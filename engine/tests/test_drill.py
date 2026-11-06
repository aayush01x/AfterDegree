"""Drill-down (CONTRACT Appendix C + D): exact counts, context inheritance, company profile, privacy."""

import json
import re
import time

import pytest

from afterdegree.crustdata import PERSON_TTL_S, DiskCache
from afterdegree.drill import apply_step, build_origin, company_facts, own_posting_url
from afterdegree.mock import matches
from afterdegree.people import PERSON_ID_RE, privacy_violations
from afterdegree.schemas import DrillResult, Job, PersonDetail

from .conftest import riya_profile
from .test_api import _api, assert_error, onboard, wait_job


@pytest.fixture
async def api(settings, crustdata):
    app, client, ctx = await _api(settings)
    yield app, client
    await client.aclose()
    await ctx.__aexit__(None, None, None)


def tok(tool, params, *steps):
    return {"tool": tool, "params": params, "path": [{"dimension": d, "value": v, "label": lab} for d, v, lab in steps]}


async def drill(client, pid, token):
    r = await client.post("/api/drill", json={"profile_id": pid, "drill": token})
    assert r.status_code == 200, r.text
    job = await wait_job(client, r.json()["job_id"])
    Job.model_validate(job)
    return job


async def drill_ok(client, pid, token) -> dict:
    job = await drill(client, pid, token)
    assert job["status"] == "done", job["error"]
    assert job["tool"] == "drill"
    DrillResult.model_validate(job["result"])
    return job["result"]


def fake_count(fake, filters) -> int:
    return sum(1 for p in fake.people if matches(p, filters, "person"))


# ------------------------------------------------------------------ people drills


async def test_country_drill_counts_are_exact_and_drillable(api, fake):
    _, client = api
    pid = await onboard(client)
    res = await drill_ok(client, pid, tok("people_like_me", {"match": "field_only"}, ("country", "Germany", "Germany")))
    assert res["title"] == "People like you in Germany"
    assert res["path"][0]["dimension"] == "country"
    # The headline is an exact total over the slice filters, not a sample tally.
    crustdata = res["cohort"]["filters"]["crustdata"]
    n = fake_count(fake, crustdata)
    assert res["count"]["k"] == n == res["people_total"] and n >= 10
    assert res["count"]["n"] >= n
    assert res["context"]["origin_tool"] == "people_like_me" and res["context"]["origin_label"] == "People Like Me"
    # Next level: cities, companies, roles with exact counts; each row's token extends the path by one step.
    ids = [s["id"] for s in res["sections"]]
    assert "cities" in ids
    cities = next(s for s in res["sections"] if s["id"] == "cities")
    row = next(r for r in cities["data"]["rows"] if not r.get("rest"))
    assert row["drill"]["path"][:1] == res["path"] and row["drill"]["path"][1]["dimension"] == "city"
    assert cities["data"]["n"] == n
    assert sum(r["cells"]["people"] for r in cities["data"]["rows"]) <= n
    for r in cities["data"]["rows"]:
        if not r.get("rest"):
            assert r["cells"]["people"] >= 5
    # Clicking the row opens a slice whose count is exactly the row's count (same filter), of the country total.
    child = await drill_ok(client, pid, row["drill"])
    assert child["count"]["k"] == row["cells"]["people"]
    assert child["count"]["n"] == n
    assert child["count"]["k"] <= res["count"]["k"]  # never widens
    assert child["title"].endswith(row["cells"]["city"])
    # People: anonymous cards from a capped sample.
    assert 0 < len(res["people"]) <= 30
    assert all(PERSON_ID_RE.match(p["id"]) for p in res["people"])
    assert res["people_note"] and str(n) in res["people_note"]
    assert res["listing_blocked_reason"] is None


async def test_drill_inherits_origin_filters(api, fake):
    """Germany on People Like Me with an experience band = only people like you in that band, in Germany."""
    _, client = api
    pid = await onboard(client)
    wide = await drill_ok(client, pid, tok("people_like_me", {"match": "field_only"}, ("country", "Germany", "Germany")))
    narrow = await drill_ok(client, pid, tok("people_like_me", {"match": "field_only", "exp_band": [1, 3]}, ("country", "Germany", "Germany")))
    assert narrow["count"]["k"] <= wide["count"]["k"]
    labels = {f["label"]: f for f in narrow["context"]["filters"]}
    assert labels["Experience"]["value"] == "1–3 yrs" and labels["Experience"]["param"] == "exp_band"
    dropped = labels["Experience"]["drill"]
    assert "exp_band" not in dropped["params"] and dropped["path"] == narrow["path"]
    flt = json.dumps(narrow["cohort"]["filters"]["crustdata"])
    assert "years_of_experience_raw" in flt
    assert narrow["count"]["k"] == fake_count(fake, narrow["cohort"]["filters"]["crustdata"])


