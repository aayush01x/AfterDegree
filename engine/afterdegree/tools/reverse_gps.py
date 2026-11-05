"""4. Reverse Career GPS: trace how people in the goal position got there; routes that fit the user."""

from __future__ import annotations

from collections import Counter, defaultdict

from .. import filters as F
from .. import taxonomy as tx
from ..analysis import find_target_role, route_fits, route_gaps, route_steps, user_steps, years_to_target
from ..llm import ParsedGoal, parse_goal_fallback, validate_goal
from ..schemas import Cohort, Result
from ..stats import make_count, median
from ..toolkit import ToolContext, ToolInputError, section, text_section
from .common import job_title_or, place_text, step, title_or

TOOL = "reverse_gps"
MIN_ROUTE = 5


def step_kind(label: str, target_label: str) -> str:
    if label == target_label:
        return "goal"
    if label.startswith("Bachelor's"):
        return "start"
    if any(w in label for w in ("Master's", "MBA", "PhD")):
        return "degree"
    return "role"


def route_title(steps: list[str]) -> str:
    degree = next((s for s in steps if any(w in s for w in ("Master's", "MBA", "PhD"))), None)
    intern = any(s.startswith("Internship") or s == "Converted an internship there" for s in steps)
    if degree and intern:
        return f"{degree}, then an internship or working-student role"
    if degree:
        return f"{degree} first"
    if any(s.startswith("Earlier job") for s in steps):
        return "Work abroad first, then move"
    if "Moved up inside the same company" in steps:
        return "Join, then move up inside the company"
    if any(s.startswith("Worked in India") for s in steps):
        return "Direct move after work in India"
    return "Direct route"


def route_fit(steps: list[str], done: set[str]) -> str:
    bachelor = next((s for s in steps if s.startswith("Bachelor's")), None)
    user_bachelor = next((s for s in done if s.startswith("Bachelor's")), None)
    if bachelor and user_bachelor and bachelor != user_bachelor:
        return "far"
    if route_fits(steps, done):
        return "fits_you"
    return "stretch"


async def parse_goal(ctx: ToolContext) -> tuple[ParsedGoal, str]:
    p = ctx.params
    if p.get("role"):
        goal = validate_goal(ParsedGoal(role=p.get("role"), city=p.get("city"), country=p.get("country"), company=p.get("company")))
        return goal, "from the fields you filled in"
    text = (p.get("goal_text") or "").strip()
    if not text:
        raise ToolInputError("Tell me the goal you have in mind.", hint='For example "ML engineer in Berlin".')
    if len(text) > 300:
        raise ToolInputError("That goal is a bit long for me to read.", hint="Use one short sentence, like 'Data engineer in Amsterdam'.")
    if ctx.llm is not None and getattr(ctx.llm, "available", False):
        goal, used = await ctx.llm.parse_goal(text)
        return goal, "with help from the language model" if used else "with simple rules"
    return parse_goal_fallback(text), "with simple rules"


ROUTE_SEP = " → "


def route_signature(steps: list[str]) -> str:
    return ROUTE_SEP.join(steps)


