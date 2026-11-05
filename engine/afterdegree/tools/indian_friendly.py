"""7. Indian-Friendly Companies: employers abroad with evidence of hiring Indian-educated people, plus sponsorship signals."""

from __future__ import annotations

import re
from collections import defaultdict

from .. import filters as F
from .. import taxonomy as tx
from ..crustdata import BudgetExceeded, CrustdataError
from ..profile import ParsedPerson, Role, years_between
from ..schemas import Cohort, Result
from ..stats import make_count, median
from ..toolkit import ToolContext, iso, months_ago, section, text_section
from .common import place_text, resolve_place, step, title_or

TOOL = "indian_friendly"
TOP_EMPLOYERS = 8
EMPLOYER_FIELDS = [
    "basic_profile.location",
    "experience.employment_details.current",
    "experience.employment_details.past",
]
SPONSOR_REGISTER_COUNTRIES = {"United Kingdom", "Netherlands"}


def _is_senior(r: Role) -> bool:
    if r.seniority and r.seniority in tx.SENIORITY_LEVEL_RANK:
        return tx.SENIORITY_LEVEL_RANK[r.seniority] >= 2
    return tx.seniority_from_title(r.title) in ("Senior", "Lead / principal", "Manager and above")


def _seniority_label(roles: list[Role]) -> str | None:
    ranks = [(tx.SENIORITY_LEVEL_RANK.get(r.seniority or "", -1), r.seniority) for r in roles if r.seniority]
    if ranks:
        best = max(ranks)[1]
        return best
    fams = [tx.seniority_from_title(r.title) for r in roles]
    if not fams:
        return None
    return max(fams, key=lambda s: tx.SENIORITY_ORDER.index(s))


