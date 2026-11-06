"""Shared machinery for tools: budget-aware counting and sampling, evidence, sections, privacy."""

from __future__ import annotations

import hashlib
import json
import logging
import math
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from typing import Any

from . import filters as F
from .config import Settings
from .crustdata import BadRequestError, BudgetExceeded, CallResult, CrustdataClient, ForbiddenError, RunBudget, person_search_unit_cost
from .db import Store
from .profile import ParsedPerson, parse_person
from .schemas import (
    SECTION_DATA_MODELS,
    Cohort,
    Count,
    Evidence,
    NextStep,
    Result,
    Section,
)
from .stats import confidence_level

log = logging.getLogger("afterdegree.tools")

MOCK_WARNING = "Example data (mock mode)"
MOCK_TODAY = date(2026, 11, 1)

PERSON_SAMPLE_FIELDS = [
    "basic_profile.location",
    "basic_profile.current_title",
    "experience.employment_details.current",
    "experience.employment_details.past",
    "education.schools",
]
PERSON_SAMPLE_FIELDS_FALLBACK = ["basic_profile", "experience", "education"]
PERSON_SORT = [{"field": "metadata.updated_at", "order": "desc"}, {"field": "crustdata_person_id", "order": "asc"}]
JOB_SAMPLE_FIELDS = [
    "crustdata_job_id",
    "job_details.title",
    "job_details.employment_type",
    "company.basic_info.name",
    "company.basic_info.crustdata_company_id",
    "job_details.url",
    "job_details.source",
    "company.basic_info.primary_domain",
    "location.raw",
    "location.city",
    "location.country",
    "content.description",
    "metadata.date_added",
    "metadata.date_updated",
]
JOB_SORT = [{"field": "metadata.date_added", "order": "desc"}]
PAGE_SIZE = 100

ProgressFn = Callable[[str, int, int], Awaitable[None] | None]


class ToolInputError(Exception):
    """Bad tool parameters; becomes a 400 with a mentor-voice message."""

    def __init__(self, message: str, hint: str | None = None):
        super().__init__(message)
        self.message = message
        self.hint = hint


@dataclass
class Sample:
    people: list[ParsedPerson]
    total: int
    evidence_id: str | None
    requested: int = 0


