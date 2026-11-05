"""Probe the real Crustdata API with a small, capped set of calls and print response *shapes*.

Usage:
    uv run python scripts/probe.py [--linkedin-url https://www.linkedin.com/in/<someone>]

Calls (about 4 credits; hard cap 15 credits / 12 live calls; cached responses are free on re-runs):
  1. person enrich on the given LinkedIn URL (skipped without --linkedin-url)       ~1 credit
  2. person autocomplete for a school name                                           free
  3. person search with an education filter, limit 5                                 ~1.7 credits
  4. person search count using the engine's cohort filter grammar, limit 1          ~0.2 credits
  5. job search, limit 5, plus a limit-0 aggregation query                           ~0.15 credits
  6. company identify                                                               free
  7. web search                                                                      1 credit

Raw responses are written to tests/fixtures/live/ (git-ignored: they contain real people's data).
Only key names and value types are printed, never values or keys of the API.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from afterdegree import filters as F  # noqa: E402
from afterdegree.config import load_settings  # noqa: E402
from afterdegree.crustdata import CrustdataClient, CrustdataError, RunBudget  # noqa: E402
from afterdegree.db import Store  # noqa: E402
from afterdegree.profile import extract_person_data, normalise_profile, parse_person  # noqa: E402
from afterdegree.toolkit import JOB_SAMPLE_FIELDS, PERSON_SAMPLE_FIELDS  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "live"


def shape(value, depth: int = 0, max_depth: int = 7):
    """Type skeleton of a JSON value (no data)."""
    if depth > max_depth:
        return "…"
    if isinstance(value, dict):
        return {k: shape(v, depth + 1) for k, v in value.items()}
    if isinstance(value, list):
        if not value:
            return []
        merged: dict = {}
        scalars = set()
        for item in value[:10]:
            s = shape(item, depth + 1)
            if isinstance(s, dict):
                for k, v in s.items():
                    if k not in merged or merged[k] in ("null", []):
                        merged[k] = v
            else:
                scalars.add(json.dumps(s))
        return [merged] if merged else [json.loads(x) for x in sorted(scalars)]
    if value is None:
        return "null"
    return type(value).__name__


def show(name: str, data) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False))
    print(f"\n=== {name} (saved to tests/fixtures/live/{name}.json)")
    print(json.dumps(shape(data), indent=2))


def presence_report(profiles: list[dict]) -> None:
    """How often the fields our parsers rely on are filled (counts only)."""
    c: Counter = Counter()
    for raw in profiles:
        p = parse_person(raw)
        c["profiles"] += 1
        c["with country"] += bool(p.country)
        c["with city"] += bool(p.city)
        c["with undergrad"] += bool(p.undergrad())
        c["undergrad with end_year"] += bool(p.undergrad() and p.undergrad().end_year)
        c["undergrad with country"] += bool(p.undergrad() and p.undergrad().country)
        for r in p.roles:
            c["roles"] += 1
            c["roles with start"] += bool(r.start)
            c["roles with end (past)"] += bool(r.end) if not r.current else 0
            c["roles with company_id"] += bool(r.company_id)
            c["roles with location/country"] += bool(r.country)
            c["roles with seniority"] += bool(r.seniority)
            c["intern roles"] += r.is_intern
    print("\n--- parser field coverage:", json.dumps(dict(c), indent=2))


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--linkedin-url", help="profile to enrich (1 credit); skipped when absent")
    ap.add_argument("--school", default="Vellore Institute of Technology")
    args = ap.parse_args()

    settings = load_settings()
    if settings.mock:
        print("AFTERDEGREE_MOCK is set; unset it to probe the real API.")
        return 2
    if not settings.crustdata_api_key:
        print("CRUSTDATA_API_KEY is empty in .env; nothing to probe.")
        return 2
    store = Store(settings.db_path)
    client = CrustdataClient(settings, store)
    budget = RunBudget(max_live_calls=12, max_credits=15.0)
    run_id = "probe"

    async def attempt(label, coro):
        try:
            return await coro
        except CrustdataError as exc:
            print(f"\n!!! {label}: {type(exc).__name__} (HTTP {exc.status}): {exc.detail or exc.message}")
            return None

    try:
        if args.linkedin_url:
            r = await attempt("person enrich", client.person_enrich(args.linkedin_url, budget=budget, run_id=run_id))
            if r:
                show("person_enrich", r.data)
                pdata = extract_person_data(r.data)
                if pdata:
                    person, derived = normalise_profile(pdata)
                    print("\n--- normalised derived (own profile):", derived.model_dump_json(indent=2))
        else:
            print("No --linkedin-url given: skipping person enrich.")

        r = await attempt("autocomplete", client.person_autocomplete("education.schools.school", args.school, limit=10, budget=budget, run_id=run_id))
        if r:
            show("person_autocomplete_school", r.data)

        edu = F.cond("education.schools.school", "[.]", args.school)
        body = {"filters": edu, "limit": 5, "fields": PERSON_SAMPLE_FIELDS}
        r = await attempt("person search", client.person_search(body, budget=budget, run_id=run_id))
        if r:
            show("person_search_education", r.data)
            presence_report(r.data.get("profiles") or [])

        cohort = F.and_(
            F.education_group(school_phrases=[args.school], field_phrase="Computer Science", end_year_range=(2020, 2024)),
            F.person_has_country(),
            F.person_not_country("India"),
        )
        r = await attempt("cohort count", client.person_search({"filters": cohort, "limit": 1, "fields": ["crustdata_person_id"]}, budget=budget, run_id=run_id))
        if r:
            show("person_search_cohort_count", {"total_count": r.data.get("total_count"), "keys": list(r.data.keys()), "remarks": r.data.get("remarks")})

        jf = F.and_(F.phrase_any("job_details.title", ["Data Engineer"]), F.job_country("Germany"))
        r = await attempt("job search", client.job_search({"filters": jf, "limit": 5, "fields": JOB_SAMPLE_FIELDS,
                                                           "sorts": [{"field": "metadata.date_added", "order": "desc"}]}, budget=budget, run_id=run_id))
        if r:
            show("job_search", r.data)
        r = await attempt("job aggregations", client.job_search({"filters": jf, "limit": 0, "aggregations": [
            {"type": "count"}, {"type": "group_by", "field": "company.basic_info.company_id", "agg": "count", "size": 5}]}, budget=budget, run_id=run_id))
        if r:
            show("job_search_aggregations", r.data)

        r = await attempt("company identify", client.company_identify(names=["Zalando"], budget=budget, run_id=run_id))
        if r:
            show("company_identify", r.data)

        r = await attempt("web search", client.web_search('"Zalando" visa sponsorship', location="DE", budget=budget, run_id=run_id))
        if r:
            show("web_search", r.data)
    finally:
        await client.aclose()
    print(f"\nProbe finished: {budget.live_calls} live calls, {budget.cached_calls} cached, ~{budget.credits:.2f} credits (estimated or reported).")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
