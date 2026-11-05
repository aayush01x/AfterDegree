"""Small builders for Crustdata filter trees (person and job search)."""

from __future__ import annotations

from typing import Any

from . import taxonomy as tx

EMP = "experience.employment_details"
CUR = f"{EMP}.current"
PAST = f"{EMP}.past"
EDU = "education.schools"


def cond(field: str, op: str, value: Any) -> dict:
    return {"field": field, "type": op, "value": value}


def _group(op: str, conditions: list[dict | None]) -> dict | None:
    conds = [c for c in conditions if c]
    if not conds:
        return None
    if len(conds) == 1 and op in ("and", "or"):
        return conds[0]
    return {"op": op, "conditions": conds}


def and_(*conditions: dict | None) -> dict | None:
    return _group("and", list(conditions))


def or_(*conditions: dict | None) -> dict | None:
    return _group("or", list(conditions))


def all_of(*conditions: dict | None) -> dict | None:
    conds = [c for c in conditions if c]
    return {"op": "all_of", "conditions": conds} if conds else None


def phrase_any(field: str, phrases: list[str]) -> dict | None:
    """OR of case-insensitive exact-phrase matches."""
    uniq = list(dict.fromkeys(p for p in phrases if p))
    return or_(*[cond(field, "[.]", p) for p in uniq])


def role_condition(field: str, role: str) -> dict | None:
    """Title condition for a role phrase. Uses [.] (no typo matches) on the phrase."""
    role = role.strip()
    if not role:
        return None
    return cond(field, "[.]", role)


# ------------------------------------------------------------------ person-side building blocks


def person_country(country: str) -> dict:
    variants = tx.country_variants(country)
    return cond("basic_profile.location.country", "in", variants)


def person_city(city: str) -> dict:
    """Real profiles often leave `city` empty and keep the place only in full_location ("Delhi, India",
    "Berlin Metropolitan Area"), so match either."""
    variants = tx.city_variants(city)
    return or_(cond("basic_profile.location.city", "in", variants), phrase_any("basic_profile.location.full_location", variants))  # type: ignore[return-value]


def person_not_country(country: str) -> dict:
    return cond("basic_profile.location.country", "not_in", tx.country_variants(country))


def person_has_country() -> dict:
    return cond("basic_profile.location.country", "is_not_null", None)


def india_educated() -> dict:
    """Someone with a school located in India, or at a well-known Indian institution."""
    phrases = [p for tier in tx.SCHOOL_TIERS for p in tier.phrases]
    return or_(cond(f"{EDU}.location.country", "=", "India"), phrase_any(f"{EDU}.school", phrases))


def education_group(
    schools: list[str] | None = None,
    school_phrases: list[str] | None = None,
    field_phrase: str | None = None,
    end_year_range: tuple[int, int] | None = None,
    india_located: bool = False,
) -> dict | None:
    """Conditions that must hold on ONE education element (a plain `and` on a nested array)."""
    parts: list[dict | None] = []
    if schools:
        parts.append(cond(f"{EDU}.school", "in", list(dict.fromkeys(schools))))
    if school_phrases:
        parts.append(phrase_any(f"{EDU}.school", school_phrases))
    if field_phrase:
        parts.append(phrase_any(f"{EDU}.field_of_study", tx.field_search_phrases(field_phrase)))
    if end_year_range:
        lo, hi = end_year_range
        parts.append(cond(f"{EDU}.end_year", "=>", int(lo)))
        parts.append(cond(f"{EDU}.end_year", "=<", int(hi)))
    if india_located:
        parts.append(cond(f"{EDU}.location.country", "=", "India"))
    return and_(*parts)


def intern_title_condition(path: str = EMP) -> dict:
    return phrase_any(
        f"{path}.title",
        ["Intern", "Internship", "Working Student", "Werkstudent", "Praktikant", "Co-op"],
    )  # type: ignore[return-value]


def company_condition(path: str, company: str | None = None, company_id: int | None = None) -> dict | None:
    if company_id:
        return cond(f"{path}.company_id", "=", int(company_id))
    if company:
        return cond(f"{path}.company_name", "[.]", company)
    return None


# ------------------------------------------------------------------ job-side building blocks


def job_title(role: str) -> dict:
    return cond("job_details.title", "[.]", role.strip())


def job_country(country: str) -> dict:
    return cond("location.country", "in", tx.country_variants(country))


def job_city(city: str) -> dict:
    """Postings carry a geocoded `location.city` that is sometimes empty; `location.raw` keeps the text."""
    variants = tx.city_variants(city)
    return or_(cond("location.city", "in", variants), phrase_any("location.raw", variants))  # type: ignore[return-value]


def job_date_range(start_iso: str | None = None, end_iso: str | None = None) -> list[dict]:
    out = []
    if start_iso:
        out.append(cond("metadata.date_added", "=>", start_iso))
    if end_iso:
        out.append(cond("metadata.date_added", "<", end_iso))
    return out


def describe(filters: dict | None) -> str:
    """Plain-text rendering of a filter tree for evidence notes."""
    if not filters:
        return "(no filters)"
    if "field" in filters:
        v = filters.get("value")
        return f"{filters['field']} {filters['type']} {v!r}"
    inner = f" {filters['op'].upper()} ".join(describe(c) for c in filters.get("conditions", []))
    return f"({inner})"