@dataclass
class ToolContext:
    client: CrustdataClient
    settings: Settings
    store: Store | None
    profile: dict
    params: dict
    run_id: str
    llm: Any = None
    progress_fn: ProgressFn | None = None
    total_steps: int = 6
    mock: bool = False
    budget: RunBudget = field(init=False)
    evidence: list[Evidence] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    sensitive: set[str] = field(default_factory=set)
    _step: int = 0
    budget_hit: bool = False
    # Drill tokens (CONTRACT Appendix C): the origin tool, and the path already taken when building a drill result.
    tool: str = ""
    base_path: list[dict] = field(default_factory=list)
    skills_unavailable: bool = False

    def __post_init__(self) -> None:
        self.budget = RunBudget(self.settings.max_live_calls_per_run, self.settings.max_credits_per_run)

    # ---------------------------------------------------------- basics

    @property
    def today(self) -> date:
        return MOCK_TODAY if self.mock else datetime.now(UTC).date()

    @property
    def derived(self) -> dict:
        return self.profile.get("derived") or {}

    @property
    def person(self) -> dict:
        return self.profile.get("person") or {}

    @property
    def goals(self) -> dict:
        return self.profile.get("goals") or {}

    @property
    def is_university(self) -> bool:
        return (self.goals.get("persona") or self.derived.get("persona_guess")) == "university"

    def user_skills(self) -> set[str]:
        from .taxonomy import normalise_skill

        return {normalise_skill(s) for s in self.person.get("skills") or []}

    async def step(self, label: str) -> None:
        self._step += 1
        if self._step > self.total_steps:
            self.total_steps = self._step
        if self.progress_fn is not None:
            res = self.progress_fn(label, self._step, self.total_steps)
            if hasattr(res, "__await__"):
                await res  # type: ignore[misc]

    def drill(self, dimension: str, value: Any, label: str | None = None, path: list[dict] | None = None) -> dict | None:
        """A drill token for one item: the origin tool, its full params and the path extended by one step."""
        if not self.tool or value is None or str(value).strip() == "":
            return None
        base = self.base_path if path is None else path
        return {"tool": self.tool, "params": self.params,
                "path": [*base, {"dimension": dimension, "value": str(value)[:400], "label": (label or str(value))[:200]}]}

    def warn(self, text: str) -> None:
        if text not in self.warnings:
            self.warnings.append(text)

    # ---------------------------------------------------------- evidence

    def add_evidence(
        self,
        call: CallResult | None,
        endpoint: str,
        filters: dict | None,
        total: int | None,
        used: int,
        note: str | None,
        extra: dict | None = None,
    ) -> str:
        key = call.key if call else hashlib.sha256(json.dumps(filters, sort_keys=True).encode()).hexdigest()
        ev_id = "ev_" + hashlib.sha256(f"{self.run_id}:{key}:{len(self.evidence)}".encode()).hexdigest()[:12]
        if self.mock or (call is not None and call.mock):
            source = "mock"
        else:
            source = "cache" if (call is None or call.source == "cache") else "live"
        if self.mock:
            note = f"{note} · {MOCK_WARNING}" if note else MOCK_WARNING
        f = {"filters": filters} if filters is not None else {}
        if extra:
            f.update(extra)
        ev = Evidence(
            id=ev_id,
            endpoint=endpoint,
            filters=f,
            total_count=total,
            results_used=used,
            fetched_at=call.fetched_at if call else _now_iso(),
            source=source,  # type: ignore[arg-type]
            note=note,
        )
        self.evidence.append(ev)
        if self.store is not None:
            try:
                self.store.save_evidence(ev.model_dump())
            except Exception as exc:  # pragma: no cover
                log.warning("evidence save failed: %s", exc)
        return ev_id

    # ---------------------------------------------------------- person search

    async def count_people(self, filters: dict, note: str | None = None) -> tuple[int, str]:
        body = {"filters": filters, "limit": 1, "fields": ["crustdata_person_id"]}
        call = await self.client.person_search(body, budget=self.budget, run_id=self.run_id)
        data = call.data or {}
        total = int(data.get("total_count") or 0)
        for p in data.get("profiles") or []:
            self._remember_sensitive(p)
        ev = self.add_evidence(call, "/person/search", filters, total, 0, note or "Count only (no profiles read)")
        return total, ev

    async def count_people_safe(self, filters: dict, note: str | None = None) -> tuple[int | None, str | None]:
        try:
            return await self.count_people(filters, note)
        except BudgetExceeded:
            self._budget_warning()
            return None, None

    async def count_many(self, items: list[tuple[Any, dict, str]]) -> dict[Any, tuple[int | None, str | None]]:
        """Exact counts for several filter trees (count-only queries, run concurrently; the rate limiter paces them).
        Returns key -> (count or None when the budget stopped it, evidence id)."""
        import asyncio

        found = await asyncio.gather(*(self.count_people_safe(f, note) for _key, f, note in items))
        return {key: res for (key, _f, _n), res in zip(items, found)}

    async def sample_people(
        self,
        filters: dict,
        max_results: int | None = None,
        note: str | None = None,
        fields: list[str] | None = None,
        reserve: float | None = None,
    ) -> Sample:
        """Read up to max_results matching profiles, capped by the per-run credit budget."""
        fields = fields or PERSON_SAMPLE_FIELDS
        cap = min(max_results or self.settings.search_sample_cap, self.settings.search_sample_cap)
        probe_body = {"filters": filters, "fields": fields, "limit": 1}
        unit = person_search_unit_cost(probe_body)
        reserve = self.settings.sample_credit_reserve if reserve is None else reserve
        # Count-only queries that run after a sample must never be starved by it (they carry the exact totals).
        reserve = max(reserve, self.settings.count_credit_reserve)
        affordable = int(math.floor(max(0.0, self.budget.remaining_credits - reserve) / unit)) if unit > 0 else cap
        want = max(0, min(cap, affordable))
        if want <= 0:
            self._budget_warning()
            return Sample([], 0, None, 0)

        people: list[ParsedPerson] = []
        total = 0
        cursor = None
        calls: list[CallResult] = []
        first_call: CallResult | None = None
        try:
            while len(people) < want:
                page = min(PAGE_SIZE, want - len(people))
                body: dict[str, Any] = {"filters": filters, "fields": fields, "limit": page, "sorts": PERSON_SORT}
                if cursor:
                    body["cursor"] = cursor
                try:
                    call = await self.client.person_search(body, budget=self.budget, run_id=self.run_id)
                except BadRequestError as exc:
                    # Some accounts reject sub-path `fields`; fall back to whole sections once.
                    if fields is not PERSON_SAMPLE_FIELDS_FALLBACK and "field" in (exc.detail or "").lower() and not calls:
                        fields = PERSON_SAMPLE_FIELDS_FALLBACK
                        continue
                    raise
                except ForbiddenError:
                    # `skills` in the response is enabled per account; read the profiles without it.
                    if not calls and any(f.startswith("skills") for f in fields):
                        fields = [f for f in fields if not f.startswith("skills")]
                        self.skills_unavailable = True
                        continue
                    raise
                calls.append(call)
                first_call = first_call or call
                data = call.data or {}
                total = int(data.get("total_count") or total)
                profiles = data.get("profiles") or []
                for raw in profiles:
                    self._remember_sensitive(raw)
                    people.append(parse_person(raw))
                cursor = data.get("next_cursor")
                if not cursor or not profiles:
                    break
        except BudgetExceeded:
            self._budget_warning()
        used = len(people)
        if want < cap and used < total and used >= want:
            self.warn(
                f"To stay within this run's data budget I read {used} of the {total:,} matching profiles; "
                "totals and country counts cover every matching profile; panels marked as a sample use the profiles read."
            )
        source_note = note or "Profiles read"
        ev = self.add_evidence(
            first_call,
            "/person/search",
            filters,
            total,
            used,
            f"{source_note}: sampled the first {used} of {total:,} matching profiles (most recently updated first)",
            extra={"pages": len(calls)},
        )
        return Sample(people, total, ev, want)

    # ---------------------------------------------------------- job search

    async def count_jobs(self, filters: dict, note: str | None = None, aggregations: list[dict] | None = None) -> tuple[int, dict, str]:
        body: dict[str, Any] = {"filters": filters, "limit": 0, "aggregations": aggregations or [{"type": "count"}]}
        call = await self.client.job_search(body, budget=self.budget, run_id=self.run_id)
        data = call.data or {}
        total = int(data.get("total_count") or 0)
        aggs = data.get("aggregations") or []
        for a in aggs:
            if a.get("type") == "count" and a.get("value") is not None:
                total = int(a["value"])
        ev = self.add_evidence(call, "/job/search", filters, total, 0, note or "Count only (no postings read)", extra={"aggregations": body["aggregations"]} if aggregations else None)
        return total, data, ev

    async def sample_jobs(self, filters: dict, max_results: int | None = None, note: str | None = None) -> tuple[list[dict], int, str | None]:
        cap = min(max_results or self.settings.job_sample_cap, self.settings.job_sample_cap)
        affordable = int(math.floor(max(0.0, self.budget.remaining_credits - 1.0) / 0.03))
        want = max(0, min(cap, affordable))
        if want <= 0:
            self._budget_warning()
            return [], 0, None
        jobs: list[dict] = []
        total = 0
        cursor = None
        first: CallResult | None = None
        try:
            while len(jobs) < want:
                body: dict[str, Any] = {"filters": filters, "fields": JOB_SAMPLE_FIELDS, "limit": min(PAGE_SIZE, want - len(jobs)), "sorts": JOB_SORT}
                if cursor:
                    body["cursor"] = cursor
                call = await self.client.job_search(body, budget=self.budget, run_id=self.run_id)
                first = first or call
                data = call.data or {}
                total = int(data.get("total_count") or total)
                rows = data.get("job_listings") or []
                jobs.extend(rows)
                cursor = data.get("next_cursor")
                if not cursor or not rows:
                    break
        except BudgetExceeded:
            self._budget_warning()
        ev = self.add_evidence(
            first,
            "/job/search",
            filters,
            total,
            len(jobs),
            f"{note or 'Postings read'}: the {len(jobs)} most recent of {total:,} matching postings",
        )
        return jobs, total, ev

    # ---------------------------------------------------------- lookups

    async def school_variants(self, school: str) -> list[str]:
        """Stored spellings of a school (free autocomplete)."""
        from .taxonomy import short_school

        base = short_school(school) or school
        variants = [school]
        try:
            call = await self.client.person_autocomplete("education.schools.school", base, limit=10, budget=self.budget, run_id=self.run_id)
            norm_base = _norm(base)
            for s in (call.data or {}).get("suggestions") or []:
                v = s.get("value") if isinstance(s, dict) else None
                if not v:
                    continue
                nv = _norm(v)
                if len(nv) >= 5 and (norm_base in nv or nv in norm_base):
                    variants.append(v)
        except BudgetExceeded:
            self._budget_warning()
        except Exception as exc:  # autocomplete is a nicety; never fail on it
            log.info("school autocomplete failed: %s", exc)
        return list(dict.fromkeys(variants))[:12]

    async def identify_company(self, name: str) -> tuple[int | None, str]:
        try:
            call = await self.client.company_identify(names=[name], budget=self.budget, run_id=self.run_id)
        except BudgetExceeded:
            self._budget_warning()
            return None, name
        except Exception as exc:
            log.info("company identify failed: %s", exc)
            return None, name
        for item in call.data or []:
            matches = item.get("matches") or []
            if not matches:
                continue
            best = max(matches, key=lambda m: (m.get("confidence_score") or 0, _headcount_rank(m)))
            cd = best.get("company_data") or {}
            cid = cd.get("crustdata_company_id") or (cd.get("basic_info") or {}).get("crustdata_company_id")
            cname = (cd.get("basic_info") or {}).get("name") or name
            self.add_evidence(call, "/company/identify", {"names": [name]}, len(matches), 1, f"Resolved '{name}' to a company record")
            return (int(cid) if cid else None), cname
        return None, name

    # ---------------------------------------------------------- privacy

    def _remember_sensitive(self, raw: dict) -> None:
        bp = raw.get("basic_profile") or {}
        name = bp.get("name")
        if isinstance(name, str) and len(name.strip()) >= 4:
            self.sensitive.add(name.strip())
        url = ((raw.get("social_handles") or {}).get("professional_network_identifier") or {}).get("profile_url")
        if isinstance(url, str) and url:
            self.sensitive.add(url)

    def _budget_warning(self) -> None:
        self.budget_hit = True
        self.warn(
            "I hit this run's safety limit on data lookups, so some parts are based on less data than usual."
        )

    # ---------------------------------------------------------- result

    def confidence(self, n: int, widened: bool = False, sample_n: int | None = None) -> str:
        level = confidence_level(n, widened, sample_n)
        if self.budget_hit and level == "high":
            level = "medium"
        return level

    def data_date(self) -> str:
        if not self.evidence:
            return self.today.isoformat()
        oldest = min(e.fetched_at for e in self.evidence)
        return oldest[:10]

    async def finish(
        self,
        tool: str,
        title: str,
        sections: list[Section],
        confidence: str,
        coverage_note: str,
        cohort: Cohort | None = None,
        next_steps: list[NextStep] | None = None,
        facts: list[str] | None = None,
        coverage: float | None = None,
    ) -> Result:
        if self.mock:
            self.warnings.insert(0, MOCK_WARNING)
        summary = None
        if facts:
            summary = await self._summary(title, facts)
        result = Result(
            tool=tool,  # type: ignore[arg-type]
            title=title,
            summary=summary,
            cohort=cohort,
            confidence=confidence,  # type: ignore[arg-type]
            coverage_note=coverage_note,
            coverage=round(max(0.0, min(1.0, coverage)), 3) if coverage is not None else None,
            data_date=self.data_date(),
            sections=sections,
            next_steps=next_steps or [],
            warnings=self.warnings,
            evidence=self.evidence,
        )
        return scrub_result(result, self.sensitive)

    async def _summary(self, title: str, facts: list[str]) -> str | None:
        if self.mock:
            return "Example summary (mock mode): " + " ".join(facts[:2])
        if self.llm is None:
            return None
        try:
            return await self.llm.summarize(title, facts)
        except Exception as exc:  # summaries are optional
            log.info("summary failed: %s", exc)
            return None


