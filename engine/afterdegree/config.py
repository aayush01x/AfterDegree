"""Engine settings, read from the environment and /home/.../afterdegree/.env.

Key values are never logged or printed; `Settings.__repr__` masks them.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field, fields
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = ENGINE_DIR.parent
DEFAULT_ENV_FILE = PROJECT_DIR / ".env"

SECRET_FIELDS = {"crustdata_api_key", "openrouter_api_key"}


def _read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key.startswith("export "):
            key = key[len("export ") :].strip()
        value = value.strip().strip('"').strip("'")
        values[key] = value
    return values


def _flag(value: str | None, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    crustdata_api_key: str = ""
    openrouter_api_key: str = ""
    openrouter_model: str = "deepseek/deepseek-v4.1-flash-1017"
    crustdata_base_url: str = "https://api.crustdata.com"
    crustdata_api_version: str = "2025-11-01"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    mock: bool = False
    social_posts_enabled: bool = False

    cache_dir: Path = field(default_factory=lambda: PROJECT_DIR / ".cache" / "crustdata")
    cache_ttl_days: float = 7.0
    db_path: Path = field(default_factory=lambda: PROJECT_DIR / ".cache" / "afterdegree.sqlite3")

    # Per tool-run hard budget.
    max_live_calls_per_run: int = 60
    max_credits_per_run: float = 25.0
    # Profiles/postings sampled per query (capped further by the credit budget).
    search_sample_cap: int = 200
    job_sample_cap: int = 100
    # Credits kept back from a sample so later counting calls in the same run can still run.
    sample_credit_reserve: float = 3.0

    # Upstream behaviour.
    http_timeout_s: float = 45.0
    max_retries: int = 3
    backoff_base_s: float = 1.0
    aggregate_rpm: int = 200
    llm_timeout_s: float = 60.0

    # Drill-down runs (POST /api/drill): their own, smaller budget.
    drill_max_credits: float = 15.0
    drill_sample_cap: int = 30
    # Person data (raw Crustdata responses and anonymised drill people) never lives longer than this.
    person_data_ttl_days: float = 7.0

    # Optional web checks for sponsor registers (1 credit each, UK/NL only).
    web_sponsor_checks: int = 2
    # Optional company enrich (2 credits each) for headcount trends.
    company_enrich_top_n: int = 0

    cors_origins: tuple[str, ...] = ("http://localhost:3000", "http://127.0.0.1:3000")

    def __repr__(self) -> str:  # never leak keys
        parts = []
        for f in fields(self):
            value = getattr(self, f.name)
            if f.name in SECRET_FIELDS:
                value = "<set>" if value else "<empty>"
            parts.append(f"{f.name}={value!r}")
        return f"Settings({', '.join(parts)})"

    __str__ = __repr__

    @property
    def has_crustdata_key(self) -> bool:
        return bool(self.crustdata_api_key)

    @property
    def has_llm_key(self) -> bool:
        return bool(self.openrouter_api_key)


def load_settings(env_file: Path | None = None, **overrides) -> Settings:
    file_values = _read_env_file(env_file or Path(os.environ.get("AFTERDEGREE_ENV_FILE", DEFAULT_ENV_FILE)))

    def get(name: str, default: str | None = None) -> str | None:
        if name in os.environ:
            return os.environ[name]
        return file_values.get(name, default)

    s = Settings()
    s.crustdata_api_key = get("CRUSTDATA_API_KEY", "") or ""
    s.openrouter_api_key = get("OPENROUTER_API_KEY", "") or ""
    s.openrouter_model = get("OPENROUTER_MODEL") or s.openrouter_model
    s.mock = _flag(get("AFTERDEGREE_MOCK"))
    s.social_posts_enabled = _flag(get("AFTERDEGREE_SOCIAL_POSTS"))
    if get("AFTERDEGREE_CACHE_DIR"):
        s.cache_dir = Path(get("AFTERDEGREE_CACHE_DIR"))  # type: ignore[arg-type]
    if get("AFTERDEGREE_DB_PATH"):
        s.db_path = Path(get("AFTERDEGREE_DB_PATH"))  # type: ignore[arg-type]

    numeric = {
        "AFTERDEGREE_CACHE_TTL_DAYS": ("cache_ttl_days", float),
        "AFTERDEGREE_MAX_LIVE_CALLS": ("max_live_calls_per_run", int),
        "AFTERDEGREE_MAX_CREDITS": ("max_credits_per_run", float),
        "AFTERDEGREE_SEARCH_SAMPLE_CAP": ("search_sample_cap", int),
        "AFTERDEGREE_JOB_SAMPLE_CAP": ("job_sample_cap", int),
        "AFTERDEGREE_WEB_SPONSOR_CHECKS": ("web_sponsor_checks", int),
        "AFTERDEGREE_COMPANY_ENRICH_TOP_N": ("company_enrich_top_n", int),
        "AFTERDEGREE_MAX_RETRIES": ("max_retries", int),
        "AFTERDEGREE_DRILL_MAX_CREDITS": ("drill_max_credits", float),
        "AFTERDEGREE_DRILL_SAMPLE_CAP": ("drill_sample_cap", int),
    }
    for env_name, (attr, cast) in numeric.items():
        raw = get(env_name)
        if raw not in (None, ""):
            setattr(s, attr, cast(raw))
    for key, value in overrides.items():
        setattr(s, key, value)
    return s


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings


def set_settings(settings: Settings | None) -> None:
    global _settings
    _settings = settings
