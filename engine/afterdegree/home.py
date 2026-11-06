"""Home ("Your plan") data.

GET /api/profiles/{profile_id}/runs      The user's latest finished run of each tool, with one headline each.
                                         Reads the jobs table only: no data calls, zero credits.
GET /api/profiles/{profile_id}/snapshot  Three fresh count-only numbers for the user's goal (people like you in
                                         the target country, new postings, Indian-educated people in the role).
                                         Count-only searches through the shared client, so they reuse the disk
                                         cache of the tools' own identical queries; capped at 3 credits and
                                         memoised per profile + goals for a few hours.

Kept in its own module (registered from api.py with one call) so tool work elsewhere never collides with it.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Callable
from datetime import date, timedelta
from typing import Any, Literal

from fastapi import FastAPI, Request
from pydantic import BaseModel

from . import filters as F
from . import taxonomy as tx
from .cohort import build_cohort
from .crustdata import CrustdataError, RunBudget
from .db import Store, utcnow_iso
from .toolkit import ToolContext, ToolInputError, iso

log = logging.getLogger("afterdegree.home")

MIN_GROUP = 5  # never name or count a group smaller than this
SNAPSHOT_MAX_CREDITS = 3.0
SNAPSHOT_MAX_CALLS = 24
SNAPSHOT_TTL_S = 6 * 3600
HOME_COUNTRY = "India"
UNI_DESTINATIONS = ["United States", "United Kingdom", "Germany", "Canada", "Australia", "Ireland", "Netherlands", "Singapore"]


# ------------------------------------------------------------------ response models


class Headline(BaseModel):
    """One number (or name) that sums up a finished run. Read as: [lead] display label."""

    display: str
    label: str
    value: float | None = None
    lead: str | None = None
    detail: str | None = None
    level: Literal["low", "medium", "high"] | None = None


class RunSummary(BaseModel):
    tool: str
    job_id: str
    params: dict[str, Any]
    finished_at: str
    title: str
    question: str
    confidence: str | None = None
    headline: Headline | None = None


class RunsResponse(BaseModel):
    profile_id: str
    runs: list[RunSummary]  # latest finished run per tool, newest first
    recent: list[RunSummary]  # newest finished runs with distinct questions


SnapshotStatus = Literal["ok", "too_few", "needs_role", "needs_country", "needs_institution", "unavailable"]


class SnapshotTile(BaseModel):
    key: str
    status: SnapshotStatus
    label: str
    value: int | None = None
    display: str | None = None
    lead: str | None = None
    detail: str | None = None
    n: int | None = None
    tool: str
    params: dict[str, Any] = {}
    evidence_ids: list[str] = []


class SnapshotGoal(BaseModel):
    role: str | None = None
    city: str | None = None
    country: str | None = None
    place: str | None = None
    institution: str | None = None


class SnapshotResponse(BaseModel):
    profile_id: str
    persona: Literal["student", "university"]
    goal: SnapshotGoal
    tiles: list[SnapshotTile]
    data_date: str
    generated_at: str
    cached: bool
    credits_used: float


# ------------------------------------------------------------------ runs (DB only)


def _fmt(n: float | int) -> str:
    return f"{int(round(n)):,}"


def _rows(table: dict | None) -> list[dict]:
    return [r for r in ((table or {}).get("rows") or []) if not r.get("rest")]


def _section(result: dict, id_: str, kind: str | None = None) -> dict | None:
    for s in result.get("sections") or []:
        if s.get("id") == id_ and (kind is None or s.get("kind") == kind):
            return s.get("data") or {}
    return None


def _count_headline(count: dict, label: str, detail: str | None = None) -> Headline | None:
    k, n = count.get("k"), count.get("n")
    if k is None or n is None:
        return None
    lead = "At least" if str(count.get("display", "")).lower().startswith("at least") else None
    return Headline(display=_fmt(k), value=float(k), lead=lead, label=f"of {_fmt(n)} {label}".strip(), detail=detail)


def _stat_headline(data: dict) -> Headline | None:
    label = str(data.get("label") or "").strip()
    if data.get("count"):
        return _count_headline(data["count"], label, data.get("note"))
    value = data.get("value")
    display = data.get("display") or (_fmt(value) if isinstance(value, (int, float)) else None)
    if not display:
        return None
    return Headline(display=str(display), value=float(value) if isinstance(value, (int, float)) else None, label=label,
                    level=data.get("level"), detail=data.get("note"))


def _first_sentence(text: str | None) -> str | None:
    if not text:
        return None
    s = text.strip().split(". ")[0].rstrip(".")
    return s[:200] if s else None


def _people_like_me(result: dict, params: dict) -> Headline | None:
    university = bool(params.get("institution"))
    who = "your graduates" if university else "people like you"
    countries = _section(result, "countries", "distribution")
    # Exact per-country totals only (a sampled breakdown carries sample_n and is never used for a headline).
    if countries and not countries.get("sample_n"):
        target = next((i for i in countries.get("items") or [] if i.get("target") and not i.get("remainder")), None)
        if target and int(target.get("count") or 0) >= MIN_GROUP:
            return Headline(display=_fmt(target["count"]), value=float(target["count"]), lead="At least",
                            label=f"of {_fmt(countries.get('n') or 0)} {who} now live in {target['label']}")
    moved = _section(result, "moved_abroad", "stat")
    if moved and moved.get("count"):
        return _count_headline(moved["count"], f"{who} now live outside India")
    size = _section(result, "cohort_size", "stat")
    return _stat_headline(size) if size else None


def _internship_chances(result: dict, params: dict) -> Headline | None:
    chance = _section(result, "chance", "stat")
    return _stat_headline(chance) if chance else None


def _conversion_map(result: dict, params: dict) -> Headline | None:
    table = _section(result, "companies", "ranked_table")
    for row in _rows(table):
        cnt = row.get("count") or (row.get("cells") or {}).get("rate")
        name = (row.get("cells") or {}).get("company")
        if name and isinstance(cnt, dict) and cnt.get("share") is not None:
            return Headline(display=str(name), label="converts interns to full-time jobs most often", detail=f"{cnt.get('display')} interns stayed on")
    rest = next((r for r in (table or {}).get("rows") or [] if r.get("rest")), None)
    if rest and isinstance(rest.get("count"), dict):
        return _count_headline(rest["count"], "interns went full-time at the same company")
    return None


def _reverse_gps(result: dict, params: dict) -> Headline | None:
    routes = (_section(result, "routes", "route_list") or {}).get("routes") or []
    if routes:
        top = routes[0]
        title = top.get("title") or " → ".join(s.get("label", "") for s in top.get("steps") or [])
        people = top.get("people")
        if isinstance(people, dict):
            return _count_headline(people, f"took the top route: {title}")
        if isinstance(people, (int, float)) and people >= MIN_GROUP:
            return Headline(display=_fmt(people), value=float(people), label=f"people took the top route: {title}")
    return None


def _routes_to_position(result: dict, params: dict) -> Headline | None:
    titles = _section(result, "titles", "ranked_table")
    for row in _rows(titles):
        cnt = row.get("count")
        title = (row.get("cells") or {}).get("title")
        if title and isinstance(cnt, dict) and int(cnt.get("k") or 0) >= MIN_GROUP:
            return _count_headline(cnt, f"came in with the title {title}")
    cohort = result.get("cohort") or {}
    if cohort.get("n_visible"):
        return Headline(display=_fmt(cohort["n_visible"]), value=float(cohort["n_visible"]), label="people hold this position today")
    return None


def _indian_friendly(result: dict, params: dict) -> Headline | None:
    table = _section(result, "employers", "ranked_table")
    place = params.get("city") or params.get("country") or "this country"
    for row in _rows(table):
        cells = row.get("cells") or {}
        name, hires = cells.get("employer"), cells.get("hires")
        if name and isinstance(hires, (int, float)) and hires >= MIN_GROUP:
            return Headline(display=str(name), label=f"employs the most Indian-educated people in {place}",
                            detail=f"{_fmt(hires)} Indian-educated people work there now")
    return None


def _market_saturation(result: dict, params: dict) -> Headline | None:
    ratio = _section(result, "ratio", "stat")
    if ratio and ratio.get("level"):
        level = ratio["level"]
        return Headline(display=level.capitalize(), label="competition from people like you", level=level,
                        detail=ratio.get("note"))
    return _stat_headline(ratio) if ratio else None


HEADLINES: dict[str, Callable[[dict, dict], Headline | None]] = {
    "people_like_me": _people_like_me,
    "internship_chances": _internship_chances,
    "conversion_map": _conversion_map,
    "reverse_gps": _reverse_gps,
    "routes_to_position": _routes_to_position,
    "indian_friendly": _indian_friendly,
    "market_saturation": _market_saturation,
}

MATCH_TEXT = {"exact_school": "same college and field", "school_tier": "similar colleges, same field", "field_only": "same field, any college"}


def headline_for(tool: str, result: dict, params: dict | None = None) -> Headline | None:
    """The run's one number: tool-specific when we know the result, else its first stat, else its summary."""
    params = params or {}
    try:
        fn = HEADLINES.get(tool)
        h = fn(result, params) if fn else None
        if h is None:
            for s in result.get("sections") or []:
                if s.get("kind") == "stat":
                    h = _stat_headline(s.get("data") or {})
                    if h:
                        break
        if h is None:
            sentence = _first_sentence(result.get("summary"))
            if sentence:
                h = Headline(display="", label=sentence)
        return h
    except Exception as exc:  # a headline is a nicety: never fail the list over one odd result
        log.info("headline for %s failed: %s", tool, exc)
        return None