# ------------------------------------------------------------------ privacy scrub

PROFILE_URL_RE = re.compile(r"https?://([a-z]{2,3}\.)?(www\.)?linkedin\.com/in/[^\s\"']+", re.I)


def scrub_result(result: Result, sensitive: set[str]) -> Result:
    """Remove any other person's name or profile URL that slipped into a result."""
    text = result.model_dump_json()
    original = text
    text = PROFILE_URL_RE.sub("[hidden]", text)
    for s in sorted(sensitive, key=len, reverse=True):
        if " " not in s and not s.startswith("http"):
            continue  # single-token names are too likely to collide with ordinary words
        encoded = json.dumps(s)[1:-1]
        if encoded in text:
            text = text.replace(encoded, "[hidden]")
    if text == original:
        return result
    log.warning("privacy scrub redacted content in a %s result", result.tool)
    return Result.model_validate_json(text)


# ------------------------------------------------------------------ section helpers


def section(id_: str, kind: str, title: str, data: Any, evidence_ids: list[str] | None = None) -> Section:
    """Build a section, validating `data` against the per-kind model (web/src/lib/types.ts)."""
    model = SECTION_DATA_MODELS[kind]
    if isinstance(data, dict):
        data = model.model_validate(data)
    payload = _strip_none(data.model_dump(by_alias=True))
    ev = [e for e in (evidence_ids or []) if e]
    return Section(id=id_, kind=kind, title=title, data=payload, evidence_ids=list(dict.fromkeys(ev)))  # type: ignore[arg-type]


