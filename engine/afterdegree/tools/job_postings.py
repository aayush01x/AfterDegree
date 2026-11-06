"""6. Job Posting Analysis: volume and trend, seniority, skills, languages, visa wording, hire-through signal."""

from __future__ import annotations

from collections import Counter

from .. import filters as F
from .. import taxonomy as tx
from ..crustdata import BudgetExceeded
from ..schemas import Result
from ..stats import make_count
from ..toolkit import ToolContext, iso, months_ago, section, stat_section
from .common import company_value, distribution_section, job_title_or, pct, place_text, require_role, resolve_place, step, title_or

TOOL = "job_postings"
TREND_MONTHS = 12
HIRE_CHECKS = 5
JOB_SAMPLE_N = 60  # skills, languages and visa wording are read from the most recent postings


def language_bucket(kind: str, lang: str | None) -> str:
    if kind == "required":
        return f"{lang} required"
    if kind == "written_in":
        return f"Posting written in {lang}"
    if kind == "plus":
        return f"{lang} a plus"
    return "English only"


async def run(ctx: ToolContext) -> Result:
    p = ctx.params
    role = require_role(p.get("role"))
    city, country = resolve_place(p.get("city"), p.get("country"), required_country=True)
    role_label = tx.display_role(role)
    place = place_text(city, country)
    ctx.tool = TOOL
    ctx.total_steps = 6
    today = ctx.today

    base = F.and_(job_title_or(role), F.job_country(country), F.job_city(city) if city else None) or {}

    await ctx.step("Counting open postings")
    d30 = iso(today.fromordinal(today.toordinal() - 30))
    d90 = iso(today.fromordinal(today.toordinal() - 90))
    n30, _, ev30 = await ctx.count_jobs(F.and_(base, *F.job_date_range(d30)), "Postings added in the last 30 days")
    n90, _, ev90 = await ctx.count_jobs(F.and_(base, *F.job_date_range(d90)), "Postings added in the last 90 days")
    d180 = iso(today.fromordinal(today.toordinal() - 180))
    nprev, _, evprev = await ctx.count_jobs(F.and_(base, *F.job_date_range(d180, d90)), "Postings added in the 90 days before that")

    await ctx.step("Building the monthly trend")
    points = []
    for i in range(TREND_MONTHS - 1, -1, -1):
        start = months_ago(today, i)
        end = months_ago(today, i - 1) if i > 0 else None
        try:
            n_m, _, _ = await ctx.count_jobs(F.and_(base, *F.job_date_range(iso(start), iso(end) if end else None)) or {},
                                             f"Postings added in {start.strftime('%Y-%m')}")
            points.append({"period": start.strftime("%Y-%m"), "value": n_m, "drill": ctx.drill("quarter", start.strftime("%Y-%m"))})
        except BudgetExceeded:
            ctx._budget_warning()
            break

    await ctx.step("Reading seniority and top employers")
    _, agg_data, ev_agg = await ctx.count_jobs(
        F.and_(base, *F.job_date_range(d90)) or {},
        "Titles and employers of postings in the last 90 days",
        aggregations=[
            {"type": "group_by", "field": "job_details.title", "agg": "count", "size": 300},
            {"type": "group_by", "field": "company.basic_info.company_id", "agg": "count", "size": 10},
        ],
    )
    seniority: Counter = Counter()
    employers: list[dict] = []
    for agg in agg_data.get("aggregations") or []:
        if agg.get("field") == "job_details.title":
            for b in agg.get("buckets") or []:
                seniority[tx.seniority_from_title(str(b.get("key")))] += int(b.get("count") or 0)
        elif agg.get("field") == "company.basic_info.company_id":
            for b in agg.get("buckets") or []:
                meta = b.get("metadata") or {}
                employers.append({"id": b.get("key"), "name": meta.get("company_name") or str(b.get("key")), "postings": int(b.get("count") or 0)})
    seniority_ordered = {k: seniority[k] for k in tx.SENIORITY_ORDER if seniority.get(k)}
    # The title aggregation covers the most common titles only: show the rest instead of implying full coverage.
    unclassified = max(0, n90 - sum(seniority_ordered.values()))

    await ctx.step("Reading recent postings for skills, languages and visas")
    jobs, total_sampled_pool, ev_jobs = await ctx.sample_jobs(F.and_(base, *F.job_date_range(d90)) or base, max_results=JOB_SAMPLE_N,
                                                              note="Recent postings")
    ev_s = [e for e in (ev_jobs,) if e]
    skills: Counter = Counter()
    langs: Counter = Counter()
    visa: Counter = Counter()
    for j in jobs:
        desc = (j.get("content") or {}).get("description")
        for s in tx.skills_in_text(desc):
            skills[s] += 1
        kind, lang = tx.language_requirement(desc)
        langs[language_bucket(kind, lang)] += 1
        visa[tx.visa_signal(desc)] += 1
    n_jobs = len(jobs)

    await ctx.step("Checking whether postings led to hires")
    since = iso(months_ago(today, 12))
    rows = []
    for emp in employers[:HIRE_CHECKS]:
        hires = None
        if emp["id"] is not None:
            filters = F.and_(
                title_or(F.CUR, role),
                F.cond(f"{F.CUR}.company_id", "=", int(emp["id"])),
                F.cond(f"{F.CUR}.start_date", "=>", since),
                F.person_country(country),
            )
            hires, _ = await ctx.count_people_safe(filters or {}, f"People who started as {role_label} at {emp['name']} in the last 12 months")
        if hires is None:
            signal = ["Hires not checked (unclear)"]
        elif hires >= 5 and hires >= 0.1 * emp["postings"]:
            signal = ["Hires seen"]
        elif hires > 0:
            signal = ["Few hires seen"]
        else:
            signal = ["No matching hires seen yet"]
        rows.append({
            "id": str(emp["id"]),
            "cells": {"employer": emp["name"], "postings": emp["postings"], "hires": hires, "signal": signal},
            "drill": ctx.drill("posting_employer", company_value(emp["name"], emp["id"]), emp["name"]),
            "you": bool(ctx.derived.get("current_company") and emp["name"].lower() == ctx.derived["current_company"].lower()),
        })
    unchecked = employers[HIRE_CHECKS:]
    if unchecked:
        rows.append({"id": "other", "cells": {"employer": "Other top employers", "postings": sum(e["postings"] for e in unchecked),
                                              "hires": None, "signal": []}, "rest": True})

    await ctx.step("Writing it up")
    visa_count = make_count(visa.get("offers", 0), n_jobs, ev_s)
    change = f"{n90 - nprev:+,} vs the 90 days before" if nprev else None
    sections = [
        stat_section("open_90", "Open postings", "postings added in the last 90 days", display=f"{n90:,}", value=n90, unit="postings",
                     note=change, evidence_ids=[ev90]),
        stat_section("open_30", "Last 30 days", "postings added in the last 30 days", display=f"{n30:,}", value=n30, unit="postings",
                     evidence_ids=[ev30]),
        stat_section("open_prev", "The 90 days before", "postings added in the previous 90 days", display=f"{nprev:,}", value=nprev,
                     unit="postings", evidence_ids=[evprev]),
        section("trend", "timeseries", "Postings added per month", {"points": points, "unit": "postings",
                "caption": "Postings stay in the index after they close, so these are postings added each month, not live vacancies."}),
        distribution_section("seniority", "Seniority asked for", seniority_ordered, n90 if unclassified else sum(seniority_ordered.values()),
                             [ev_agg], top=None, unit="postings", keep_order=True,
                             caption="Exact counts from the job titles of the postings in the last 90 days"
                             + (f"; {unclassified:,} postings with less common titles aren't grouped." if unclassified else "."),
                             remainders={"Less common titles": unclassified} if unclassified else None,
                             drill=lambda label: None if label.startswith("Mid level") else ctx.drill("seniority", label)),
        section("skills", "keywords", "Skills in demand", {
            "items": [{"term": t, "count": c, "share": round(c / n_jobs, 3) if n_jobs >= 10 else None, "you_have": t in ctx.user_skills(),
                       "drill": ctx.drill("skill", t)}
                      for t, c in skills.most_common(20) if c >= 2],
            "n": n_jobs, "caption": f"Mentions in the {n_jobs} most recent postings.",
        }, ev_s),
        distribution_section("languages", "Language requirements", langs, n_jobs, ev_s, top=None, unit="postings",
                             caption=f"Read from the text of the {n_jobs} most recent postings (of {n90:,}): 'required' means the posting "
                             "asks for the language, not just mentions it.",
                             drill=lambda label: None if label.startswith("English only") else ctx.drill("language", label), sample_n=n_jobs),
        stat_section("visa", "Visa sponsorship", "postings mention visa sponsorship or relocation support", count=visa_count,
                     note=f"Read from the {n_jobs} most recent postings (of {n90:,}). {visa.get('rules_out', 0)} of them say they can't "
                     "sponsor; the rest don't say."),
        section("employers", "ranked_table", "Employers posting most, and whether postings led to hires", {
            "n": n90,
            "columns": [{"key": "employer", "label": "Employer", "type": "text"},
                        {"key": "postings", "label": "Postings (90 days)", "type": "int", "bar": True},
                        {"key": "hires", "label": "Matching hires (12 months)", "type": "int"},
                        {"key": "signal", "label": "Hire-through", "type": "badges"}],
            "rows": rows,
            "caption": "Matching hires are people whose profile shows them starting this role at the employer in the last 12 months.",
        }, [ev_agg]),
    ]

    for sec in sections:
        if sec.id in ("visa", "skills"):
            sec.data["sample_n"] = n_jobs
    next_steps = [
        step(f"Check how crowded {role_label} roles in {place} are", "market_saturation", role=role, city=city, country=country),
        step(f"Trace routes to {role_label} in {place}", "reverse_gps", role=role, city=city, country=country),
        step(f"Find employers in {country} that hire Indian-educated people", "indian_friendly", country=country, role=role, city=city),
    ]
    top_lang = next(((k, v) for k, v in langs.most_common() if not k.startswith("English only")), None)
    facts = [f"{role_label} postings in {place}: {n30} in the last 30 days, {n90} in the last 90 days.",
             f"Postings offering visa sponsorship or relocation: {pct(visa_count)}."]
    if top_lang and n_jobs:
        facts.append(f"Most common language ask: {top_lang[0]} ({top_lang[1]} of {n_jobs} postings read).")
    if skills:
        facts.append("Top skills: " + ", ".join(t for t, _ in skills.most_common(5)) + ".")
    return await ctx.finish(
        TOOL,
        f"What {role_label} postings in {place} show",
        sections,
        ctx.confidence(n90, sample_n=n_jobs),
        f"Counts cover every indexed posting; skills, languages and visas are read from the {n_jobs} most recent postings. "
        "Postings on sites the index doesn't cover are not counted.",
        cohort=None,
        next_steps=next_steps,
        facts=facts,
        coverage=(n_jobs / n90) if n90 else None,
    )