def question_for(tool: str, title: str, params: dict) -> str:
    if tool == "people_like_me":
        bits = [MATCH_TEXT.get(str(params.get("match") or "exact_school"), "")]
        band = params.get("exp_band")
        if isinstance(band, list) and band:
            bits.append(f"{band[0]:g}–{band[-1]:g} years of work")
        return f"{title} ({', '.join(b for b in bits if b)})" if any(bits) else title
    if tool == "internship_chances" and params.get("company") and str(params["company"]).lower() not in title.lower():
        return f"{title}, at {params['company']}"
    return title


def list_runs(store: Store, profile_id: str, recent_limit: int = 6, scan: int = 300) -> RunsResponse:
    rows = store._exec(  # noqa: SLF001 - read-only query on the shared connection
        "SELECT job_id, tool, params, updated_at FROM jobs WHERE profile_id = ? AND status = 'done' AND tool != 'drill'"
        " ORDER BY updated_at DESC, rowid DESC LIMIT ?",
        (profile_id, scan),
    ).fetchall()
    latest: dict[str, dict] = {}
    recent: list[dict] = []
    seen_q: set[str] = set()
    for r in rows:
        params = json.loads(r["params"] or "{}")
        item = {"tool": r["tool"], "job_id": r["job_id"], "params": params, "finished_at": r["updated_at"]}
        if r["tool"] not in latest:
            latest[r["tool"]] = item
        sig = r["tool"] + json.dumps(params, sort_keys=True)
        if sig not in seen_q and len(recent) < recent_limit:
            seen_q.add(sig)
            recent.append(item)

    built: dict[str, RunSummary] = {}

    def summary(item: dict) -> RunSummary | None:
        if item["job_id"] in built:
            return built[item["job_id"]]
        row = store._exec("SELECT result FROM jobs WHERE job_id = ?", (item["job_id"],)).fetchone()  # noqa: SLF001
        try:
            result = json.loads(row["result"]) if row and row["result"] else None
        except ValueError:
            result = None
        if not result:
            return None
        title = str(result.get("title") or item["tool"].replace("_", " ").capitalize())
        out = RunSummary(**item, title=title, question=question_for(item["tool"], title, item["params"]),
                         confidence=result.get("confidence"), headline=headline_for(item["tool"], result, item["params"]))
        built[item["job_id"]] = out
        return out

    runs = [s for s in (summary(i) for i in sorted(latest.values(), key=lambda i: i["finished_at"], reverse=True)) if s]
    rec = [s for s in (summary(i) for i in recent) if s]
    return RunsResponse(profile_id=profile_id, runs=runs, recent=rec)


