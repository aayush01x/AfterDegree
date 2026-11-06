"""Pydantic models that mirror docs/CONTRACT.md. These are the binding API shapes."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Persona = Literal["student_abroad", "professional", "university"]
Intent = Literal["masters_abroad", "job_abroad", "switch_role", "grow_in_place", "program_insights"]
MatchLevel = Literal["exact_school", "school_tier", "field_only"]
Confidence = Literal["high", "medium", "low"]
SectionKind = Literal["distribution", "ranked_table", "routes", "route_list", "timeseries", "stat", "text", "keywords"]
JobStatus = Literal["queued", "running", "done", "error"]
ToolName = Literal[
    "people_like_me",
    "internship_chances",
    "conversion_map",
    "reverse_gps",
    "routes_to_position",
    "job_postings",
    "indian_friendly",
    "market_saturation",
]


class _Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------- shared objects ----------


class Count(_Model):
    k: int
    n: int
    display: str
    share: float | None = None
    ci: list[float] | None = None
    evidence_ids: list[str] = Field(default_factory=list)


class Cohort(_Model):
    definition: str
    filters: dict[str, Any] = Field(default_factory=dict)
    n_visible: int
    match_level: MatchLevel
    widened: bool = False
    widened_reason: str | None = None


class Evidence(_Model):
    id: str
    endpoint: str
    filters: dict[str, Any] = Field(default_factory=dict)
    total_count: int | None = None
    results_used: int = 0
    fetched_at: str
    source: Literal["live", "cache", "mock"]
    note: str | None = None


class Section(_Model):
    id: str
    kind: SectionKind
    title: str
    data: dict[str, Any] = Field(default_factory=dict)
    evidence_ids: list[str] = Field(default_factory=list)


class NextStep(_Model):
    label: str
    tool: ToolName
    params: dict[str, Any] = Field(default_factory=dict)


class Result(_Model):
    tool: ToolName
    title: str
    summary: str | None = None
    cohort: Cohort | None = None
    confidence: Confidence
    coverage_note: str
    coverage: float | None = None
    data_date: str
    sections: list[Section] = Field(default_factory=list)
    next_steps: list[NextStep] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)


class ErrorBody(_Model):
    code: str
    message: str
    hint: str | None = None


class ErrorEnvelope(_Model):
    error: ErrorBody


class Progress(_Model):
    step: str
    done: int
    total: int


class Job(_Model):
    job_id: str
    tool: ToolName | Literal["drill"]
    status: JobStatus
    progress: Progress | None = None
    result: Result | DrillResult | None = None
    error: ErrorBody | None = None


class JobCreated(_Model):
    job_id: str


# ---------- drill tokens (CONTRACT Appendix C) ----------

DrillDimension = Literal[
    "country", "city", "company", "role", "school", "degree", "degree_country", "seniority", "years_band",
    "route", "route_step", "posting_employer", "skill", "language", "quarter",
]


class DrillStep(BaseModel):
    model_config = ConfigDict(extra="ignore")
    dimension: DrillDimension
    value: str = Field(max_length=400)
    label: str = Field(default="", max_length=200)

    @field_validator("label", mode="before")
    @classmethod
    def _label(cls, v: Any) -> Any:
        return "" if v is None else v


class DrillToken(BaseModel):
    """Opaque to the UI: sent back unchanged (plus an optional extra path step)."""

    model_config = ConfigDict(extra="ignore")
    tool: ToolName
    params: dict[str, Any] = Field(default_factory=dict)
    path: list[DrillStep] = Field(default_factory=list, max_length=8)


# ---------- section data payloads (match web/src/lib/types.ts; documented in CONTRACT.md) ----------


class DistributionItem(_Model):
    label: str
    count: int
    share: float | None = None
    target: bool = False
    remainder: bool = False
    drill: DrillToken | None = None
    preview: list[dict[str, Any]] | None = None


class DistributionData(_Model):
    n: int
    items: list[DistributionItem]
    unit: str | None = None
    caption: str | None = None
    sample_n: int | None = None


ColumnType = Literal["text", "int", "count", "share", "years", "badges"]


class Column(_Model):
    key: str
    label: str
    type: ColumnType = "text"
    bar: bool = False


class TableRow(_Model):
    id: str | None = None
    cells: dict[str, Any] = Field(default_factory=dict)
    count: Count | None = None
    badges: list[str] = Field(default_factory=list)
    you: bool = False
    rest: bool = False
    drill: DrillToken | None = None
    posting_url: str | None = None
    preview: list[dict[str, Any]] | None = None


class SortSpec(_Model):
    key: str
    dir: Literal["asc", "desc"] = "desc"


class RankedTableData(_Model):
    n: int | None = None
    columns: list[Column]
    rows: list[TableRow]
    default_sort: SortSpec | None = None
    caption: str | None = None
    sample_n: int | None = None
    note: str | None = None


class RouteNode(_Model):
    id: str
    label: str
    kind: str
    drill: DrillToken | None = None


class RouteEdge(_Model):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    from_: str = Field(alias="from")
    to: str
    count: int


class RoutesData(_Model):
    nodes: list[RouteNode]
    edges: list[RouteEdge]
    caption: str | None = None


class RouteStep(_Model):
    label: str
    kind: str | None = None
    years: float | None = None


class RouteItem(_Model):
    id: str
    title: str | None = None
    steps: list[RouteStep]
    people: Count | int
    typical_years: float | None = None
    fit: Literal["fits_you", "stretch", "far"] | None = None
    gaps: list[str] = Field(default_factory=list)
    drill: DrillToken | None = None


class RouteListData(_Model):
    routes: list[RouteItem]
    caption: str | None = None


class TimePoint(_Model):
    period: str
    value: float
    drill: DrillToken | None = None


class TimeSeries(_Model):
    key: str
    label: str
    points: list[TimePoint]


class TimeseriesData(_Model):
    points: list[TimePoint] | None = None
    series: list[TimeSeries] | None = None
    unit: str | None = None
    caption: str | None = None


class StatData(_Model):
    label: str
    value: float | None = None
    count: Count | None = None
    unit: str | None = None
    display: str | None = None
    level: Literal["low", "medium", "high"] | None = None
    note: str | None = None
    sample_n: int | None = None
    drill: DrillToken | None = None


class TextData(_Model):
    text: str


class KeywordItem(_Model):
    term: str
    count: int
    share: float | None = None
    you_have: bool | None = None
    drill: DrillToken | None = None


class KeywordsData(_Model):
    n: int | None = None
    sample_n: int | None = None
    items: list[KeywordItem]
    caption: str | None = None


SECTION_DATA_MODELS: dict[str, type[_Model]] = {
    "distribution": DistributionData,
    "ranked_table": RankedTableData,
    "routes": RoutesData,
    "route_list": RouteListData,
    "timeseries": TimeseriesData,
    "stat": StatData,
    "text": TextData,
    "keywords": KeywordsData,
}


# ---------- onboarding ----------


class Location(_Model):
    city: str | None = None
    country: str | None = None


class EducationEntry(_Model):
    school: str | None = None
    degree: str | None = None
    field: str | None = None
    start_year: int | None = None
    end_year: int | None = None
    school_country: str | None = None


class ExperienceEntry(_Model):
    company: str | None = None
    company_id: int | None = None
    title: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    seniority: str | None = None
    function: str | None = None


class Person(_Model):
    name: str | None = None
    headline: str | None = None
    location: Location = Field(default_factory=Location)
    education: list[EducationEntry] = Field(default_factory=list)
    experience: list[ExperienceEntry] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)


class Derived(_Model):
    undergrad_school: str | None = None
    undergrad_field: str | None = None
    undergrad_end_year: int | None = None
    years_experience: float | None = None
    current_company: str | None = None
    current_title: str | None = None
    persona_guess: Persona = "student_abroad"


class Goals(BaseModel):
    """Validated LLM extraction. Unknown keys are dropped, not rejected."""

    model_config = ConfigDict(extra="ignore")

    persona: Persona | None = None
    intent: Intent | None = None
    target_roles: list[str] = Field(default_factory=list)
    target_countries: list[str] = Field(default_factory=list)
    target_cities: list[str] = Field(default_factory=list)
    target_companies: list[str] = Field(default_factory=list)
    institution: str | None = None
    programs: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)


class OnboardingProfileRequest(_Model):
    linkedin_url: str


class OnboardingProfileResponse(_Model):
    profile_id: str
    person: Person
    derived: Derived
    evidence: list[Evidence] = Field(default_factory=list)


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    role: Literal["user", "assistant"]
    content: str


class OnboardingChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    profile_id: str
    messages: list[ChatMessage] = Field(default_factory=list)


class OnboardingChatResponse(_Model):
    reply: str
    done: bool
    goals: Goals
    suggested_replies: list[str] = Field(default_factory=list)


class OnboardingCompleteRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    profile_id: str
    goals: Goals = Field(default_factory=Goals)


class Home(_Model):
    next_steps: list[NextStep]


class OnboardingCompleteResponse(_Model):
    profile_id: str
    home: Home


class StoredProfile(_Model):
    profile_id: str
    linkedin_url: str | None = None
    person: Person
    derived: Derived
    goals: Goals | None = None
    completed: bool = False
    created_at: str
    evidence: list[Evidence] = Field(default_factory=list)


class Health(_Model):
    crustdata: Literal["ok", "missing_key", "error"]
    llm: Literal["ok", "missing_key", "error"]
    mock: bool = False


class UsageEndpoint(_Model):
    endpoint: str
    live_calls: int
    cached_calls: int
    results: int
    estimated_credits: float


class Usage(_Model):
    session_started_at: str
    live_calls: int
    cached_calls: int
    estimated_credits: float
    reported_credits: float | None = None
    by_endpoint: list[UsageEndpoint] = Field(default_factory=list)


# ---------- tool request bodies ----------


class _ToolBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    profile_id: str
    institution: str | None = None
    programs: list[str] | None = None


class PeopleLikeMeBody(_ToolBody):
    match: MatchLevel = "exact_school"
    exp_band: list[float] | None = None

    @field_validator("exp_band", mode="before")
    @classmethod
    def _parse_band(cls, v: Any) -> Any:
        """Accept [min, max] or the string "min,max" (also "min-max")."""
        if v is None or v == "" or v == []:
            return None
        if isinstance(v, str):
            parts = [x for x in v.replace("–", ",").replace("-", ",").split(",") if x.strip()]
            v = [float(x) for x in parts]
        if isinstance(v, (list, tuple)):
            if len(v) == 1:
                v = [v[0], v[0]]
            if len(v) != 2:
                raise ValueError("exp_band needs two numbers: [min, max]")
            lo, hi = float(v[0]), float(v[1])
            if lo < 0 or hi < 0:
                raise ValueError("exp_band values must be zero or more")
            return [min(lo, hi), max(lo, hi)]
        return v


class InternshipChancesBody(_ToolBody):
    company: str | None = None
    role: str | None = None
    country: str | None = None


class ConversionScope(BaseModel):
    model_config = ConfigDict(extra="ignore")
    school: str | None = None
    field: str | None = None
    country: str | None = None
    role: str | None = None


class ConversionMapBody(_ToolBody):
    scope: ConversionScope = Field(default_factory=ConversionScope)


class ReverseGpsBody(_ToolBody):
    goal_text: str | None = None
    role: str | None = None
    city: str | None = None
    country: str | None = None
    company: str | None = None


class RoutesToPositionBody(_ToolBody):
    role: str
    company: str | None = None
    city: str | None = None
    country: str | None = None


class JobPostingsBody(_ToolBody):
    role: str
    city: str | None = None
    country: str


class IndianFriendlyBody(_ToolBody):
    country: str
    role: str | None = None
    city: str | None = None


class MarketSaturationBody(_ToolBody):
    role: str
    city: str | None = None
    country: str


# ---------- drill-down results (CONTRACT Appendix C + D) ----------


class PersonStep(_Model):
    kind: Literal["education", "work", "internship"]
    org: str
    title: str | None = None
    city: str | None = None
    country: str | None = None
    start_year: int | None = None
    end_year: int | None = None
    years: float | None = None


class PersonCurrent(_Model):
    title: str | None = None
    company: str | None = None
    city: str | None = None
    country: str | None = None
    since_year: int | None = None


class PersonCard(_Model):
    id: str
    headline: str
    current: PersonCurrent | None = None
    match_reasons: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    steps: list[PersonStep] = Field(default_factory=list)


class RouteStat(_Model):
    label: str
    count: Count


class RouteSkill(_Model):
    term: str
    count: int
    n: int


class PersonDetail(PersonCard):
    skills: list[str] = Field(default_factory=list)
    route_stats: list[RouteStat] = Field(default_factory=list)
    position: dict[str, int] | None = None
    why: list[dict[str, str]] = Field(default_factory=list)
    same_route: list[PersonCard] = Field(default_factory=list)
    route_skills: list[RouteSkill] = Field(default_factory=list)
    route_typical_years: float | None = None
    data_date: str | None = None


class DrillContextFilter(_Model):
    label: str
    value: str
    key: str | None = None
    param: str | None = None
    drill: DrillToken | None = None


class DrillContext(_Model):
    origin_tool: str
    origin_label: str
    filters: list[DrillContextFilter] = Field(default_factory=list)


class DrillRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    profile_id: str
    drill: DrillToken


class DrillResult(_Model):
    tool: Literal["drill"] = "drill"
    title: str
    path: list[DrillStep] = Field(default_factory=list)
    context: DrillContext | None = None
    count: Count | None = None
    count_label: str | None = None
    cohort: Cohort | None = None
    confidence: Confidence = "low"
    sections: list[Section] = Field(default_factory=list)
    people: list[PersonCard] = Field(default_factory=list)
    people_total: int | None = None
    people_note: str | None = None
    listing_blocked_reason: str | None = None
    company: dict[str, Any] | None = None
    summary: str | None = None
    coverage: float | None = None
    coverage_note: str | None = None
    data_date: str | None = None
    next_steps: list[NextStep] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)


Job.model_rebuild()
