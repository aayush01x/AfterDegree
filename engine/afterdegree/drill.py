"""Drill-down (CONTRACT Appendix C) and company profile (Appendix D).

A drill starts from the exact cohort of the screen it was clicked on: the origin tool's own
cohort/filter-building code is re-run with the token's params (its count queries are cached),
then every path step is applied as an extra filter. Nothing is widened silently: a step that
can't be expressed as a filter is refused, and a step that can only be matched approximately
says so in `warnings`.

Counting rules (the "sample vs total" lesson):
- the headline count and every breakdown row are EXACT totals from count-only searches;
- a capped sample of the slice is read only to pick which rows to count, to draw anonymous
  career paths, and for facts that need whole profiles (routes, tenure); those carry
  `sample_n` and use the sample size as their denominator, never the exact total.
- count-only queries for the headline run before the sample, and the sample leaves credits
  for the per-row counts that follow it.
"""

from __future__ import annotations

import copy
import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from urllib.parse import urlparse

from . import filters as F
from . import taxonomy as tx
from .analysis import feeder_role, intern_outcomes, route_steps
from .cohort import build_cohort, plan_for_level, university_plan
from .crustdata import BudgetExceeded, CrustdataError
from .people import card_for, half_years, path_signature, person_id, privacy_violations, scrub_person_output, top_skills
from .profile import ParsedPerson, Role, further_degrees, parse_person, years_between
from .schemas import Cohort, DrillResult, DrillToken, NextStep
from .stats import MIN_ROW_COUNT, make_count, median, share_of
from .toolkit import PERSON_SAMPLE_FIELDS, ToolContext, ToolInputError, iso, months_ago, section
from .tools.common import company_value, job_title_or, resolve_place, title_or
from .tools.internship_chances import intern_element

log = logging.getLogger("afterdegree.drill")

ORIGIN_LABEL = {
    "people_like_me": "People Like Me",
    "internship_chances": "Internship Chances",
    "conversion_map": "Conversion Map",
    "reverse_gps": "Reverse Career GPS",
    "routes_to_position": "Routes to Positions",
    "job_postings": "Job Postings",
    "indian_friendly": "Indian-Friendly",
    "market_saturation": "Market Saturation",
}
MATCH_LABEL = {"exact_school": "same college and field", "school_tier": "similar colleges, same field",
               "field_only": "same field, any college"}
BLOCKED = "Fewer than 5 people match, so we don't list individuals."
DRILL_FIELDS = [*PERSON_SAMPLE_FIELDS, "skills"]
HOME = "India"
COUNT_COST = 0.25  # worst-case credits of one count-only person search

LEVEL_PHRASES = {
    "Bachelor's": ["Bachelor", "BTech", "B.Tech", "B.E.", "BSc", "B.Sc"],
    "Master's": ["Master", "MSc", "M.Sc", "MS", "MEng", "M.Tech", "MTech"],
    "MBA": ["MBA", "PGDM", "Master of Business Administration"],
    "PhD": ["PhD", "Ph.D", "Doctor of Philosophy", "Doctorate"],
}
FURTHER_PHRASES = LEVEL_PHRASES["Master's"] + LEVEL_PHRASES["MBA"] + LEVEL_PHRASES["PhD"]
DEGREE_LABELS = {"MS / MSc / MEng": "Master's", "MBA": "MBA", "PhD": "PhD", "Master's": "Master's"}
JOB_SENIORITY_PHRASES = {
    "Internship / working student": ["Intern", "Internship", "Working Student", "Werkstudent", "Praktikant"],
    "Entry level": ["Junior", "Jr", "Graduate", "Entry Level", "Trainee", "Associate"],
    "Senior": ["Senior", "Sr"],
    "Lead / principal": ["Lead", "Principal", "Staff", "Architect"],
    "Manager and above": ["Manager", "Head of", "Director", "VP", "Vice President", "Chief"],
}
SPONSOR_PHRASES = ["visa sponsorship", "sponsor your visa", "relocation support", "relocation package", "Blue Card"]
ISO3 = {"DEU": "Germany", "USA": "United States", "GBR": "United Kingdom", "NLD": "Netherlands", "IRL": "Ireland", "IND": "India",
        "CAN": "Canada", "FRA": "France", "CHE": "Switzerland", "SWE": "Sweden", "AUS": "Australia", "SGP": "Singapore",
        "ARE": "United Arab Emirates", "JPN": "Japan", "ESP": "Spain", "ITA": "Italy", "POL": "Poland", "AUT": "Austria",
        "BEL": "Belgium", "DNK": "Denmark", "FIN": "Finland", "NOR": "Norway", "PRT": "Portugal", "CZE": "Czechia",
        "ROU": "Romania", "CHN": "China", "ISR": "Israel", "BRA": "Brazil", "NZL": "New Zealand", "LUX": "Luxembourg"}
ISO2_NAME = {**{v: k for k, v in tx.ISO2.items()}, "DE": "Germany", "US": "United States", "GB": "United Kingdom", "UK": "United Kingdom",
             "NL": "Netherlands", "IE": "Ireland", "IN": "India", "CA": "Canada", "FR": "France", "CH": "Switzerland", "SE": "Sweden",
             "AU": "Australia", "SG": "Singapore", "AE": "United Arab Emirates", "JP": "Japan", "ES": "Spain", "IT": "Italy",
             "PL": "Poland", "AT": "Austria", "BE": "Belgium", "DK": "Denmark", "FI": "Finland", "NO": "Norway", "PT": "Portugal",
             "CZ": "Czechia", "RO": "Romania", "CN": "China", "IL": "Israel", "BR": "Brazil", "LU": "Luxembourg"}
ATS_HOSTS = ("greenhouse.io", "lever.co", "myworkdayjobs.com", "smartrecruiters.com", "ashbyhq.com", "personio.de", "personio.com",
             "recruitee.com", "workable.com", "successfactors.com", "successfactors.eu", "teamtailor.com")
GOAL_CACHE: dict[str, Any] = {}


# ------------------------------------------------------------------ scope


@dataclass
class Scope:
    """The origin cohort plus every path step, as structured filters (people side and postings side)."""

    tool: str
    noun: str
    kind: str = "people"  # "people" | "jobs"
    base: list[dict] = field(default_factory=list)
    origin_place: dict | None = None
    origin_city: str | None = None
    origin_country: str | None = None
    country: str | None = None
    city: str | None = None
    company: tuple[str | None, int | None] | None = None  # current employer from a path step
    window: tuple[date, date | None] | None = None  # current role start window (market saturation)
    extra: list[dict] = field(default_factory=list)
    intern_origin: bool = False
    # postings side (job_postings origin, or a company's hiring facts)
    job_base: list[dict] = field(default_factory=list)
    job_origin_place: dict | None = None
    job_window: tuple[date, date | None] | None = None
    job_extra: list[dict] = field(default_factory=list)
    job_company: dict | None = None
    job_only_steps: list[str] = field(default_factory=list)
    cohort: Cohort | None = None
    notes: list[str] = field(default_factory=list)
    facets: set[str] = field(default_factory=set)  # dimensions already fixed (origin or path)
    role_label: str | None = None
    place_label: str | None = None
    built: Any = None  # the origin BuiltCohort: filters are composed exactly as the tool does (same cache keys)

    def people_filters(self, *more: dict | None) -> dict:
        parts: list[dict | None] = [self.origin_place]
        if self.country:
            parts.append(F.person_country(self.country))
        if self.city:
            parts.append(F.person_city(self.city))
        if self.company:
            parts.append(F.company_condition(F.CUR, self.company[0], self.company[1]))
        if self.window:
            parts.append(F.cond(f"{F.CUR}.start_date", "=>", iso(self.window[0])))
            if self.window[1]:
                parts.append(F.cond(f"{F.CUR}.start_date", "<", iso(self.window[1])))
        parts += self.extra
        parts += list(more)
        if self.built is not None:
            return self.built.filters(*parts)
        return F.and_(*self.base, *parts) or F.india_educated()

    def job_filters(self, *more: dict | None) -> dict:
        parts: list[dict | None] = [*self.job_base, self.job_origin_place, self.job_company]
        if self.country:
            parts.append(F.job_country(self.country))
        if self.city:
            parts.append(F.job_city(self.city))
        if self.job_window:
            parts += F.job_date_range(iso(self.job_window[0]), iso(self.job_window[1]) if self.job_window[1] else None)
        parts += self.job_extra
        parts += list(more)
        return F.and_(*parts) or {}


# ------------------------------------------------------------------ origin cohorts (reusing each tool's own code)


async def _goal(ctx: ToolContext):
    from .tools.reverse_gps import parse_goal

    key = repr(sorted((k, str(v)) for k, v in ctx.params.items()))
    if key not in GOAL_CACHE:
        goal, _how = await parse_goal(ctx)
        GOAL_CACHE[key] = goal
    return GOAL_CACHE[key]


def _place(city: str | None, country: str | None) -> tuple[dict | None, dict | None]:
    if city:
        return F.person_city(city), F.job_city(city)
    if country:
        return F.person_country(country), F.job_country(country)
    return None, None