# ------------------------------------------------------------------ snapshot (count-only, cached)


def _goal(profile: dict) -> SnapshotGoal:
    from .tools.common import place_text, resolve_place  # shared helpers; imported lazily to keep start-up light

    g = profile.get("goals") or {}
    role = ((g.get("target_roles") or [None])[0] or "").strip() or None
    city_in = (g.get("target_cities") or [None])[0]
    country_in = (g.get("target_countries") or [None])[0]
    city, country = resolve_place(city_in, country_in)
    return SnapshotGoal(role=role, city=city, country=country, place=place_text(city, country) if (city or country) else None,
                        institution=(g.get("institution") or None))


def _job_base(role: str, city: str | None, country: str) -> dict:
    """The exact filter tree job_postings builds, so the count reuses its cached answer."""
    from .tools.common import job_title_or

    return F.and_(job_title_or(role), F.job_country(country), F.job_city(city) if city else None) or {}


async def _student_tiles(ctx: ToolContext, goal: SnapshotGoal) -> list[SnapshotTile]:
    from .tools.common import title_or

    tiles: list[SnapshotTile] = []
    role, city, country = goal.role, goal.city, goal.country
    role_label = tx.display_role(role) if role else None

    # (a) People like you now in the target country: exact count of the People Like Me cohort.
    a = SnapshotTile(key="cohort_in_country", status="needs_country", label="people like you now live in your target country",
                     tool="people_like_me", params={"match": "exact_school"})
    if country:
        a.label = f"people like you now live in {country}"
        try:
            cohort = await build_cohort(ctx, "exact_school")
            k, ev = await ctx.count_people(cohort.filters(F.person_country(country)), f"People like you now in {country}")
            a.n = cohort.n
            a.detail = f"of {cohort.n:,}: {cohort.plan.definition}"
            a.evidence_ids = [e for e in (cohort.evidence_id, ev) if e]
            a.params = {"match": cohort.plan.level}
            if 0 < k < MIN_GROUP:
                a.status, a.display = "too_few", "Fewer than 5"
            else:
                a.status, a.value, a.display, a.lead = "ok", k, f"{k:,}", "At least"
        except (ToolInputError, CrustdataError) as exc:
            a.status, a.detail = "unavailable", exc.message
    tiles.append(a)

    # (b) Postings for the target role in the target place, added in the last 30 days (job counts cost nothing).
    b = SnapshotTile(key="postings_30d", status="needs_role", label="new postings for your role in the last 30 days", tool="job_postings")
    if role and country:
        b.label = f"new {role_label} postings in {goal.place} in the last 30 days"
        b.params = {k: v for k, v in {"role": role, "city": city, "country": country}.items() if v}
        try:
            d30 = iso(ctx.today - timedelta(days=30))
            n, _, ev = await ctx.count_jobs(F.and_(_job_base(role, city, country), *F.job_date_range(d30)) or {},
                                            "Postings added in the last 30 days")
            b.status, b.value, b.display, b.evidence_ids = "ok", n, f"{n:,}", [ev]
        except (ToolInputError, CrustdataError) as exc:
            b.status, b.detail = "unavailable", exc.message
    elif role:
        b.status = "needs_country"
    tiles.append(b)

    # (c) Indian-educated people in the role and place today: the supply you'd compete with (reverse_gps's count).
    c = SnapshotTile(key="indian_in_role", status="needs_role", label="Indian-educated people already do your target role there",
                     tool="market_saturation")
    if role and (city or country):
        c.label = f"Indian-educated people work as {role_label} in {goal.place} today"
        c.params = {k: v for k, v in {"role": role, "city": city, "country": country}.items() if v}
        try:
            target = F.and_(title_or(F.CUR, role), F.person_city(city) if city else F.person_country(country or ""))
            k, ev = await ctx.count_people(F.and_(target, F.india_educated()) or {}, "People in the goal position who studied in India")
            c.evidence_ids = [ev]
            if 0 < k < MIN_GROUP:
                c.status, c.display = "too_few", "Fewer than 5"
            else:
                c.status, c.value, c.display = "ok", k, f"{k:,}"
        except (ToolInputError, CrustdataError) as exc:
            c.status, c.detail = "unavailable", exc.message
    elif role:
        c.status = "needs_country"
    tiles.append(c)
    return tiles


