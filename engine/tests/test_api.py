import asyncio
import json
import re

import httpx
import pytest

from afterdegree.api import create_app
from afterdegree.config import Settings
from afterdegree.db import Store
from afterdegree.schemas import (
    Evidence,
    Health,
    Job,
    JobCreated,
    OnboardingChatResponse,
    OnboardingCompleteResponse,
    OnboardingProfileResponse,
    StoredProfile,
    Usage,
)

from .helpers import assert_privacy, validate_result
from .test_tools import HAPPY

SLUGS = {
    "people_like_me": "people-like-me",
    "internship_chances": "internship-chances",
    "conversion_map": "conversion-map",
    "reverse_gps": "reverse-gps",
    "routes_to_position": "routes-to-position",
    "job_postings": "job-postings",
    "indian_friendly": "indian-friendly",
    "market_saturation": "market-saturation",
    "college_paths": "college-paths",
}


async def _api(settings, fake=None, mock=False):
    app = create_app(settings=settings, store=Store(":memory:"))
    ctx = app.router.lifespan_context(app)
    await ctx.__aenter__()
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://engine")
    # never wait on the rate limiter in tests
    from .conftest import fast_limiter

    app.state.client.limiter = fast_limiter()
    return app, client, ctx


@pytest.fixture
async def api(settings, crustdata):
    app, client, ctx = await _api(settings)
    yield app, client
    await client.aclose()
    await ctx.__aexit__(None, None, None)


def assert_error(resp, status, code=None):
    assert resp.status_code == status, resp.text
    body = resp.json()
    assert set(body) == {"error"} and set(body["error"]) == {"code", "message", "hint"}
    assert body["error"]["message"]
    if code:
        assert body["error"]["code"] == code


async def onboard(client) -> str:
    r = await client.post("/api/onboarding/profile", json={"linkedin_url": "https://www.linkedin.com/in/riya-menon-example/"})
    assert r.status_code == 200, r.text
    return r.json()["profile_id"]


async def wait_job(client, job_id, timeout=60):
    for _ in range(int(timeout / 0.05)):
        r = await client.get(f"/api/jobs/{job_id}")
        assert r.status_code == 200
        job = r.json()
        if job["status"] in ("done", "error"):
            return job
        await asyncio.sleep(0.05)
    raise AssertionError("job did not finish")


async def test_onboarding_profile_shape(api):
    _, client = api
    r = await client.post("/api/onboarding/profile", json={"linkedin_url": "linkedin.com/in/riya-menon-example"})
    assert r.status_code == 200
    body = OnboardingProfileResponse.model_validate(r.json())
    assert body.profile_id.startswith("p_")
    assert body.derived.undergrad_school == "Vellore Institute of Technology"
    assert body.derived.persona_guess == "student_abroad"
    assert body.person.name == "Riya Menon"  # the user's own profile is returned to them
    assert body.evidence[0].endpoint == "/person/enrich"


async def test_onboarding_profile_errors(api, settings):
    _, client = api
    assert_error(await client.post("/api/onboarding/profile", json={"linkedin_url": "https://example.com/me"}), 400, "invalid_url")
    assert_error(await client.post("/api/onboarding/profile", json={"linkedin_url": "https://www.linkedin.com/in/not-found-person"}), 404, "profile_not_found")
    assert_error(await client.post("/api/onboarding/profile", json={}), 400, "bad_input")


async def test_onboarding_missing_key_is_424(tmp_path):
    s = Settings(crustdata_api_key="", cache_dir=tmp_path / "c", db_path=tmp_path / "d")
    app, client, ctx = await _api(s)
    try:
        r = await client.post("/api/onboarding/profile", json={"linkedin_url": "https://www.linkedin.com/in/someone"})
        assert_error(r, 424, "missing_key")
        h = Health.model_validate((await client.get("/api/health")).json())
        assert h.crustdata == "missing_key" and h.llm == "missing_key" and h.mock is False
    finally:
        await client.aclose()
        await ctx.__aexit__(None, None, None)


async def test_chat_complete_and_profile(api):
    _, client = api
    pid = await onboard(client)
    r = await client.post("/api/onboarding/chat", json={"profile_id": pid, "messages": []})
    first = OnboardingChatResponse.model_validate(r.json())
    assert not first.done
    msgs = [{"role": "assistant", "content": first.reply}, {"role": "user", "content": "Yes"},
            {"role": "assistant", "content": "q2"}, {"role": "user", "content": "A master's abroad"},
            {"role": "assistant", "content": "q3"}, {"role": "user", "content": "Germany"}]
    r = await client.post("/api/onboarding/chat", json={"profile_id": pid, "messages": msgs})
    chat = OnboardingChatResponse.model_validate(r.json())
    assert chat.goals.target_countries == ["Germany"]
    r = await client.post("/api/onboarding/complete", json={"profile_id": pid, "goals": {"target_roles": ["Data Engineer"]}})
    done = OnboardingCompleteResponse.model_validate(r.json())
    assert done.home.next_steps and done.home.next_steps[0].tool == "people_like_me"
    prof = StoredProfile.model_validate((await client.get(f"/api/profiles/{pid}")).json())
    assert prof.completed and prof.goals.target_roles == ["Data Engineer"] and prof.goals.target_countries == ["Germany"]
    assert prof.evidence and prof.evidence[0].endpoint == "/person/enrich"
    assert_error(await client.get("/api/profiles/p_missing"), 404, "profile_not_found")
    assert_error(await client.post("/api/onboarding/chat", json={"profile_id": "p_missing", "messages": []}), 404)


