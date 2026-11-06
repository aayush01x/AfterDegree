"""3. Conversion Map: intern-to-job conversion ratios by company (and by country and school group)."""

from __future__ import annotations

from .. import filters as F
from .. import taxonomy as tx
from ..analysis import intern_outcomes, tally_by
from ..cohort import build_cohort
from ..schemas import Cohort, Result
from ..stats import fold_small, make_count
from ..toolkit import ToolContext, section
from .common import company_value_from_key, distribution_section, resolve_place, step, title_or
from .internship_chances import company_tallies, intern_element, role_filter_for

TOOL = "conversion_map"
SAMPLE_N = 40


async def run(ctx: ToolContext) -> Result:
    scope = ctx.params.get("scope") or {}
    _, country = resolve_place(None, scope.get("country"))
    role = (scope.get("role") or "").strip() or None
    school = (scope.get("school") or "").strip() or None
    field = (scope.get("field") or "").strip() or None
    ctx.tool = TOOL
    ctx.total_steps = 4

    await ctx.step("Finding interns in this scope")
    extra = [intern_element(None, None, country)]
    if role:
        extra.append(title_or(F.EMP, role))
    if school or field:
        variants = await ctx.school_variants(school) if school else None
        _, field_phrase = tx.normalise_field(field) if field else (None, None)
        edu = F.education_group(schools=variants, field_phrase=field_phrase)
        filters = F.and_(edu, *extra) or {}
        n, _ = await ctx.count_people(filters, "Interns in scope")
        definition = "People who studied " + " at ".join(x for x in [tx.normalise_field(field)[0] if field else None, tx.short_school(school) if school else None] if x)
        cohort_model = Cohort(definition=definition, filters={"school": school, "field": field, "country": country, "role": role, "crustdata": filters},
                              n_visible=n, match_level="exact_school" if school else "field_only", widened=False, widened_reason=None)
        widened = False
    else:
        built = await build_cohort(ctx, "field_only", extra=extra, noun="former interns or working students", min_n=25)
        filters, n, cohort_model, widened = built.filters(), built.n, built.model(), built.widened
        cohort_model.filters.update({"country": country, "role": role})
        if built.plan.level != "exact_school":
            cohort_model.filters["school"] = None

    await ctx.step("Reading their career histories")
    sample = await ctx.sample_people(filters, max_results=SAMPLE_N, note="Interns' profiles", reserve=0.5)
    ev = [e for e in (sample.evidence_id,) if e]

    await ctx.step("Counting conversions by company and country")
    keep = role_filter_for(None, None, country)
    outcomes = [o for pp in sample.people for o in intern_outcomes(pp, keep)]
    kept, rest = company_tallies(outcomes, top=20)
    rows = []
    for t in kept:
        c = make_count(t.converted, t.seen, ev).model_dump()
        rows.append({"id": t.key, "cells": {"company": t.name, "country": t.country, "seen": t.seen, "converted": t.converted, "rate": c},
                     "count": c, "drill": ctx.drill("company", company_value_from_key(t.key, t.name), t.name)})
    if rest:
        c = make_count(rest.converted, rest.seen, ev).model_dump()
        rows.append({"id": "other", "cells": {"company": rest.name, "country": None, "seen": rest.seen, "converted": rest.converted, "rate": c},
                     "count": c, "rest": True})

    by_country = tally_by(outcomes, lambda o: o.country or "Country not listed")
    conversions = {label: t.converted for label, t in by_country.items()}
    finished = sum(1 for o in outcomes if not o.ongoing)
    sections = [
        section("companies", "ranked_table", "Companies ranked by conversion", {
            "n": finished,
            "columns": [
                {"key": "company", "label": "Company", "type": "text"},
                {"key": "country", "label": "Country", "type": "text"},
                {"key": "seen", "label": "Interns seen", "type": "int"},
                {"key": "converted", "label": "Converted", "type": "int"},
                {"key": "rate", "label": "Conversion", "type": "count", "bar": True},
            ],
            "rows": rows,
            "default_sort": {"key": "rate", "dir": "desc"},
            "sample_n": len(sample.people),
            "caption": f"Finished internships in the {len(sample.people)} profiles read (of {n:,} matching)."
            + (" Companies with fewer than 5 finished internships are grouped as Other companies." if rest else ""),
        }, ev),
        distribution_section("by_country", "Conversions by country", conversions, sum(conversions.values()), ev,
                             unit="conversions", other_label="Other countries", target=country,
                             caption=f"Internships that turned into a full-time job at the same company, by country of the internship, "
                                     f"in the {len(sample.people)} profiles read.",
                             drill=lambda label: None if label == "Country not listed" else ctx.drill("country", label),
                             sample_n=len(sample.people)),
    ]

    # Extra (not in the contract table): conversion by school group, when the scope is not a single school.
    if not school:
        per_tier: dict[str, list[int]] = {}
        for pp in sample.people:
            ug = pp.undergrad()
            tier = tx.school_tier(ug.school if ug else None)
            label = tier.label.split(" (")[0] if tier else "Other universities"
            outs = [o for o in intern_outcomes(pp, keep) if not o.ongoing]
            if not outs:
                continue
            acc = per_tier.setdefault(label, [0, 0])
            acc[0] += sum(o.converted for o in outs)
            acc[1] += len(outs)
        tier_kept, tier_other = fold_small({k: v[1] for k, v in per_tier.items()})
        tier_rows = []
        for label, n_t in tier_kept:
            c = make_count(per_tier[label][0], n_t, ev).model_dump()
            tier_rows.append({"id": label, "cells": {"group": label, "seen": n_t, "rate": c}, "count": c,
                              "drill": None if label == "Other universities" else ctx.drill("school", label)})
        if tier_rows:
            sections.append(section("by_school_group", "ranked_table", "Conversion by school group", {
                "n": finished,
                "columns": [{"key": "group", "label": "School group", "type": "text"}, {"key": "seen", "label": "Interns seen", "type": "int"},
                            {"key": "rate", "label": "Conversion", "type": "count", "bar": True}],
                "rows": tier_rows,
                "caption": f"{tier_other} internships from smaller groups are not shown." if tier_other else None,
            }, ev))

    top_company = next((r["cells"]["company"] for r in rows if not r.get("rest")), None)
    next_steps = []
    if country:
        next_steps.append(step(f"See your own chances in {country}", "internship_chances", country=country, role=role))
        next_steps.append(step(f"Find employers in {country} that hire Indian-educated people", "indian_friendly", country=country, role=role))
    if top_company:
        next_steps.append(step(f"See your chances at {top_company}", "internship_chances", company=top_company, country=country))
    if not next_steps:
        next_steps.append(step("See where people like you are now", "people_like_me"))

    facts = [f"Scope: {cohort_model.definition}; {n} visible profiles with internships; {len(sample.people)} read; {finished} finished internships."]
    if rows:
        facts.append("Highest conversion: " + "; ".join(f"{r['cells']['company']} {r['count']['display']}" for r in rows[:3] if not r.get("rest")))
    return await ctx.finish(
        TOOL,
        f"Internship conversion map{' in ' + country if country else ''}",
        sections,
        ctx.confidence(finished, widened) if finished >= 10 else "low",
        f"Based on {finished} finished internships in {len(sample.people)} profiles read (of {n:,} visible matches). "
        "Companies with fewer than 5 interns are not shown individually.",
        cohort=cohort_model,
        next_steps=next_steps,
        facts=facts,
        coverage=(len(sample.people) / n) if n else None,
    )
