"""FastAPI app implementing docs/CONTRACT.md. Run: uv run uvicorn afterdegree.api:app --port 8000"""

from __future__ import annotations

import json
import logging
import secrets
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Settings, get_settings
from .crustdata import CrustdataClient, CrustdataError, MissingKeyError, NotFoundError, RunBudget
from .db import Store, utcnow_iso
from .jobs import JobRunner
from .llm import LLM
from .onboarding import Onboarding, home_next_steps
from .profile import extract_person_data, normalise_linkedin_url, normalise_profile
from .people import PERSON_ID_RE
from .schemas import (
    DrillRequest,
    Evidence,
    Goals,
    Health,
    Job,
    JobCreated,
    OnboardingChatRequest,
    OnboardingChatResponse,
    OnboardingCompleteRequest,
    OnboardingCompleteResponse,
    OnboardingProfileRequest,
    OnboardingProfileResponse,
    PersonDetail,
    StoredProfile,
    Usage,
    UsageEndpoint,
)
from .toolkit import MOCK_TODAY
from .tools import TOOLS

log = logging.getLogger("afterdegree.api")


class APIError(Exception):
    def __init__(self, status: int, code: str, message: str, hint: str | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.hint = hint


def error_response(status: int, code: str, message: str, hint: str | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, "hint": hint}})


def _upstream_status(exc: CrustdataError) -> int:
    if isinstance(exc, NotFoundError):
        return 404
    return exc.http_status if exc.http_status in (404, 429) else 424