async def build_origin(ctx: ToolContext, tool: str, p: dict) -> Scope:
    today = ctx.today
    if tool == "people_like_me":
        built = await build_cohort(ctx, p.get("match") or "exact_school", _exp_band(p.get("exp_band")))
        university = bool(p.get("institution") or ctx.is_university)
        sc = Scope(tool, "your graduates" if university else "people like you", built=built, cohort=built.model())
        if built.widened_reason:
            sc.notes.append(built.widened_reason)
        return sc

    if tool == "internship_chances":
        _, country = resolve_place(None, p.get("country"))
        company = (p.get("company") or "").strip() or None
        role = (p.get("role") or "").strip() or None
        cid, cname = (await ctx.identify_company(company)) if company else (None, None)
        extra = [intern_element(cname, cid, country)] + ([title_or(F.EMP, role)] if role else [])
        built = await build_cohort(ctx, "exact_school", extra=extra, noun="former interns or working students", min_n=25)
        sc = Scope(tool, "interns like you", built=built, cohort=built.model(), intern_origin=True)
        if built.widened_reason:
            sc.notes.append(built.widened_reason)
        return sc

    if tool == "conversion_map":
        scope = p.get("scope") or {}
        _, country = resolve_place(None, scope.get("country"))
        role = (scope.get("role") or "").strip() or None
        school = (scope.get("school") or "").strip() or None
        fld = (scope.get("field") or "").strip() or None
        extra = [intern_element(None, None, country)] + ([title_or(F.EMP, role)] if role else [])
        if school or fld:
            variants = await ctx.school_variants(school) if school else None
            _, phrase = tx.normalise_field(fld) if fld else (None, None)
            filters = F.and_(F.education_group(schools=variants, field_phrase=phrase), *extra) or {}
            definition = "Interns who studied " + " at ".join(
                x for x in [tx.normalise_field(fld)[0] if fld else None, tx.short_school(school) if school else None] if x)
            cohort = Cohort(definition=definition, filters={"school": school, "field": fld, "country": country, "role": role},
                            n_visible=0, match_level="exact_school" if school else "field_only")
            return Scope(tool, "interns from this scope", base=[filters], cohort=cohort, intern_origin=True)
        built = await build_cohort(ctx, "field_only", extra=extra, noun="former interns or working students", min_n=25)
        sc = Scope(tool, "interns like you", built=built, cohort=built.model(), intern_origin=True)
        if built.widened_reason:
            sc.notes.append(built.widened_reason)
        return sc

    if tool in ("reverse_gps", "routes_to_position"):
        if tool == "reverse_gps":
            goal = await _goal(ctx)
            if not goal.role:
                raise ToolInputError("I couldn't find a role in that goal.", hint='Try something like "Data engineer in Munich".')
            role, city, country, company = goal.role, goal.city, goal.country, goal.company
        else:
            role = (p.get("role") or "").strip()
            if not role:
                raise ToolInputError("Which role should I look at?", hint="Add a role, for example Data Engineer.")
            city, country = resolve_place(p.get("city"), p.get("country"))
            company = (p.get("company") or "").strip() or None
        cid = None
        if company:
            cid, company = await ctx.identify_company(company)
        place_p, _ = _place(city, country)
        base = [title_or(F.CUR, role)]
        if company:
            base.append(F.company_condition(F.CUR, company, cid))
        noun = "people in this position"
        if tool == "reverse_gps":
            target = F.and_(*base, place_p) or {}
            n_like, _ = await ctx.count_people_safe(F.and_(target, F.india_educated()) or {}, "People in the goal position who studied in India")
            noun = "people in your goal position"
            if (n_like or 0) >= 10:
                base.append(F.india_educated())
                noun = "Indian-educated people in your goal position"
        sc = Scope(tool, noun, base=base, origin_place=place_p, origin_city=city, origin_country=country,
                   role_label=tx.display_role(role), place_label=city or country)
        sc.facets |= {"role"} | ({"company"} if company else set()) | ({"city"} if city else set()) | ({"country"} if country else set())
        return sc

    if tool == "job_postings":
        role = (p.get("role") or "").strip()
        if not role:
            raise ToolInputError("Which role should I look at?", hint="Add a role, for example Data Engineer.")
        city, country = resolve_place(p.get("city"), p.get("country"), required_country=True)
        place_p, place_j = _place(city, country)
        role_label = tx.display_role(role)
        sc = Scope(tool, f"people working as {role_label}", kind="jobs", base=[title_or(F.CUR, role)], origin_place=place_p,
                   origin_city=city, origin_country=country, job_base=[job_title_or(role)], job_origin_place=place_j,
                   job_window=(date.fromordinal(today.toordinal() - 90), None), role_label=role_label, place_label=city or country)
        sc.facets |= {"role", "country"} | ({"city"} if city else set())
        return sc

    if tool == "indian_friendly":
        city, country = resolve_place(p.get("city"), p.get("country"), required_country=True)
        role = (p.get("role") or "").strip() or None
        place_p, _ = _place(city, country)
        base = [F.india_educated(), F.cond(f"{F.CUR}.name", "is_not_null", None)]
        if role:
            base.append(title_or(F.CUR, role))
        sc = Scope(tool, "Indian-educated people", base=base, origin_place=place_p, origin_city=city, origin_country=country,
                   role_label=tx.display_role(role) if role else None, place_label=city or country)
        sc.facets |= {"country"} | ({"city"} if city else set()) | ({"role"} if role else set())
        return sc

    if tool == "market_saturation":
        from .tools.market_saturation import QUARTERS, quarter_starts

        role = (p.get("role") or "").strip()
        if not role:
            raise ToolInputError("Which role should I look at?", hint="Add a role, for example Data Engineer.")
        city, country = resolve_place(p.get("city"), p.get("country"), required_country=True)
        plan = await plan_for_level(ctx, "field_only", with_years=False)
        if p.get("institution") or ctx.is_university:
            inst = p.get("institution") or ctx.goals.get("institution")
            if inst:
                plan = await university_plan(ctx, inst, p.get("programs") or ctx.goals.get("programs"))
        background = plan.filters() if plan else F.india_educated()
        bounds = quarter_starts(today, QUARTERS)
        place_p, _ = _place(city, country)
        sc = Scope(tool, "new entrants like you", base=[background, title_or(F.CUR, role)], origin_place=place_p,
                   origin_city=city, origin_country=country, window=(bounds[0], bounds[-1]),
                   role_label=tx.display_role(role), place_label=city or country)
        sc.facets |= {"role", "country"} | ({"city"} if city else set())
        return sc

    raise ToolInputError("That link doesn't point at a group I can open.", hint="Go back and pick a count again.")


def _exp_band(v: Any) -> list[float] | None:
    if v in (None, "", []):
        return None
    if isinstance(v, str):
        v = [x for x in v.split(",") if x.strip()]
    try:
        return [float(x) for x in v][:2]
    except (TypeError, ValueError):
        return None


# ------------------------------------------------------------------ path steps → filters


def _unsupported(label: str, why: str) -> ToolInputError:
    return ToolInputError(f"I can't open \"{label}\" as its own group: {why}",
                          hint="Pick another count on the page; this one can't be filtered exactly.")


def role_condition(path: str, label: str) -> tuple[dict, bool]:
    """Title condition for a role-family label. Returns (condition, approximate)."""
    lab = label.strip()
    if lab == "Intern / Working Student":
        return F.intern_title_condition(path), False
    m = re.match(r"^(.*?)\s*\(other\)$", lab)
    if m:
        return F.phrase_any(f"{path}.title", [m.group(1)]), True  # type: ignore[return-value]
    if "/" in lab and lab not in tx.ROLE_SYNONYMS:
        return F.phrase_any(f"{path}.title", [x.strip() for x in lab.split("/") if x.strip()]), True  # type: ignore[return-value]
    return title_or(path, lab), False


def exact_role(label: str) -> bool:
    return label != "Intern / Working Student" and not role_condition(F.CUR, label)[1] and label != "Founder"


def school_condition(value: str) -> dict:
    for tier in tx.SCHOOL_TIERS:
        if tier.label.split(" (")[0].lower() == value.lower():
            return F.phrase_any(f"{F.EDU}.school", list(tier.phrases))  # type: ignore[return-value]
    return F.cond(f"{F.EDU}.school", "[.]", value)


def further_degree_in(country: str) -> dict:
    return F.and_(F.cond(f"{F.EDU}.location.country", "in", tx.country_variants(country)),
                  F.phrase_any(f"{F.EDU}.degree", FURTHER_PHRASES))  # type: ignore[return-value]


def years_band_range(value: str) -> tuple[float | None, float | None] | None:
    v = value.replace("yrs", "years")
    if (m := re.search(r"(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)", v)):
        return float(m.group(1)), float(m.group(2))
    if (m := re.search(r"under\s*(\d+(?:\.\d+)?)", v, re.I)):
        return 0.0, float(m.group(1))
    if (m := re.search(r"(\d+(?:\.\d+)?)\s*\+", v)):
        return float(m.group(1)), None
    return None


def route_step_condition(label: str) -> tuple[dict | None, str | None]:
    """One route step (analysis.route_steps label) → a filter. Returns (condition, note when it can't be applied)."""
    if label.startswith("Bachelor's in "):
        country = label[len("Bachelor's in "):]
        if country == HOME:
            return F.india_educated(), None
        return F.and_(F.cond(f"{F.EDU}.location.country", "in", tx.country_variants(country)),
                      F.phrase_any(f"{F.EDU}.degree", LEVEL_PHRASES["Bachelor's"])), None
    if label.startswith("Worked in India"):
        return F.cond(f"{F.EMP}.location", "[.]", HOME), None
    if (m := re.match(r"^(Master's|MBA|PhD) in (.+)$", label)):
        level, where = m.group(1), m.group(2)
        deg = F.phrase_any(f"{F.EDU}.degree", LEVEL_PHRASES[level])
        if where == "a country not listed":
            return deg, None
        return F.and_(deg, F.cond(f"{F.EDU}.location.country", "in", tx.country_variants(where))), None
    if (m := re.match(r"^Internship / working student in (.+)$", label)):
        return F.and_(F.intern_title_condition(F.EMP), F.cond(f"{F.EMP}.location", "[.]", m.group(1))), None
    if (m := re.match(r"^Earlier job in (.+)$", label)):
        return F.cond(f"{F.PAST}.location", "[.]", m.group(1)), None
    if label in ("Moved up inside the same company", "Converted an internship there"):
        return None, f"the step '{label}' can't be searched directly, so it isn't applied to the count"
    return None, None


def _company_ref(value: str) -> tuple[str | None, int | None, bool]:
    v = value.strip()
    feeder = v.startswith("feeder:")
    if feeder:
        v = v[len("feeder:"):]
    if v.isdigit():
        return None, int(v), feeder
    return v or None, None, feeder


