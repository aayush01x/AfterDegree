import httpx
import pytest
import respx

from afterdegree.crustdata import (
    AuthError,
    BadRequestError,
    BudgetExceeded,
    CreditsExhaustedError,
    CrustdataClient,
    DiskCache,
    EndpointNotAllowed,
    ForbiddenError,
    MissingKeyError,
    NotFoundError,
    RateLimitedError,
    RunBudget,
    TokenBucket,
    UpstreamError,
    cache_key,
    estimate_cost,
    estimate_max_cost,
    person_search_unit_cost,
)

from .conftest import BASE, _no_sleep, fast_limiter, load_fixture

EDU_FILTER = {"field": "education.schools.school", "type": "=", "value": "Vellore Institute of Technology"}


async def test_headers_and_cache_miss_then_hit(client, store):
    with respx.mock() as router:
        route = router.post(f"{BASE}/person/search").mock(return_value=httpx.Response(200, json=load_fixture("person_search_name.json")))
        body = {"filters": EDU_FILTER, "limit": 1, "fields": ["crustdata_person_id"]}
        first = await client.person_search(body)
        second = await client.person_search(body)
    assert route.call_count == 1
    req = route.calls[0].request
    assert req.headers["authorization"] == "Bearer test-key-not-real"
    assert req.headers["x-api-version"] == "2025-11-01"
    assert first.source == "live" and second.source == "cache"
    assert second.data["total_count"] == 8
    usage = {(r["endpoint"], r["source"]): r for r in store.usage_since("2000-01-01")}
    assert usage[("/person/search", "live")]["calls"] == 1
    assert usage[("/person/search", "cache")]["calls"] == 1
    assert usage[("/person/search", "cache")]["est"] == 0


async def test_cache_key_is_canonical():
    a = cache_key("/job/search", {"limit": 0, "filters": {"type": "=", "field": "x", "value": 1}})
    b = cache_key("/job/search", {"filters": {"field": "x", "value": 1, "type": "="}, "limit": 0})
    assert a == b
    assert a != cache_key("/person/search", {"limit": 0, "filters": {"type": "=", "field": "x", "value": 1}})


def test_cache_ttl_expiry(tmp_path):
    now = [1000.0]
    cache = DiskCache(tmp_path, ttl_days=1, clock=lambda: now[0])
    cache.set("abc123", "/job/search", {"a": 1}, {"ok": True}, "2026-11-06T00:00:00Z")
    assert cache.get("abc123")["response"] == {"ok": True}
    now[0] += 2 * 86400
    assert cache.get("abc123") is None


async def test_mock_client_never_writes_real_cache(settings, store, fake, tmp_path):
    settings.mock = True
    c = CrustdataClient(settings, store, transport=fake.transport(), limiter=fast_limiter())
    await c.job_search({"filters": {"field": "location.country", "type": "=", "value": "Germany"}, "limit": 0})
    assert not (settings.cache_dir).exists()


def test_person_search_unit_cost_matches_pricing_doc():
    # no fields -> experience + education returned: 0.23 per result
    assert person_search_unit_cost({"filters": {"field": "basic_profile.name", "type": "=", "value": "x"}}) == pytest.approx(0.23)
    # filter on education, return only id: 0.03 + 0.1
    assert person_search_unit_cost({"filters": EDU_FILTER, "fields": ["crustdata_person_id"]}) == pytest.approx(0.13)
    # filter edu + exp, return exp + edu
    body = {"filters": {"op": "and", "conditions": [EDU_FILTER, {"field": "experience.employment_details.current.title", "type": "[.]", "value": "x"}]},
            "fields": ["experience.employment_details.current", "education.schools", "basic_profile.location"]}
    assert person_search_unit_cost(body) == pytest.approx(0.43)
    assert estimate_max_cost("/person/search", {**body, "limit": 100}) == pytest.approx(43.0)


def test_estimate_cost_other_endpoints():
    assert estimate_cost("/job/search", {"limit": 5}, {"job_listings": [{}] * 5}) == pytest.approx(0.15)
    assert estimate_cost("/job/search", {"limit": 0}, load_fixture("job_search_count.json")) == 0
    assert estimate_cost("/person/enrich", {}, load_fixture("person_enrich_all_fields.json")) == 1
    assert estimate_cost("/person/enrich", {}, load_fixture("person_enrich_no_match.json")) == 0
    assert estimate_cost("/company/identify", {}, load_fixture("company_identify_domain.json")) == 0
    assert estimate_cost("/web/search/live", {"query": "x"}, {"results": []}) == 1


async def test_token_bucket_spaces_requests():
    t = [0.0]
    slept = []

    async def fake_sleep(s):
        slept.append(s)
        t[0] += s

    bucket = TokenBucket(rpm=30, capacity=1, clock=lambda: t[0], sleep=fake_sleep)
    await bucket.acquire()
    waited = await bucket.acquire()
    assert waited == pytest.approx(2.0)  # 30 RPM = one token every 2 s
    assert sum(slept) == pytest.approx(2.0)


