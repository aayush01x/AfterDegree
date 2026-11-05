"""Async Crustdata client.

- per-endpoint token buckets plus a 200 RPM aggregate bucket
- jittered exponential backoff on 429/5xx, clear errors on 400/401/402/403/404
- disk cache keyed by sha256(endpoint + canonical JSON body); each distinct query is paid once
- a credit-log row per call, and a hard per-run budget (live calls and estimated credits)

Only the endpoints enabled on the team key are callable. Never logs key values.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import random
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from .config import Settings
from .db import Store

log = logging.getLogger("afterdegree.crustdata")

ENDPOINT_RPM: dict[str, int] = {
    "/person/search": 30,
    "/person/enrich": 15,
    "/person/search/autocomplete": 300,
    "/company/search/autocomplete": 300,
    "/company/identify": 30,
    "/company/search": 30,
    "/company/enrich": 15,
    "/job/search": 30,
    "/web/search/live": 10,
    "/web/enrich/live": 10,
    "/social_post/search": 30,
}
OPTIONAL_ENDPOINTS = {"/social_post/search"}

# ---------------------------------------------------------------- errors


class CrustdataError(Exception):
    """Base error. `message` is written for the end user in the mentor voice."""

    code = "upstream_error"
    http_status = 424

    def __init__(self, message: str, hint: str | None = None, status: int | None = None, detail: str | None = None):
        super().__init__(message)
        self.message = message
        self.hint = hint
        self.status = status
        self.detail = detail  # upstream message, for logs only


class MissingKeyError(CrustdataError):
    code = "missing_key"


class AuthError(CrustdataError):
    code = "upstream_auth"


class CreditsExhaustedError(CrustdataError):
    code = "upstream_credits"


class ForbiddenError(CrustdataError):
    code = "upstream_forbidden"


class NotFoundError(CrustdataError):
    code = "not_found"
    http_status = 404


class BadRequestError(CrustdataError):
    code = "upstream_bad_request"


class RateLimitedError(CrustdataError):
    code = "rate_limited"
    http_status = 429


class UpstreamError(CrustdataError):
    code = "upstream_unavailable"


class BudgetExceeded(CrustdataError):
    code = "budget_exceeded"
    http_status = 429


class EndpointNotAllowed(CrustdataError):
    code = "endpoint_not_allowed"
    http_status = 500


# ---------------------------------------------------------------- rate limiting


class TokenBucket:
    def __init__(
        self,
        rpm: float,
        capacity: float | None = None,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ):
        self.rate = rpm / 60.0
        # Small burst allowance; Crustdata prefers steady traffic over bursts.
        self.capacity = capacity if capacity is not None else max(1.0, rpm / 10.0)
        self.tokens = self.capacity
        self.clock = clock
        self.sleep = sleep
        self.updated = clock()
        self._lock = asyncio.Lock()

    def _refill(self) -> None:
        now = self.clock()
        elapsed = max(0.0, now - self.updated)
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.updated = now

    async def acquire(self) -> float:
        """Take one token, waiting if needed. Returns seconds waited."""
        waited = 0.0
        async with self._lock:
            while True:
                self._refill()
                if self.tokens >= 1.0:
                    self.tokens -= 1.0
                    return waited
                wait = (1.0 - self.tokens) / self.rate
                waited += wait
                await self.sleep(wait)


class RateLimiter:
    def __init__(
        self,
        endpoint_rpm: dict[str, int] | None = None,
        aggregate_rpm: int = 200,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ):
        self.clock = clock
        self.sleep = sleep
        self.buckets = {ep: TokenBucket(rpm, clock=clock, sleep=sleep) for ep, rpm in (endpoint_rpm or ENDPOINT_RPM).items()}
        self.aggregate = TokenBucket(aggregate_rpm, clock=clock, sleep=sleep)

    async def acquire(self, endpoint: str) -> float:
        bucket = self.buckets.get(endpoint)
        waited = 0.0
        if bucket is not None:
            waited += await bucket.acquire()
        waited += await self.aggregate.acquire()
        return waited


# ---------------------------------------------------------------- cache


def canonical_json(body: Any) -> str:
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def cache_key(endpoint: str, body: Any) -> str:
    return hashlib.sha256((endpoint + "\n" + canonical_json(body)).encode("utf-8")).hexdigest()


class DiskCache:
    def __init__(self, directory: Path, ttl_days: float = 7.0, clock: Callable[[], float] = time.time):
        self.dir = Path(directory)
        self.ttl_s = ttl_days * 86400
        self.clock = clock

    def _path(self, key: str) -> Path:
        return self.dir / key[:2] / f"{key}.json"

    def get(self, key: str) -> dict | None:
        path = self._path(key)
        if not path.exists():
            return None
        try:
            entry = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        if self.clock() - float(entry.get("stored_at", 0)) > self.ttl_s:
            return None
        return entry

    def set(self, key: str, endpoint: str, body: Any, response: Any, fetched_at: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        entry = {"endpoint": endpoint, "body": body, "response": response, "fetched_at": fetched_at, "stored_at": self.clock()}
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(entry, ensure_ascii=False), encoding="utf-8")
        tmp.replace(path)


# ---------------------------------------------------------------- credits

PERSON_FILTER_PREMIUM = {
    "experience": 0.1,
    "education": 0.1,
    "skills": 0.1,
    "certifications": 0.2,
    "honors": 0.2,
    "professional_network": 0.2,
    "dev_platform_profiles": 0.8,
    "research_profiles": 0.4,
}
PERSON_RESPONSE_PREMIUM = {
    "experience": 0.1,
    "education": 0.1,
    "skills": 0.1,
    "certifications": 0.2,
    "honors": 0.2,
    "professional_network": 0.2,
    "summary": 0.2,
    "research_profiles": 0.4,
}


def _filter_fields(node: Any) -> list[str]:
    out: list[str] = []
    if isinstance(node, dict):
        if "field" in node:
            out.append(str(node["field"]))
        for child in node.get("conditions", []) or []:
            out.extend(_filter_fields(child))
    elif isinstance(node, list):
        for child in node:
            out.extend(_filter_fields(child))
    return out


def _person_group(path: str, response: bool) -> str | None:
    if path.startswith("experience.") or path in ("experience", "recently_changed_jobs"):
        return "experience"
    if path.startswith("education"):
        return "education"
    if path.startswith("skills"):
        return "skills"
    if path.startswith("certifications"):
        return "certifications"
    if path.startswith("honors"):
        return "honors"
    if path.startswith("dev_platform_profiles"):
        return "dev_platform_profiles"
    if path.startswith("research_profiles"):
        return "research_profiles"
    if path in ("basic_profile.summary", "professional_network.summary"):
        return "summary"
    if path == "basic_profile.languages" or path.startswith("professional_network.") and not path.startswith(
        "professional_network.location"
    ):
        return "professional_network"
    if response and path == "professional_network":
        return "professional_network"
    return None


def person_search_unit_cost(body: dict) -> float:
    """Credits per returned profile for a /person/search body (list prices)."""
    cost = 0.03
    filter_groups = {g for f in _filter_fields(body.get("filters")) if (g := _person_group(f, False))}
    cost += sum(PERSON_FILTER_PREMIUM.get(g, 0) for g in filter_groups)
    fields_ = body.get("fields")
    if fields_ is None:
        response_groups = {"experience", "education"}
    else:
        response_groups = {g for f in fields_ if (g := _person_group(f, True))}
    cost += sum(PERSON_RESPONSE_PREMIUM.get(g, 0) for g in response_groups)
    return round(cost, 4)


def _limit(body: dict, default: int = 20) -> int:
    value = body.get("limit", body.get("count", default))
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return default


def estimate_max_cost(endpoint: str, body: dict) -> float:
    """Worst-case credits for a call before it is made."""
    if endpoint == "/person/search":
        return _limit(body) * person_search_unit_cost(body)
    if endpoint == "/person/enrich":
        return float(len(body.get("professional_network_profile_urls") or [])) or 1.0
    if endpoint == "/company/enrich":
        ids = next((body[k] for k in ("crustdata_company_ids", "domains", "names", "professional_network_profile_urls") if k in body), [])
        return 2.0 * max(1, len(ids))
    if endpoint == "/company/search":
        return _limit(body) * 0.03
    if endpoint == "/job/search":
        return _limit(body) * 0.03
    if endpoint == "/web/search/live":
        return 1.0
    if endpoint == "/web/enrich/live":
        return float(max(1, len(body.get("urls") or [])))
    if endpoint == "/social_post/search":
        return _limit(body) * 0.5
    return 0.0


def count_results(endpoint: str, data: Any) -> int:
    if endpoint == "/person/search" and isinstance(data, dict):
        return len(data.get("profiles") or [])
    if endpoint == "/job/search" and isinstance(data, dict):
        return len(data.get("job_listings") or [])
    if endpoint in ("/person/enrich", "/company/enrich", "/company/identify") and isinstance(data, list):
        return sum(1 for item in data if item.get("matches"))
    if endpoint == "/company/search" and isinstance(data, dict):
        return len(data.get("companies") or data.get("results") or [])
    if endpoint == "/web/search/live" and isinstance(data, dict):
        return len(data.get("results") or [])
    if endpoint == "/web/enrich/live" and isinstance(data, list):
        return len(data)
    if endpoint == "/social_post/search" and isinstance(data, dict):
        return len(data.get("posts") or data.get("results") or [])
    if isinstance(data, dict) and "suggestions" in data:
        return len(data.get("suggestions") or [])
    return 0


def estimate_cost(endpoint: str, body: dict, data: Any) -> float:
    n = count_results(endpoint, data)
    if endpoint == "/person/search":
        return round(n * person_search_unit_cost(body), 4)
    if endpoint == "/person/enrich":
        return float(n)
    if endpoint == "/company/enrich":
        return 2.0 * n
    if endpoint in ("/company/search", "/job/search"):
        return round(0.03 * n, 4)
    if endpoint == "/web/search/live":
        return 1.0
    if endpoint == "/web/enrich/live":
        return float(n)
    if endpoint == "/social_post/search":
        return 0.5 * n
    return 0.0


# ---------------------------------------------------------------- budget


@dataclass
class RunBudget:
    max_live_calls: int
    max_credits: float
    live_calls: int = 0
    cached_calls: int = 0
    credits: float = 0.0

    @property
    def remaining_credits(self) -> float:
        return max(0.0, self.max_credits - self.credits)

    @property
    def remaining_calls(self) -> int:
        return max(0, self.max_live_calls - self.live_calls)

    def check(self, worst_case: float) -> None:
        if self.live_calls + 1 > self.max_live_calls:
            raise BudgetExceeded(
                "I've reached the safe limit of data lookups for this question.",
                hint="The results so far are shown; narrow the question or try again later.",
            )
        if self.credits + worst_case > self.max_credits + 1e-9:
            raise BudgetExceeded(
                "This question would cost more data credits than one run is allowed to spend.",
                hint="Try a narrower question, or raise AFTERDEGREE_MAX_CREDITS.",
            )

    def charge(self, credits: float) -> None:
        self.live_calls += 1
        self.credits = round(self.credits + credits, 4)


# ---------------------------------------------------------------- client


@dataclass
class CallResult:
    endpoint: str
    body: dict
    data: Any
    source: str  # live | cache
    fetched_at: str
    credits: float = 0.0
    key: str = ""
    mock: bool = False
    meta: dict = field(default_factory=dict)


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _upstream_message(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text[:300]
    if isinstance(payload, dict):
        err = payload.get("error")
        if isinstance(err, dict):
            return str(err.get("message", ""))[:500]
        if "message" in payload:
            return str(payload["message"])[:500]
    return str(payload)[:300]


def error_for_status(endpoint: str, response: httpx.Response) -> CrustdataError:
    status = response.status_code
    detail = _upstream_message(response)
    low = detail.lower()
    if status == 401:
        return AuthError(
            "I couldn't sign in to our career-data provider; the API key looks wrong or expired.",
            hint="Check CRUSTDATA_API_KEY in the .env file.",
            status=status,
            detail=detail,
        )
    if status == 402 or (status == 403 and "credit" in low):
        return CreditsExhaustedError(
            "We've run out of data credits for now, so I can't look this up.",
            hint="Top up Crustdata credits, or try a question that's already cached.",
            status=status,
            detail=detail,
        )
    if status == 403:
        return ForbiddenError(
            "That kind of lookup isn't switched on for our data plan.",
            hint=f"{endpoint} returned 403; check the endpoint and fields enabled on the key.",
            status=status,
            detail=detail,
        )
    if status == 404:
        return NotFoundError("I couldn't find that in the data.", hint="Check the spelling or the link.", status=status, detail=detail)
    if status == 429:
        return RateLimitedError(
            "The data provider asked us to slow down for a minute.",
            hint="Wait a minute and try again; finished lookups are cached.",
            status=status,
            detail=detail,
        )
    if status in (400, 413, 422) or (status == 500 and ("unsupported" in low or "requires" in low)):
        return BadRequestError(
            "I asked the data provider a question it couldn't understand.",
            hint="Try simpler wording for the role, place or company.",
            status=status,
            detail=detail,
        )
    return UpstreamError(
        "The career-data provider is having a moment and didn't answer.",
        hint="Please try again in a minute.",
        status=status,
        detail=detail,
    )


RETRYABLE = {429, 500, 502, 503, 504}


class CrustdataClient:
    def __init__(
        self,
        settings: Settings,
        store: Store | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
        limiter: RateLimiter | None = None,
        cache: DiskCache | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        use_cache: bool | None = None,
        mock: bool | None = None,
    ):
        self.settings = settings
        self.store = store
        self.mock = settings.mock if mock is None else mock
        self.sleep = sleep
        if limiter is None:
            if self.mock:  # no real upstream to protect
                limiter = RateLimiter({ep: 100000 for ep in ENDPOINT_RPM}, aggregate_rpm=100000, sleep=sleep)
            else:
                limiter = RateLimiter(aggregate_rpm=settings.aggregate_rpm, sleep=sleep)
        self.limiter = limiter
        # Mock data must never land in the real cache.
        self.use_cache = (not self.mock) if use_cache is None else use_cache
        self.cache = cache or DiskCache(settings.cache_dir, settings.cache_ttl_days)
        self._transport = transport
        self._client: httpx.AsyncClient | None = None
        self.last_auth_error = False

    # -- lifecycle

    def _http(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.settings.crustdata_base_url,
                timeout=httpx.Timeout(self.settings.http_timeout_s),
                transport=self._transport,
            )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.settings.crustdata_api_key or 'mock'}",
            "x-api-version": self.settings.crustdata_api_version,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    @property
    def has_key(self) -> bool:
        return self.mock or bool(self.settings.crustdata_api_key)

    # -- core

    async def post(
        self,
        endpoint: str,
        body: dict,
        budget: RunBudget | None = None,
        run_id: str | None = None,
        use_cache: bool = True,
    ) -> CallResult:
        if endpoint not in ENDPOINT_RPM:
            raise EndpointNotAllowed(f"Endpoint {endpoint} is not enabled for this engine.")
        if endpoint in OPTIONAL_ENDPOINTS and not self.settings.social_posts_enabled:
            raise EndpointNotAllowed(f"Endpoint {endpoint} is feature-flagged off.")

        key = cache_key(endpoint, body)
        if use_cache and self.use_cache:
            entry = self.cache.get(key)
            if entry is not None:
                if budget is not None:
                    budget.cached_calls += 1
                self._log(endpoint, "cache", 200, count_results(endpoint, entry["response"]), 0.0, None, run_id, key)
                return CallResult(endpoint, body, entry["response"], "cache", entry.get("fetched_at") or _now_iso(), 0.0, key)

        if not self.has_key:
            raise MissingKeyError(
                "I can't reach the career data yet because the data key isn't set up.",
                hint="Add CRUSTDATA_API_KEY to .env, or run the engine with AFTERDEGREE_MOCK=1 for example data.",
            )

        worst = estimate_max_cost(endpoint, body)
        if budget is not None:
            budget.check(worst)

        response = await self._send_with_retries(endpoint, body)
        data = response.json()
        fetched_at = _now_iso()
        est = estimate_cost(endpoint, body, data)
        reported = None
        header = response.headers.get("x-credits-used")
        if header:
            try:
                reported = float(header)
            except ValueError:
                reported = None
        charged = reported if reported is not None else est
        if budget is not None:
            budget.charge(charged)
        source = "mock" if self.mock else "live"
        self._log(endpoint, source, response.status_code, count_results(endpoint, data), 0.0 if self.mock else est, reported, run_id, key)
        if use_cache and self.use_cache:
            try:
                self.cache.set(key, endpoint, body, data, fetched_at)
            except OSError as exc:  # cache problems must never fail a run
                log.warning("cache write failed: %s", exc)
        return CallResult(endpoint, body, data, "live", fetched_at, charged, key, mock=self.mock)

    async def _send_with_retries(self, endpoint: str, body: dict) -> httpx.Response:
        attempts = self.settings.max_retries + 1
        last_exc: CrustdataError | None = None
        for attempt in range(attempts):
            await self.limiter.acquire(endpoint)
            try:
                response = await self._http().post(endpoint, json=body, headers=self._headers())
            except httpx.TimeoutException:
                last_exc = UpstreamError(
                    "The career-data provider took too long to answer.", hint="Please try again in a minute.", detail="timeout"
                )
            except httpx.HTTPError as exc:
                last_exc = UpstreamError(
                    "I couldn't reach the career-data provider.", hint="Check the network connection and try again.", detail=type(exc).__name__
                )
            else:
                if response.status_code < 400:
                    self.last_auth_error = False
                    return response
                err = error_for_status(endpoint, response)
                if isinstance(err, AuthError):
                    self.last_auth_error = True
                if response.status_code not in RETRYABLE or isinstance(err, BadRequestError):
                    log.warning("crustdata %s -> %s: %s", endpoint, response.status_code, err.detail)
                    raise err
                last_exc = err
                if attempt < attempts - 1:
                    await self.sleep(self._retry_delay(response, attempt))
                    continue
                break
            if attempt < attempts - 1:
                await self.sleep(self._retry_delay(None, attempt))
        assert last_exc is not None
        log.warning("crustdata %s failed after %d attempts: %s", endpoint, attempts, last_exc.detail)
        raise last_exc

    def _retry_delay(self, response: httpx.Response | None, attempt: int) -> float:
        if response is not None:
            for header in ("retry-after", "x-ratelimit-reset"):
                value = response.headers.get(header)
                if value:
                    try:
                        return min(60.0, max(0.5, float(value))) + random.uniform(0, 0.5)
                    except ValueError:
                        pass
        base = self.settings.backoff_base_s
        return min(30.0, base * (2**attempt)) + random.uniform(0, base)

    def _log(self, endpoint, source, status, results, est, reported, run_id, key) -> None:
        if self.store is None:
            return
        try:
            self.store.log_call(endpoint, source, status, results, est, reported, run_id, key)
        except Exception as exc:  # logging must never break a run
            log.warning("credit log write failed: %s", exc)

    # -- typed helpers

    async def person_search(self, body: dict, **kw) -> CallResult:
        return await self.post("/person/search", body, **kw)

    async def person_enrich(self, linkedin_url: str, fields: list[str] | None = None, **kw) -> CallResult:
        body: dict[str, Any] = {"professional_network_profile_urls": [linkedin_url]}
        body["fields"] = fields or ["basic_profile", "experience", "education", "skills"]
        return await self.post("/person/enrich", body, **kw)

    async def person_autocomplete(self, field: str, query: str, limit: int = 10, **kw) -> CallResult:
        return await self.post("/person/search/autocomplete", {"field": field, "query": query, "limit": limit}, **kw)

    async def company_autocomplete(self, field: str, query: str, limit: int = 10, **kw) -> CallResult:
        return await self.post("/company/search/autocomplete", {"field": field, "query": query, "limit": limit}, **kw)

    async def company_identify(self, names: list[str] | None = None, domains: list[str] | None = None, **kw) -> CallResult:
        body = {"names": names} if names else {"domains": domains or []}
        return await self.post("/company/identify", body, **kw)

    async def company_enrich(self, company_ids: list[int], fields: list[str] | None = None, **kw) -> CallResult:
        return await self.post(
            "/company/enrich", {"crustdata_company_ids": company_ids, "fields": fields or ["basic_info", "headcount"]}, **kw
        )

    async def job_search(self, body: dict, **kw) -> CallResult:
        return await self.post("/job/search", body, **kw)

    async def web_search(self, query: str, location: str | None = None, **kw) -> CallResult:
        body: dict[str, Any] = {"query": query, "sources": ["web"]}
        if location:
            body["location"] = location
        return await self.post("/web/search/live", body, **kw)
