"""5. Routes to Positions: entry routes into a specific position (feeders, previous titles, schools, experience)."""

from __future__ import annotations

from collections import Counter

from .. import filters as F
from .. import taxonomy as tx
from ..analysis import experience_at_entry, feeder_role, find_target_role, highest_degree, previous_role
from ..schemas import Cohort, Result
from ..stats import YEAR_BUCKET_ORDER, bucket_years, make_count, median
from ..toolkit import ToolContext, section
from .common import company_value, counts_table_section, distribution_section, place_text, require_role, resolve_place, step, title_or

TOOL = "routes_to_position"


async def run(ctx: ToolContext) -> Result:
    p = ctx.params
    role = require_role(p.get("role"))
    city, country = resolve_place(p.get("city"), p.get("country"))
    company = (p.get("company") or "").strip() or None
    role_label = tx.display_role(role)
    place = place_text(city, country)
    ctx.tool = TOOL
    ctx.total_steps = 4

    await ctx.step("Finding people in this position")
    company_id = None
    if company:
        company_id, company = await ctx.identify_company(company)
    parts = [title_or(F.CUR, role)]
    if city:
        parts.append(F.person_city(city))
    elif country:
        parts.append(F.person_country(country))
    if company:
        parts.append(F.company_condition(F.CUR, company, company_id))
    target = F.and_(*parts) or {}
    n, _ = await ctx.count_people(target, "People in the position")

    await ctx.step("Reading how they entered")
    sample = await ctx.sample_people(target, max_results=50, note="Profiles of people in the position", reserve=0.5)
    ev = [e for e in (sample.evidence_id,) if e]

    await ctx.step("Mapping feeder employers, titles and schools")
    feeders: Counter = Counter()
    prev_titles: Counter = Counter()
    schools: Counter = Counter()
    years_entry: Counter = Counter()
    raw_years: list[float] = []
    edges: Counter = Counter()
    feeder_ids: dict[str, object] = {}
    school_names: dict[str, str] = {}
    traced = 0
    for pp in sample.people:
        tr = find_target_role(pp, role, company, company_id)
        if tr is None:
            continue
        traced += 1
        fr = feeder_role(pp, tr)
        pr = previous_role(pp, tr)
        feeder = fr.company if fr and fr.company else "First job (no earlier employer)"
        feeders[feeder] += 1
        if fr and fr.company and fr.company_id:
            feeder_ids.setdefault(feeder, fr.company_id)
        title = tx.title_family(pr.title) if pr and pr.title else "No earlier role"
        prev_titles[title] += 1
        edges[(feeder, title)] += 1
        hd = highest_degree(pp)
        if hd:
            school_label = f"{tx.short_school(hd.school)}, {hd.level or 'degree'}"
            schools[school_label] += 1
            school_names.setdefault(school_label, tx.short_school(hd.school) or hd.school or "")
        ye = experience_at_entry(pp, tr, ctx.today)
        raw_years.append(ye) if ye is not None else None
        b = bucket_years(ye)
        if b:
            years_entry[b] += 1

    def feeder_drill(label: str):
        if label in ("First job (no earlier employer)", "Other employers"):
            return None
        return ctx.drill("company", "feeder:" + (company_value(label, feeder_ids.get(label)) or label), label)

    def title_drill(label: str):
        return None if label in ("No earlier role", "Other roles") else ctx.drill("role", "previous:" + label, label)

    target_label = f"{role_label}" + (f" at {company}" if company else "") + f" in {place}"
    nodes: dict[str, dict] = {"__target": {"id": "target", "label": target_label, "kind": "goal",
                                           "drill": {"tool": TOOL, "params": ctx.params, "path": []}}}
    edge_list = []
    title_totals: Counter = Counter()
    big_feeders = {f for f, c in feeders.items() if c >= 5}
    big_titles = {t for t, c in prev_titles.items() if c >= 5}
    folded: Counter = Counter()
    for (feeder, title), c in edges.items():
        folded[(feeder if feeder in big_feeders else "Other employers", title if title in big_titles else "Other roles")] += c
    for (feeder, title), c in folded.most_common():
        if c < 5:
            continue
        if f"f:{feeder}" not in nodes:
            nodes[f"f:{feeder}"] = {"id": f"f{len(nodes)}", "label": feeder, "kind": "employer", "drill": feeder_drill(feeder)}
        if f"t:{title}" not in nodes:
            nodes[f"t:{title}"] = {"id": f"t{len(nodes)}", "label": title, "kind": "title", "drill": title_drill(title)}
        edge_list.append({"from": nodes[f"f:{feeder}"]["id"], "to": nodes[f"t:{title}"]["id"], "count": c})
        title_totals[title] += c
    for title, c in title_totals.items():
        edge_list.append({"from": nodes[f"t:{title}"]["id"], "to": "target", "count": c})

    ordered_years = {k: years_entry[k] for k in YEAR_BUCKET_ORDER if years_entry.get(k)}
    you_titles = tx.title_family(ctx.derived.get("current_title"))
    sections = [
        section("graph", "routes", "Entry routes: feeder employers → previous titles → this position", {
            "nodes": list(nodes.values()), "edges": edge_list,
            "caption": "Employers and roles with fewer than 5 people are grouped as Other; only connections taken by at least 5 people are drawn.",
        }, ev),
        counts_table_section("feeders", "Feeder employers", "employer", "Employer", feeders, traced, ev,
                             you_label=ctx.derived.get("current_company"), other_label="Other employers",
                             caption="Last employer before joining.", drill=feeder_drill, sample_n=len(sample.people)),
        counts_table_section("titles", "Previous titles", "title", "Title", prev_titles, traced, ev,
                             you_label=you_titles, other_label="Other titles", drill=title_drill, sample_n=len(sample.people)),
        counts_table_section("schools", "Schools and degrees", "school", "School and degree", schools, traced, ev,
                             other_label="Other schools", caption="Each person's highest degree.",
                             drill=lambda label: ctx.drill("school", school_names.get(label) or label, label), sample_n=len(sample.people)),
        distribution_section("years", "Years of experience at entry", ordered_years, sum(ordered_years.values()), ev, top=None,
                             unit="people", keep_order=True, other_label="Other",
                             caption=(f"Median {median(raw_years):.1f} years of experience at entry." if raw_years else None),
                             sample_n=len(sample.people)),  # experience at entry is read from whole profiles: not drillable
    ]

    next_steps = [step(f"Plan your own route to {role_label} in {place}", "reverse_gps", role=role, city=city, country=country, company=company)]
    if country:
        next_steps.append(step(f"Read current {role_label} postings in {country}", "job_postings", role=role, city=city, country=country))
    if company:
        next_steps.append(step(f"See your Internship-to-Job chances at {company}", "internship_chances", company=company, country=country))

    med = median(raw_years)
    facts = [f"Position: {target_label}; {n} visible people; {traced} entries traced."]
    if med is not None:
        facts.append(f"Median years of experience at entry: {med:.1f}.")
    top_feed = [f for f, c in feeders.most_common(3) if c >= 5]
    if top_feed:
        facts.append("Common previous employers: " + ", ".join(top_feed) + ".")
    return await ctx.finish(
        TOOL,
        f"How people got into {target_label}",
        sections,
        ctx.confidence(traced),
        f"Based on {traced} entry routes traced from {len(sample.people)} profiles read (of {n:,} visible people in the position).",
        cohort=Cohort(definition=f"People who are {target_label} today", filters={"role": role, "company": company, "city": city,
                      "country": country, "crustdata": target}, n_visible=n, match_level="field_only", widened=False),
        next_steps=next_steps,
        facts=facts,
        coverage=(traced / n) if n else None,
    )


__all__ = ["run", "make_count"]