async def test_rate_limiter_applies_aggregate_limit():
    from afterdegree.crustdata import RateLimiter

    t = [0.0]

    async def fake_sleep(s):
        t[0] += s

    lim = RateLimiter({"/a": 1000, "/b": 1000}, aggregate_rpm=60, clock=lambda: t[0], sleep=fake_sleep)
    lim.aggregate.capacity = lim.aggregate.tokens = 1
    for lim_b in lim.buckets.values():
        lim_b.capacity = lim_b.tokens = 100
    await lim.acquire("/a")
    await lim.acquire("/b")
    assert t[0] == pytest.approx(1.0)  # 60 RPM aggregate => 1 s between calls


async def test_budget_stops_before_calling(client):
    budget = RunBudget(max_live_calls=1, max_credits=100)
    with respx.mock() as router:
        route = router.post(f"{BASE}/job/search").mock(return_value=httpx.Response(200, json=load_fixture("job_search_count.json")))
        await client.job_search({"filters": {"field": "a", "type": "=", "value": 1}, "limit": 0}, budget=budget)
        with pytest.raises(BudgetExceeded):
            await client.job_search({"filters": {"field": "a", "type": "=", "value": 2}, "limit": 0}, budget=budget)
    assert route.call_count == 1


async def test_budget_credit_ceiling(client):
    budget = RunBudget(max_live_calls=10, max_credits=1.0)
    with respx.mock(assert_all_called=False) as router:
        route = router.post(f"{BASE}/person/search").mock(return_value=httpx.Response(200, json={"profiles": [], "total_count": 0}))
        with pytest.raises(BudgetExceeded):
            await client.person_search({"filters": EDU_FILTER, "limit": 100}, budget=budget)
    assert route.call_count == 0


async def test_cached_calls_do_not_use_budget(client):
    budget = RunBudget(max_live_calls=1, max_credits=10)
    body = {"filters": {"field": "a", "type": "=", "value": 1}, "limit": 0}
    with respx.mock() as router:
        router.post(f"{BASE}/job/search").mock(return_value=httpx.Response(200, json=load_fixture("job_search_count.json")))
        await client.job_search(body, budget=budget)
        await client.job_search(body, budget=budget)
    assert budget.live_calls == 1 and budget.cached_calls == 1


async def test_retries_429_then_succeeds(client):
    with respx.mock() as router:
        route = router.post(f"{BASE}/job/search").mock(side_effect=[
            httpx.Response(429, json={"error": {"type": "rate_limit_error", "message": "slow down"}}, headers={"retry-after": "1"}),
            httpx.Response(503, json={"error": {"message": "busy"}}),
            httpx.Response(200, json=load_fixture("job_search_count.json")),
        ])
        res = await client.job_search({"filters": {"field": "a", "type": "=", "value": 3}, "limit": 0})
    assert route.call_count == 3
    assert res.data["total_count"] == 4448237


async def test_gives_up_after_retries(client, settings):
    settings.max_retries = 2
    with respx.mock() as router:
        route = router.post(f"{BASE}/job/search").mock(return_value=httpx.Response(429, json={"error": {"message": "slow"}}))
        with pytest.raises(RateLimitedError):
            await client.job_search({"filters": {"field": "a", "type": "=", "value": 4}, "limit": 0})
    assert route.call_count == 3


@pytest.mark.parametrize(
    "status,payload,exc",
    [
        (401, load_fixture("error_401.json"), AuthError),
        (402, {"error": {"message": "Payment required"}}, CreditsExhaustedError),
        (403, {"error": {"message": "Insufficient credits"}}, CreditsExhaustedError),
        (403, load_fixture("error_403_fields.json"), ForbiddenError),
        (404, {"error": {"message": "Not found"}}, NotFoundError),
        (400, {"error": {"message": "bad filter"}}, BadRequestError),
        (500, load_fixture("error_500_unsupported.json"), BadRequestError),
    ],
)
async def test_clear_errors(client, status, payload, exc):
    with respx.mock() as router:
        route = router.post(f"{BASE}/person/search").mock(return_value=httpx.Response(status, json=payload))
        with pytest.raises(exc) as info:
            await client.person_search({"filters": {"field": "x", "type": "=", "value": status}, "limit": 1})
    assert route.call_count == 1  # never retried
    assert info.value.message and "test-key" not in info.value.message


async def test_network_error_becomes_upstream_error(client, settings):
    settings.max_retries = 1
    with respx.mock() as router:
        router.post(f"{BASE}/job/search").mock(side_effect=httpx.ConnectError("boom"))
        with pytest.raises(UpstreamError):
            await client.job_search({"filters": {"field": "a", "type": "=", "value": 9}, "limit": 0})


async def test_missing_key_and_disallowed_endpoints(settings, store):
    settings.crustdata_api_key = ""
    c = CrustdataClient(settings, store, limiter=fast_limiter(), sleep=_no_sleep)
    with pytest.raises(MissingKeyError):
        await c.job_search({"filters": {}, "limit": 0})
    with pytest.raises(EndpointNotAllowed):
        await c.post("/person/identify", {})
    with pytest.raises(EndpointNotAllowed):
        await c.post("/social_post/search", {})  # feature-flagged off by default


def test_settings_repr_masks_keys(settings):
    text = repr(settings)
    assert "test-key-not-real" not in text and "<set>" in text