def apply_step(ctx: ToolContext, sc: Scope, step: dict) -> None:
    dim, value, label = step["dimension"], str(step["value"]), step.get("label") or str(step["value"])
    sc.facets.add(dim)
    if dim == "country":
        country = tx.canonical_country(value) or value
        if sc.origin_country and sc.origin_country != country:
            sc.origin_place, sc.job_origin_place, sc.origin_city = None, None, None  # a sibling country, not a narrowing
        if sc.city and tx.country_for_city(sc.city) not in (None, country):
            sc.city = None
        sc.country = country
        return
    if dim == "city":
        city = tx.canonical_city(value) or value
        if sc.origin_city and sc.origin_city != city:
            sc.origin_place, sc.job_origin_place = None, None  # a comparable city chosen on the origin screen
            if sc.origin_country:
                sc.country = sc.country or sc.origin_country
        sc.city = city
        return
    if dim in ("company", "posting_employer"):
        name, cid, feeder = _company_ref(value)
        name = name or (label if not cid else None)
        if feeder:
            sc.extra.append(F.company_condition(F.PAST, label if cid else name, cid))  # type: ignore[arg-type]
            sc.facets.discard("company")
            return
        if sc.intern_origin and dim == "company":
            sc.extra.append(intern_element(name, cid, None))
        elif sc.company:
            sc.extra.append(F.company_condition(F.CUR, name, cid))  # type: ignore[arg-type]
        else:
            sc.company = (name, cid)
        sc.job_company = F.cond("company.basic_info.company_id", "=", cid) if cid else F.cond("company.basic_info.name", "[.]", name)
        return
    if dim == "role":
        if value.startswith("previous:"):
            cond, approx = role_condition(F.PAST, value[len("previous:"):])
            sc.extra.append(cond)
            sc.facets.discard("role")
            if approx:
                sc.notes.append(f"'{label}' groups several titles, so this counts every earlier title containing it.")
            return
        cond, approx = role_condition(F.CUR, value)
        sc.extra.append(cond)
        if approx:
            sc.notes.append(f"'{label}' groups several titles, so this counts every current title containing it.")
        return
    if dim == "school":
        sc.extra.append(school_condition(value))
        return
    if dim == "degree":
        level = DEGREE_LABELS.get(value)
        if not level:
            raise _unsupported(label, "it isn't a degree level I can search for.")
        sc.extra.append(F.phrase_any(f"{F.EDU}.degree", LEVEL_PHRASES[level]))  # type: ignore[arg-type]
        return
    if dim == "degree_country":
        if value.lower().startswith(("country not", "other", "no ")):
            raise _unsupported(label, "the country isn't listed on these profiles.")
        sc.extra.append(further_degree_in(tx.canonical_country(value) or value))
        return
    if dim == "years_band":
        if value.startswith("entry:"):
            raise _unsupported(label, "years of experience at the time of joining are worked out from whole profiles, not searchable.")
        rng = years_band_range(value)
        if not rng:
            raise _unsupported(label, "I can't read that experience range.")
        lo, hi = rng
        if lo is not None:
            sc.extra.append(F.cond("years_of_experience_raw", "=>", lo))
        if hi is not None:
            sc.extra.append(F.cond("years_of_experience_raw", "=<", hi))
        return
    if dim == "seniority":
        if value in tx.SENIORITY_LEVEL_RANK:
            sc.extra.append(F.cond(f"{F.CUR}.seniority_level", "=", value))
            return
        phrases = JOB_SENIORITY_PHRASES.get(value)
        if not phrases:
            raise _unsupported(label, "titles that state no seniority can't be searched for.")
        sc.job_extra.append(F.phrase_any("job_details.title", phrases))  # type: ignore[arg-type]
        sc.job_only_steps.append(label)
        sc.notes.append(f"'{label}' counts job titles containing {', '.join(phrases[:3])} or similar words.")
        return
    if dim == "skill":
        sc.job_extra.append(F.cond("content.description", "[.]", value))
        if sc.kind == "jobs":
            sc.job_only_steps.append(label)
        else:
            sc.extra.append(F.cond("skills.professional_network_skills", "[.]", value))
        return
    if dim == "language":
        if value.lower().startswith("english only"):
            raise _unsupported(label, "a posting that asks for no other language can't be searched for directly.")
        m = re.search(r"(German|Dutch|French|Swedish|Danish|Norwegian|Finnish|Spanish|Italian|Polish|Japanese)", value)
        if not m:
            raise _unsupported(label, "I can't tell which language it means.")
        native = {"German": "Deutsch", "Dutch": "Nederlands", "French": "Français", "Spanish": "Español"}.get(m.group(1))
        sc.job_extra.append(F.phrase_any("content.description", [m.group(1)] + ([native] if native else [])))  # type: ignore[arg-type]
        sc.job_only_steps.append(label)
        sc.notes.append(f"'{label}' counts every posting that mentions {m.group(1)}, including ones where it is only a plus.")
        return
    if dim == "quarter":
        if (m := re.match(r"^(\d{4})-Q([1-4])$", value)):
            start = date(int(m.group(1)), (int(m.group(2)) - 1) * 3 + 1, 1)
            end = months_ago(start, -3)
            if sc.kind == "jobs":
                sc.job_window = (start, end)
                sc.job_only_steps.append(label)
            else:
                sc.window = (start, end)
            return
        if (m := re.match(r"^(\d{4})-(\d{2})$", value)):
            start = date(int(m.group(1)), int(m.group(2)), 1)
            sc.job_window = (start, months_ago(start, -1))
            sc.job_only_steps.append(label)
            return
        raise _unsupported(label, "I can't read that period.")
    if dim in ("route", "route_step"):
        steps = [s.strip() for s in (value if " → " in value else label).split(" → ")] if dim == "route" else [value]
        applied = 0
        for st in steps:
            cond, note = route_step_condition(st)
            if cond:
                sc.extra.append(cond)
                applied += 1
            elif note:
                sc.notes.append(f"For this route, {note}.")
        if not applied:
            raise _unsupported(label, "none of its steps can be searched for.")
        if dim == "route":
            sc.notes.append("Counted people whose profiles show every step of this route; some also took extra steps along the way.")
        return
    raise _unsupported(label, "that kind of group isn't supported yet.")


# ------------------------------------------------------------------ context chips


def _without(token: DrillToken, dotted: str) -> dict:
    params = copy.deepcopy(token.params)
    head, _, rest = dotted.partition(".")
    if rest and isinstance(params.get(head), dict):
        params[head].pop(rest, None)
    else:
        params.pop(head, None)
    return {"tool": token.tool, "params": params, "path": [s.model_dump() for s in token.path]}


def context_for(token: DrillToken, sc: Scope) -> dict:
    p = token.params
    out: list[dict] = []

    def chip(label: str, value: Any, param: str | None = None, removable: bool = True) -> None:
        if value in (None, "", []):
            return
        item: dict[str, Any] = {"label": label, "value": str(value)}
        if param:
            item["param"] = param
            if removable:
                item["drill"] = _without(token, param)
        out.append(item)

    t = token.tool
    if sc.cohort is not None and t in ("people_like_me", "internship_chances", "conversion_map"):
        chip("Background", sc.cohort.definition)
    if t == "people_like_me":
        match = p.get("match") or "exact_school"
        chip("Like you", MATCH_LABEL.get(match, match), "match", removable=match != "exact_school")
        band = _exp_band(p.get("exp_band"))
        if band:
            chip("Experience", f"{band[0]:g}–{band[-1]:g} yrs", "exp_band")
    elif t == "internship_chances":
        chip("Company", p.get("company"), "company")
        chip("Role", p.get("role"), "role")
        chip("Internship in", p.get("country"), "country")
    elif t == "conversion_map":
        scope = p.get("scope") or {}
        chip("Interns and working students", f"{scope['role']} roles" if scope.get("role") else None, "scope.role")
        chip("College", scope.get("school"), "scope.school")
        chip("Field", scope.get("field"), "scope.field")
        chip("Internships in", scope.get("country"), "scope.country")
    elif t == "reverse_gps":
        if p.get("goal_text"):
            chip("Goal", p.get("goal_text"), "goal_text", removable=False)
        else:
            chip("Role", p.get("role"), "role", removable=False)
            chip("City", p.get("city"), "city")
            chip("Country", p.get("country"), "country")
            chip("Company", p.get("company"), "company")
    elif t == "routes_to_position":
        chip("Role", p.get("role"), "role", removable=False)
        chip("Company", p.get("company"), "company")
        chip("City", p.get("city"), "city")
        chip("Country", p.get("country"), "country")
    elif t in ("job_postings", "market_saturation"):
        chip("Role", p.get("role"), "role", removable=False)
        if sc.origin_city or not p.get("city"):
            chip("City", p.get("city"), "city")
        chip("Country", p.get("country"), "country", removable=False)
    elif t == "indian_friendly":
        chip("Country", p.get("country"), "country", removable=False)
        chip("Role", p.get("role"), "role")
        if sc.origin_city or not p.get("city"):
            chip("City", p.get("city"), "city")
    return {"origin_tool": t, "origin_label": ORIGIN_LABEL.get(t, t.replace("_", " ")), "filters": out}


# ------------------------------------------------------------------ exact breakdowns


@dataclass
class Candidate:
    label: str
    value: str
    cond: dict
    dimension: str


async def exact_section(ctx: ToolContext, id_: str, title: str, key: str, header: str, slice_f: dict, n: int,
                        cands: list[Candidate], other_label: str, sample_n: int, path: list[dict] | None = None,
                        kind: str = "ranked_table") -> dict | None:
    """Exact count for each candidate row (count-only searches); rows under 5 fold into the remainder."""
    if not cands or n < MIN_ROW_COUNT:
        return None
    res = await ctx.count_many([(i, F.and_(slice_f, c.cond) or {}, f"{header}: {c.label}") for i, c in enumerate(cands)])
    rows: list[tuple[Candidate, int, str | None]] = []
    for i, c in enumerate(cands):
        k, ev = res[i]
        if k is not None and k >= MIN_ROW_COUNT:
            rows.append((c, min(k, n), ev))
    rows.sort(key=lambda r: -r[1])
    ev_ids = [e for _c, _k, e in rows if e]
    shown = sum(k for _c, k, _e in rows)
    rest = n - shown
    caption = (f"Exact counts from count-only searches. The rows were picked from {sample_n} career paths read from this group"
               if sample_n else "Exact counts from count-only searches")
    caption += f"; everyone else is under '{other_label}'." if rest > 0 else "."
    if rest < 0:
        caption += " Some people hold two current roles, so rows can overlap."
    if kind == "distribution":
        items = [{"label": c.label, "count": k, "share": share_of(k, n), "drill": ctx.drill(c.dimension, c.value, c.label, path=path)}
                 for c, k, _e in rows]
        if rest > 0:
            items.append({"label": other_label, "count": rest, "share": share_of(rest, n), "remainder": True})
        return section(id_, "distribution", title, {"n": n, "items": items, "unit": "people", "caption": caption}, ev_ids).model_dump()
    out_rows = []
    for c, k, ev in rows:
        out_rows.append({"id": _slug(c.label), "cells": {key: c.label, "people": k}, "count": make_count(k, n, [ev] if ev else []).model_dump(),
                         "drill": ctx.drill(c.dimension, c.value, c.label, path=path)})
    if rest > 0 and out_rows:
        out_rows.append({"id": "other", "cells": {key: other_label, "people": rest}, "count": make_count(rest, n).model_dump(), "rest": True})
    if not out_rows:
        return None
    columns = [{"key": key, "label": header, "type": "text"}, {"key": "people", "label": "People", "type": "int", "bar": True}]
    return section(id_, "ranked_table", title, {"n": n, "columns": columns, "rows": out_rows, "caption": caption}, ev_ids).model_dump()


