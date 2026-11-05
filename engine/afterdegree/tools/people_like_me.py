"""1. People Like Me: the cohort sharing the user's background, and where they are now."""

from __future__ import annotations

from collections import Counter

from .. import filters as F
from .. import taxonomy as tx
from ..cohort import build_cohort
from ..profile import further_degrees
from ..schemas import Result
from ..stats import make_count
from ..toolkit import ToolContext, stat_section
from .common import company_value, counts_table_section, distribution_section, pct, step, user_target_role

TOOL = "people_like_me"
HOME = "India"
DEGREE_LABEL = {"Master's": "MS / MSc / MEng", "MBA": "MBA", "PhD": "PhD"}


async def run(ctx: ToolContext) -> Result:
    p = ctx.params
    ctx.tool = TOOL
    ctx.total_steps = 5
    await ctx.step("Finding people with your background")
    cohort = await build_cohort(ctx, p.get("match") or "exact_school", p.get("exp_band"))
    university = bool(ctx.params.get("institution") or ctx.is_university)
    who = "your graduates" if university else "people like you"

    await ctx.step("Checking how many moved abroad")
    n_loc, ev_loc = await ctx.count_people_safe(cohort.filters(F.person_has_country()), "Cohort members with a known location")
    k_abroad, ev_abroad = await ctx.count_people_safe(
        cohort.filters(F.person_has_country(), F.person_not_country(HOME)), "Cohort members now located outside India"
    )

    await ctx.step("Reading a sample of their profiles")
    sample = await ctx.sample_people(cohort.filters(), note="Cohort profiles", reserve=0.5)
    people = sample.people
    ev_s = [sample.evidence_id] if sample.evidence_id else []

    await ctx.step("Counting where they are now")
    target = None if university else ((ctx.goals.get("target_countries") or [None])[0])
    countries = Counter(pp.country for pp in people if pp.country)
    abroad_counts = Counter({c: k for c, k in countries.items() if c != HOME})
    home_count = countries.get(HOME, 0)
    n_c = sum(countries.values())
    abroad_people = [pp for pp in people if pp.country and pp.country != HOME]
    top_abroad = next((c for c, _ in abroad_counts.most_common()), None)
    employer_country = target or top_abroad

    roles: Counter = Counter()
    employers: Counter = Counter()
    employer_ids: dict[str, object] = {}
    for pp in abroad_people:
        cur = pp.primary_current()
        fam = tx.title_family((cur.title if cur else None) or pp.current_title)
        if fam:
            roles[fam] += 1
        if cur and cur.company and pp.country == employer_country:
            employers[cur.company] += 1
            if cur.company_id:
                employer_ids.setdefault(cur.company, cur.company_id)
    n_in_target = sum(1 for pp in people if pp.country == employer_country)

    degree_types: Counter = Counter()
    degree_countries: Counter = Counter()
    for pp in people:
        fd = further_degrees(pp)
        if not fd:
            continue
        latest = max(fd, key=lambda s: s.end_year or 0)
        degree_types[DEGREE_LABEL.get(latest.level or "", "Other degree")] += 1
        masters = [s for s in fd if s.level == "Master's"]
        if masters:
            degree_countries[max(masters, key=lambda s: s.end_year or 0).country or "Country not listed"] += 1
    with_degree = sum(degree_types.values())

    await ctx.step("Writing it up")
    abroad_count = None
    if n_loc is not None and k_abroad is not None and n_loc > 0:
        abroad_count = make_count(k_abroad, n_loc, [e for e in (ev_abroad, ev_loc) if e])
    target_role = user_target_role(ctx) if not university else None
    n_read = len(people)
    read_note = (f"The breakdowns below are read from {n_read:,} of these {cohort.n:,} profiles (sample_n)."
                 if n_read < cohort.n else None)
    hero = stat_section("cohort_size", "Your graduates" if university else "People like you", "visible profiles",
                        display=f"{cohort.n:,}", value=cohort.n, unit="profiles",
                        note=" ".join(x for x in (cohort.widened_reason, read_note) if x) or None,
                        evidence_ids=[cohort.evidence_id] if cohort.evidence_id else [])
    hero.data["sample_n"] = n_read
    hero.data["drill"] = {"tool": TOOL, "params": ctx.params, "path": []}
    sections = [hero]

    def country_drill(label: str):
        if label == "Still in India":
            return ctx.drill("country", HOME, "India")
        return None if label.startswith("Other") else ctx.drill("country", label)

    def employer_drill(label: str):
        if not employer_country:
            return None
        path = [{"dimension": "country", "value": employer_country, "label": employer_country}]
        return ctx.drill("company", company_value(label, employer_ids.get(label)), label, path=path)

    if abroad_count is not None:
        sections.append(stat_section("moved_abroad", "Moved abroad", f"{who} now live outside India", count=abroad_count,
                                     note="Counted over every visible profile in the group that shows a location."))
    sections += [
        distribution_section("countries", f"Where the {n_c} are now", abroad_counts, n_c, ev_s, unit="people",
                             caption=("Each square is one person. Abroad first" + ("; your target is highlighted." if target else "."))
                             + (f" Read from {n_read:,} of {cohort.n:,} profiles." if read_note else ""),
                             other_label="Other countries", target=target, remainders={"Still in India": home_count},
                             drill=country_drill, sample_n=n_read),
        counts_table_section("roles", "What they do now", "role", "Role", roles, len(abroad_people), ev_s,
                             you_label=tx.display_role(target_role) if target_role else None, other_label="Other roles", caption="abroad",
                             drill=lambda label: ctx.drill("role", label), sample_n=n_read,
                             empty_note=f"No single role is shared by 5 or more of the {len(abroad_people)} people abroad in the profiles read."),
        counts_table_section("employers_target", f"Employers in {employer_country or 'their new country'}", "employer", "Employer",
                             employers, n_in_target, ev_s, you_label=ctx.derived.get("current_company"), other_label="At other employers",
                             drill=employer_drill, sample_n=n_read,
                             empty_note=(f"No employer in {employer_country or 'that country'} has 5 or more of the {n_in_target} people like you "
                                         "found there in the profiles read, so none is listed. Open the country to see the people instead.")),
        distribution_section("further_degrees", "Further degrees", degree_types, len(people), ev_s, unit="degrees",
                             caption="Latest degree after the bachelor's, as listed on profiles.",
                             remainders={"No further degree shown": len(people) - with_degree},
                             drill=lambda label: None if label in ("No further degree shown", "Other degree") else ctx.drill("degree", label),
                             sample_n=n_read),
        distribution_section("degree_countries", "Where they studied", degree_countries, sum(degree_countries.values()), ev_s,
                             unit="people", caption="Country of the master's, for those who took one.",
                             other_label="Other countries", target=target,
                             drill=lambda label: ctx.drill("degree_country", label), sample_n=n_read),
    ]

    next_country = target or top_abroad
    top_role = target_role or next((r for r, _ in roles.most_common() if r != "Intern / Working Student"), None)
    next_steps = []
    if next_country:
        next_steps.append(step(f"See your Internship-to-Job chances in {next_country}", "internship_chances", country=next_country))
        if top_role:
            next_steps.append(step(f"Trace how people became {top_role} in {next_country}", "reverse_gps", role=top_role, country=next_country))
        next_steps.append(step(f"Find employers in {next_country} that hire Indian-educated people", "indian_friendly", country=next_country, role=top_role))
    if top_role and next_country:
        next_steps.append(step(f"Read current {top_role} postings in {next_country}", "job_postings", role=top_role, country=next_country))
    if not next_steps:
        next_steps.append(step("Widen the group to similar colleges", "people_like_me", match="school_tier"))

    facts = [f"Group: {cohort.plan.definition}; {cohort.n} visible profiles."]
    if cohort.widened_reason:
        facts.append(cohort.widened_reason)
    if abroad_count:
        facts.append(f"Now living outside India: {pct(abroad_count)}.")
    if abroad_counts:
        facts.append("Most common countries abroad in the sample: " + ", ".join(f"{c} ({k})" for c, k in abroad_counts.most_common(3) if k >= 5))
    if degree_countries:
        facts.append("Master's countries in the sample: " + ", ".join(f"{c} ({k})" for c, k in degree_countries.most_common(3) if k >= 5))

    coverage = (n_loc / cohort.n) if (n_loc is not None and cohort.n) else None
    return await ctx.finish(
        TOOL,
        "Where your graduates are now" if university else "Where people like you are now",
        sections,
        ctx.confidence(cohort.n, cohort.widened, len(people)),
        f"Based on {cohort.n:,} visible profiles; the breakdowns use {len(people)} of them"
        + (f", and {coverage:.0%} show a current country, so every count is 'at least'" if coverage is not None else "")
        + ". People without public profiles are not counted.",
        cohort=cohort.model(),
        next_steps=next_steps,
        facts=facts,
        coverage=coverage,
    )