async def test_small_slice_blocks_listing(api):
    _, client = api
    pid = await onboard(client)
    res = await drill_ok(client, pid, tok("people_like_me", {"match": "exact_school"}, ("country", "Ireland", "Ireland"),
                                          ("city", "Dublin", "Dublin"), ("role", "DevOps Engineer", "DevOps Engineer")))
    assert res["count"]["k"] < 5
    assert res["people"] == [] and res["listing_blocked_reason"] == "Fewer than 5 people match, so we don't list individuals."


async def test_unsupported_step_is_refused_not_widened(api):
    _, client = api
    pid = await onboard(client)
    job = await drill(client, pid, tok("routes_to_position", {"role": "Data Engineer", "country": "Germany"},
                                       ("years_band", "entry:1–3 years", "1–3 years")))
    assert job["status"] == "error" and job["error"]["code"] == "bad_input"
    r = await client.post("/api/drill", json={"profile_id": pid, "drill": {"tool": "nope", "params": {}, "path": []}})
    assert_error(r, 400, "bad_input")
    r = await client.post("/api/drill", json={"profile_id": "p_missing", "drill": tok("people_like_me", {})})
    assert_error(r, 404, "profile_not_found")


async def test_intern_origin_company_means_interned_there(make_ctx, crustdata):
    ctx = make_ctx({"scope": {"country": "Germany"}}, profile=riya_profile())
    sc = await build_origin(ctx, "conversion_map", ctx.params)
    apply_step(ctx, sc, {"dimension": "company", "value": "2001", "label": "SAP"})
    flt = json.dumps(sc.people_filters())
    assert sc.company is None and "Working Student" in flt and '"value": 2001' in flt


async def test_jobs_drill_counts_postings(api, fake):
    _, client = api
    pid = await onboard(client)
    res = await drill_ok(client, pid, tok("job_postings", {"role": "Data Engineer", "country": "Germany"}, ("skill", "Spark", "Spark")))
    assert res["people"] == [] and res["people_note"]
    assert res["count"]["k"] <= res["count"]["n"]
    emp = next(s for s in res["sections"] if s["id"] == "companies")
    assert all(r["drill"]["path"][-1]["dimension"] == "posting_employer" for r in emp["data"]["rows"] if not r.get("rest"))


# ------------------------------------------------------------------ company profile


async def test_company_profile(api, fake):
    _, client = api
    pid = await onboard(client)
    res = await drill_ok(client, pid, tok("indian_friendly", {"country": "Germany"}, ("company", "2003", "Zalando")))
    c = res["company"]
    assert c["name"] == "Zalando" and c["domain"] == "zalando.com"
    assert c["headcount"]["total"] > 0
    assert c["people_like_you"]["k"] == res["count"]["k"]
    # Company-wide hiring = exact posting counts (the fake's postings in the last 90 days).
    from datetime import UTC, datetime, timedelta

    since = (datetime.now(UTC).date() - timedelta(days=90)).isoformat()
    n90 = sum(1 for j in fake.jobs if j["company"]["basic_info"]["crustdata_company_id"] == 2003 and j["metadata"]["date_added"][:10] >= since)
    assert c["hiring"]["open_postings_90d"] == n90
    assert c["hiring"]["sponsorship_mentions"]["n"] == n90
    assert c["hiring"]["language"]["sample_n"] <= 40
    assert set(c["scope"]) == {"company_wide", "your_filters", "profiles_read"}
    assert c["indian_educated"]["count"]["k"] <= c["indian_educated"]["count"]["n"]
    ids = [s["id"] for s in res["sections"]]
    assert "open_roles" in ids and "roles" in ids
    for row in next(s for s in res["sections"] if s["id"] == "open_roles")["data"]["rows"]:
        assert row.get("posting_url") is None  # fake postings live on a job board, not the company's own site
    # Unknown facts are null with a warning, never invented.
    assert c["industry"] is None and any("left empty" in w for w in res["warnings"])
    assert len(res["people"]) <= 30


def test_own_posting_url_only():
    assert own_posting_url("https://jobs.sap.com/job/123", "sap.com", "SAP") == "https://jobs.sap.com/job/123"
    assert own_posting_url("https://boards.greenhouse.io/zalando/jobs/1", "zalando.com", "Zalando")
    assert own_posting_url("https://de.indeed.com/viewjob?jk=1", "sap.com", "SAP") is None
    assert own_posting_url("https://www.linkedin.com/jobs/view/1", "sap.com", "SAP") is None
    assert own_posting_url("https://boards.greenhouse.io/other/jobs/1", "sap.com", "SAP") is None
    assert own_posting_url("http://jobs.sap.com/x", "sap.com", "SAP") is None