def _top(counter: Counter, k: int) -> list[str]:
    return [x for x, _ in counter.most_common(k)]


def city_candidates(people: list[ParsedPerson], country: str | None, k: int = 4) -> list[Candidate]:
    c = Counter(pp.city for pp in people if pp.city and (not country or pp.country in (None, country)))
    labels = _top(c, k)
    if len(labels) < 3 and country:
        labels += [x for x in tx.COMPARABLE_CITIES.get(country, []) if x not in labels][: 3 - len(labels)]
    return [Candidate(x, x, F.person_city(x), "city") for x in labels]


def country_candidates(people: list[ParsedPerson], k: int = 5) -> list[Candidate]:
    c = Counter(pp.country for pp in people if pp.country)
    return [Candidate(x, x, F.person_country(x), "country") for x in _top(c, k)]


def company_candidates(people: list[ParsedPerson], k: int = 4, exclude: int | None = None) -> list[Candidate]:
    c: Counter = Counter()
    names: dict[str, tuple[str, int | None]] = {}
    for pp in people:
        cur = pp.primary_current()
        if not cur or not cur.company:
            continue
        cid = int(cur.company_id) if str(cur.company_id or "").isdigit() else None
        if exclude and cid == exclude:
            continue
        key = f"id:{cid}" if cid else f"name:{cur.company.lower()}"
        c[key] += 1
        names.setdefault(key, (cur.company, cid))
    out = []
    for key in _top(c, k):
        name, cid = names[key]
        out.append(Candidate(name, company_value(name, cid) or name, F.company_condition(F.CUR, name, cid), "company"))  # type: ignore[arg-type]
    return out


def role_candidates(people: list[ParsedPerson], k: int = 4, at: tuple[str | None, int | None] | None = None) -> list[Candidate]:
    c: Counter = Counter()
    for pp in people:
        cur = _role_at(pp, *at) if at else pp.primary_current()
        fam = tx.title_family((cur.title if cur else None) or (pp.current_title if not at else None))
        if fam and exact_role(fam):
            c[fam] += 1
    return [Candidate(x, x, role_condition(F.CUR, x)[0], "role") for x in _top(c, k)]


# ------------------------------------------------------------------ helpers


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "row"


def _role_at(pp: ParsedPerson, name: str | None, cid: int | None) -> Role | None:
    def hit(r: Role) -> bool:
        if cid and r.company_id and str(r.company_id).isdigit():
            return int(r.company_id) == cid
        return bool(name and r.company and name.lower() in r.company.lower())

    roles = [r for r in pp.roles if hit(r)]
    if not roles:
        return None
    return max(roles, key=lambda r: (r.current, r.start or date(1900, 1, 1)))


def own_posting_url(url: str | None, domain: str | None, name: str | None) -> str | None:
    """Only a link to the company's own public posting (its domain or its page on a known applicant system)."""
    if not url or not isinstance(url, str) or not url.startswith("https://"):
        return None
    try:
        parsed = urlparse(url)
    except ValueError:
        return None
    host = (parsed.hostname or "").lower()
    dom = (domain or "").lower().removeprefix("www.")
    if dom and (host == dom or host.endswith("." + dom)):
        return url
    slug = re.sub(r"[^a-z0-9]", "", (dom.split(".")[0] if dom else (name or "")).lower())
    if slug and len(slug) >= 3 and any(host == a or host.endswith("." + a) for a in ATS_HOSTS):
        first = (parsed.path.strip("/").split("/") or [""])[0].lower()
        if slug in re.sub(r"[^a-z0-9]", "", host) or slug == re.sub(r"[^a-z0-9]", "", first):
            return url
    return None


def _parse_address(addr: str) -> tuple[str | None, str | None]:
    raw = [x.strip() for x in str(addr).split(",")]
    parts = [x for x in raw if x]
    if len(parts) < 2:
        return None, None
    cc = parts[-1].upper()
    country = ISO2_NAME.get(cc) or tx.COUNTRY_ALIASES.get(parts[-1].lower())
    # "street, city, state, zip, CC" (the street may be empty: ", Brentwood, Tennessee, US")
    middle = [x for x in raw[1:-1] if x and not tx.COUNTRY_ALIASES.get(x.lower())] if len(raw) > 2 else parts[:1]
    known = [p for p in middle if tx.country_for_city(tx.canonical_city(p) or p)]
    if known:
        return tx.canonical_city(known[0]) or known[0], country
    street = re.compile(r"\b(road|rd|street|st|str|strasse|straße|avenue|ave|floor|tower|building|park|plaza|block|sector|lane|suite|level|campus|drive|way)\b", re.I)
    for part in middle:
        if re.search(r"\d", part) or street.search(part) or len(part) > 30:
            continue
        return tx.canonical_city(part) or part, country
    return None, country


def company_facts(cd: dict | None, name: str) -> tuple[dict, list[str]]:
    """Company-wide facts from a company enrich record. Unknown facts stay null and are listed."""
    missing: list[str] = []
    if not cd:
        return {"name": name, "domain": None, "industry": None, "hq": None, "international": None, "india_presence": None,
                "headcount": None, "funding": None}, ["company record"]
    bi = cd.get("basic_info") or {}
    hc = cd.get("headcount") or {}
    fu = cd.get("funding") or {}
    loc = cd.get("locations") or {}
    taxo = cd.get("taxonomy") or {}
    out: dict[str, Any] = {"name": bi.get("name") or name, "domain": bi.get("primary_domain") or None}
    industry = taxo.get("professional_network_industry") or (bi.get("industries") or [None])[0] or (taxo.get("categories") or [None])[0]
    out["industry"] = industry
    hq_country = ISO3.get(str(loc.get("country") or "").upper()) or (tx.COUNTRY_ALIASES.get(str(loc.get("headquarters")).split(",")[-1].strip().lower())
                                                                     if loc.get("headquarters") else None)
    out["hq"] = {k: v for k, v in {"city": loc.get("city"), "country": hq_country}.items() if v} or None
    offices: list[tuple[str | None, str | None]] = [_parse_address(a) for a in loc.get("all_office_addresses") or []]
    countries = {c for _ci, c in offices if c}
    if hq_country:
        countries.add(hq_country)
    for region in (hc.get("by_region_absolute") or {}):
        rc = tx.COUNTRY_ALIASES.get(str(region).split(",")[-1].strip().lower())
        if rc:
            countries.add(rc)
    out["international"] = (len(countries) > 1) if countries else None
    if countries:
        india_cities = {ci for ci, c in offices if c == HOME and ci}
        for region in (hc.get("by_region_absolute") or {}):
            first = str(region).split(",")[0].strip()
            city = tx.canonical_city(tx.clean_city(first)) if first else None
            if str(region).strip().endswith(HOME) and city and tx.country_for_city(city) == HOME:
                india_cities.add(city)
        india_cities = sorted(india_cities)
        has_india = HOME in countries
        out["india_presence"] = {"has_india_office": has_india, "is_gcc": bool(has_india and hq_country and hq_country != HOME),
                                 "india_cities": india_cities}
    else:
        out["india_presence"] = None
    if hc.get("total") is not None:
        growth = (hc.get("growth_percent") or {}).get("yoy")
        by_fn = sorted((hc.get("by_role_absolute") or {}).items(), key=lambda kv: -(kv[1] or 0))[:6]
        yoy_fn = hc.get("by_role_growth_yoy_pct") or {}
        out["headcount"] = {"total": int(hc["total"]), "growth_12m": round(growth / 100, 3) if isinstance(growth, (int, float)) else None,
                            "by_function": [{"label": k, "count": int(v), "growth_12m": round(yoy_fn[k] / 100, 3) if isinstance(yoy_fn.get(k), (int, float)) else None}
                                            for k, v in by_fn if v]}
    else:
        out["headcount"] = None
        missing.append("headcount")
    rounds = fu.get("num_funding_rounds") or 0
    total = fu.get("total_investment_usd") or 0
    if rounds or total:
        when = str(fu.get("last_fundraise_date") or "")[:4] or None
        out["funding"] = {"stage": fu.get("last_round_type"), "total_usd": float(total) if total else None, "last_round_date": when}
    else:
        out["funding"] = None
    out["_offices"] = [{"city": ci, "country": c} for ci, c in offices if ci and c]
    if not out["industry"]:
        missing.append("industry")
    if out["hq"] is None:
        missing.append("headquarters")
    return out, missing


# ------------------------------------------------------------------ people (anonymous trajectories)


def build_people(ctx: ToolContext, people: list[ParsedPerson], slice_label: str, data_date: str) -> tuple[list[dict], list[dict]]:
    """PersonCards for the sample and the PersonDetail behind each (stored for 7 days, resolvable only for this profile)."""
    secret = ctx.store.server_secret() if ctx.store is not None else "test-secret"
    profile_id = ctx.profile.get("profile_id") or ""
    today = ctx.today
    cards: list[dict] = []
    sigs: list[tuple[str, ...]] = []
    for pp in people:
        if pp.person_id is None:
            pp.person_id = "anon:" + _fingerprint(pp)
        pid = person_id(secret, profile_id, pp.person_id)
        cards.append(card_for(pp, pid, ctx.profile, today))
        sigs.append(tuple(path_signature(pp)))
    kept = [pp for pp in people if pp.person_id is not None]
    n = len(cards)
    by_sig: dict[tuple[str, ...], list[int]] = {}
    for i, s in enumerate(sigs):
        by_sig.setdefault(s, []).append(i)
    finished = [o for pp in kept for o in intern_outcomes(pp) if not o.ongoing]
    details = []
    for i, (pp, card) in enumerate(zip(kept, cards)):
        same = [j for j in by_sig[sigs[i]] if j != i]
        group = [i, *same]
        stats = [{"label": f"of the {n} career paths read from {slice_label} took this same route",
                  "count": make_count(len(group), n).model_dump()}]
        if finished:
            conv = sum(1 for o in finished if o.converted)
            stats.append({"label": "finished internships in these paths turned into a full-time job at the same company",
                          "count": make_count(conv, len(finished)).model_dump()})
        route_skills, typical = [], None
        if len(group) >= MIN_ROW_COUNT:  # aggregates only over groups of 5 or more
            sk: Counter = Counter()
            for j in group:
                for s in set(top_skills(kept[j], 30)):
                    sk[s] += 1
            route_skills = [{"term": t, "count": c, "n": len(group)} for t, c in sk.most_common(6) if c >= 2]
            yrs = []
            for j in group:
                ug, cur = kept[j].undergrad(), kept[j].primary_current()
                if ug and ug.end_year and cur and cur.start:
                    yrs.append(max(0.0, cur.start.year - ug.end_year))
            typical = half_years(median(yrs)) if yrs else None
        ug = pp.undergrad()
        why = []
        if ug and ug.school:
            why.append({"label": "College", "value": tx.short_school(ug.school) or ug.school,
                        **({"note": "same"} if "Same college" in card["match_reasons"] else {})})
        f_label, _ = tx.normalise_field(ug.field if ug else None)
        if f_label:
            why.append({"label": "Field", "value": f_label, **({"note": "same"} if "Same field" in card["match_reasons"] else {})})
        if ug and ug.end_year:
            why.append({"label": "Graduated", "value": str(ug.end_year)})
        sig = list(sigs[i])
        if sig:
            why.append({"label": "Route", "value": " → ".join(sig)})
        details.append({**card, "skills": top_skills(pp, 8), "route_stats": stats, "position": {"index": i + 1, "total": n},
                        "why": why, "same_route": [cards[j] for j in same[:3]], "route_skills": route_skills,
                        "route_typical_years": typical, "data_date": data_date})
    return cards, details


