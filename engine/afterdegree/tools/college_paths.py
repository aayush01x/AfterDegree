"""9. College Paths: which universities, programmes and Indian colleges lead to the user's goal role.

Nested arrays: a plain `and` on education conditions means ONE school entry, so the goal group (which already requires an
Indian school) is combined with a degree/school entry through `all_of` (different entries may match).

Counting (same rule as every tool): every number in a table is an exact count-only total. A small,
cheap profile sample (education only) is read just to pick which universities, programmes and
colleges to count. The goal-group counts run before the sample, and the sample leaves credits for
the per-row counts that follow it. Rows under 5 people fold into the remainder.
"""

from __future__ import annotations

from collections import Counter

from .. import filters as F
from .. import taxonomy as tx
from ..profile import ParsedPerson, further_degrees
from ..schemas import Cohort, Result
from ..stats import MIN_ROW_COUNT, make_count, share_of
from ..toolkit import ToolContext, section, stat_section, text_section
from .common import place_text, require_role, resolve_place, step, title_or

TOOL = "college_paths"
SAMPLE_N = 40
TOP_UNIS = 6
TOP_PROGRAMMES = 4
TOP_COLLEGES = 3
WINDOW_YEARS = 8  # "recent graduates" for the outcome rates
HOME = "India"
SAMPLE_FIELDS = ["basic_profile.location", "basic_profile.current_title", "education.schools"]  # 0.33 credits/profile
ABROAD = ["United States", "United States of America", "United Kingdom", "Germany", "Canada", "Australia", "Netherlands",
          "The Netherlands", "Ireland", "France", "Switzerland", "Sweden", "Singapore", "New Zealand", "Italy", "Spain",
          "Finland", "Denmark", "Norway", "Belgium", "Austria", "Japan", "Hong Kong", "United Arab Emirates", "Poland",
          "Portugal", "Czechia", "Israel", "South Korea", "China"]
LEVEL_PHRASES = {
    "masters": ["Master", "MSc", "M.Sc", "MS", "MEng", "M.Tech", "MTech"],
    "any_further": ["Master", "MSc", "M.Sc", "MS", "MEng", "M.Tech", "MTech", "MBA", "PhD", "Ph.D", "Doctor of Philosophy", "Doctorate"],
}
LEVELS_OF = {"masters": ("Master's",), "any_further": ("Master's", "MBA", "PhD")}


# ------------------------------------------------------------------ filters (shared with the drill-down)


def goal_parts(role: str, city: str | None, country: str | None, company: tuple[str | None, int | None] | None) -> list[dict]:
    """The goal group's non-education conditions (title, place, company)."""
    parts = [title_or(F.CUR, role)]
    if city:
        parts.append(F.person_city(city))
    elif country:
        parts.append(F.person_country(country))
    if company and (company[0] or company[1]):
        parts.append(F.company_condition(F.CUR, company[0], company[1]))
    return [x for x in parts if x]


def with_entry(parts: list[dict], element: dict, india: bool = True) -> dict:
    """Goal group + one education entry. `all_of` (nested arrays only) lets the Indian school and the further degree be
    different entries; a plain `and` would force them onto the same school."""
    edu = F.all_of(F.india_educated(), element) if india else element
    return F.and_(*parts, edu) or {}


def goal_filters(role: str, city: str | None, country: str | None, company: tuple[str | None, int | None] | None,
                 india: bool = True) -> dict:
    parts = [title_or(F.CUR, role)]
    if city:
        parts.append(F.person_city(city))
    elif country:
        parts.append(F.person_country(country))
    if company and (company[0] or company[1]):
        parts.append(F.company_condition(F.CUR, company[0], company[1]))
    if india:
        parts.append(F.india_educated())
    return F.and_(*parts) or {}


def field_phrases(field: str | None) -> list[str]:
    if not field:
        return []
    label, phrase = tx.normalise_field(field)
    return tx.field_search_phrases(phrase or label or field)