def test_company_facts_from_enrich_record():
    from pathlib import Path

    d = json.loads((Path(__file__).parent / "fixtures" / "live" / "company_enrich.json").read_text())
    rec = d if isinstance(d, dict) else d[0]
    facts, missing = company_facts(rec["matches"][0]["company_data"], "Zalando")
    assert facts["hq"] == {"city": "Berlin", "country": "Germany"}
    assert facts["international"] is True and facts["industry"] == "Retail"
    assert facts["headcount"]["total"] == 12639 and facts["headcount"]["growth_12m"] == pytest.approx(0.031, abs=0.001)
    assert facts["funding"] is None  # no rounds: not invented
    assert "headcount" not in missing
    assert not privacy_violations({k: v for k, v in facts.items() if k not in ("_offices", "name")})  # `name` is the company's


# ------------------------------------------------------------------ people detail + privacy (binding)


FORBIDDEN_KEYS = {"name", "profile_url", "linkedin_url", "email", "emails", "photo", "photo_url", "crustdata_person_id"}


def _scan(obj, path="$"):
    if isinstance(obj, dict):
        for k, v in obj.items():
            assert k not in FORBIDDEN_KEYS or f"{path}.{k}" == "$.company.name", f"{path}.{k}"
            yield from _scan(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _scan(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj


def assert_no_personal_data(obj, fake):
    names = {p["basic_profile"]["name"] for p in fake.people}
    pids = {str(p["crustdata_person_id"]) for p in fake.people}
    for path, s in _scan(obj):
        assert "linkedin.com" not in s.lower(), path
        assert not re.search(r"https?://", s) or path.endswith("posting_url"), path
        assert not re.search(r"\b(19|20)\d{2}-(0[1-9]|1[0-2])(-\d{2})?\b", s), f"full date at {path}: {s}"
        assert "@" not in s or "." not in s.split("@")[-1], f"email-like at {path}"
        assert s not in names, f"name at {path}"
        assert s not in pids, f"person id at {path}"
    blob = json.dumps(obj)
    for name in names:
        assert name not in blob
    for pid in pids:
        assert not re.search(rf"(?<!\d){pid}(?!\d)", blob), pid


async def test_people_privacy_and_detail(api, fake):
    app, client = api
    pid = await onboard(client)
    res = await drill_ok(client, pid, tok("people_like_me", {"match": "field_only"}, ("country", "Germany", "Germany")))
    persons = res["people"]
    assert persons
    assert_no_personal_data({"people": persons, "sections": res["sections"], "company": res.get("company")}, fake)
    for card in persons:
        for st in card["steps"]:
            assert st["years"] is None or (st["years"] * 2) == int(st["years"] * 2)  # rounded to 0.5
            assert set(st) <= {"kind", "org", "title", "city", "country", "start_year", "end_year", "years"}
    # Person detail: resolvable for this profile only.
    pid_card = persons[0]["id"]
    r = await client.get(f"/api/people/{pid_card}", params={"profile_id": pid})
    assert r.status_code == 200, r.text
    detail = PersonDetail.model_validate(r.json())
    assert detail.id == pid_card and len(detail.skills) <= 8
    assert detail.route_stats and all(rs.count.k <= rs.count.n for rs in detail.route_stats)
    assert detail.position == {"index": 1, "total": len(persons)}
    assert_no_personal_data(r.json(), fake)
    other = await onboard(client)
    assert_error(await client.get(f"/api/people/{pid_card}", params={"profile_id": other}), 404, "person_not_found")
    assert_error(await client.get("/api/people/pp_0000000000000000", params={"profile_id": pid}), 404, "person_not_found")
    assert_error(await client.get("/api/people/../../etc", params={"profile_id": pid}), 404)
    # Ids are opaque HMACs, salted with a secret persisted in SQLite.
    secret = app.state.store.server_secret()
    assert len(secret) == 64 and app.state.store.server_secret() == secret


async def test_company_drill_privacy(api, fake):
    _, client = api
    pid = await onboard(client)
    res = await drill_ok(client, pid, tok("people_like_me", {"match": "field_only"}, ("country", "Germany", "Germany"), ("company", "2001", "SAP")))
    assert_no_personal_data({"people": res["people"], "sections": res["sections"], "company": res["company"]}, fake)


def test_person_data_ttl_is_at_most_7_days(store, tmp_path):
    store.save_drill_person("pp_aaaaaaaaaaaaaaaa", "p_1", {"id": "pp_aaaaaaaaaaaaaaaa"}, ttl_s=-1)
    assert store.get_drill_person("pp_aaaaaaaaaaaaaaaa", "p_1") is None
    assert store.purge_expired_people() == 1
    store.save_drill_person("pp_bbbbbbbbbbbbbbbb", "p_1", {"id": "pp_bbbbbbbbbbbbbbbb"}, ttl_s=60)
    assert store.get_drill_person("pp_bbbbbbbbbbbbbbbb", "p_1") is not None
    assert store.get_drill_person("pp_bbbbbbbbbbbbbbbb", "p_2") is None  # only for the profile it was shown to
    # Raw person responses in the disk cache never outlive 7 days, even with a longer cache TTL.
    cache = DiskCache(tmp_path, ttl_days=30)
    assert cache.ttl_for("/person/search") == PERSON_TTL_S == 7 * 86400
    assert cache.ttl_for("/job/search") == 30 * 86400


async def test_drill_people_stored_with_capped_ttl(api, settings):
    app, client = api
    settings.person_data_ttl_days = 30  # a misconfiguration must still be capped at 7 days
    pid = await onboard(client)
    await drill_ok(client, pid, tok("people_like_me", {"match": "field_only"}, ("country", "Germany", "Germany")))
    rows = app.state.store._exec("SELECT expires_at FROM drill_people").fetchall()
    assert rows and all(r["expires_at"] <= time.time() + 7 * 86400 + 5 for r in rows)
    # Old drill results (they hold anonymised paths) are purged too.
    app.state.store._exec("UPDATE jobs SET created_at = '2020-01-01T00:00:00Z' WHERE tool = 'drill'")
    assert app.state.store.purge_old_drill_jobs(7 * 86400) >= 1


async def test_college_paths_rows_drill_to_the_same_count(api, fake):
    _, client = api
    pid = await onboard(client)
    r = await client.post("/api/tools/college-paths", json={"profile_id": pid, "role": "Data Engineer", "country": "Germany"})
    job = await wait_job(client, r.json()["job_id"])
    assert job["status"] == "done", job["error"]
    sec = {s["id"]: s["data"] for s in job["result"]["sections"]}
    for sid in ("universities", "programmes"):
        row = next(x for x in sec[sid]["rows"] if x.get("drill"))
        res = await drill_ok(client, pid, row["drill"])
        key = "in_goal" if sid == "universities" else "people"
        assert res["count"]["k"] == row["cells"][key], (sid, res["title"])
        assert res["count"]["n"] == job["result"]["sections"][0]["data"]["value"]
        assert res["context"]["origin_tool"] == "college_paths"
        assert res["people"] and res["listing_blocked_reason"] is None
        assert_no_personal_data({"people": res["people"], "sections": res["sections"]}, fake)


async def test_degree_country_drill_uses_a_separate_school_entry(make_ctx, crustdata):
    ctx = make_ctx({"match": "field_only"}, profile=riya_profile())
    sc = await build_origin(ctx, "people_like_me", ctx.params)
    apply_step(ctx, sc, {"dimension": "degree_country", "value": "Germany", "label": "Germany"})
    f = sc.people_filters()
    assert f["op"] == "all_of" or any(c.get("op") == "all_of" for c in f["conditions"])  # the master's abroad is not forced onto the same school entry as the Indian bachelor's


async def test_route_drills_are_exact(api, fake):
    """Career Routes: a route / edge drill shows exactly the people the route page counted (same cached sample)."""
    _, client = api
    pid = await onboard(client)
    r = await client.post("/api/tools/reverse-gps", json={"profile_id": pid, "goal_text": "Data engineer in Berlin"})
    job = await wait_job(client, r.json()["job_id"])
    assert job["status"] == "done", job["error"]
    sec = {s["id"]: s["data"] for s in job["result"]["sections"]}
    route = sec["routes"]["routes"][0]
    res = await drill_ok(client, pid, route["drill"])
    assert res["count"]["k"] == route["people"]["k"] and res["count"]["n"] == route["people"]["n"]
    assert res["route"]["kind"] == "route" and res["route"]["exact"] is True
    assert [s["label"] for s in res["route"]["steps"]] == [s["label"] for s in route["steps"]]
    assert len(res["people"]) == res["count"]["k"] or res["listing_blocked_reason"]
    edge = sec["graph"]["edges"][0]
    assert edge["drill"]["path"][-1]["dimension"] == "route_edge"
    res_e = await drill_ok(client, pid, edge["drill"])
    assert res_e["count"]["k"] == edge["count"]
    assert_no_personal_data({"people": res_e["people"], "sections": res_e["sections"]}, fake)
    node = next(n for n in sec["graph"]["nodes"] if n.get("drill"))
    res_n = await drill_ok(client, pid, node["drill"])
    assert res_n["route"]["kind"] == "step" and res_n["count"]["k"] >= max(e["count"] for e in sec["graph"]["edges"]
                                                                          if e["from"] == node["id"] or e["to"] == node["id"])