async def read_people(ctx: ToolContext, filters: dict, reserve: float, note: str) -> tuple[list[ParsedPerson], str | None]:
    cap = max(0, min(30, ctx.settings.drill_sample_cap))
    if cap == 0:
        return [], None
    sample = await ctx.sample_people(filters, max_results=cap, note=note, fields=list(DRILL_FIELDS), reserve=reserve)
    if ctx.skills_unavailable:
        ctx.warn("Skills aren't available on this data plan, so career paths show no skills.")
    return sample.people[:cap], sample.evidence_id


# ------------------------------------------------------------------ titles and next steps


def _fingerprint(pp: ParsedPerson) -> str:
    import hashlib

    raw = "|".join(f"{r.company}:{r.title}:{r.start}" for r in pp.roles) + "|" + "|".join(f"{x.school}:{x.end_year}" for x in pp.schools)
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:]


def title_for(sc: Scope, path: list[dict], jobs: bool) -> str:
    noun = "postings" if jobs else sc.noun
    if not path:
        return _cap(noun)
    last = path[-1]
    dim, label = last["dimension"], last.get("label") or last["value"]
    if dim in ("company", "posting_employer"):
        if str(last["value"]).startswith("feeder:"):
            return f"{_cap(noun)} who worked at {label} before"
        return label
    if jobs:
        return {"skill": f"Postings that mention {label}", "language": f"Postings: {label}", "seniority": f"Postings asking for {label}",
                "quarter": f"Postings added in {label}", "city": f"Postings in {label}", "country": f"Postings in {label}"}.get(dim, f"Postings: {label}")
    return {"role": f"{_cap(noun)} working as {label}", "school": f"{_cap(noun)} from {label}", "degree": f"{_cap(noun)} with a {label}",
            "degree_country": f"{_cap(noun)} who studied in {label}", "years_band": f"{_cap(noun)} with {label} of work",
            "route": f"{_cap(noun)} on this route", "route_step": f"{_cap(noun)} whose path includes: {label}",
            "quarter": f"{_cap(noun)} who started in {label}", "skill": f"{_cap(noun)} who list {label}",
            "seniority": f"{_cap(noun)} at {label} level"}.get(dim, f"{_cap(noun)} in {label}")


def count_label_for(sc: Scope, path: list[dict], jobs: bool) -> str:
    noun = "postings" if jobs else sc.noun
    if len(path) < 2:
        return noun
    prev = path[-2]
    if prev["dimension"] in ("company", "posting_employer"):
        return f"{noun} at {prev.get('label') or prev['value']}"
    return f"{noun} in {prev.get('label') or prev['value']}" if prev["dimension"] in ("country", "city") else f"{noun} ({prev.get('label') or prev['value']})"


def next_steps_for(sc: Scope, company: str | None, role: str | None) -> list[NextStep]:
    country = sc.country or sc.origin_country
    country = country if country and country != HOME else None
    out: list[NextStep] = []
    if company:
        out.append(NextStep(label=f"See your Internship-to-Job chances at {company}", tool="internship_chances",
                            params={k: v for k, v in {"company": company, "country": country}.items() if v}))
    if country:
        out.append(NextStep(label=f"Indian-friendly companies in {country}", tool="indian_friendly",
                            params={k: v for k, v in {"country": country, "city": sc.city}.items() if v}))
    if role and country:
        out.append(NextStep(label=f"Open {role} postings in {country}", tool="job_postings", params={"role": role, "country": country}))
    if not out:
        out.append(NextStep(label="See the routes into your goal", tool="reverse_gps", params={}))
    return out[:3]


# ------------------------------------------------------------------ run


async def run_drill(ctx: ToolContext, token: DrillToken) -> DrillResult:
    path = [s.model_dump() for s in token.path]
    ctx.params = dict(token.params)  # the origin tool's params: inherited by every child token
    ctx.tool = token.tool
    ctx.base_path = path
    ctx.total_steps = 5
    await ctx.step("Reading the cohort you came from")
    for st in path:  # company names → Crustdata company ids (identify is free), so every count matches on the id
        v = str(st["value"])
        if st["dimension"] in ("company", "posting_employer") and not v.startswith("feeder:") and not v.isdigit():
            cid, cname = await ctx.identify_company(v)
            if cid:
                st["value"], st["label"] = str(cid), st.get("label") or cname
    origin = await build_origin(ctx, token.tool, token.params)
    context = context_for(token, origin)
    await ctx.step("Applying your filters")
    parent = copy.deepcopy(origin)
    for st in path[:-1]:
        apply_step(ctx, parent, st)
    sc = copy.deepcopy(parent)
    if path:
        apply_step(ctx, sc, path[-1])
        if parent.origin_place is not None and sc.origin_place is None:
            # A sibling place chosen on the origin screen (e.g. a comparable city): compare it with the whole country.
            parent.origin_place = F.person_country(parent.origin_country) if parent.origin_country else None
            parent.job_origin_place = F.job_country(parent.origin_country) if parent.origin_country else None
            parent.origin_city = None
    last = path[-1] if path else None
    is_company = bool(last and last["dimension"] in ("company", "posting_employer") and not str(last["value"]).startswith("feeder:"))
    jobs_mode = origin.kind == "jobs" and not is_company
    if jobs_mode:
        result = await _jobs_slice(ctx, token, sc, parent, path, context)
    else:
        result = await _people_slice(ctx, token, sc, parent, path, context, is_company)
    return result


async def _people_slice(ctx: ToolContext, token: DrillToken, sc: Scope, parent: Scope, path: list[dict], context: dict,
                        is_company: bool) -> DrillResult:
    slice_f, parent_f = sc.people_filters(), parent.people_filters()
    last = path[-1] if path else None
    for s in sc.job_only_steps:
        ctx.warn(f"'{s}' describes job postings, so the people numbers here don't use it.")
    for note in sc.notes:
        ctx.warn(note)

    # 1. Exact totals first (count-only), before any profile is read.
    await ctx.step("Counting the people in this group")
    res = await ctx.count_many([("slice", slice_f, "People in this group"), ("parent", parent_f, "People in the group you came from")])
    n, ev_n = res["slice"]
    n_parent, ev_p = res["parent"]
    if n is None:
        raise BudgetExceeded("I couldn't count this group within this run's data budget.", hint="Try again in a minute.")
    n_parent = max(n_parent or n, n)

    company_block = None
    cname, cid = None, None
    pre = None
    if is_company:
        cname, cid = _company_ref(str(last["value"]))[:2]  # type: ignore[index]
        cname = last.get("label") or cname
        if not cid and cname:
            cid, cname = await ctx.identify_company(cname)
        await ctx.step("Reading company facts and open postings")
        pre = await _company_pre(ctx, parent, cname, cid)

    # 2. A capped sample of the slice: rows to count, anonymous paths, whole-profile facts.
    await ctx.step("Reading anonymised career paths")
    people: list[ParsedPerson] = []
    ev_sample = None
    planned_counts = 10 if is_company else 13  # exact per-row counts that follow the sample
    if n >= MIN_ROW_COUNT:
        people, ev_sample = await read_people(ctx, slice_f, reserve=planned_counts * COUNT_COST,
                                              note="Anonymised career paths in this group")
    sample_n = len(people)

    # 3. Next level, exact.
    await ctx.step("Counting the next level")
    sections: list[dict] = []
    child = path  # tokens extend the current path
    if is_company:
        company_block, csections = await _company_profile(ctx, sc, slice_f, n, n_parent, ev_n, people, cname, cid, path, pre or {})
        sections += csections
    else:
        has_place = bool(sc.city or sc.country or sc.origin_place)
        if (sc.country or sc.origin_country) and not (sc.city or sc.origin_city):
            sec = await exact_section(ctx, "cities", "Cities", "city", "City", slice_f, n,
                                      city_candidates(people, sc.country or sc.origin_country, 5), "Elsewhere", sample_n, child)
            if sec:
                sections.append(sec)
        elif not has_place:
            sec = await exact_section(ctx, "countries", "Countries", "country", "Country", slice_f, n, country_candidates(people), "Other countries",
                                      sample_n, child)
            if sec:
                sections.append(sec)
        if not sc.company and "company" not in sc.facets:
            sec = await exact_section(ctx, "companies", "Companies", "company", "Company", slice_f, n, company_candidates(people), "Other companies",
                                      sample_n, child)
            if sec:
                sections.append(sec)
        if "role" not in sc.facets:
            sec = await exact_section(ctx, "roles", "Roles", "role", "Role", slice_f, n, role_candidates(people), "Other roles", sample_n, child)
            if sec:
                sections.append(sec)

    # 4. People (anonymous), only when at least 5 match.
    await ctx.step("Drawing anonymised paths")
    blocked = n < MIN_ROW_COUNT
    cards: list[dict] = []
    details: list[dict] = []
    data_date = ctx.data_date()
    if not blocked and people:
        label = (last.get("label") if last else None) or "this group"
        cards, details = build_people(ctx, people, label, data_date)
    noun = sc.noun
    if blocked:
        people_note = None
    elif cards:
        people_note = f"Showing {len(cards)} anonymised career paths of at least {n:,} {noun}."
    else:
        people_note = "No career paths could be read for this group within this run's data budget."
    if n < 10 and not blocked:
        ctx.warn("Under 10 people: read this as a hint, not a rate.")

    count = make_count(n, n_parent, [e for e in (ev_n, ev_p) if e])
    cohort = Cohort(
        definition=_cap(title_for(sc, path, False) if not is_company else f"{noun} at {cname}"),
        filters={"origin_tool": token.tool, "path": path, "country": sc.country or sc.origin_country, "city": sc.city or sc.origin_city,
                 "crustdata": slice_f},
        n_visible=n,
        match_level=(sc.cohort.match_level if sc.cohort else "field_only"),
        widened=bool(sc.cohort and sc.cohort.widened),
        widened_reason=sc.cohort.widened_reason if sc.cohort else None,
    )
    top_company = next((r["cells"]["company"] for s in sections if s["id"] == "companies" for r in s["data"]["rows"] if not r.get("rest")), None)
    top_role = next((r.get("label") or (r.get("cells") or {}).get("role") for s in sections if s["id"] == "roles"
                     for r in (s["data"].get("rows") or s["data"].get("items") or []) if not (r.get("rest") or r.get("remainder"))), None)
    facts = [f"{title_for(sc, path, False)}: {n} of {n_parent} {count_label_for(sc, path, False)}."]
    if top_company:
        facts.append(f"Most common employer: {top_company}.")
    title = title_for(sc, path, False)
    summary = None if is_company else await ctx._summary(title, facts)
    result = DrillResult(
        title=title,
        path=token.path,
        context=context,  # type: ignore[arg-type]
        count=count,
        count_label=count_label_for(sc, path, False),
        cohort=cohort,
        confidence=ctx.confidence(n) if n >= 10 else "low",  # type: ignore[arg-type]
        sections=sections,  # type: ignore[arg-type]
        people=cards,  # type: ignore[arg-type]
        people_total=n,
        people_note=people_note,
        listing_blocked_reason=BLOCKED if blocked else None,
        company=company_block,
        summary=summary,
        coverage=round(min(1.0, sample_n / n), 3) if n else None,
        coverage_note=(f"Counts are exact totals of visible profiles; the {sample_n} career paths shown were read from them."
                       if sample_n else "Counts are exact totals of visible profiles."),
        data_date=data_date,
        next_steps=next_steps_for(sc, cname if is_company else top_company, top_role or sc.role_label),
        warnings=ctx.warnings,
        evidence=ctx.evidence,
    )
    return _finish(ctx, result, details)