async def run(ctx: ToolContext) -> Result:
    ctx.tool = TOOL
    ctx.total_steps = 6
    await ctx.step("Reading your goal")
    goal, how = await parse_goal(ctx)
    if not goal.role:
        raise ToolInputError("I couldn't find a role in that goal.", hint='Try something like "Data engineer in Munich".')
    role, city, country, company = goal.role, goal.city, goal.country, goal.company
    role_label = tx.display_role(role)
    place = place_text(city, country)

    await ctx.step("Finding people in that position today")
    company_id = None
    if company:
        company_id, company = await ctx.identify_company(company)
    target_parts = [title_or(F.CUR, role)]
    if city:
        target_parts.append(F.person_city(city))
    elif country:
        target_parts.append(F.person_country(country))
    if company:
        target_parts.append(F.company_condition(F.CUR, company, company_id))
    target = F.and_(*target_parts) or {}
    n_all, _ = await ctx.count_people(target, "People in the goal position")
    like_filters = F.and_(target, F.india_educated()) or {}
    n_like, _ = await ctx.count_people_safe(like_filters, "People in the goal position who studied in India")

    await ctx.step("Reading how they got there")
    use_like = (n_like or 0) >= 10
    sample = await ctx.sample_people(like_filters if use_like else target, note="Profiles of people in the goal position", reserve=2.5)
    ev = [e for e in (sample.evidence_id,) if e]
    if not use_like:
        ctx.warn("Too few Indian-educated people were visible in this exact position, so the routes include people from any background.")

    await ctx.step("Grouping their routes")
    done = user_steps(ctx.profile, ctx.today)
    target_label = f"{role_label} in {place}" + (f" at {company}" if company else "")
    routes: dict[tuple, list[float | None]] = defaultdict(list)
    edges: Counter = Counter()
    for pp in sample.people:
        tr = find_target_role(pp, role, company, company_id)
        if tr is None:
            continue
        steps = route_steps(pp, tr, target_label, ctx.today)
        routes[tuple(steps)].append(years_to_target(pp, tr))
        for a, b in zip(steps, steps[1:]):
            edges[(a, b)] += 1
    traced = sum(len(v) for v in routes.values())

    route_items = []
    small = 0
    ranked = sorted(routes.items(), key=lambda kv: -len(kv[1]))
    for steps, years in ranked:
        if len(years) < MIN_ROUTE:
            small += len(years)
            continue
        steps_l = list(steps)
        typical = median(years)
        route_items.append({
            "id": f"r{len(route_items) + 1}",
            "title": route_title(steps_l),
            "steps": [{"label": st, "kind": step_kind(st, target_label)} for st in steps_l],
            "people": make_count(len(years), traced, ev).model_dump(),
            "typical_years": round(typical, 1) if typical is not None else None,
            "fit": route_fit(steps_l, done),
            "gaps": route_gaps(steps_l, done),
            "drill": ctx.drill("route", route_signature(steps_l), route_title(steps_l)),
        })
        if len(route_items) >= 6:
            break
    fit_order = {"fits_you": 0, "stretch": 1, "far": 2}
    route_items.sort(key=lambda r: (fit_order[r["fit"]], -r["people"]["k"]))

    nodes: dict[str, dict] = {}
    edge_list = []
    for (a, b), c in edges.most_common():
        if c < MIN_ROUTE:
            continue
        for label in (a, b):
            if label not in nodes:
                kind = step_kind(label, target_label)
                nodes[label] = {"id": f"n{len(nodes) + 1}", "label": label, "kind": kind}
                if kind != "goal":
                    nodes[label]["drill"] = ctx.drill("route_step", label)
        edge_list.append({"from": nodes[a]["id"], "to": nodes[b]["id"], "count": c})

    await ctx.step("Checking which skills the role asks for")
    skills_section = None
    job_filters = F.and_(job_title_or(role), F.job_country(country) if country else None, F.job_city(city) if city else None)
    if job_filters:
        jobs, total_jobs, ev_jobs = await ctx.sample_jobs(job_filters, max_results=60, note="Postings for the goal role")
        skill_counts: Counter = Counter()
        for j in jobs:
            for s in tx.skills_in_text((j.get("content") or {}).get("description")):
                skill_counts[s] += 1
        mine = ctx.user_skills()
        items = []
        for term, cnt in sorted(skill_counts.items(), key=lambda kv: (kv[0] in mine, -kv[1])):
            if cnt < 3:
                continue
            items.append({"term": term, "count": cnt, "share": round(cnt / len(jobs), 3) if len(jobs) >= 10 else None, "you_have": term in mine,
                          "drill": ctx.drill("skill", term)})
        items = items[:15]
        skills_section = section("skills_gap", "keywords", "Skills common in this role", {
            "items": items, "n": len(jobs),
            "caption": f"From the {len(jobs)} most recent matching postings. Skills already on your profile are marked.",
        }, [ev_jobs])
        missing = [i["term"] for i in items if not i["you_have"]][:3]
        for r in route_items:
            r["gaps"] += [f"Build {m}" for m in missing if f"Build {m}" not in r["gaps"]]

    await ctx.step("Writing it up")
    goal_parts = [f"Role: {role_label}"] + ([f"City: {city}"] if city else []) + ([f"Country: {country}"] if country else []) \
        + ([f"Company: {company}"] if company else [])
    sections = [
        text_section("goal", "Your goal, as I read it",
                     ". ".join(goal_parts) + f". I read this {how}. {n_all:,} people visibly hold this position today"
                     + (f", and {n_like:,} of them studied in India." if n_like is not None else "."), ev),
        section("routes", "route_list", "Routes that got people there", {
            "routes": route_items,
            "caption": (f"{small} people followed rarer routes (fewer than 5 people each) and are not listed. " if small else "")
            + f"Routes traced from {traced} profiles; 'fits you' means the route starts where you are now.",
        }, ev),
        section("graph", "routes", "How the routes connect", {
            "nodes": list(nodes.values()), "edges": edge_list,
            "caption": "Only steps taken by at least 5 people are drawn.",
        }, ev),
    ]
    if skills_section:
        sections.append(skills_section)
    if not route_items:
        ctx.warn("No single route was shared by 5 or more people in the profiles I read, so I can't show route details without exposing individuals.")

    next_steps = [step(f"See the entry routes into {role_label} roles in {place}", "routes_to_position", role=role, city=city, country=country, company=company)]
    if country:
        next_steps.append(step(f"Read current {role_label} postings in {country}", "job_postings", role=role, city=city, country=country))
        next_steps.append(step(f"Check how crowded {role_label} roles in {place} are", "market_saturation", role=role, city=city, country=country))
        next_steps.append(step(f"See your Internship-to-Job chances in {country}", "internship_chances", country=country, role=role))

    cohort = Cohort(
        definition=f"People who are {role_label} in {place} today" + (" and studied in India" if use_like else ""),
        filters={"goal": {"role": role, "city": city, "country": country, "company": company},
                 "role": role, "city": city, "country": country, "company": company, "crustdata": like_filters if use_like else target},
        n_visible=(n_like or 0) if use_like else n_all,
        match_level="field_only",
        widened=not use_like,
        widened_reason=None if use_like else "Too few Indian-educated people in this position, so I included everyone in it.",
    )
    facts = [f"Goal: {role_label} in {place}; {n_all} people hold it today" + (f", {n_like} studied in India." if n_like is not None else ".")]
    for r in route_items[:2]:
        facts.append(f"Route: {' -> '.join(st['label'] for st in r['steps'])}; {r['people']['display']} people; typical {r['typical_years']} years.")
    return await ctx.finish(
        TOOL,
        f"Routes to {role_label} in {place}",
        sections,
        ctx.confidence(traced, not use_like),
        f"Routes traced from {traced} profiles read (of {cohort.n_visible:,} visible people in the position). "
        "People without public profiles are not counted.",
        cohort=cohort,
        next_steps=next_steps,
        facts=facts,
        coverage=(traced / cohort.n_visible) if cohort.n_visible else None,
    )