@pytest.mark.parametrize("tool", list(SLUGS))
async def test_tool_endpoints_produce_contract_results(api, fake, tool):
    _, client = api
    pid = await onboard(client)
    r = await client.post(f"/api/tools/{SLUGS[tool]}", json={"profile_id": pid, **HAPPY[tool]})
    assert r.status_code == 200, r.text
    job_id = JobCreated.model_validate(r.json()).job_id
    job = Job.model_validate(await wait_job(client, job_id))
    assert job.status == "done", job.error
    assert job.tool == tool and job.progress.done == job.progress.total
    validate_result(job.result, tool)
    raw = json.dumps((await client.get(f"/api/jobs/{job_id}")).json())
    assert_privacy(raw, fake)
    ev_id = job.result.evidence[0].id
    ev = Evidence.model_validate((await client.get(f"/api/evidence/{ev_id}")).json())
    assert ev.id == ev_id


async def test_tool_errors(api):
    _, client = api
    pid = await onboard(client)
    assert_error(await client.post("/api/tools/job-postings", json={"profile_id": pid, "role": "Data Engineer"}), 400, "bad_input")
    assert_error(await client.post("/api/tools/people-like-me", json={"profile_id": "p_nope"}), 404, "profile_not_found")
    assert_error(await client.post("/api/tools/people-like-me", json={"profile_id": pid, "exp_band": "a,b"}), 400, "bad_input")
    r = await client.post("/api/tools/reverse-gps", json={"profile_id": pid})
    job = await wait_job(client, r.json()["job_id"])
    assert job["status"] == "error" and job["error"]["code"] == "bad_input" and job["error"]["message"]
    assert_error(await client.get("/api/jobs/job_nope"), 404, "job_not_found")
    assert_error(await client.get("/api/evidence/ev_nope"), 404)
    assert_error(await client.get("/api/does-not-exist"), 404, "not_found")


async def test_exp_band_string_accepted(api):
    _, client = api
    pid = await onboard(client)
    r = await client.post("/api/tools/people-like-me", json={"profile_id": pid, "exp_band": "1,3"})
    job = await wait_job(client, r.json()["job_id"])
    assert job["status"] == "done"
    assert "1–3 years of work" in job["result"]["cohort"]["definition"]


async def test_sse_stream(api):
    _, client = api
    pid = await onboard(client)
    r = await client.post("/api/tools/job-postings", json={"profile_id": pid, "role": "Data Engineer", "country": "Germany"})
    job_id = r.json()["job_id"]
    events = []
    async with client.stream("GET", f"/api/jobs/{job_id}/events") as resp:
        assert resp.headers["content-type"].startswith("text/event-stream")
        async for line in resp.aiter_lines():
            if line.startswith("event:"):
                events.append(line.split(":", 1)[1].strip())
    assert events[-1] == "done"
    assert set(events) <= {"progress", "done"}


async def test_health_and_usage(api):
    _, client = api
    pid = await onboard(client)
    r = await client.post("/api/tools/job-postings", json={"profile_id": pid, "role": "Data Engineer", "country": "Germany"})
    await wait_job(client, r.json()["job_id"])
    h = Health.model_validate((await client.get("/api/health")).json())
    assert h.crustdata == "ok" and h.llm == "missing_key"
    u = Usage.model_validate((await client.get("/api/usage")).json())
    assert u.live_calls > 0 and u.estimated_credits > 0
    assert {e.endpoint for e in u.by_endpoint} >= {"/person/enrich", "/job/search"}


async def test_cors_for_frontend(api):
    _, client = api
    r = await client.options("/api/health", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


async def test_mock_mode_is_deterministic_and_labelled(tmp_path):
    s = Settings(crustdata_api_key="", cache_dir=tmp_path / "c", db_path=tmp_path / "d", mock=True)
    app, client, ctx = await _api(s)
    try:
        h = (await client.get("/api/health")).json()
        assert h["crustdata"] == "ok" and h["mock"] is True
        pid = await onboard(client)
        prof = (await client.get(f"/api/profiles/{pid}")).json()
        assert prof["person"]["name"] == "Riya Menon"
        results = []
        for _ in range(2):
            r = await client.post("/api/tools/people-like-me", json={"profile_id": pid})
            job = await wait_job(client, r.json()["job_id"])
            assert job["status"] == "done"
            assert "Example data (mock mode)" in job["result"]["warnings"]
            assert {e["source"] for e in job["result"]["evidence"]} == {"mock"}
            validate_result(job["result"], "people_like_me")
            results.append(re.sub(r'"ev_[0-9a-f]+"', '"ev"', json.dumps(job["result"]["sections"])))
        assert results[0] == results[1]  # same numbers; evidence ids are per run
        assert not (tmp_path / "c").exists()  # mock data never cached
        u = (await client.get("/api/usage")).json()
        assert u["estimated_credits"] == 0
    finally:
        await client.aclose()
        await ctx.__aexit__(None, None, None)