async def _jobs_slice(ctx: ToolContext, token: DrillToken, sc: Scope, parent: Scope, path: list[dict], context: dict) -> DrillResult:
    for note in sc.notes:
        ctx.warn(note)
    await ctx.step("Counting postings in this group")
    slice_f, parent_f = sc.job_filters(), parent.job_filters()
    n, agg, ev_n = await ctx.count_jobs(slice_f, "Postings in this group", aggregations=[
        {"type": "count"},
        {"type": "group_by", "field": "company.basic_info.company_id", "agg": "count", "size": 8},
    ])
    n_parent, _, ev_p = await ctx.count_jobs(parent_f, "Postings in the group you came from")
    n_parent = max(n_parent, n)
    await ctx.step("Breaking them down")
    sections: list[dict] = []
    employers = []
    for a in agg.get("aggregations") or []:
        if a.get("field") == "company.basic_info.company_id":
            for b in a.get("buckets") or []:
                meta = b.get("metadata") or {}
                employers.append((meta.get("company_name") or str(b.get("key")), b.get("key"), int(b.get("count") or 0)))
    jobs, _total, ev_j = await ctx.sample_jobs(slice_f, max_results=20, note="Most recent postings in this group")
    cities = [] if sc.city else [(x["label"], x["count"]) for x in
                                 await _exact_job_cities(ctx, slice_f, jobs, sc.country or sc.origin_country, 6)]
    cols = lambda key, header: [{"key": key, "label": header, "type": "text"}, {"key": "postings", "label": "Postings", "type": "int", "bar": True}]  # noqa: E731
    if employers:
        rows = [{"id": str(cid), "cells": {"company": nm, "postings": k}, "count": make_count(k, n, [ev_n]).model_dump(),
                 "drill": ctx.drill("posting_employer", company_value(nm, cid), nm)} for nm, cid, k in employers if k > 0]
        rest = n - sum(k for *_x, k in employers)
        if rest > 0:
            rows.append({"id": "other", "cells": {"company": "Other employers", "postings": rest}, "rest": True})
        sections.append(section("companies", "ranked_table", "Employers posting", {"n": n, "columns": cols("company", "Employer"), "rows": rows,
                                "caption": "Exact posting counts per employer."}, [ev_n]).model_dump())
    if cities and not sc.city:
        rows = [{"id": _slug(c), "cells": {"city": c, "postings": k}, "count": make_count(k, n, [ev_n]).model_dump(),
                 "drill": ctx.drill("city", c)} for c, k in cities if k > 0]
        rest = n - sum(k for _c, k in cities)
        if rest > 0:
            rows.append({"id": "other", "cells": {"city": "Other places", "postings": rest}, "rest": True})
        sections.append(section("cities", "ranked_table", "Cities", {"n": n, "columns": cols("city", "City"), "rows": rows,
                                "caption": "Exact posting counts for the cities in the most recent postings."}, [ev_n]).model_dump())
    sections.append(_open_roles_section(ctx, jobs, None, None, n, [e for e in (ev_j,) if e]))
    title = title_for(sc, path, True)
    result = DrillResult(
        title=title, path=token.path, context=context,  # type: ignore[arg-type]
        count=make_count(n, n_parent, [ev_n, ev_p]), count_label=count_label_for(sc, path, True), cohort=None,
        confidence=ctx.confidence(n) if n >= 10 else "low",  # type: ignore[arg-type]
        sections=sections,  # type: ignore[arg-type]
        people=[], people_total=None,
        people_note="These are job postings, so there are no career paths to list here. Open an employer to see the people who work there.",
        listing_blocked_reason=None, summary=None, coverage=None,
        coverage_note="Counts cover every indexed posting in this group.", data_date=ctx.data_date(),
        next_steps=next_steps_for(sc, employers[0][0] if employers else None, sc.role_label), warnings=ctx.warnings, evidence=ctx.evidence,
    )
    return _finish(ctx, result, [])


def _days_ago(raw: Any, today: date) -> str | None:
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", str(raw or ""))
    if not m:
        return None
    d = (today - date(int(m.group(1)), int(m.group(2)), int(m.group(3)))).days
    if d <= 0:
        return "today"
    return "1 day ago" if d == 1 else f"{d} days ago"


def _lang_badge(desc: str | None) -> str:
    kind, lang = tx.language_requirement(desc)
    if kind in ("required", "written_in") and lang:
        return f"{lang} required"
    if kind == "plus" and lang:
        return f"English OK ({lang} a plus)"
    return "English OK"


def _open_roles_section(ctx: ToolContext, jobs: list[dict], domain: str | None, name: str | None, n: int, ev: list[str]) -> dict:
    rows = []
    for j in jobs[:8]:
        jd = j.get("job_details") or {}
        loc = j.get("location") or {}
        comp = ((j.get("company") or {}).get("basic_info") or {})
        url = own_posting_url(jd.get("url"), domain or comp.get("primary_domain"), name or comp.get("name"))
        rows.append({"id": str(j.get("crustdata_job_id") or len(rows)),
                     "cells": {"role": jd.get("title") or "Untitled posting", "city": loc.get("city") or (str(loc.get("raw") or "").split(",")[0] or None),
                               "posted": _days_ago((j.get("metadata") or {}).get("date_added"), ctx.today),
                               "language": [_lang_badge((j.get("content") or {}).get("description"))]},
                     "posting_url": url})
    columns = [{"key": "role", "label": "Role", "type": "text"}, {"key": "city", "label": "City", "type": "text"},
               {"key": "posted", "label": "Posted", "type": "text"}, {"key": "language", "label": "Language", "type": "badges"}]
    return section("open_roles", "ranked_table", "Open now", {"n": n, "columns": columns, "rows": rows,
                   "caption": "The most recent postings. A link is shown only for the company's own public posting."}, ev).model_dump()


# ------------------------------------------------------------------ company profile (Appendix D)


async def _company_pre(ctx: ToolContext, parent: Scope, cname: str | None, cid: int | None) -> dict:
    """Company-wide facts, company-wide counts and postings: all before any profile is read."""
    today = ctx.today
    name = cname or "this company"
    warnings_missing: list[str] = []
    # Company-wide facts (identify is free; enrich is cached for 7 days).
    cd = None
    ev_co = None
    if cid:
        try:
            call = await ctx.client.company_enrich([cid], fields=["basic_info", "headcount", "funding", "locations", "taxonomy"],
                                                   budget=ctx.budget, run_id=ctx.run_id)
            for item in call.data or []:
                ms = item.get("matches") or []
                if ms:
                    cd = ms[0].get("company_data")
            ev_co = ctx.add_evidence(call, "/company/enrich", {"crustdata_company_ids": [cid]}, 1 if cd else 0, 1 if cd else 0,
                                     f"Company facts for {name} (company-wide)")
        except BudgetExceeded:
            ctx._budget_warning()
        except CrustdataError as exc:
            log.info("company enrich failed: %s", exc)
    facts, missing = company_facts(cd, name)
    warnings_missing += missing
    domain = facts.get("domain")
    office_list = facts.pop("_offices", [])

    cur_company = F.company_condition(F.CUR, cname, cid) or {}
    since24 = iso(months_ago(today, 24))
    senior_levels = [k for k, v in tx.SENIORITY_LEVEL_RANK.items() if v >= 2]
    base_counts = [
        ("all", cur_company, f"Everyone visible at {name} (company-wide)"),
        ("ind", F.and_(cur_company, F.india_educated()) or {}, f"Indian-educated people at {name} (company-wide)"),
        ("ind_recent", F.and_(cur_company, F.india_educated(), F.cond(f"{F.CUR}.start_date", "=>", since24)) or {},
         f"…who joined {name} in the last 24 months"),
        ("ind_senior", F.and_(cur_company, F.india_educated(), F.cond(f"{F.CUR}.seniority_level", "in", senior_levels)) or {},
         "…at senior level or above"),
        ("hires12", F.and_(cur_company, F.cond(f"{F.CUR}.start_date", "=>", iso(months_ago(today, 12))),
                           F.cond(f"{F.CUR}.start_date", "<", iso(months_ago(today, 3)))) or {},
         f"People who started at {name} 3–12 months ago (company-wide)"),
    ]
    # Internship conversion in the inherited context: interned at this company → working there now (not in training).
    intern_ctx = F.and_(parent.people_filters(), intern_element(cname, cid, None)) or {}
    base_counts += [("int_n", intern_ctx, f"Interns and working students at {name} matching your filters"),
                    ("int_k", F.and_(intern_ctx, cur_company, F.cond(f"{F.CUR}.seniority_level", "in", tx.NON_TRAINING_LEVELS)) or {},
                     f"…now working at {name} beyond a traineeship")]
    bc = await ctx.count_many(base_counts)

    # Hiring (company-wide, job search; counts and group-bys are free).
    hiring, open_sec, visa_signals = await _hiring(ctx, cname, cid, domain, bc.get("hires12", (None, None)))
    return {"facts": facts, "missing": warnings_missing, "office_list": office_list, "bc": bc, "hiring": hiring, "open_sec": open_sec,
            "visa": visa_signals, "ev_co": ev_co}


