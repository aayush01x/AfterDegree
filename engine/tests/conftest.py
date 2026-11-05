"""Shared fixtures. Crustdata is always mocked with respx; nothing here touches the network or the real cache."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest
import respx

from afterdegree.config import Settings
from afterdegree.crustdata import CrustdataClient, RateLimiter
from afterdegree.db import Store
from afterdegree.mock import FakeCrustdata, riya_person_data
from afterdegree.profile import normalise_profile
from afterdegree.toolkit import MOCK_TODAY, ToolContext

FIXTURES = Path(__file__).parent / "fixtures"
BASE = "https://api.crustdata.com"


def load_fixture(name: str):
    return json.loads((FIXTURES / "docs" / name).read_text())


async def _no_sleep(_: float) -> None:
    return None


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        crustdata_api_key="test-key-not-real",
        openrouter_api_key="",
        cache_dir=tmp_path / "cache",
        db_path=tmp_path / "db.sqlite3",
        mock=False,
        backoff_base_s=0.0,
    )


@pytest.fixture
def store() -> Store:
    s = Store(":memory:")
    yield s
    s.close()


def fast_limiter() -> RateLimiter:
    return RateLimiter({ep: 1_000_000 for ep in ("/person/search", "/person/enrich", "/job/search", "/company/identify",
                                                  "/company/enrich", "/web/search/live", "/person/search/autocomplete",
                                                  "/company/search/autocomplete", "/company/search", "/web/enrich/live")},
                       aggregate_rpm=1_000_000, sleep=_no_sleep)


@pytest.fixture
def client(settings, store) -> CrustdataClient:
    return CrustdataClient(settings, store, limiter=fast_limiter(), sleep=_no_sleep)


@pytest.fixture(scope="session")
def fake() -> FakeCrustdata:
    return FakeCrustdata()


def route_to_fake(router: respx.MockRouter, fake: FakeCrustdata) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        status, payload = fake.handle(request.url.path, json.loads(request.content or b"{}"))
        return httpx.Response(status, json=payload)

    router.post(url__startswith=BASE).mock(side_effect=handler)


@pytest.fixture
def crustdata(fake):
    """respx router answering every Crustdata call from the fake dataset."""
    with respx.mock(assert_all_called=False) as router:
        route_to_fake(router, fake)
        yield router


def riya_profile(goals: dict | None = None) -> dict:
    person, derived = normalise_profile(riya_person_data(), MOCK_TODAY)
    return {"profile_id": "p_test", "person": person.model_dump(), "derived": derived.model_dump(), "goals": goals}


@pytest.fixture
def make_ctx(client, settings, store):
    def _make(params: dict | None = None, profile: dict | None = None, **overrides) -> ToolContext:
        for k, v in overrides.items():
            setattr(settings, k, v)
        ctx = ToolContext(client=client, settings=settings, store=store, profile=profile or riya_profile(),
                          params=params or {}, run_id="run_test", mock=False)
        return ctx

    return _make