def stat_section(id_: str, title: str, label: str, display: str | None = None, count: Count | None = None,
                 value: float | None = None, unit: str | None = None, level: str | None = None, note: str | None = None,
                 evidence_ids: list[str] | None = None) -> Section:
    if count is not None and evidence_ids is None:
        evidence_ids = list(count.evidence_ids)
    return section(id_, "stat", title, {"label": label, "display": display, "count": count, "value": value, "unit": unit,
                                         "level": level, "note": note}, evidence_ids)


def _strip_none(obj: Any) -> Any:
    """Drop null optional fields, but keep Count objects intact (their share/ci are null by contract when n < 10)."""
    if isinstance(obj, dict):
        if {"k", "n", "display"} <= obj.keys():
            return obj
        return {k: _strip_none(v) for k, v in obj.items() if v is not None}
    if isinstance(obj, list):
        return [_strip_none(v) for v in obj]
    return obj


def text_section(id_: str, title: str, text: str, evidence_ids: list[str] | None = None) -> Section:
    return section(id_, "text", title, {"text": text}, evidence_ids)


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _headcount_rank(match: dict) -> int:
    rng = ((match.get("company_data") or {}).get("basic_info") or {}).get("employee_count_range") or ""
    m = re.match(r"(\d+)", rng.replace(",", ""))
    return int(m.group(1)) if m else 0


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def months_ago(today: date, months: int) -> date:
    y, m = today.year, today.month - months
    while m <= 0:
        m += 12
        y -= 1
    return date(y, m, 1)


def iso(d: date) -> str:
    return d.isoformat()


__all__ = ["ToolContext", "ToolInputError", "Sample", "F", "section", "stat_section", "text_section", "months_ago", "iso"]