async def _company_profile(ctx: ToolContext, sc: Scope, slice_f: dict, n: int, n_parent: int, ev_n: str | None,
                           people: list[ParsedPerson], cname: str | None, cid: int | None, path: list[dict],
                           pre: dict) -> tuple[dict, list[dict]]:
    today = ctx.today
    name = cname or "this company"
    facts, warnings_missing, office_list, bc = pre["facts"], list(pre["missing"]), pre["office_list"], pre["bc"]
    hiring, open_sec, visa_signals, ev_co = pre["hiring"], pre["open_sec"], pre["visa"], pre["ev_co"]

    ind_all, ev_all = bc["all"]
    ind_k, ev_ind = bc["ind"]
    indian = None
    if ind_k is not None and ind_all:
        rec, _ = bc["ind_recent"]
        sen, ev_sen = bc["ind_senior"]
        indian = {"count": make_count(ind_k, ind_all, [e for e in (ev_ind, ev_all) if e]).model_dump(), "recent_24m": rec,
                  "senior_share": make_count(sen, ind_k, [ev_sen] if ev_sen else []).model_dump() if (sen is not None and ind_k) else None,
                  "median_tenure_years": None}
    int_n, ev_in = bc["int_n"]
    int_k, ev_ik = bc["int_k"]
    conversion = make_count(int_k or 0, int_n, [e for e in (ev_in, ev_ik) if e]).model_dump() if int_n else None
    if conversion is None:
        warnings_missing.append("internship conversion")

    # Whole-profile facts from the sample (denominator = profiles read).
    sample_n = len(people)
    at = (cname, cid)
    promo_years, tenures = [], []
    for pp in people:
        roles = sorted([r for r in pp.roles if _role_at_match(r, cname, cid) and r.start], key=lambda r: r.start)  # type: ignore[arg-type, return-value]
        if not roles:
            continue
        first = roles[0]
        if first.current or (roles[-1].current):
            tenures.append(years_between(first.start, today))  # type: ignore[arg-type]
        nxt = next((r for r in roles[1:] if (r.title or "").lower() != (first.title or "").lower() and not r.is_intern), None)
        if nxt and not first.is_intern:
            promo_years.append(years_between(first.start, nxt.start))  # type: ignore[arg-type]
    promotion = {"median_years_to_first_promotion": half_years(median(promo_years)), "n": len(promo_years)} if len(promo_years) >= MIN_ROW_COUNT else None
    retention = {"median_tenure_years": half_years(median(tenures)), "left_within_1y": None, "n": len(tenures)} if len(tenures) >= MIN_ROW_COUNT else None

    # Exact counts per office city / role / feeder, then the sample-based sections.
    city_c = city_candidates(people, None, 3)
    office_cities = [o["city"] for o in office_list]
    for ci in office_cities:
        if len(city_c) >= 3:
            break
        if ci and all(c.label != ci for c in city_c):
            city_c.append(Candidate(ci, ci, F.person_city(ci), "city"))
    feeder_counter: Counter = Counter()
    feeder_names: dict[str, tuple[str, int | None]] = {}
    for pp in people:
        tr = _role_at(pp, cname, cid)
        fr = feeder_role(pp, tr) if tr else None
        if fr and fr.company:
            fid = int(fr.company_id) if str(fr.company_id or "").isdigit() else None
            key = f"id:{fid}" if fid else f"name:{fr.company.lower()}"
            feeder_counter[key] += 1
            feeder_names.setdefault(key, (fr.company, fid))
    feeders = [Candidate(feeder_names[k][0], company_value(*feeder_names[k]) or feeder_names[k][0],
                         F.company_condition(F.PAST, feeder_names[k][0], feeder_names[k][1]), "company")  # type: ignore[arg-type]
               for k in _top(feeder_counter, 3)]
    count_items = [(("city", c.label), F.and_(slice_f, c.cond) or {}, f"{name}, {c.label}: people like you") for c in city_c]
    offices_counts = await ctx.count_many(count_items) if n >= MIN_ROW_COUNT and count_items else {}
    offices = []
    seen_c: set[str] = set()
    for o in office_list[:8]:
        if o["city"] in seen_c:
            continue
        seen_c.add(o["city"])
        k = (offices_counts.get(("city", o["city"])) or (None, None))[0]
        offices.append({"city": o["city"], "country": o["country"], **({"people_like_you": k} if k is not None and k >= MIN_ROW_COUNT else {})})
    for (_dim, ci), (k, _ev) in offices_counts.items():
        if ci not in seen_c and k is not None and k >= MIN_ROW_COUNT:
            offices.append({"city": ci, "country": tx.country_for_city(ci) or (sc.country or sc.origin_country or ""), "people_like_you": k})

    sections: list[dict] = []
    parent_path = path[:-1]
    sec = await exact_section(ctx, "feeder_employers", f"Worked before {name}", "employer", "Employer", slice_f, n, feeders,
                              "No earlier employer in common", sample_n, parent_path)
    if sec:
        sec["data"]["caption"] = (f"People like you at {name} who also worked at each employer earlier (exact counts). "
                                  + sec["data"].get("caption", ""))
        sections.append(sec)
    sections.append(_programs_section(ctx, people, path))
    sections.append(_degree_countries_section(ctx, people, path))
    sec = await exact_section(ctx, "roles", "What they do now", "role", "Role", slice_f, n, role_candidates(people, 4, at), "Other roles",
                              sample_n, path, kind="distribution")
    if sec:
        sections.append(sec)
    sections.append(_seniority_section(ctx, people, at, path))
    sections.append(_joined_section(people, at, today, name))
    sections.append(_entry_routes_section(ctx, people, at, today, name, path))
    if open_sec:
        sections.append(open_sec)
    sections = [s for s in sections if s]

    company = {**facts,
               "offices": offices,
               "people_like_you": make_count(n, n_parent, [e for e in (ev_n,) if e]).model_dump(),
               "indian_educated": indian,
               "hiring": hiring,
               "internship_conversion": conversion,
               "promotion": promotion,
               "retention": retention,
               "visa_signals": visa_signals,
               "sample_n": sample_n,
               "scope": {"company_wide": ["domain", "industry", "hq", "international", "india_presence", "headcount", "funding", "offices",
                                          "indian_educated", "hiring", "visa_signals"],
                         "your_filters": ["people_like_you", "offices.people_like_you", "internship_conversion"],
                         "profiles_read": ["promotion", "retention"]}}
    if ev_co:
        company["evidence_id"] = ev_co
    if hiring is None:
        warnings_missing.append("postings")
    if indian is None:
        warnings_missing.append("Indian-educated hires")
    if warnings_missing:
        ctx.warn(f"Not known for {name}: " + ", ".join(dict.fromkeys(warnings_missing)) + ". Those parts are left empty rather than guessed.")
    return company, sections


def _role_at_match(r: Role, name: str | None, cid: int | None) -> bool:
    if cid and r.company_id and str(r.company_id).isdigit():
        return int(r.company_id) == cid
    return bool(name and r.company and name.lower() in r.company.lower())


