"""8. Market Saturation: new entrants with the user's background versus open postings, and the trend."""

from __future__ import annotations

from datetime import date

from .. import filters as F
from .. import taxonomy as tx
from ..cohort import plan_for_level
from ..crustdata import BudgetExceeded
from ..schemas import Cohort, Result
from ..toolkit import ToolContext, iso, months_ago, section, stat_section, text_section
from .common import job_title_or, place_text, require_role, resolve_place, step, title_or

TOOL = "market_saturation"
QUARTERS = 4


def level_for(ratio: float | None) -> str | None:
    """Entrants per opening -> saturation level. Thresholds: under 0.02 low, 0.02-0.08 medium, above high."""
    if ratio is None:
        return None
    if ratio < 0.02:
        return "low"
    if ratio < 0.08:
        return "medium"
    return "high"


LEVEL_TEXT = {
    "low": "Few people with your background are entering compared with the openings: the market looks open.",
    "medium": "A steady number of people with your background are entering compared with the openings: competitive but workable.",
    "high": "Many people with your background are entering compared with the openings: expect more competition from similar profiles.",
}


def quarter_starts(today: date, n: int) -> list[date]:
    q_month = ((today.month - 1) // 3) * 3 + 1
    current = date(today.year, q_month, 1)
    starts = [current]
    for _ in range(n):
        starts.append(months_ago(starts[-1], 3))
    starts.reverse()
    return starts  # n+1 boundaries: n complete quarters plus the current one


def q_label(d: date) -> str:
    return f"{d.year}-Q{(d.month - 1) // 3 + 1}"


async def run(ctx: ToolContext) -> Result:
    p = ctx.params
    role = require_role(p.get("role"))
    city, country = resolve_place(p.get("city"), p.get("country"), required_country=True)
    role_label = tx.display_role(role)
    place = place_text(city, country)
    ctx.total_steps = 5
    today = ctx.today

    plan = await plan_for_level(ctx, "field_only", with_years=False)
    if ctx.params.get("institution") or ctx.is_university:
        from ..cohort import university_plan

        inst = ctx.params.get("institution") or ctx.goals.get("institution")
        if inst:
            plan = await university_plan(ctx, inst, ctx.params.get("programs") or ctx.goals.get("programs"))
    background = plan.filters() if plan else F.india_educated()
    background_text = plan.definition if plan else "Indian-educated graduates"

    def entrants_filter(where_city: str | None, start: date, end: date | None) -> dict:
        parts = [background, title_or(F.CUR, role), F.cond(f"{F.CUR}.start_date", "=>", iso(start))]
        if end:
            parts.append(F.cond(f"{F.CUR}.start_date", "<", iso(end)))
        parts.append(F.person_city(where_city) if where_city else F.person_country(country))
        return F.and_(*parts) or {}

    def openings_filter(where_city: str | None, start: date, end: date | None) -> dict:
        return F.and_(job_title_or(role), F.job_city(where_city) if where_city else F.job_country(country),
                      *F.job_date_range(iso(start), iso(end) if end else None)) or {}

    await ctx.step("Counting new entrants and openings by quarter")
    bounds = quarter_starts(today, QUARTERS)
    entrants_pts, openings_pts = [], []
    ev_ids: list[str] = []
    total_e = total_o = 0
    for start, end in zip(bounds[:-1], bounds[1:]):
        try:
            e, ev_e = await ctx.count_people(entrants_filter(city, start, end), f"New {role_label}s like you in {place}, {q_label(start)}")
            o, _, ev_o = await ctx.count_jobs(openings_filter(city, start, end), f"{role_label} postings in {place}, {q_label(start)}")
        except BudgetExceeded:
            ctx._budget_warning()
            break
        ev_ids += [ev_e, ev_o]
        total_e += e
        total_o += o
        entrants_pts.append({"period": q_label(start), "value": e})
        openings_pts.append({"period": q_label(start), "value": o})

    ratio = round(total_e / total_o, 4) if total_o else None
    level = level_for(ratio)
    if total_e < 10:
        ctx.warn(f"Only {total_e} new entrants with your background were visible, so the rating rests on very few people.")

    await ctx.step("Comparing with other cities")
    comp_rows = []
    year_start, year_end = bounds[0], bounds[-1]
    if city:
        comp_rows.append({"id": city, "cells": {"city": city, "ratio": f"{ratio:.2f}" if ratio is not None else "No openings indexed",
                                                "openings": total_o, "entrants": total_e},
                          "badges": [f"{(level or 'unknown').capitalize()} saturation"], "you": True})
    for other in [c for c in tx.COMPARABLE_CITIES.get(country or "", []) if c != city][:4]:
        try:
            e, ev_e = await ctx.count_people(entrants_filter(other, year_start, year_end), f"New {role_label}s like you in {other}, last 12 months")
            o, _, ev_o = await ctx.count_jobs(openings_filter(other, year_start, year_end), f"{role_label} postings in {other}, last 12 months")
        except BudgetExceeded:
            ctx._budget_warning()
            break
        ev_ids += [ev_e, ev_o]
        r = round(e / o, 4) if o else None
        comp_rows.append({"id": other, "cells": {"city": other, "ratio": f"{r:.2f}" if r is not None else "No openings indexed",
                                                 "openings": o, "entrants": e},
                          "badges": [f"{(level_for(r) or 'unknown').capitalize()} saturation"], "you": False, "_r": r})
    others = sorted([r for r in comp_rows if not r["you"]], key=lambda r: (r["_r"] is None, r["_r"] or 0))
    comp_rows = [r for r in comp_rows if r["you"]] + others
    for r in comp_rows:
        r.pop("_r", None)

    await ctx.step("Writing it up")
    per100 = f"about {ratio * 100:.1f} new entrants like you per 100 openings" if ratio is not None else None
    sections = [
        stat_section("ratio", "Entrants per opening", "new entrants like you per open posting",
                     display=f"{ratio:.2f}" if ratio is not None else "n/a", value=ratio, unit="entrants per opening",
                     level=level, note=(f"{per100.capitalize()} over the last {QUARTERS} quarters." if per100 else "No openings indexed in this period."),
                     evidence_ids=ev_ids),
        section("trend", "timeseries", "New entrants and openings by quarter", {
            "series": [{"key": "entrants", "label": "Entrants like you", "points": entrants_pts},
                       {"key": "openings", "label": "Openings", "points": openings_pts}],
            "caption": "The current quarter is still in progress.",
        }, ev_ids),
        text_section("read", "What this means",
                     (LEVEL_TEXT[level] if level else "There weren't enough indexed postings to compare.")
                     + f" 'Entrants' are {background_text[0].lower() + background_text[1:]} whose profile shows them starting a {role_label} role in {place}"
                     " in the period; 'openings' are postings added to the index in the same period. Both undercount: not everyone updates "
                     "their profile and not every vacancy is posted where the index can see it, so compare places rather than reading the "
                     "number on its own. Under 0.02 per opening is low, 0.02 to 0.08 medium, above that high.", ev_ids),
        section("cities", "ranked_table", "Comparable cities", {
            "columns": [{"key": "city", "label": "City", "type": "text"}, {"key": "ratio", "label": "Entrants per opening", "type": "text"},
                        {"key": "openings", "label": "Openings (12 months)", "type": "int", "bar": True},
                        {"key": "entrants", "label": "New entrants like you", "type": "int"}],
            "rows": comp_rows,
            "caption": "Least crowded first, after your chosen city.",
        }, ev_ids),
        stat_section("entrants", "New entrants like you", f"new {role_label}s like you in {place} (last {QUARTERS} quarters)",
                     display=f"{total_e:,}", value=total_e, unit="people", evidence_ids=ev_ids),
        stat_section("openings", "Openings", f"{role_label} postings in {place} (last {QUARTERS} quarters)",
                     display=f"{total_o:,}", value=total_o, unit="postings", evidence_ids=ev_ids),
    ]
    best_other = next((r["cells"]["city"] for r in comp_rows if not r["you"] and r["badges"] == ["Low saturation"]), None)
    next_steps = [
        step(f"Read current {role_label} postings in {place}", "job_postings", role=role, city=city, country=country),
        step(f"Trace routes to {role_label} in {place}", "reverse_gps", role=role, city=city, country=country),
    ]
    if best_other:
        next_steps.append(step(f"Look at {role_label} postings in {best_other}", "job_postings", role=role, city=best_other, country=country))
    facts = [f"In the last {QUARTERS} quarters in {place}: {total_e} new {role_label}s with this background vs {total_o} postings."]
    if ratio is not None:
        facts.append(f"That is {ratio:.2f} per opening, rated {level}.")
    return await ctx.finish(
        TOOL,
        f"How crowded is {role_label} in {place}?",
        sections,
        ctx.confidence(min(total_e * 5, total_o)) if total_o and total_e >= 10 else "low",
        f"Entrants counted from visible profiles ({background_text}); openings from indexed postings. Both undercount the real market.",
        cohort=Cohort(definition=background_text, filters={"role": role, "city": city, "country": country, "crustdata": background},
                      n_visible=total_e, match_level=(plan.level if plan else "field_only"), widened=False),  # type: ignore[arg-type]
        next_steps=next_steps,
        facts=facts,
        coverage=None,
    )