def further_element(level: str, field: str | None, schools: list[str] | None = None, abroad: bool = True,
                    window: tuple[int, int] | None = None) -> dict:
    """Conditions on ONE education element: a further degree (level), optionally at a school / abroad / in a field / recent."""
    parts = [F.phrase_any(f"{F.EDU}.degree", LEVEL_PHRASES.get(level, LEVEL_PHRASES["masters"]))]
    if schools:
        parts.append(F.cond(f"{F.EDU}.school", "in", list(dict.fromkeys(schools))))
    if abroad:
        parts.append(F.cond(f"{F.EDU}.location.country", "in", ABROAD))
    fp = field_phrases(field)
    if fp:
        parts.append(F.phrase_any(f"{F.EDU}.field_of_study", fp))
    if window:
        parts += [F.cond(f"{F.EDU}.end_year", "=>", window[0]), F.cond(f"{F.EDU}.end_year", "=<", window[1])]
    return F.and_(*parts)  # type: ignore[return-value]


def college_element(schools: list[str], window: tuple[int, int] | None, field: str | None = None) -> dict:
    parts = [F.cond(f"{F.EDU}.school", "in", list(dict.fromkeys(schools)))]
    fp = field_phrases(field)
    if fp:
        parts.append(F.phrase_any(f"{F.EDU}.field_of_study", fp))
    if window:
        parts += [F.cond(f"{F.EDU}.end_year", "=>", window[0]), F.cond(f"{F.EDU}.end_year", "=<", window[1])]
    return F.and_(*parts)  # type: ignore[return-value]


def window_for(ctx: ToolContext) -> tuple[int, int]:
    y = ctx.today.year
    return y - WINDOW_YEARS, y


async def step_condition(ctx: ToolContext, value: str, params: dict) -> dict | None:
    """The exact element behind a College Paths row, for drill-downs (`uni:`, `college:`, `programme:` values)."""
    level = params.get("level") or "masters"
    field = (params.get("field") or "").strip() or None
    if value.startswith("uni:"):
        variants = await ctx.school_variants(value[4:])
        return further_element(level, field, variants)
    if value.startswith("college:"):
        variants = await ctx.school_variants(value[8:])
        return college_element(variants, window_for(ctx))
    if value.startswith("programme:"):
        return further_element(level, value[len("programme:"):])
    if value.startswith("yourprog:"):
        inst = params.get("institution") or ctx.goals.get("institution")
        variants = await ctx.school_variants(inst) if inst else []
        prog = value[len("yourprog:"):]
        return college_element(variants, window_for(ctx), None if prog == "All programmes" else prog)
    return None


# ------------------------------------------------------------------ sample → candidates


def _further(pp: ParsedPerson, level: str, field: str | None) -> list:
    levels = LEVELS_OF.get(level, LEVELS_OF["masters"])
    fp = [p.lower() for p in field_phrases(field)]
    out = []
    for s in further_degrees(pp):
        if s.level not in levels or not s.school or not s.country or s.country == HOME:
            continue
        if fp and not any(p in (s.field or "").lower() for p in fp):
            continue
        out.append(s)
    return out


def candidates(people: list[ParsedPerson], level: str, field: str | None) -> tuple[Counter, dict[str, str], Counter, Counter]:
    unis: Counter = Counter()
    uni_country: dict[str, str] = {}
    progs: Counter = Counter()
    colleges: Counter = Counter()
    for pp in people:
        seen_u, seen_p = set(), set()
        for s in _further(pp, level, field):
            if s.school not in seen_u:
                unis[s.school] += 1
                seen_u.add(s.school)
                uni_country.setdefault(s.school, s.country)  # type: ignore[arg-type]
            label, _ = tx.normalise_field(s.field)
            if label and label not in seen_p:
                progs[label] += 1
                seen_p.add(label)
        ug = pp.undergrad()
        if ug and ug.school and (ug.country in (None, HOME)) and (ug.country == HOME or tx.looks_indian_school(ug.school)):
            colleges[ug.school] += 1
    return unis, uni_country, progs, colleges