async def _university_tiles(ctx: ToolContext, goal: SnapshotGoal) -> list[SnapshotTile]:
    abroad = SnapshotTile(key="graduates_abroad", status="needs_institution", label="of your graduates now live outside India",
                          tool="people_like_me")
    top = SnapshotTile(key="top_destination", status="needs_institution", label="is where most of your graduates abroad live",
                       tool="people_like_me")
    if not goal.institution:
        return [abroad, top]
    programs = (ctx.goals.get("programs") or [])
    params = {"institution": goal.institution, "programs": programs} if programs else {"institution": goal.institution}
    abroad.params = top.params = params
    try:
        cohort = await build_cohort(ctx, "exact_school")
        n_loc, ev_loc = await ctx.count_people(cohort.filters(F.person_has_country()), "Graduates with a known location")
        k_abroad, ev_ab = await ctx.count_people(cohort.filters(F.person_has_country(), F.person_not_country(HOME_COUNTRY)),
                                                 "Graduates now located outside India")
        abroad.n = n_loc
        abroad.evidence_ids = [e for e in (cohort.evidence_id, ev_loc, ev_ab) if e]
        abroad.detail = cohort.plan.definition
        if 0 < k_abroad < MIN_GROUP:
            abroad.status, abroad.display = "too_few", "Fewer than 5"
        else:
            abroad.status, abroad.value, abroad.display, abroad.lead = "ok", k_abroad, f"{k_abroad:,}", "At least"
            abroad.label = f"of {n_loc:,} of your graduates now live outside India"
        found = await ctx.count_many([(c, cohort.filters(F.person_country(c)), f"Graduates now in {c}") for c in UNI_DESTINATIONS])
        best = max(((c, k) for c, (k, _) in found.items() if k), key=lambda x: x[1], default=None)
        top.evidence_ids = [ev for _, (_, ev) in found.items() if ev]
        if best and best[1] >= MIN_GROUP:
            top.status, top.display, top.value = "ok", best[0], None
            top.detail = f"at least {best[1]:,} of your graduates live there now (of the {len(UNI_DESTINATIONS)} usual destinations we count)"
        else:
            top.status, top.display = "too_few", "Too few to say"
    except (ToolInputError, CrustdataError) as exc:
        for t in (abroad, top):
            if t.status == "needs_institution":
                t.status, t.detail = "unavailable", exc.message
    return [abroad, top]


