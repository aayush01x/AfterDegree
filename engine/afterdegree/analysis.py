"""Deterministic career analysis over parsed profiles: intern conversion, routes, entry points."""

from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date

from . import taxonomy as tx
from .profile import ParsedPerson, Role, School, further_degrees, years_between, years_of_experience

# ------------------------------------------------------------------ internship conversion


@dataclass
class InternOutcome:
    company_key: str
    company: str
    country: str | None
    converted: bool
    ongoing: bool


def intern_outcomes(
    person: ParsedPerson,
    role_filter: Callable[[Role], bool] | None = None,
) -> list[InternOutcome]:
    """One outcome per (person, company) where they interned: did a full-time role at the
    same company follow? Internships still running are marked ongoing (not counted)."""
    roles = person.roles_sorted()
    seen: set[str] = set()
    out: list[InternOutcome] = []
    for r in roles:
        if not r.is_intern:
            continue
        if role_filter is not None and not role_filter(r):
            continue
        key = r.company_key()
        if not key or key in seen:
            continue
        seen.add(key)
        ongoing = r.current or r.end is None
        later_ft = [
            r2
            for r2 in roles
            if r2 is not r
            and not r2.is_intern
            and r2.company_key() == key
            and (r2.start is None or r.start is None or r2.start >= r.start)
        ]
        converted = bool(later_ft)
        if converted:
            ongoing = False
        out.append(InternOutcome(key, r.company or "Unknown company", r.country or r.hq_country, converted, ongoing))
    return out


@dataclass
class ConversionTally:
    interns: int = 0
    converted: int = 0
    ongoing: int = 0
    label: str = ""


def tally_by(outcomes: list[InternOutcome], key: Callable[[InternOutcome], str | None]) -> dict[str, ConversionTally]:
    out: dict[str, ConversionTally] = defaultdict(ConversionTally)
    for o in outcomes:
        k = key(o)
        if not k:
            continue
        t = out[k]
        t.label = t.label or k
        if o.ongoing:
            t.ongoing += 1
            continue
        t.interns += 1
        t.converted += int(o.converted)
    return dict(out)


def company_display(outcomes: list[InternOutcome]) -> dict[str, str]:
    names: dict[str, Counter] = defaultdict(Counter)
    for o in outcomes:
        names[o.company_key][o.company] += 1
    return {k: c.most_common(1)[0][0] for k, c in names.items()}


# ------------------------------------------------------------------ routes


def find_target_role(person: ParsedPerson, role: str | None, company: str | None = None, company_id: int | None = None) -> Role | None:
    current = person.current_roles()
    cands = current or []
    if company_id:
        by_id = [r for r in cands if r.company_id and int(r.company_id) == int(company_id)]
        cands = by_id or cands
    elif company:
        low = company.lower()
        by_name = [r for r in cands if r.company and low in r.company.lower()]
        cands = by_name or cands
    if role:
        matching = [r for r in cands if tx.title_matches_role(r.title, role)]
        if matching:
            cands = matching
    if not cands:
        return None
    return max(cands, key=lambda r: r.start or date(1900, 1, 1))


def _work_band(years: float) -> str:
    if years < 2:
        return "under 2 years"
    if years < 4:
        return "2–4 years"
    return "4+ years"


def india_work_years(person: ParsedPerson, before: date | None, today: date) -> float:
    roles = [
        r
        for r in person.roles
        if not r.is_intern and r.start and (before is None or r.start < before) and (r.country in (None, "India") and _role_in_india(r))
    ]
    clipped = []
    for r in roles:
        end = r.end or today
        if before and end > before:
            end = before
        clipped.append(Role(r.company, r.company_id, r.title, r.start, end, False))
    return years_of_experience(clipped, today)


def _role_in_india(r: Role) -> bool:
    if r.country:
        return r.country == "India"
    if r.hq_country == "India":
        return True
    return r.country is None and r.hq_country in (None, "India")


def bachelor_step(ug: School | None) -> str | None:
    if ug is None:
        return None
    if ug.country == "India" or (ug.country is None and tx.looks_indian_school(ug.school)):
        return "Bachelor's in India"
    return f"Bachelor's in {ug.country}" if ug.country else "Bachelor's (country not listed)"