# ------------------------------------------------------------------ run


async def run(ctx: ToolContext) -> Result:
    p = ctx.params
    role = require_role(p.get("role"))
    city, country = resolve_place(p.get("city"), p.get("country"))
    company_name = (p.get("company") or "").strip() or None
    level = p.get("level") or "masters"
    field = (p.get("field") or "").strip() or None
    field_label = tx.normalise_field(field)[0] if field else None
    institution = p.get("institution") or (ctx.goals.get("institution") if ctx.is_university else None)
    role_label = tx.display_role(role)
    place = place_text(city, country)
    ctx.tool = TOOL
    ctx.total_steps = 6
    window = window_for(ctx)
    level_text = "a master's" if level == "masters" else "a further degree"

    await ctx.step("Counting people in your goal role")
    company = None
    if company_name:
        company = await ctx.identify_company(company_name)
        company = (company[1], company[0])
    goal = goal_filters(role, city, country, company)
    gparts = goal_parts(role, city, country, company)
    target_label = role_label + (f" at {company[0]}" if company else "") + f" in {place}"
    base = await ctx.count_many([
        ("g", goal, f"Indian-educated people who are {target_label} now"),
        ("abroad", with_entry(gparts, further_element(level, field)) or {}, f"…with {level_text} from a university abroad"),
        ("any", with_entry(gparts, further_element(level, field, abroad=False)) or {}, f"…with {level_text} anywhere"),
    ])
    n_g, ev_g = base["g"]
    k_abroad, ev_ab = base["abroad"]
    k_any, ev_any = base["any"]
    if n_g is None:
        n_g, ev_g = await ctx.count_people(goal, f"Indian-educated people who are {target_label} now")

    await ctx.step("Reading where they studied")
    people: list[ParsedPerson] = []
    ev_s = None
    if n_g:
        planned = TOP_UNIS * 3 + TOP_PROGRAMMES + (TOP_COLLEGES + 1) * 2
        sample = await ctx.sample_people(goal, max_results=SAMPLE_N, fields=SAMPLE_FIELDS, note="Education of people in the goal role",
                                         reserve=planned * 0.25)
        people, ev_s = sample.people, sample.evidence_id
    unis, uni_country, progs, colleges = candidates(people, level, field)
    sample_n = len(people)

    await ctx.step("Counting graduates of each university")
    top_unis = [u for u, _ in unis.most_common(TOP_UNIS)]
    variants = {}
    for u in top_unis:
        variants[u] = await ctx.school_variants(u)
    own = ctx.derived.get("undergrad_school") if not institution else None
    top_colleges = [c for c, _ in colleges.most_common(TOP_COLLEGES + 1) if not own or tx.short_school(c) != tx.short_school(own)][:TOP_COLLEGES]
    for c in [*top_colleges, *([own] if own else [])]:
        variants[c] = await ctx.school_variants(c)
    top_progs = [x for x, _ in progs.most_common(TOP_PROGRAMMES)]

    items: list[tuple[tuple, dict, str]] = []
    for u in top_unis:
        items.append((("u_all", u), with_entry(gparts, further_element(level, field, variants[u])) or {}, f"{u}: people in the goal role"))
        items.append((("u_k", u), with_entry(gparts, further_element(level, field, variants[u], window=window)) or {},
                      f"{u}: recent graduates in the goal role"))
        items.append((("u_n", u), F.all_of(F.india_educated(), further_element(level, field, variants[u], window=window)) or {},
                      f"{u}: recent Indian-educated graduates"))
    for prog in top_progs:
        items.append((("p", prog), with_entry(gparts, further_element(level, prog)) or {}, f"{prog}: people in the goal role"))
    for c in [*top_colleges, *([own] if own else [])]:
        items.append((("c_k", c), with_entry(gparts, college_element(variants[c], window)) or {}, f"{c}: recent graduates in the goal role"))
        items.append((("c_n", c), college_element(variants[c], window), f"{c}: recent graduates"))
    your_progs: list[str] = []
    if institution:
        inst_var = await ctx.school_variants(institution)
        your_progs = list(p.get("programs") or ctx.goals.get("programs") or []) or ["All programmes"]
        for prog in your_progs[:5]:
            fld = None if prog == "All programmes" else prog
            items.append((("y_k", prog), with_entry(gparts, college_element(inst_var, window, fld), india=False), f"{prog}: graduates in the goal role"))
            items.append((("y_n", prog), college_element(inst_var, window, fld), f"{prog}: graduates"))
    res = await ctx.count_many(items) if items else {}

    def got(key) -> tuple[int | None, str | None]:
        return res.get(key, (None, None))

    await ctx.step("Ranking universities, programmes and colleges")
    sections = []
    sections.append(stat_section("goal_size", "Your goal", f"Indian-educated people are {target_label} today", display=f"{n_g:,}",
                                 value=n_g, unit="people", evidence_ids=[ev_g] if ev_g else []))
    if k_abroad is not None and k_any is not None and n_g:
        k_any = max(k_any, k_abroad)
        dist = {f"{_cap(level_text)} from abroad": k_abroad, f"{_cap(level_text)}, not abroad or place not listed": k_any - k_abroad}
        rest = max(0, n_g - k_any)
        small = sum(v for v in dist.values() if 0 < v < MIN_ROW_COUNT)  # groups under 5 aren't shown on their own
        items_d = [{"label": k, "count": v, "share": share_of(v, n_g), "target": False, "remainder": False}
                   for k, v in dist.items() if v >= MIN_ROW_COUNT]
        no_label = f"No {level_text.split(' ', 1)[1]} shown"
        items_d.append({"label": no_label if not small else f"{no_label}, or a group under 5", "count": rest + small,
                        "share": share_of(rest + small, n_g), "remainder": True})
        sections.append(section("further_degree", "distribution", "Did they study further?", {
            "n": n_g, "items": items_d, "unit": "people",
            "caption": f"Exact counts over all {n_g:,}. 'Abroad' means the school's listed country is outside India." }, [e for e in (ev_g, ev_ab, ev_any) if e]))

    # Universities: people in the goal (all years) + outcome rate of recent graduates.
    uni_rows, shown = [], 0
    ev_u: list[str] = []
    for u in top_unis:
        k_all, e1 = got(("u_all", u))
        k_r, e2 = got(("u_k", u))
        n_r, e3 = got(("u_n", u))
        if k_all is None or k_all < MIN_ROW_COUNT:
            continue
        ev_row = [e for e in (e1, e2, e3) if e]
        ev_u += ev_row
        rate = make_count(min(k_r or 0, n_r), n_r, ev_row).model_dump() if n_r else None
        uni_rows.append({"id": _slug(u), "cells": {"university": tx.short_school(u) or u, "country": uni_country.get(u), "in_goal": k_all,
                                                    "graduates": n_r, "rate": rate},
                         "count": make_count(k_all, n_g, ev_row).model_dump(), "drill": ctx.drill("school", "uni:" + u, tx.short_school(u) or u)})
        shown += k_all
    uni_rows.sort(key=lambda r: -r["cells"]["in_goal"])
    if uni_rows and k_abroad and k_abroad > shown:
        uni_rows.append({"id": "other", "cells": {"university": "Other universities abroad", "country": None, "in_goal": k_abroad - shown,
                                                  "graduates": None, "rate": None}, "rest": True})
    sections.append(section("universities", "ranked_table", "Universities that lead there", {
        "n": n_g,
        "columns": [{"key": "university", "label": "University", "type": "text"}, {"key": "country", "label": "Country", "type": "text"},
                    {"key": "in_goal", "label": f"Now {role_label}" + (f" in {place}" if place != "anywhere" else ""), "type": "int", "bar": True},
                    {"key": "graduates", "label": f"Indian-educated graduates {window[0]}–{window[1]}", "type": "int"},
                    {"key": "rate", "label": "Of those, now in your goal", "type": "count"}],
        "rows": uni_rows,
        "default_sort": {"key": "in_goal", "dir": "desc"},
        "caption": (f"Exact counts. '{_cap(level_text)}' from each university"
                    + (f" in {field_label}" if field_label else "")
                    + f"; the rate compares its Indian-educated graduates of {window[0]}–{window[1]} who are in your goal now with all of them. "
                    f"Universities were picked from {sample_n} profiles read; ones with fewer than 5 people in your goal aren't listed."),
        "note": None if uni_rows else "No university abroad has 5 or more visible people in this goal yet.",
    }, ev_u or [e for e in (ev_s,) if e]))

    prog_rows, shown_p = [], 0
    ev_p: list[str] = []
    for prog in top_progs:
        k, e = got(("p", prog))
        if k is None or k < MIN_ROW_COUNT:
            continue
        ev_p += [e] if e else []
        prog_rows.append({"id": _slug(prog), "cells": {"programme": prog, "people": k}, "count": make_count(k, n_g, [e] if e else []).model_dump(),
                          "drill": ctx.drill("degree", "programme:" + prog, prog)})
        shown_p += k
    prog_rows.sort(key=lambda r: -r["cells"]["people"])
    if prog_rows and k_abroad and k_abroad > shown_p:
        prog_rows.append({"id": "other", "cells": {"programme": "Other fields", "people": k_abroad - shown_p}, "rest": True})
    sections.append(section("programmes", "ranked_table", "Programmes that lead there", {
        "n": n_g,
        "columns": [{"key": "programme", "label": "Field of the degree abroad", "type": "text"},
                    {"key": "people", "label": "People", "type": "int", "bar": True}],
        "rows": prog_rows,
        "caption": f"Exact counts of people in your goal with {level_text} abroad in each field (share of all {n_g:,}). "
                   "Someone with two degrees abroad can appear twice.",
    }, ev_p))

    if not institution:
        col_rows = []
        ev_c: list[str] = []
        for c in [*top_colleges, *([own] if own else [])]:
            k, e1 = got(("c_k", c))
            n, e2 = got(("c_n", c))
            is_you = bool(own and c == own)
            if k is None or n is None or (k < MIN_ROW_COUNT and not is_you):
                continue
            ev_row = [e for e in (e1, e2) if e]
            ev_c += ev_row
            col_rows.append({"id": "you" if is_you else _slug(c),
                             "cells": {"college": tx.short_school(c) or c, "graduates": n, "in_goal": k,
                                       "rate": make_count(min(k, n), n, ev_row).model_dump() if n else None},
                             "count": make_count(min(k, n), n, ev_row).model_dump() if n else None,
                             "you": is_you, "badges": ["Your college"] if is_you else [],
                             **({"drill": ctx.drill("school", "college:" + c, tx.short_school(c) or c)} if k >= MIN_ROW_COUNT else {})})
        col_rows.sort(key=lambda r: (not r["you"], -r["cells"]["in_goal"]))
        sections.append(section("indian_colleges", "ranked_table", "Indian colleges that send people there", {
            "columns": [{"key": "college", "label": "College", "type": "text"},
                        {"key": "graduates", "label": f"Graduates {window[0]}–{window[1]}", "type": "int"},
                        {"key": "in_goal", "label": "Now in your goal", "type": "int", "bar": True},
                        {"key": "rate", "label": "Share now in your goal", "type": "count"}],
            "rows": col_rows,
            "caption": f"Exact counts of each college's graduates of {window[0]}–{window[1]} and how many are {target_label} now. "
                       f"Colleges were picked from {sample_n} profiles read; your own college is always shown.",
        }, ev_c))
    else:
        y_rows = []
        ev_y: list[str] = []
        for prog in your_progs[:5]:
            k, e1 = got(("y_k", prog))
            n, e2 = got(("y_n", prog))
            if k is None or n is None:
                continue
            ev_row = [e for e in (e1, e2) if e]
            ev_y += ev_row
            y_rows.append({"id": _slug(prog), "cells": {"programme": prog, "graduates": n, "in_goal": k,
                                                         "rate": make_count(min(k, n), n, ev_row).model_dump() if n else None},
                           "count": make_count(min(k, n), n, ev_row).model_dump() if n else None,
                           **({"drill": ctx.drill("school", "yourprog:" + prog, prog)} if k >= MIN_ROW_COUNT else {})})
        sections.append(section("your_programmes", "ranked_table", "Your programmes: graduates now in this goal", {
            "columns": [{"key": "programme", "label": "Programme", "type": "text"},
                        {"key": "graduates", "label": f"Graduates {window[0]}–{window[1]}", "type": "int"},
                        {"key": "in_goal", "label": f"Now {target_label}", "type": "int", "bar": True},
                        {"key": "rate", "label": "Share", "type": "count"}],
            "rows": y_rows,
            "caption": f"Exact counts of {tx.short_school(institution) or institution} graduates of {window[0]}–{window[1]} who are {target_label} now "
                       "(any background).",
        }, ev_y))

    sections.append(text_section("method", "How this was worked out",
        f"I counted Indian-educated people whose current title matches {role_label}"
        + (f" in {place}" if place != "anywhere" else "") + (f" at {company[0]}" if company else "")
        + f" ({n_g:,} visible profiles), read the education of {sample_n} of them to find which universities, programmes and colleges "
        "come up, then counted each one exactly. A university's rate is how many of its Indian-educated graduates from "
        f"{window[0]} to {window[1]} hold this role now; people who don't list a degree or a school's country aren't counted, so every "
        "number is 'at least'. A low rate can mean many graduates chose other roles, not that the route doesn't work.",
        [e for e in (ev_g, ev_s) if e]))

    top_u = next((r["cells"]["university"] for r in uni_rows if not r.get("rest")), None)
    next_steps = [step(f"Trace the routes into {role_label} in {place}" + (f" (via {top_u})" if top_u else ""), "reverse_gps",
                       role=role, city=city, country=country, company=company[0] if company else None),
                  step("See where people like you are now", "people_like_me")]
    if country and country != HOME:
        next_steps.append(step(f"Find employers in {country} that hire Indian-educated people", "indian_friendly", country=country, role=role, city=city))
    facts = [f"Goal: {target_label}; {n_g} Indian-educated people visible."]
    if k_abroad is not None and n_g:
        facts.append(f"With {level_text} from abroad: {k_abroad} of {n_g}.")
    for r in uni_rows[:3]:
        if not r.get("rest"):
            facts.append(f"{r['cells']['university']}: {r['cells']['in_goal']} people in the goal.")
    cohort = Cohort(definition=f"Indian-educated people who are {target_label} today",
                    filters={"role": role, "city": city, "country": country, "company": company[0] if company else None, "level": level,
                             "field": field, "goal": {"role": role, "city": city, "country": country, "company": company[0] if company else None},
                             "crustdata": goal},
                    n_visible=n_g, match_level="field_only", widened=False)
    if n_g < 10:
        ctx.warn(f"Only {n_g} Indian-educated people are visible in this goal, so read this as a hint, not a ranking.")
    return await ctx.finish(
        TOOL,
        f"Colleges and programmes that lead to {target_label}",
        sections,
        ctx.confidence(n_g) if n_g >= 10 else "low",
        f"Every number is an exact count of visible profiles; the {sample_n} profiles read were used only to choose which universities, "
        "programmes and colleges to count. People without public profiles are not counted.",
        cohort=cohort,
        next_steps=next_steps,
        facts=facts,
        coverage=(sample_n / n_g) if n_g else None,
    )


def _cap(s: str) -> str:
    return s[:1].upper() + s[1:]


def _slug(text: str) -> str:
    import re

    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "row"


__all__ = ["run", "step_condition", "goal_filters", "further_element", "college_element"]