class SnapshotCache:
    """Per profile + goals + day; a lock per profile so two tabs never double-count."""

    def __init__(self) -> None:
        self._data: dict[str, tuple[float, SnapshotResponse]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    def key(self, profile: dict, today: date) -> str:
        return json.dumps([profile.get("profile_id"), profile.get("goals"), today.isoformat()], sort_keys=True, default=str)

    def get(self, key: str) -> SnapshotResponse | None:
        hit = self._data.get(key)
        if hit and time.time() - hit[0] < SNAPSHOT_TTL_S:
            return hit[1]
        return None

    def put(self, key: str, value: SnapshotResponse) -> None:
        if len(self._data) > 500:
            self._data.clear()
        self._data[key] = (time.time(), value)

    def lock(self, profile_id: str) -> asyncio.Lock:
        return self._locks.setdefault(profile_id, asyncio.Lock())


async def build_snapshot(app_state: Any, profile: dict, refresh: bool = False) -> SnapshotResponse:
    settings = app_state.settings if hasattr(app_state, "settings") else None
    cache: SnapshotCache = app_state.home_snapshots
    pid = profile["profile_id"]
    ctx = ToolContext(client=app_state.client, settings=settings, store=app_state.store, profile=profile, params={},
                      run_id=f"home_{pid}", llm=None, mock=bool(settings and settings.mock))
    ctx.budget = RunBudget(max_live_calls=SNAPSHOT_MAX_CALLS, max_credits=SNAPSHOT_MAX_CREDITS)
    key = cache.key(profile, ctx.today)
    async with cache.lock(pid):
        if not refresh:
            hit = cache.get(key)
            if hit is not None:
                return hit.model_copy(update={"cached": True})
        goal = _goal(profile)
        university = ctx.is_university
        tiles = await (_university_tiles(ctx, goal) if university else _student_tiles(ctx, goal))
        out = SnapshotResponse(
            profile_id=pid,
            persona="university" if university else "student",
            goal=goal,
            tiles=tiles,
            data_date=ctx.data_date(),
            generated_at=utcnow_iso(),
            cached=False,
            credits_used=round(ctx.budget.credits, 3),
        )
        if not any(t.status == "unavailable" for t in tiles):
            cache.put(key, out)
        return out


# ------------------------------------------------------------------ routes


def register_home_routes(app: FastAPI, load_profile: Callable[[Request, str], dict]) -> None:
    app.state.home_snapshots = SnapshotCache()

    @app.get("/api/profiles/{profile_id}/runs", response_model=RunsResponse)
    async def profile_runs(profile_id: str, request: Request, limit: int = 6):
        load_profile(request, profile_id)
        return list_runs(request.app.state.store, profile_id, recent_limit=max(1, min(limit, 20)))

    @app.get("/api/profiles/{profile_id}/snapshot", response_model=SnapshotResponse)
    async def profile_snapshot(profile_id: str, request: Request, refresh: bool = False):
        prof = load_profile(request, profile_id)
        return await build_snapshot(request.app.state, prof, refresh=refresh)


__all__ = ["register_home_routes", "headline_for", "list_runs", "build_snapshot", "RunsResponse", "SnapshotResponse"]
