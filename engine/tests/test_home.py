"""Home ("Your plan") endpoints: /runs reads finished jobs only; /snapshot is count-only, capped and cached."""

from __future__ import annotations

import json

import pytest

from afterdegree.home import RunsResponse, SnapshotResponse, headline_for, list_runs

from .test_api import _api, assert_error, onboard, wait_job


@pytest.fixture
async def api(settings, crustdata):
    app, client, ctx = await _api(settings)
    yield app, client
    await client.aclose()
    await ctx.__aexit__(None, None, None)


async def _set_goals(client, pid, **goals):
    r = await client.post("/api/onboarding/complete", json={"profile_id": pid, "goals": goals})
    assert r.status_code == 200, r.text


def _search_calls(crustdata) -> list[dict]:
    return [json.loads(c.request.content or b"{}") for c in crustdata.calls if c.request.url.path.endswith("/search")]


# ------------------------------------------------------------------ /runs


async def test_runs_empty_and_unknown_profile(api):
    _, client = api
    pid = await onboard(client)
    r = await client.get(f"/api/profiles/{pid}/runs")
    assert r.status_code == 200
    body = RunsResponse.model_validate(r.json())
    assert body.runs == [] and body.recent == []
    assert_error(await client.get("/api/profiles/p_missing/runs"), 404, "profile_not_found")


async def test_runs_latest_per_tool_with_headlines_and_no_data_calls(api, crustdata):
    app, client = api
    pid = await onboard(client)
    for slug, body in [("people-like-me", {"match": "exact_school"}), ("job-postings", {"role": "Data Engineer", "country": "Germany"}),
                       ("job-postings", {"role": "Data Engineer", "country": "Germany", "city": "Berlin"})]:
        r = await client.post(f"/api/tools/{slug}", json={"profile_id": pid, **body})
        job = await wait_job(client, r.json()["job_id"])
        assert job["status"] == "done", job
    # a failed run and someone else's run never show up
    bad = await client.post("/api/tools/reverse-gps", json={"profile_id": pid})
    await wait_job(client, bad.json()["job_id"])
    other = await onboard(client)
    r = await client.post("/api/tools/indian-friendly", json={"profile_id": other, "country": "Germany"})
    await wait_job(client, r.json()["job_id"])

    calls_before = len(crustdata.calls)
    body = RunsResponse.model_validate((await client.get(f"/api/profiles/{pid}/runs")).json())
    assert len(crustdata.calls) == calls_before, "/runs must never call the data provider"

    tools = [r.tool for r in body.runs]
    assert sorted(tools) == ["job_postings", "people_like_me"]
    jp = next(r for r in body.runs if r.tool == "job_postings")
    assert jp.params == {"role": "Data Engineer", "country": "Germany", "city": "Berlin"}  # the latest one
    assert jp.headline and jp.headline.value is not None and jp.headline.label.startswith("postings added")
    plm = next(r for r in body.runs if r.tool == "people_like_me")
    assert plm.headline and plm.headline.display and plm.title and "same college and field" in plm.question
    # recent: distinct questions, newest first
    assert [r.tool for r in body.recent] == ["job_postings", "job_postings", "people_like_me"]
    assert len({json.dumps(r.params, sort_keys=True) for r in body.recent}) == 3
    assert body.recent[0].finished_at >= body.recent[-1].finished_at


def test_list_runs_skips_drill_jobs(store):
    store.create_job("job_a", "drill", "p1", {"tool": "people_like_me"})
    store.update_job("job_a", status="done", result={"title": "x", "sections": []})
    store.create_job("job_b", "job_postings", "p1", {"role": "X", "country": "Germany"})
    store.update_job("job_b", status="done", result={"title": "What X postings show", "sections": [], "summary": "There were 12 postings. More text."})
    out = list_runs(store, "p1")
    assert [r.tool for r in out.runs] == ["job_postings"]
    assert out.runs[0].headline.label == "There were 12 postings"  # summary fallback


# ------------------------------------------------------------------ headlines


def _count(k, n, display=None):
    return {"k": k, "n": n, "display": display or f"at least {k} of {n}", "share": k / n if n >= 10 else None, "ci": None}


def test_headline_people_like_me_prefers_exact_target_country():
    result = {"sections": [
        {"id": "cohort_size", "kind": "stat", "data": {"label": "visible profiles", "value": 626, "display": "626"}},
        {"id": "moved_abroad", "kind": "stat", "data": {"label": "people like you now live outside India", "count": _count(38, 623)}},
        {"id": "countries", "kind": "distribution", "data": {"n": 623, "items": [{"label": "United States", "count": 20, "target": True}]}},
    ]}
    h = headline_for("people_like_me", result)
    assert (h.value, h.lead) == (20, "At least") and h.label == "of 623 people like you now live in United States"
    # a sampled breakdown (sample_n) is never used: fall back to the exact moved-abroad total
    result["sections"][2]["data"]["sample_n"] = 60
    h = headline_for("people_like_me", result)
    assert h.value == 38 and h.label == "of 623 people like you now live outside India"
    # a target group under 5 is never shown on its own
    result["sections"][2]["data"].pop("sample_n")
    result["sections"][2]["data"]["items"][0]["count"] = 3
    assert headline_for("people_like_me", result).value == 38


