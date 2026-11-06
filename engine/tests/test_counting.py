"""Sample vs total (the People Like Me country bug, generalised): a breakdown shown next to a total is either an exact
count-only total or clearly a sample (sample_n), and never divides sample numerators by a total denominator."""

import pytest

from afterdegree import filters as F
from afterdegree.crustdata import DiskCache
from afterdegree.mock import matches
from afterdegree.tools import TOOLS
from afterdegree.tools.indian_friendly import SENIOR_LEVELS

from .test_tools import HAPPY, mocked_ctx


def _sections(result):
    return [s.model_dump() for s in result.sections]


@pytest.mark.parametrize("tool", [t for t in HAPPY if t != "people_like_me"])
async def test_sample_breakdowns_use_sample_denominators(tool, make_ctx, crustdata):
    ctx = mocked_ctx(make_ctx, tool, HAPPY[tool])
    r = await TOOLS[tool][0](ctx)
    for s in _sections(r):
        d = s["data"]
        if s["kind"] in ("distribution", "ranked_table", "keywords") and d.get("sample_n") is not None:
            assert d.get("n") is None or d["n"] <= d["sample_n"] * 4, (tool, s["id"], d.get("n"), d["sample_n"])
            if s["kind"] == "distribution" and d.get("unit") == "postings":
                assert d["n"] == d["sample_n"], (tool, s["id"])
        for c in _counts(d):
            assert c["k"] <= c["n"], (tool, s["id"], c)
    # Every profile sample is capped well below the old 200 (cost), and none was cut short by the budget.
    for ev in r.evidence:
        if ev.endpoint == "/person/search" and ev.results_used:
            assert ev.results_used <= 50, (tool, ev.note)
    assert not ctx.budget_hit, (tool, r.warnings)


