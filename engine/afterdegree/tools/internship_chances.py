"""2. Internship to Job (Chances): how often internships turned into full-time jobs for people like the user."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from .. import filters as F
from ..analysis import company_display, intern_outcomes, tally_by
from ..cohort import build_cohort
from ..profile import Role
from ..schemas import Result
from ..stats import make_count
from ..toolkit import ToolContext, section, stat_section, text_section
from .common import company_value_from_key, pct, resolve_place, step, title_or, user_target_role

TOOL = "internship_chances"
MIN_INTERN_PROFILES = 25  # widen below this: not every intern profile has a finished, in-scope internship


def intern_element(company: str | None, company_id: int | None, country: str | None) -> dict:
    """Conditions on ONE employment element: an internship (at company) (in country)."""
    parts = [F.intern_title_condition(F.EMP)]
    if company_id or company:
        parts.append(F.company_condition(F.EMP, company, company_id))
    if country:
        parts.append(F.cond(f"{F.EMP}.location", "[.]", country))
    return F.and_(*parts)  # type: ignore[return-value]


def role_filter_for(company: str | None, company_id: int | None, country: str | None):
    def keep(r: Role) -> bool:
        if company_id and r.company_id and int(r.company_id) != int(company_id):
            return False
        if company and not company_id and r.company and company.lower() not in r.company.lower():
            return False
        if country and (r.country or r.hq_country) and (r.country or r.hq_country) != country:
            return False
        return True

    return keep


@dataclass
class CompanyTally:
    key: str
    name: str
    country: str | None
    seen: int
    converted: int


def company_tallies(outcomes, min_interns: int = 5, top: int = 12) -> tuple[list[CompanyTally], CompanyTally | None]:
    """Per-company finished internships and conversions; companies under min_interns fold into one rest tally."""
    names = company_display(outcomes)
    countries: dict[str, Counter] = {}
    for o in outcomes:
        if o.country:
            countries.setdefault(o.company_key, Counter())[o.country] += 1
    tallies = tally_by(outcomes, lambda o: o.company_key)
    ranked = sorted(tallies.items(), key=lambda kv: (-(kv[1].converted / kv[1].interns if kv[1].interns else 0), -kv[1].interns))
    kept: list[CompanyTally] = []
    rest_seen = rest_conv = 0
    for key, t in ranked:
        if t.interns == 0:
            continue
        if t.interns < min_interns or len(kept) >= top:
            rest_seen += t.interns
            rest_conv += t.converted
            continue
        c = countries.get(key)
        kept.append(CompanyTally(key, names.get(key, key), c.most_common(1)[0][0] if c else None, t.interns, t.converted))
    rest = CompanyTally("other", "Other companies", None, rest_seen, rest_conv) if rest_seen else None
    return kept, rest


IC_COLUMNS = [
    {"key": "company", "label": "Company", "type": "text"},
    {"key": "interns", "label": "Interns", "type": "int"},
    {"key": "converted", "label": "Went full-time", "type": "count", "bar": True},
]


def ic_rows(kept: list[CompanyTally], rest: CompanyTally | None, ev: list[str], you_company: str | None = None,
            ctx: ToolContext | None = None) -> list[dict]:
    rows = []
    for t in kept:
        c = make_count(t.converted, t.seen, ev).model_dump()
        row = {"id": t.key, "cells": {"company": t.name, "interns": t.seen, "converted": c}, "count": c,
               "badges": ["Small group"] if t.seen < 10 else [],
               "you": bool(you_company and t.name.lower() == you_company.lower())}
        tok = ctx.drill("company", company_value_from_key(t.key, t.name), t.name) if ctx else None
        if tok:
            row["drill"] = tok
        rows.append(row)
    if rest:
        c = make_count(rest.converted, rest.seen, ev).model_dump()
        rows.append({"id": "other", "cells": {"company": rest.name, "interns": rest.seen, "converted": c}, "count": c, "rest": True})
    return rows


async def run(ctx: ToolContext) -> Result:
    p = ctx.params
    ctx.tool = TOOL
    ctx.total_steps = 5
    _, country = resolve_place(None, p.get("country"))
    company = (p.get("company") or "").strip() or None
    role = (p.get("role") or "").strip() or None

    await ctx.step("Looking up the company")
    company_id = None
    company_name = company
    if company:
        company_id, company_name = await ctx.identify_company(company)

    await ctx.step("Finding interns with your background")
    extra = [intern_element(company_name, company_id, country)]
    if role:
        extra.append(title_or(F.EMP, role))
    cohort = await build_cohort(ctx, "exact_school", extra=extra, noun="former interns or working students", min_n=MIN_INTERN_PROFILES)

    await ctx.step("Reading their career histories")
    sample = await ctx.sample_people(cohort.filters(), note="Interns' profiles", reserve=0.5)
    ev = [e for e in (sample.evidence_id,) if e]

    await ctx.step("Checking who went full-time at the same company")
    keep = role_filter_for(company_name, company_id, country)
    outcomes = [o for pp in sample.people for o in intern_outcomes(pp, keep)]
    finished = [o for o in outcomes if not o.ongoing]
    ongoing = len(outcomes) - len(finished)
    k = sum(o.converted for o in finished)
    chance = make_count(k, len(finished), ev)

    await ctx.step("Writing it up")
    target = " ".join(x for x in [f"at {company_name}" if company_name else None, f"in {country}" if country else None] if x)
    kept, rest = company_tallies(outcomes)
    sections = [
        stat_section(
            "chance",
            "Your chance",
            "interns and working students later went full-time at the same company",
            count=chance,
            note=cohort.widened_reason,
        ),
        section("companies", "ranked_table", "Companies by conversion for people like you", {
            "n": len(finished),
            "columns": IC_COLUMNS,
            "rows": ic_rows(kept, rest, ev, company_name, ctx),
            "default_sort": {"key": "converted", "dir": "desc"},
            "caption": ("Companies with fewer than 5 finished internships are grouped as Other companies." if rest else None),
        }, ev),
        text_section(
            "method",
            "How this was computed",
            f"I found {cohort.n:,} visible profiles of people with your background ({cohort.plan.definition}) "
            f"who held an internship or working-student role{(' ' + target) if target else ''}"
            + f", read {len(sample.people)} of their career histories, and counted an internship as converted when the person later "
            "held a non-intern role at the same company. "
            + (f"{ongoing} people still in their internship were left out because the outcome isn't known yet. " if ongoing else "")
            + "Profiles that don't list internships can't be counted, so treat this as a floor, not a promise.",
            ev,
        ),
    ]
    cohort_model = cohort.model()
    cohort_model.filters.update({"company": company_name, "role": role, "country": country})
    if len(finished) < 10:
        ctx.warn("Fewer than 10 finished internships were visible, so I'm showing the raw count instead of a percentage.")

    tgt_role = role or user_target_role(ctx)
    next_steps = [step(f"Compare companies' conversion in {country or 'all countries'}", "conversion_map", scope={"country": country, "role": role})]
    if country:
        next_steps.append(step(f"Find employers in {country} that hire Indian-educated people", "indian_friendly", country=country, role=tgt_role))
        if tgt_role:
            next_steps.append(step(f"Read current {tgt_role} postings in {country}", "job_postings", role=tgt_role, country=country))

    facts = [f"Interns {target or 'anywhere'} with this background: {cohort.n} visible profiles; {len(sample.people)} read.",
             f"Went full-time at the same company: {pct(chance)}."]
    if cohort.widened_reason:
        facts.append(cohort.widened_reason)
    return await ctx.finish(
        TOOL,
        f"Internship-to-Job chances {target}".strip(),
        sections,
        ctx.confidence(len(finished), cohort.widened) if len(finished) >= 10 else "low",
        f"Based on {len(finished)} finished internships from {len(sample.people)} profiles read "
        f"(of {cohort.n:,} visible matches). People without public profiles are not counted.",
        cohort=cohort_model,
        next_steps=next_steps,
        facts=facts,
        coverage=(len(sample.people) / cohort.n) if cohort.n else None,
    )


__all__ = ["run", "intern_element", "role_filter_for", "company_tallies", "ic_rows", "IC_COLUMNS"]