def create_app(
    settings: Settings | None = None,
    crustdata_transport: httpx.AsyncBaseTransport | None = None,
    llm_transport: httpx.AsyncBaseTransport | None = None,
    store: Store | None = None,
) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        st = app.state
        st.started_at = utcnow_iso()
        st.store = store or Store(settings.db_path)
        interrupted = st.store.fail_interrupted_jobs()
        st.store.purge_expired_people()
        st.store.purge_old_drill_jobs(min(settings.person_data_ttl_days, 7.0) * 86400)
        if interrupted:
            log.info("marked %d interrupted jobs as failed", interrupted)
        transport = crustdata_transport
        if transport is None and settings.mock:
            from .mock import get_fake

            transport = get_fake().transport()
        st.client = CrustdataClient(settings, st.store, transport=transport)
        st.llm = LLM(settings, transport=llm_transport)
        st.onboarding = Onboarding(st.llm)
        st.runner = JobRunner(st.store, st.client, settings, st.llm)
        if settings.mock:
            log.warning("AfterDegree engine running in MOCK mode: all data is fictional example data")
        yield
        await st.runner.shutdown()
        await st.client.aclose()

    app = FastAPI(title="AfterDegree engine", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------------------------------------------------------------ errors

    @app.exception_handler(APIError)
    async def _api_error(_: Request, exc: APIError):
        return error_response(exc.status, exc.code, exc.message, exc.hint)

    @app.exception_handler(CrustdataError)
    async def _upstream_error(_: Request, exc: CrustdataError):
        return error_response(_upstream_status(exc), exc.code, exc.message, exc.hint)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        problems = []
        for err in exc.errors()[:3]:
            loc = ".".join(str(x) for x in err.get("loc", []) if x != "body")
            problems.append(f"{loc}: {err.get('msg')}" if loc else str(err.get("msg")))
        return error_response(
            400,
            "bad_input",
            "Some of what was sent doesn't look quite right, so I couldn't start.",
            "; ".join(problems) or None,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        if exc.status_code == 404:
            return error_response(404, "not_found", "I couldn't find that.", "Check the address of the request.")
        if exc.status_code == 405:
            return error_response(405, "method_not_allowed", "That kind of request isn't supported here.", None)
        return error_response(exc.status_code, "http_error", str(exc.detail), None)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        log.exception("unhandled error", exc_info=exc)
        return error_response(500, "internal", "Something went wrong on my side.", "Please try again in a moment.")

    # ------------------------------------------------------------ helpers

    def _store(request: Request) -> Store:
        return request.app.state.store

    def load_profile(request: Request, profile_id: str) -> dict:
        prof = _store(request).get_profile(profile_id)
        if prof is None:
            raise APIError(404, "profile_not_found", "I couldn't find that profile.", "Start again by sharing your LinkedIn profile link.")
        return prof

    def evidence_for(request: Request, ids: list[str]) -> list[Evidence]:
        out = []
        for i in ids:
            body = _store(request).get_evidence(i)
            if body:
                out.append(Evidence.model_validate(body))
        return out

    # ------------------------------------------------------------ onboarding

    @app.post("/api/onboarding/profile", response_model=OnboardingProfileResponse)
    async def onboarding_profile(body: OnboardingProfileRequest, request: Request):
        url = normalise_linkedin_url(body.linkedin_url)
        if url is None:
            raise APIError(400, "invalid_url", "That doesn't look like a LinkedIn profile link.",
                           "It should look like https://www.linkedin.com/in/your-name")
        client: CrustdataClient = request.app.state.client
        budget = RunBudget(max_live_calls=3, max_credits=5)
        try:
            call = await client.person_enrich(url, budget=budget, run_id="onboarding")
        except MissingKeyError as exc:
            raise APIError(424, exc.code, exc.message, exc.hint) from exc
        person_data = extract_person_data(call.data)
        if person_data is None:
            raise APIError(404, "profile_not_found", "I couldn't find that profile in the data yet.",
                           "Check the link is your public LinkedIn profile URL, or try again in a few days.")
        today = MOCK_TODAY if settings.mock else datetime.now(UTC).date()
        person, derived = normalise_profile(person_data, today)
        profile_id = "p_" + secrets.token_hex(6)
        ev = Evidence(
            id="ev_" + secrets.token_hex(6),
            endpoint="/person/enrich",
            filters={"professional_network_profile_urls": [url], "fields": call.body.get("fields")},
            total_count=1,
            results_used=1,
            fetched_at=call.fetched_at,
            source="cache" if (call.source == "cache" or call.mock) else "live",
            note="Your own profile" + (" · Example data (mock mode)" if settings.mock else ""),
        )
        st = _store(request)
        st.save_evidence(ev.model_dump())
        st.save_profile(profile_id, url, person.model_dump(), derived.model_dump(), None, [ev.id])
        return OnboardingProfileResponse(profile_id=profile_id, person=person, derived=derived, evidence=[ev])

    @app.post("/api/onboarding/chat", response_model=OnboardingChatResponse)
    async def onboarding_chat(body: OnboardingChatRequest, request: Request):
        prof = load_profile(request, body.profile_id)
        resp = await request.app.state.onboarding.turn(prof, [m.model_dump() for m in body.messages])
        _store(request).update_goals(body.profile_id, resp.goals.model_dump())
        return resp

    @app.post("/api/onboarding/complete", response_model=OnboardingCompleteResponse)
    async def onboarding_complete(body: OnboardingCompleteRequest, request: Request):
        prof = load_profile(request, body.profile_id)
        goals = body.goals
        stored = Goals.model_validate(prof.get("goals") or {})
        merged = stored.model_copy(update={k: v for k, v in goals.model_dump().items() if v not in (None, [], "")})
        if merged.persona is None:
            merged.persona = (prof.get("derived") or {}).get("persona_guess") or "student_abroad"
        _store(request).update_goals(body.profile_id, merged.model_dump(), completed=True)
        prof["goals"] = merged.model_dump()
        return OnboardingCompleteResponse(profile_id=body.profile_id, home={"next_steps": home_next_steps(prof, merged)})

    @app.get("/api/profiles/{profile_id}", response_model=StoredProfile)
    async def get_profile(profile_id: str, request: Request):
        prof = load_profile(request, profile_id)
        return StoredProfile(
            profile_id=prof["profile_id"],
            linkedin_url=prof["linkedin_url"],
            person=prof["person"],
            derived=prof["derived"],
            goals=Goals.model_validate(prof["goals"]) if prof.get("goals") else None,
            completed=prof["completed"],
            created_at=prof["created_at"],
            evidence=evidence_for(request, prof.get("evidence_ids") or []),
        )

    # ------------------------------------------------------------ tools

    def register_tool(tool: str, run_fn, body_model, slug: str) -> None:
        async def endpoint(body: body_model, request: Request) -> JobCreated:  # type: ignore[valid-type]
            prof = load_profile(request, body.profile_id)
            params = body.model_dump(exclude={"profile_id"}, exclude_none=True)
            job_id = request.app.state.runner.start(tool, run_fn, prof, params)
            return JobCreated(job_id=job_id)

        endpoint.__annotations__ = {"body": body_model, "request": Request, "return": JobCreated}
        endpoint.__name__ = f"tool_{tool}"
        app.post(f"/api/tools/{slug}", response_model=JobCreated, name=tool)(endpoint)

    for tool_name, (run_fn, body_model, slug) in TOOLS.items():
        register_tool(tool_name, run_fn, body_model, slug)

    # ------------------------------------------------------------ drill-down (CONTRACT Appendix C + D)

    @app.post("/api/drill", response_model=JobCreated)
    async def drill(body: DrillRequest, request: Request):
        prof = load_profile(request, body.profile_id)
        job_id = request.app.state.runner.start_drill(prof, body.drill)
        return JobCreated(job_id=job_id)

    @app.get("/api/people/{person_id}", response_model=PersonDetail)
    async def person_detail(person_id: str, request: Request, profile_id: str = ""):
        if not profile_id:
            raise APIError(400, "bad_input", "I need to know whose drill-down this career path came from.", "Add ?profile_id=… to the request.")
        load_profile(request, profile_id)
        body = _store(request).get_drill_person(person_id, profile_id) if PERSON_ID_RE.match(person_id) else None
        if body is None:
            raise APIError(404, "person_not_found", "This career path is no longer available.",
                           "Paths are kept for 7 days and only for the profile that opened them. Open the group again to see current paths.")
        return JSONResponse(content=PersonDetail.model_validate(body).model_dump(mode="json"))

    # ------------------------------------------------------------ jobs & evidence

    @app.get("/api/jobs/{job_id}", response_model=Job, response_model_by_alias=True)
    async def get_job(job_id: str, request: Request):
        job = request.app.state.runner.get(job_id)
        if job is None:
            raise APIError(404, "job_not_found", "I couldn't find that run.", "It may have been started on another server; start it again.")
        return JSONResponse(content=Job.model_validate(job).model_dump(mode="json", by_alias=True))

    @app.get("/api/jobs/{job_id}/events")
    async def job_events(job_id: str, request: Request):
        if request.app.state.runner.get(job_id) is None:
            raise APIError(404, "job_not_found", "I couldn't find that run.", None)
        return StreamingResponse(
            request.app.state.runner.events(job_id),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @app.get("/api/evidence/{evidence_id}", response_model=Evidence)
    async def get_evidence(evidence_id: str, request: Request):
        body = _store(request).get_evidence(evidence_id)
        if body is None:
            raise APIError(404, "evidence_not_found", "I couldn't find that piece of evidence.", None)
        return Evidence.model_validate(body)

    # ------------------------------------------------------------ health & usage

    @app.get("/api/health", response_model=Health)
    async def health(request: Request):
        client: CrustdataClient = request.app.state.client
        llm: LLM = request.app.state.llm
        if settings.mock:
            cd = "ok"
        elif not settings.crustdata_api_key:
            cd = "missing_key"
        else:
            cd = "error" if client.last_auth_error else "ok"
        if not settings.openrouter_api_key:
            lm = "missing_key"
        else:
            lm = "error" if llm.last_error else "ok"
        return Health(crustdata=cd, llm=lm, mock=settings.mock)

    @app.get("/api/usage", response_model=Usage)
    async def usage(request: Request):
        rows = _store(request).usage_since(request.app.state.started_at)
        by: dict[str, dict[str, Any]] = {}
        for r in rows:
            e = by.setdefault(r["endpoint"], {"endpoint": r["endpoint"], "live_calls": 0, "cached_calls": 0, "results": 0,
                                              "estimated_credits": 0.0, "reported": None})
            if r["source"] == "live":
                e["live_calls"] += r["calls"]
                e["estimated_credits"] += r["est"] or 0.0
                if r["rep"] is not None:
                    e["reported"] = (e["reported"] or 0.0) + r["rep"]
            else:  # cache and mock calls cost nothing
                e["cached_calls"] += r["calls"]
            e["results"] += r["results"] or 0
        eps = [UsageEndpoint(**{k: (round(v, 3) if k == "estimated_credits" else v) for k, v in e.items() if k != "reported"}) for e in by.values()]
        reported = [e["reported"] for e in by.values() if e["reported"] is not None]
        return Usage(
            session_started_at=request.app.state.started_at,
            live_calls=sum(e.live_calls for e in eps),
            cached_calls=sum(e.cached_calls for e in eps),
            estimated_credits=round(sum(e.estimated_credits for e in eps), 3),
            reported_credits=round(sum(reported), 3) if reported else None,
            by_endpoint=sorted(eps, key=lambda e: e.endpoint),
        )

    return app


def _make_default_app() -> FastAPI:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    return create_app()


app = _make_default_app()

__all__ = ["app", "create_app", "json"]