def _counts(obj):
    if isinstance(obj, dict):
        if {"k", "n", "display"} <= obj.keys():
            yield obj
        for v in obj.values():
            yield from _counts(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _counts(v)


async def test_indian_friendly_seniority_is_exact(make_ctx, crustdata, fake):
    ctx = mocked_ctx(make_ctx, "indian_friendly", {"country": "Germany"})
    r = await TOOLS["indian_friendly"][0](ctx)
    table = next(s for s in r.sections if s.id == "employers")
    base = r.cohort.filters["crustdata"]
    rows = [row for row in table.data["rows"] if not row.get("rest")]
    assert rows
    for row in rows:
        senior = row["cells"]["seniority"]
        assert senior["n"] == row["cells"]["hires"]  # same exact denominator as the hires column
        cid = int(row["id"]) if row["id"].isdigit() else None
        comp = F.company_condition(F.CUR, row["cells"]["employer"], cid)
        exact = sum(1 for p in fake.people if matches(p, F.and_(base, comp, F.cond(f"{F.CUR}.seniority_level", "in", SENIOR_LEVELS)), "person"))
        assert senior["k"] == exact


async def test_job_postings_seniority_covers_every_posting(make_ctx, crustdata):
    ctx = mocked_ctx(make_ctx, "job_postings", HAPPY["job_postings"])
    r = await TOOLS["job_postings"][0](ctx)
    sec = {s.id: s.data for s in r.sections}
    sen = sec["seniority"]
    assert sum(i["count"] for i in sen["items"]) == sen["n"]
    assert sen["n"] in (sec["open_90"]["value"], sum(i["count"] for i in sen["items"]))
    assert sec["languages"]["sample_n"] == sec["languages"]["n"]
    assert sec["visa"]["sample_n"] == sec["visa"]["count"]["n"]
    assert sec["skills"]["sample_n"] == sec["skills"]["n"]
    # groups that can't be searched for carry no drill token
    for it in sen["items"]:
        if it["label"].startswith("Mid level"):
            assert "drill" not in it


async def test_internship_chance_is_labelled_as_a_sample(make_ctx, crustdata, fake):
    ctx = mocked_ctx(make_ctx, "internship_chances", HAPPY["internship_chances"])
    r = await TOOLS["internship_chances"][0](ctx)
    chance = next(s for s in r.sections if s.id == "chance").data
    assert chance["sample_n"] >= 1 and "sample" in chance["note"]
    assert chance["count"]["n"] <= chance["sample_n"] * 3  # finished internships found in the profiles read
    # internship outcomes need only work history: no education group in the response (cheaper per profile)
    samples = [b for p, b in fake.calls if p == "/person/search" and int(b.get("limit") or 0) > 1]
    assert samples and not any(f.startswith("education") for f in samples[-1]["fields"])


def test_superset_page_reuse(tmp_path):
    cache = DiskCache(tmp_path)
    body = {"filters": {"field": "x", "type": "=", "value": 1}, "fields": ["a", "b"], "limit": 60, "sorts": [{"field": "s"}]}
    profiles = [{"crustdata_person_id": i} for i in range(60)]
    cache.set("k60", "/person/search", body, {"profiles": profiles, "total_count": 500, "next_cursor": "c"}, "2026-11-06T00:00:00Z")
    hit = cache.superset_page("/person/search", {**body, "limit": 40, "fields": ["a"]})
    assert hit is not None
    entry, key = hit
    assert key == "k60" and len(entry["response"]["profiles"]) == 40 and entry["response"]["next_cursor"] is None
    assert cache.superset_page("/person/search", {**body, "limit": 80}) is None  # not enough profiles cached
    assert cache.superset_page("/person/search", {**body, "limit": 40, "fields": ["a", "skills"]}) is None  # missing a field
    assert cache.superset_page("/person/search", {**body, "limit": 40, "cursor": "c"}) is None


async def test_smaller_sample_is_served_from_a_larger_cached_one(make_ctx, crustdata, fake):
    ctx = make_ctx({})
    f = F.person_country("Germany")
    first = await ctx.sample_people(f, max_results=50)
    live_before = ctx.budget.live_calls
    calls_before = len(fake.calls)
    second = await ctx.sample_people(f, max_results=30)
    assert [p.person_id for p in second.people] == [p.person_id for p in first.people][:30]
    assert ctx.budget.live_calls == live_before and len(fake.calls) == calls_before


# ------------------------------------------------------------------ College Paths


async def test_college_paths_counts_are_exact(make_ctx, crustdata, fake):
    from afterdegree.tools.college_paths import further_element, goal_filters

    ctx = mocked_ctx(make_ctx, "college_paths", HAPPY["college_paths"])
    r = await TOOLS["college_paths"][0](ctx)
    sec = {s.id: s.data for s in r.sections}
    goal = r.cohort.filters["crustdata"]
    n_g = sum(1 for p in fake.people if matches(p, goal, "person"))
    assert sec["goal_size"]["value"] == n_g
    fd = sec["further_degree"]
    assert fd["n"] == n_g and sum(i["count"] for i in fd["items"]) == n_g
    unis = [row for row in sec["universities"]["rows"] if not row.get("rest")]
    assert unis
    for row in unis:
        assert row["cells"]["in_goal"] >= 5 and row["count"]["n"] == n_g
        assert row["drill"]["path"][-1]["value"].startswith("uni:")
        rate = row["cells"]["rate"]
        assert rate is None or rate["k"] <= rate["n"] == row["cells"]["graduates"]
    assert goal == goal_filters("Data Engineer", None, "Germany", None)
    # a university row's count equals a direct count of people in the goal with a master's there (separate school entry)
    top = unis[0]
    uni = top["drill"]["path"][-1]["value"][4:]
    variants = await ctx.school_variants(uni)
    from afterdegree.tools.college_paths import goal_parts, with_entry

    f = with_entry(goal_parts("Data Engineer", None, "Germany", None), further_element("masters", None, variants))
    assert top["cells"]["in_goal"] == sum(1 for p in fake.people if matches(p, f, "person"))
    you = [row for row in sec["indian_colleges"]["rows"] if row.get("you")]
    assert len(you) == 1 and you[0]["badges"] == ["Your college"]
    progs = [row for row in sec["programmes"]["rows"] if not row.get("rest")]
    assert progs and all(p["cells"]["people"] >= 5 for p in progs)
    assert ctx.budget.credits <= 25