def route_steps(person: ParsedPerson, target: Role, target_label: str, today: date) -> list[str]:
    steps: list[str] = []
    ug = person.undergrad()
    b = bachelor_step(ug)
    if b:
        steps.append(b)
    t_start = target.start or today
    iw = india_work_years(person, t_start, today)
    if iw >= 0.5:
        steps.append("Worked in India first")
    for s in sorted(further_degrees(person), key=lambda s: s.end_year or 0):
        if s.end_year and s.end_year > t_start.year + 1:
            continue
        where = s.country or "a country not listed"
        steps.append(f"{s.level} in {where}")
    prior = [r for r in person.roles_sorted() if r is not target and r.start and r.start < t_start]
    tkey = target.company_key()
    abroad_interns = {
        r.country or r.hq_country
        for r in prior
        if r.is_intern and (r.country or r.hq_country) not in (None, "India") and r.company_key() != tkey
    }
    for c in sorted(abroad_interns):
        steps.append(f"Internship / working student in {c}")
    target_country = target.country or target.hq_country
    abroad_jobs = {
        r.country or r.hq_country
        for r in prior
        if not r.is_intern and (r.country or r.hq_country) not in (None, "India", target_country) and r.company_key() != tkey
    }
    for c in sorted(abroad_jobs):
        steps.append(f"Earlier job in {c}")
    if any(not r.is_intern and (r.country or r.hq_country) == target_country and r.company_key() != tkey
           for r in prior if target_country not in (None, "India")):
        steps.append(f"Earlier job in {target_country}")
    if any(r.company_key() == target.company_key() and not r.is_intern for r in prior):
        steps.append("Moved up inside the same company")
    elif any(r.company_key() == target.company_key() and r.is_intern for r in prior):
        steps.append("Converted an internship there")
    steps.append(target_label)
    out: list[str] = []
    for s in steps:
        if not out or out[-1] != s:
            out.append(s)
    return out


def years_to_target(person: ParsedPerson, target: Role) -> float | None:
    ug = person.undergrad()
    if not ug or not ug.end_year or not target.start:
        return None
    return round(max(0.0, years_between(date(ug.end_year, 6, 1), target.start)), 1)


def user_steps(profile: dict, today: date) -> set[str]:
    """Route steps the signed-in user has already completed (from their stored profile)."""
    from .profile import School as _School  # local import keeps module graph simple

    person = profile.get("person") or {}
    done: set[str] = set()
    schools = [
        _School(e.get("school"), e.get("degree"), e.get("field"), e.get("start_year"), e.get("end_year"), e.get("school_country"), tx.degree_level(e.get("degree")))
        for e in person.get("education") or []
    ]
    from .profile import pick_undergrad

    ug = pick_undergrad(schools)
    b = bachelor_step(ug)
    if b:
        done.add(b)
    for s in schools:
        if s is not ug and s.level in ("Master's", "MBA", "PhD"):
            done.add(f"{s.level} in {s.country or 'a country not listed'}")
    years = (profile.get("derived") or {}).get("years_experience") or 0
    if years >= 0.5:
        done.add("Worked in India")
    return done


def route_gaps(route: list[str], done: set[str]) -> list[str]:
    gaps = []
    for step in route[:-1]:
        if step.startswith("Worked in India"):
            if "Worked in India" not in done:
                gaps.append("Work experience in India before moving")
            continue
        if step in done or step.startswith("Bachelor's"):
            continue
        if step in ("Moved up inside the same company", "Converted an internship there"):
            continue
        gaps.append(step)
    return gaps


def route_fits(route: list[str], done: set[str]) -> bool:
    bachelor = next((s for s in route if s.startswith("Bachelor's")), None)
    user_bachelor = next((s for s in done if s.startswith("Bachelor's")), None)
    if bachelor and user_bachelor and bachelor != user_bachelor:
        return False
    needs_work = any(s.startswith("Worked in India") for s in route)
    if needs_work and "Worked in India" not in done:
        return False
    return True


def previous_role(person: ParsedPerson, target: Role) -> Role | None:
    t_start = target.start
    prior = [r for r in person.roles_sorted() if r is not target and r.start and (t_start is None or r.start <= t_start)]
    return prior[-1] if prior else None


def feeder_role(person: ParsedPerson, target: Role) -> Role | None:
    """Last role at a different company before joining the target company."""
    key = target.company_key()
    t_start = target.start
    first_at_target = min(
        (r.start for r in person.roles if r.company_key() == key and r.start),
        default=t_start,
    )
    prior = [r for r in person.roles_sorted() if r.company_key() != key and r.start and (first_at_target is None or r.start < first_at_target)]
    return prior[-1] if prior else None


def highest_degree(person: ParsedPerson) -> School | None:
    order = {"PhD": 4, "MBA": 3, "Master's": 3, "Bachelor's": 2, None: 1, "School": 0}
    schools = [s for s in person.schools if s.school and s.level != "School"]
    if not schools:
        return None
    return max(schools, key=lambda s: (order.get(s.level, 1), s.end_year or 0))


def experience_at_entry(person: ParsedPerson, target: Role, today: date) -> float | None:
    if not target.start:
        return None
    before = [r for r in person.roles if r is not target and r.start and r.start < target.start]
    clipped = [Role(r.company, r.company_id, r.title, r.start, min(r.end or today, target.start), False) for r in before if not r.is_intern]
    return years_of_experience(clipped, target.start)