async def _hiring(ctx: ToolContext, cname: str | None, cid: int | None, domain: str | None,
                  hires: tuple[int | None, str | None]) -> tuple[dict | None, dict | None, list[dict]]:
    today = ctx.today
    comp = F.cond("company.basic_info.company_id", "=", cid) if cid else F.cond("company.basic_info.name", "[.]", cname or "")
    d90 = iso(date.fromordinal(today.toordinal() - 90))
    d180 = iso(date.fromordinal(today.toordinal() - 180))
    try:
        n90, agg, ev90 = await ctx.count_jobs(F.and_(comp, *F.job_date_range(d90)) or {}, f"{cname} postings, last 90 days (company-wide)",
                                              aggregations=[{"type": "count"},
                                                            {"type": "group_by", "field": "job_details.title", "agg": "count", "size": 200}])
        nprev, _, _ = await ctx.count_jobs(F.and_(comp, *F.job_date_range(d180, d90)) or {}, f"{cname} postings, the 90 days before")
        n_sp, _, ev_sp = await ctx.count_jobs(F.and_(comp, *F.job_date_range(d90), F.phrase_any("content.description", SPONSOR_PHRASES)) or {},
                                              f"{cname} postings mentioning visa sponsorship or relocation")
        old_from, old_to = iso(months_ago(today, 12)), iso(months_ago(today, 3))
        n_old, _, ev_old = await ctx.count_jobs(F.and_(comp, *F.job_date_range(old_from, old_to)) or {}, f"{cname} postings 3–12 months old")
    except BudgetExceeded:
        ctx._budget_warning()
        return None, None, []
    except CrustdataError as exc:
        log.info("company postings failed: %s", exc)
        return None, None, []
    roles: Counter = Counter()
    for a in agg.get("aggregations") or []:
        if a.get("field") == "job_details.title":
            for b in a.get("buckets") or []:
                fam = tx.title_family(str(b.get("key"))) or "Other roles"
                roles[fam] += int(b.get("count") or 0)
    by_role = [{"label": k, "count": v} for k, v in roles.most_common(6)]
    rest = n90 - sum(r["count"] for r in by_role)
    if rest > 0 and by_role:
        by_role.append({"label": "Other roles", "count": rest})
    jobs, _t, ev_j = await ctx.sample_jobs(F.and_(comp, *F.job_date_range(d90)) or {}, max_results=ctx.settings.drill_job_sample,
                                           note=f"Most recent {cname} postings (language mix and open roles)")
    places = await _exact_job_cities(ctx, F.and_(comp, *F.job_date_range(d90)) or {}, jobs, None, 6)
    lang: Counter = Counter()
    for j in jobs:
        kind, lng = tx.language_requirement((j.get("content") or {}).get("description"))
        if kind in ("required", "written_in") and lng == "German":
            lang["german_required"] += 1
        elif kind in ("required", "written_in"):
            lang["other"] += 1
        else:
            lang["english_only"] += 1
    k_h, _ev_h = hires
    ht = None
    if n_old:
        ratio = (k_h or 0) / n_old
        label = "unclear" if (n_old < 5 or k_h is None) else ("high" if (k_h >= 5 and ratio >= 0.3) else ("some" if k_h >= 1 else "unclear"))
        ht = {"postings_seen": n_old, "matched_hires": k_h or 0, "label": label,
              "note": "Postings 3–12 months old, compared with people whose profile shows them starting at the company in that window (company-wide)."}
    hiring = {
        "open_postings_90d": n90,
        "change_vs_prev": round((n90 - nprev) / nprev, 3) if nprev else None,
        "by_role": by_role,
        "by_location": places,
        "language": ({"english_only": lang["english_only"], "german_required": lang["german_required"], "other": lang["other"],
                      "sample_n": len(jobs)} if jobs else None),
        "sponsorship_mentions": make_count(n_sp, n90, [ev_sp]).model_dump() if n90 else None,
        "hire_through": ht,
        "median_days_open": None,
    }
    visa = [{"label": f"Mentions visa sponsorship or relocation in {n_sp} of {n90} postings (90 days)", "evidence_id": ev_sp}] if n_sp else []
    open_sec = _open_roles_section(ctx, jobs, domain, cname, n90, [e for e in (ev_j, ev90) if e]) if jobs else None
    return hiring, open_sec, visa


def _job_city(j: dict) -> str | None:
    loc = j.get("location") or {}
    raw = loc.get("city") or (str(loc.get("raw") or "").split(",")[0].strip() or None)
    return tx.canonical_city(raw) if raw else None


async def _exact_job_cities(ctx: ToolContext, base: dict, jobs: list[dict], country: str | None, k: int) -> list[dict]:
    """Exact posting counts (free count-only job searches) for the cities seen in a posting sample."""
    seen = Counter(c for c in (_job_city(j) for j in jobs) if c)
    cands = [c for c, _ in seen.most_common(k)]
    if country and len(cands) < 3:
        cands += [c for c in tx.COMPARABLE_CITIES.get(country, []) if c not in cands][: 3 - len(cands)]
    out = []
    for c in cands:
        try:
            n_c, _, _ = await ctx.count_jobs(F.and_(base, F.job_city(c)) or {}, f"Postings in {c}")
        except (BudgetExceeded, CrustdataError):
            break
        if n_c:
            out.append({"label": c, "count": n_c})
    return sorted(out, key=lambda x: -x["count"])


def _programs_section(ctx: ToolContext, people: list[ParsedPerson], path: list[dict]) -> dict | None:
    c: Counter = Counter()
    school_of: dict[str, str] = {}
    for pp in people:
        ug = pp.undergrad()
        if not ug or not ug.school:
            continue
        f_label, _ = tx.normalise_field(ug.field)
        label = " · ".join(x for x in (tx.short_school(ug.school) or ug.school, f_label) if x)
        c[label] += 1
        school_of[label] = tx.short_school(ug.school) or ug.school
    if not c:
        return None
    n = len(people)
    rows, other = [], 0
    for label, k in c.most_common():
        if k >= MIN_ROW_COUNT and len(rows) < 6:
            rows.append({"id": _slug(label), "cells": {"program": label, "people": k}, "count": make_count(k, n).model_dump(),
                         "drill": ctx.drill("school", school_of[label], school_of[label], path=path)})
        else:
            other += k
    if other:
        rows.append({"id": "other", "cells": {"program": "Other programs", "people": other}, "rest": True})
    return section("programs", "ranked_table", "Programs they came from", {
        "n": n, "sample_n": n,
        "columns": [{"key": "program", "label": "College and field", "type": "text"}, {"key": "people", "label": "People", "type": "int", "bar": True}],
        "rows": rows, "caption": f"Bachelor's college and field, in the {n} career paths read (not exact totals)."}).model_dump()


def _degree_countries_section(ctx: ToolContext, people: list[ParsedPerson], path: list[dict]) -> dict | None:
    if not people:
        return None
    c: Counter = Counter()
    none = 0
    for pp in people:
        fd = further_degrees(pp)
        if not fd:
            none += 1
            continue
        top = max(fd, key=lambda s: ({"PhD": 3, "MBA": 2, "Master's": 2}.get(s.level or "", 1), s.end_year or 0))
        c[top.country or "Country not listed"] += 1
    n = len(people)
    items, other = [], 0
    for label, k in c.most_common():
        if k >= MIN_ROW_COUNT and label != "Country not listed":
            items.append({"label": label, "count": k, "share": share_of(k, n), "drill": ctx.drill("degree_country", label, path=path)})
        else:
            other += k
    if other:
        items.append({"label": "Other or not listed", "count": other, "share": share_of(other, n)})
    if none:
        items.append({"label": "No degree beyond the bachelor's", "count": none, "share": share_of(none, n), "remainder": True})
    return section("degree_countries", "distribution", "Where they earned a master's or higher", {
        "n": n, "sample_n": n, "items": items, "unit": "people", "caption": f"In the {n} career paths read (not exact totals)."}).model_dump()


def _seniority_section(ctx: ToolContext, people: list[ParsedPerson], at: tuple[str | None, int | None], path: list[dict]) -> dict | None:
    c: Counter = Counter()
    for pp in people:
        r = _role_at(pp, *at)
        if r and r.seniority:
            c[r.seniority] += 1
    if not c:
        return None
    n = sum(c.values())
    items, other = [], 0
    for label in sorted(c, key=lambda s: tx.SENIORITY_LEVEL_RANK.get(s, 99)):
        k = c[label]
        if k >= MIN_ROW_COUNT:
            items.append({"label": label, "count": k, "share": share_of(k, n), "drill": ctx.drill("seniority", label, path=path)})
        else:
            other += k
    if other:
        items.append({"label": "Other levels", "count": other, "share": share_of(other, n)})
    return section("seniority", "distribution", "Seniority", {"n": n, "sample_n": len(people), "items": items, "unit": "people",
                                                              "caption": f"Of the {n} career paths read that state a level."}).model_dump()


def _joined_section(people: list[ParsedPerson], at: tuple[str | None, int | None], today: date, name: str) -> dict | None:
    years: Counter = Counter()
    for pp in people:
        starts = [r.start for r in pp.roles if _role_at_match(r, *at) and r.start]
        if starts:
            years[min(starts).year] += 1
    if not years:
        return None
    span = list(range(today.year - 6, today.year + 1))
    before = sum(v for y, v in years.items() if y < span[0])
    points = [{"period": str(y), "value": years.get(y, 0)} for y in span]
    cap = f"Year they first joined, in the {len(people)} career paths read (not exact totals)."
    if before:
        cap += f" {before} joined before {span[0]}."
    return section("joined_by_year", "timeseries", f"Joined {name}, by year", {
        "series": [{"key": "joined", "label": "People like you who joined", "points": points}], "unit": "people", "caption": cap}).model_dump()


def _entry_routes_section(ctx: ToolContext, people: list[ParsedPerson], at: tuple[str | None, int | None], today: date, name: str,
                          path: list[dict]) -> dict | None:
    routes: dict[tuple[str, ...], list[float | None]] = {}
    traced = 0
    for pp in people:
        tr = _role_at(pp, *at)
        if not tr:
            continue
        steps = route_steps(pp, tr, f"Joined {name}", today)
        ug = pp.undergrad()
        yrs = (tr.start.year - ug.end_year) if (ug and ug.end_year and tr.start) else None
        routes.setdefault(tuple(steps), []).append(yrs)
        traced += 1
    if not traced:
        return None
    items, small = [], 0
    for steps, yrs in sorted(routes.items(), key=lambda kv: -len(kv[1])):
        if len(yrs) < MIN_ROW_COUNT:
            small += len(yrs)
            continue
        typical = median([y for y in yrs if y is not None])
        sig = " → ".join(steps)
        items.append({"id": f"r{len(items) + 1}", "steps": [{"label": s} for s in steps], "people": make_count(len(yrs), traced).model_dump(),
                      "typical_years": half_years(typical) if typical is not None else None, "gaps": [],
                      "drill": ctx.drill("route", sig, " → ".join(steps[:-1]) or sig, path=path)})
    caption = f"Routes traced from the {traced} career paths read."
    if small:
        caption += f" {small} joined by routes shared by fewer than 5 of them, so those aren't listed."
    return section("entry_routes", "route_list", "Entry routes", {"routes": items, "caption": caption}).model_dump()


# ------------------------------------------------------------------ privacy + storage


def _finish(ctx: ToolContext, result: DrillResult, details: list[dict]) -> DrillResult:
    payload = result.model_dump(mode="json", by_alias=True)
    sens = set(ctx.sensitive)
    payload["people"] = scrub_person_output(payload["people"], sens)
    payload["sections"] = scrub_person_output(payload["sections"], sens)
    details = [scrub_person_output(d, sens) for d in details]
    problems = privacy_violations({"people": payload["people"], "sections": payload["sections"]}, sens) + privacy_violations(details, sens)
    if problems:  # pragma: no cover - scrub_person_output already removed them
        log.warning("drill privacy check flagged %d items after scrubbing", len(problems))
    if ctx.store is not None and details:
        ttl = min(ctx.settings.person_data_ttl_days, 7.0) * 86400
        for d in details:
            ctx.store.save_drill_person(d["id"], ctx.profile.get("profile_id") or "", d, ttl)
    return DrillResult.model_validate(payload)


def parse_people_for_tests(raw: list[dict]) -> list[ParsedPerson]:
    return [parse_person(r) for r in raw]


__all__ = ["run_drill", "build_origin", "apply_step", "Scope", "own_posting_url", "company_facts", "context_for"]