async def run(ctx: ToolContext) -> Result:
    p = ctx.params
    city, country = resolve_place(p.get("city"), p.get("country"), required_country=True)
    role = (p.get("role") or "").strip() or None
    role_label = tx.display_role(role) if role else None
    place = place_text(city, country)
    ctx.total_steps = 5
    today = ctx.today

    base_parts = [F.person_city(city) if city else F.person_country(country), F.india_educated(),
                  F.cond(f"{F.CUR}.name", "is_not_null", None)]
    if role:
        base_parts.append(title_or(F.CUR, role))
    base = F.and_(*base_parts) or {}

    await ctx.step(f"Finding Indian-educated people working in {place}")
    n, ev_n = await ctx.count_people(base, f"Indian-educated people working in {place}")

    await ctx.step("Reading where they work")
    sample = await ctx.sample_people(base, note="Profiles of Indian-educated people there", fields=EMPLOYER_FIELDS,
                                     reserve=TOP_EMPLOYERS * 2 * 0.25 + 1.0)
    groups: dict[str, list[tuple[ParsedPerson, Role]]] = defaultdict(list)
    names: dict[str, str] = {}
    ids: dict[str, int | None] = {}
    for pp in sample.people:
        cur = pp.primary_current()
        if not cur or not cur.company:
            continue
        key = cur.company_key() or cur.company
        groups[key].append((pp, cur))
        names.setdefault(key, cur.company)
        ids.setdefault(key, int(cur.company_id) if cur.company_id else None)
    top = sorted(groups, key=lambda k: -len(groups[k]))[:TOP_EMPLOYERS]

    await ctx.step("Counting hires at each employer")
    since24 = iso(months_ago(today, 24))
    stats_rows = []
    for key in top:
        cid = ids.get(key)
        comp = F.company_condition(F.CUR, names[key], cid)
        total, ev_t = await ctx.count_people_safe(F.and_(base, comp) or {}, f"Indian-educated people at {names[key]} in {place}")
        if total is None:
            break
        recent, ev_r = await ctx.count_people_safe(
            F.and_(base, comp, F.cond(f"{F.CUR}.start_date", "=>", since24)) or {}, f"…who joined {names[key]} in the last 24 months"
        )
        members = groups[key]
        tenures = [years_between(r.start, today) for _, r in members if r.start]
        first_at = []
        for pp, r in members:
            starts = [x.start for x in pp.roles if x.company_key() == r.company_key() and x.start]
            if starts:
                first_at.append(years_between(min(starts), today))
        stats_rows.append({
            "key": key, "name": names[key], "id": cid, "total": total, "recent": recent,
            "seniority": _seniority_label([r for _, r in members]) if len(members) >= 5 else None,
            "senior_k": sum(_is_senior(r) for _, r in members), "members": len(members),
            "tenure": median(first_at or tenures) if len(members) >= 5 else None,
            "ev": [e for e in (ev_t, ev_r, sample.evidence_id) if e],
        })

    await ctx.step("Checking sponsorship signals")
    since12 = iso(months_ago(today, 12))
    for row in stats_rows:
        row["badges"] = []
        if row["id"] is None:
            continue
        comp_jobs = F.and_(F.cond("company.basic_info.company_id", "=", int(row["id"])), F.job_country(country),
                           *F.job_date_range(since12)) or {}
        try:
            n_post, _, _ = await ctx.count_jobs(comp_jobs, f"{row['name']} postings in {country}, last 12 months")
            if n_post:
                sponsor_cond = F.phrase_any("content.description", ["visa sponsorship", "sponsor your visa", "relocation support", "relocation package", "Blue Card"])
                n_sp, _, _ = await ctx.count_jobs(F.and_(comp_jobs, sponsor_cond) or {}, f"{row['name']} postings mentioning sponsorship or relocation")
                if n_sp:
                    row["badges"].append(f"Mentions visa sponsorship or relocation in {n_sp} of {n_post} postings (12 months)")
        except BudgetExceeded:
            ctx._budget_warning()
            break
        except CrustdataError:
            continue

    if country in SPONSOR_REGISTER_COUNTRIES and ctx.settings.web_sponsor_checks > 0:
        register = "register of licensed sponsors" if country == "United Kingdom" else "IND recognised sponsor"
        for row in [r for r in stats_rows if r["total"] >= 5][: ctx.settings.web_sponsor_checks]:
            try:
                call = await ctx.client.web_search(f'"{row["name"]}" {register}', location=tx.ISO2.get(country),
                                                   budget=ctx.budget, run_id=ctx.run_id)
            except BudgetExceeded:
                ctx._budget_warning()
                break
            except CrustdataError:
                continue
            hits = [r for r in (call.data or {}).get("results") or []
                    if re.search(r"sponsor", f"{r.get('title', '')} {r.get('snippet', '')}", re.I)
                    and row["name"].split()[0].lower() in f"{r.get('title', '')} {r.get('snippet', '')}".lower()]
            ctx.add_evidence(call, "/web/search/live", {"query": call.body.get("query")}, len((call.data or {}).get("results") or []),
                             len(hits), "Public web search for sponsor-register mentions (not an official check)")
            if hits:
                row["badges"].append("Appears in a public sponsor-register search (unverified)")

    rows = []
    folded = 0
    shown_total = 0
    for row in sorted(stats_rows, key=lambda r: -(r["total"] or 0)):
        if (row["total"] or 0) < 5:
            folded += 1
            continue
        shown_total += row["total"]
        senior = make_count(row["senior_k"], row["members"], row["ev"]).model_dump() if row["members"] else None
        rows.append({
            "id": str(row["id"] or row["key"]),
            "cells": {
                "employer": row["name"],
                "hires": row["total"],
                "recent": row["recent"],
                "seniority": senior,
                "tenure": round(row["tenure"], 1) if row["tenure"] is not None else None,
                "signals": row["badges"],
            },
            "badges": row["badges"],
            "you": bool(ctx.derived.get("current_company") and row["name"].lower() == ctx.derived["current_company"].lower()),
        })
    if rows and n > shown_total:
        rows.append({"id": "other", "cells": {"employer": "Other employers", "hires": n - shown_total, "recent": None,
                                              "seniority": None, "tenure": None, "signals": []}, "rest": True})

    ev_all = [e for r in stats_rows for e in r["ev"]]
    sections = [
        section("employers", "ranked_table", f"Employers in {place} with Indian-educated hires", {
            "n": n,
            "columns": [
                {"key": "employer", "label": "Employer", "type": "text"},
                {"key": "hires", "label": "Indian-educated people there", "type": "int", "bar": True},
                {"key": "recent", "label": "Joined in the last 24 months", "type": "int"},
                {"key": "seniority", "label": "Reached senior or above", "type": "count"},
                {"key": "tenure", "label": "Median stay", "type": "years"},
                {"key": "signals", "label": "Sponsorship signals", "type": "badges"},
            ],
            "rows": rows,
            "default_sort": {"key": "hires", "dir": "desc"},
            "caption": (f"{folded} employers with fewer than 5 visible people are not listed. " if folded else "")
            + "Seniority and median stay come from the profiles read; badges come from the employer's own postings"
            + (" and public web results" if country in SPONSOR_REGISTER_COUNTRIES else "") + ". They are signals, not guarantees.",
        }, ev_all or [ev_n]),
        text_section("method", "How I found these employers",
                     f"I looked for people now working in {place}" + (f" as {role_label}" if role_label else "") +
                     " who studied at a university in India or at a well-known Indian institution, read "
                     f"{len(sample.people)} of the {n:,} visible profiles to find their most common employers, then counted every "
                     "visible Indian-educated person at each of those employers (and who joined in the last 24 months). "
                     "An employer is listed only when at least 5 such people are visible. Sponsorship badges come from the employer's "
                     "postings in the last 12 months" + (" and a public web search of the sponsor register (not an official check)."
                                                         if country in SPONSOR_REGISTER_COUNTRIES else
                                                         "; this country has no public sponsor register I can check."), [ev_n]),
    ]
    if not rows:
        ctx.warn("No employer had 5 or more visible Indian-educated people in this search, so none are listed. That's thin data, not a verdict.")

    next_steps = []
    if rows:
        first = rows[0]["cells"]["employer"]
        next_steps.append(step(f"See your Internship-to-Job chances at {first}", "internship_chances", company=first, country=country))
        next_steps.append(step(f"See how people got into roles at {first}", "routes_to_position", role=role or "Software Engineer", company=first, country=country))
    if role:
        next_steps.append(step(f"Read current {role_label} postings in {country}", "job_postings", role=role, country=country, city=city))
    next_steps.append(step(f"See your Internship-to-Job chances in {country}", "internship_chances", country=country))

    facts = [f"Indian-educated people working in {place}" + (f" as {role_label}" if role_label else "") + f": {n} visible profiles."]
    if rows:
        facts.append("Employers with the most: " + ", ".join(f"{r['cells']['employer']} ({r['cells']['hires']})" for r in rows[:3] if not r.get("rest")) + ".")
    return await ctx.finish(
        TOOL,
        f"Employers in {place} that hire Indian-educated people",
        sections,
        ctx.confidence(n, sample_n=len(sample.people)),
        f"Based on {n:,} visible Indian-educated profiles in {place}; employers found from {len(sample.people)} profiles read. "
        "People without public profiles are not counted.",
        cohort=Cohort(definition=f"Indian-educated people working in {place}" + (f" as {role_label}" if role_label else ""),
                      filters={"work_country": country, "country": country, "city": city, "role": role, "crustdata": base}, n_visible=n,
                      match_level="field_only", widened=False),
        next_steps=next_steps,
        facts=facts,
        coverage=(len(sample.people) / n) if n else None,
    )
