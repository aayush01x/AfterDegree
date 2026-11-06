# AfterDegree engine

FastAPI service that computes every AfterDegree number from Crustdata data. It implements
`../docs/CONTRACT.md` (see the appendices for the exact section shapes the web app renders).
Code decides; the LLM (OpenRouter) only reads goal text, runs the onboarding chat and writes
short summaries, and each summary is dropped if it contains a number that isn't in the facts.

## Run

```bash
cd engine
uv sync                                                # Python 3.12, pinned in .python-version
uv run uvicorn afterdegree.api:app --port 8000         # real data (needs CRUSTDATA_API_KEY)
AFTERDEGREE_MOCK=1 uv run uvicorn afterdegree.api:app --port 8000   # example data, no network
uv run pytest -q                                       # test suite (no network, no real cache)
```

The web app proxies `/api/*` to `http://localhost:8000`. CORS allows `http://localhost:3000`.

## Configuration

Read from the environment, then from `../.env`. Key values are never logged or printed.

| Variable | Default | Meaning |
|---|---|---|
| `CRUSTDATA_API_KEY` | empty | Crustdata key. Empty: tool runs fail with a 424 `missing_key` error (or use mock mode). |
| `OPENROUTER_API_KEY` | empty | OpenRouter key. Empty: deterministic onboarding questions, rule-based goal parsing, no summaries. |
| `OPENROUTER_MODEL` | `deepseek/deepseek-v4.1-flash-1017` | Chat model. |
| `AFTERDEGREE_MOCK` | `0` | `1` serves deterministic example data (persona: Riya Menon) with no network. |
| `AFTERDEGREE_MAX_CREDITS` | `25` | Hard estimated-credit budget per tool run. |
| `AFTERDEGREE_MAX_LIVE_CALLS` | `60` | Hard live-call budget per tool run (cached calls are free). |
| `AFTERDEGREE_SEARCH_SAMPLE_CAP` | `60` | Max profiles read per sample (tools ask for 40–50; also capped by the credit budget). |
| `AFTERDEGREE_JOB_SAMPLE_CAP` | `100` | Max postings read per sample (job postings reads 60). |
| `AFTERDEGREE_COUNT_RESERVE` | `3` | Credits every profile sample leaves for the count-only queries after it. |
| `AFTERDEGREE_DRILL_MAX_CREDITS` | `20` | Credit budget per drill-down. |
| `AFTERDEGREE_DRILL_SAMPLE_CAP` | `20` | Anonymous career paths read per drill-down (max 30). |
| `AFTERDEGREE_CACHE_TTL_DAYS` | `7` | Disk-cache lifetime. |
| `AFTERDEGREE_CACHE_DIR` | `../.cache/crustdata` | Cache location (sha256 of endpoint + canonical JSON body). |
| `AFTERDEGREE_DB_PATH` | `../.cache/afterdegree.sqlite3` | SQLite for profiles, jobs, evidence and the credit log. |
| `AFTERDEGREE_WEB_SPONSOR_CHECKS` | `2` | Web searches (1 credit each) for UK/NL sponsor-register mentions per indian-friendly run. |
| `AFTERDEGREE_SOCIAL_POSTS` | `0` | Enables `/social_post/search` (unused by the tools; off by default). |

## How it works

- `afterdegree/crustdata.py`: async client. Token buckets per endpoint (person search 30 RPM, enrich 15,
  autocomplete 300, company identify/search 30, company enrich 15, job search 30, web 10) plus a
  200 RPM aggregate; jittered backoff on 429/5xx (honours `Retry-After`); clear errors for
  400/401/402/403/404; disk cache; a credit-log row per call; a per-run budget that refuses a call
  *before* sending it if its worst-case cost would exceed the budget. Only the enabled endpoints
  can be called.
- `afterdegree/stats.py`: `Count` with 95% Wilson interval (`share`/`ci` null when n < 10),
  folding of groups under 5 people into "Other", medians.
- `afterdegree/profile.py`: person enrich → contract `person` + `derived`; search profiles → a
  compact internal form for aggregation.
- `afterdegree/cohort.py`: "people like you" cohorts, auto-widening exact_school → school_tier →
  field_only below 10 visible people, with a visible `widened_reason`. University lens: graduates
  of the institution/programs.
- `afterdegree/tools/`: the eight capabilities. Denominators come from Crustdata `total_count`
  (count queries cost about 0.13–0.23 credits); distributions come from a budget-capped sample of
  matching profiles; job counts and aggregations use free `limit: 0` queries.
- `afterdegree/jobs.py`: in-process asyncio job runner, persisted to SQLite, SSE at
  `/api/jobs/{id}/events` (`progress`, then `done` or `error`).
- `afterdegree/drill.py`: `POST /api/drill` and `GET /api/people/{id}` (CONTRACT Appendix C + D). Re-runs the
  origin tool's cohort code with the token's params, applies each path step as a filter (refusing steps that can't be
  searched for), counts the slice and every next-level row with count-only queries (exact), reads a capped sample of
  the slice for anonymous career paths, and builds the company profile (enrich + postings + company-wide counts).
- Counting rule: a number shown next to a total is an exact count-only total, or is labelled with `sample_n` and uses
  the sample size as its denominator. Samples are small (40–50 profiles) and a request for fewer profiles is served
  from a larger cached page of the same query (no new credits).
- `afterdegree/mock.py`: a synthetic Crustdata backend (3,000 people, 6,000 postings) that
  interprets the same filter trees; powers mock mode and the tests.

Privacy: results never contain another person's name or profile URL (a final scrubber also
redacts any that slip through); groups under 5 people are folded; the onboarding user's own
profile is only returned for their `profile_id`.

## Credits

Person search is billed per returned profile: 0.03 base + 0.1 per premium group filtered on
(education, experience) + 0.1 per premium group returned. A typical sampled profile costs
0.33–0.43 credits, so with the default 25-credit run budget a tool reads roughly 50–75 profiles,
not 200; raise `AFTERDEGREE_MAX_CREDITS` to read more. Each distinct query is paid once (7-day cache).
`GET /api/usage` reports estimated (and, when Crustdata sends `x-credits-used`, reported) credits.

## Probe

```bash
uv run python scripts/probe.py --linkedin-url https://www.linkedin.com/in/<someone>
```

Makes a small capped set of real calls (enrich if a URL is given, one education-filtered person
search with limit 5, one cohort-grammar count, one job search with limit 5 plus a free
aggregation, one company identify, one web search; about 4 credits, hard cap 15), saves raw
responses to `tests/fixtures/live/` (git-ignored: real people's data) and prints only key/type
shapes and parser field coverage.