def test_headline_per_tool_shapes():
    ind = {"sections": [{"id": "employers", "kind": "ranked_table", "data": {"rows": [
        {"cells": {"employer": "Walmart", "hires": 4340}}, {"cells": {"employer": "Other", "hires": 9}, "rest": True}]}}]}
    h = headline_for("indian_friendly", ind, {"country": "United States"})
    assert h.display == "Walmart" and h.value is None and "United States" in h.label and "4,340" in h.detail

    sat = {"sections": [{"id": "ratio", "kind": "stat", "data": {"label": "new entrants like you per open posting", "value": 0.0132,
                                                                  "display": "0.01", "level": "low", "note": "About 1.3 per 100."}}]}
    h = headline_for("market_saturation", sat)
    assert h.display == "Low" and h.level == "low"

    gps = {"sections": [{"id": "routes", "kind": "route_list", "data": {"routes": [
        {"id": "r1", "title": "Master's in United States first", "steps": [], "people": _count(6, 40)}]}}]}
    h = headline_for("reverse_gps", gps)
    assert h.value == 6 and h.label == "of 40 took the top route: Master's in United States first"

    conv = {"sections": [{"id": "companies", "kind": "ranked_table", "data": {"rows": [
        {"cells": {"company": "Other companies"}, "count": _count(11, 77), "rest": True}]}}]}
    assert headline_for("conversion_map", conv).value == 11

    jobs = {"sections": [{"id": "open_90", "kind": "stat", "data": {"label": "postings added in the last 90 days", "value": 79445, "display": "79,445"}}]}
    h = headline_for("job_postings", jobs)
    assert h.display == "79,445" and h.value == 79445

    # an unknown (newer) tool falls back to its first stat
    h = headline_for("college_paths", {"sections": [{"id": "goal_size", "kind": "stat", "data": {"label": "people in the goal", "value": 50}}]})
    assert h.display == "50"
    assert headline_for("routes_to_position", {"sections": [], "summary": None}) is None


# ------------------------------------------------------------------ /snapshot


async def test_snapshot_student_counts_only_and_caches(api, crustdata):
    _, client = api
    pid = await onboard(client)
    await _set_goals(client, pid, persona="student_abroad", intent="job_abroad", target_roles=["Data Engineer"], target_countries=["Germany"])
    before = len(crustdata.calls)
    r = await client.get(f"/api/profiles/{pid}/snapshot")
    assert r.status_code == 200, r.text
    snap = SnapshotResponse.model_validate(r.json())
    assert snap.persona == "student" and not snap.cached
    assert snap.goal.role == "Data Engineer" and snap.goal.country == "Germany"
    assert [t.key for t in snap.tiles] == ["cohort_in_country", "postings_30d", "indian_in_role"]
    for t in snap.tiles:
        assert t.status in ("ok", "too_few"), t
        assert t.tool and t.evidence_ids
        if t.status == "ok":
            assert t.value is not None and t.display == f"{t.value:,}"
        else:
            assert t.value is None
    assert snap.tiles[1].params == {"role": "Data Engineer", "country": "Germany"}
    assert snap.credits_used <= 3.0
    # count-only: no person search reads more than one row, no job search reads any
    for body in _search_calls(crustdata)[before:]:
        assert body.get("limit", 0) <= 1, body
    # second call is served from memory with no data calls
    n_calls = len(crustdata.calls)
    again = SnapshotResponse.model_validate((await client.get(f"/api/profiles/{pid}/snapshot")).json())
    assert again.cached and len(crustdata.calls) == n_calls
    assert [t.value for t in again.tiles] == [t.value for t in snap.tiles]
    # changing goals recounts
    await _set_goals(client, pid, target_countries=["Netherlands"])
    third = SnapshotResponse.model_validate((await client.get(f"/api/profiles/{pid}/snapshot")).json())
    assert not third.cached and third.goal.country == "Netherlands"


async def test_snapshot_without_role_asks_for_one(api):
    _, client = api
    pid = await onboard(client)
    await _set_goals(client, pid, persona="student_abroad", intent="job_abroad", target_countries=["Germany"])
    snap = SnapshotResponse.model_validate((await client.get(f"/api/profiles/{pid}/snapshot")).json())
    by = {t.key: t for t in snap.tiles}
    assert by["cohort_in_country"].status in ("ok", "too_few")
    assert by["postings_30d"].status == "needs_role" and by["indian_in_role"].status == "needs_role"
    assert by["postings_30d"].value is None


async def test_snapshot_too_few_is_never_a_number(api, monkeypatch):
    app, client = api
    pid = await onboard(client)
    await _set_goals(client, pid, persona="student_abroad", target_roles=["Data Engineer"], target_countries=["Germany"])
    from afterdegree import toolkit

    real = toolkit.ToolContext.count_people

    async def tiny(self, filters, note=None):
        n, ev = await real(self, filters, note)
        return (3 if note and "studied in India" in note else n), ev

    monkeypatch.setattr(toolkit.ToolContext, "count_people", tiny)
    snap = SnapshotResponse.model_validate((await client.get(f"/api/profiles/{pid}/snapshot?refresh=1")).json())
    tile = next(t for t in snap.tiles if t.key == "indian_in_role")
    assert tile.status == "too_few" and tile.value is None and tile.display == "Fewer than 5"


async def test_snapshot_university(api):
    _, client = api
    pid = await onboard(client)
    await _set_goals(client, pid, persona="university", intent="program_insights", institution="Vellore Institute of Technology")
    snap = SnapshotResponse.model_validate((await client.get(f"/api/profiles/{pid}/snapshot")).json())
    assert snap.persona == "university"
    assert [t.key for t in snap.tiles] == ["graduates_abroad", "top_destination"]
    assert all(t.status in ("ok", "too_few") for t in snap.tiles), snap.tiles
    assert snap.credits_used <= 3.0
    assert_error(await client.get("/api/profiles/p_missing/snapshot"), 404, "profile_not_found")
