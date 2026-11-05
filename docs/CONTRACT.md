# AfterDegree API contract (v0.1)

> **Changelog**
> - 2026-11-06 (drill-down, orchestrator): every count can be drilled. Rows/items/routes may carry an optional `drill` token; `POST /api/drill` and `GET /api/people/{person_id}` added (Appendix C). Individuals are shown only as anonymous career trajectories (Crustdata Data Export Terms §3.1–3.2, §4).
> - 2026-11-06 (engine): additive only. Section `data` shapes per kind and section ids per tool pinned to `web/src/lib/types.ts` (see Appendix A); optional `result.coverage` (0–1); optional `section.evidence_ids`; `evidence.source` may also be `"mock"` in mock mode; `reverse_gps` puts the parsed goal in `cohort.filters.goal = {role, city, country, company}`; `people-like-me` accepts `exp_band` as `[min,max]` or `"min,max"`; `GET /api/health` adds optional `mock: bool`; `GET /api/usage` shape defined; `GET /api/profiles/{id}` shape defined (Appendix B).

Single source of truth between the Python engine (`engine/`, FastAPI on `:8000`) and the Next.js app (`web/`, on `:3000`, proxying `/api/*` to the engine). All JSON. All numbers are computed by deterministic engine code from Crustdata responses; the LLM never produces a number.

## Conventions

- Base path `/api`. Errors: `{"error": {"code": "...", "message": "plain-English, mentor voice", "hint": "what to try"}}` with an HTTP status (400 bad input, 404, 409, 424 upstream data unavailable, 429 rate limited, 500).
- Tool runs can take tens of seconds (Crustdata rate limits: person enrich 15 RPM, search 30 RPM, web 10 RPM). Every tool run is a **job**: `POST` starts it and returns `{"job_id"}`; the client polls `GET /api/jobs/{job_id}` (or streams `GET /api/jobs/{job_id}/events` as Server-Sent Events). Cached runs complete immediately.
- Every request that depends on the user carries `profile_id` (from onboarding). There is no auth in v0.1; profiles live in a local SQLite DB.

## Shared objects

### Count (the only way a proportion is shown)
```json
{ "k": 24, "n": 37, "display": "at least 24 of 37", "share": 0.649,
  "ci": [0.49, 0.78], "evidence_ids": ["ev_..."] }
```
`ci` is a 95% Wilson interval. When `n < 10`, `share` and `ci` are `null` and `display` reads e.g. "4 of 7 (too few to compare)".

### Cohort
```json
{ "definition": "BTech CSE graduates of VIT Vellore (2020–2023) with 1–3 years of work",
  "filters": { "...": "the exact engine-side filter description" },
  "n_visible": 312, "match_level": "exact_school | school_tier | field_only",
  "widened": false, "widened_reason": null }
```

### Evidence
```json
{ "id": "ev_9f2c", "endpoint": "/person/search", "filters": { }, "total_count": 312,
  "results_used": 200, "fetched_at": "2026-11-06T10:12:00Z", "source": "live | cache",
  "note": "Sampled the first 200 matching profiles" }
```

### Result envelope (every tool returns this in `job.result`)
```json
{
  "tool": "people_like_me",
  "title": "Where people like you are now",
  "summary": "Mentor-voice 1–3 sentences written by the LLM from the facts below (optional; null if LLM unavailable).",
  "cohort": { "...": "Cohort or null" },
  "confidence": "high | medium | low",
  "coverage_note": "Based on 312 visible profiles; people without public profiles are not counted.",
  "data_date": "2026-11-06",
  "sections": [ { "id": "...", "kind": "...", "title": "...", "data": { } } ],
  "next_steps": [ { "label": "See your Internship-to-Job chances in Germany", "tool": "internship_chances", "params": { } } ],
  "warnings": [ "plain-English caveats" ],
  "evidence": [ "Evidence objects" ]
}
```
Section `kind` values the UI must render: `distribution` (labelled counts, e.g. countries), `ranked_table` (rows with fixed columns; each row may carry `count: Count`, `badges[]`, `you: true`), `routes` (graph of steps: `nodes[] {id,label,kind}`, `edges[] {from,to,count}`), `route_list` (ordered paths with counts and gap lists), `timeseries` (`points[] {period, value}`), `stat` (one headline Count or number with label), `text` (short paragraph), `keywords` (term + count + share).

### Job
```json
{ "job_id": "job_...", "tool": "people_like_me", "status": "queued | running | done | error",
  "progress": { "step": "Counting people with your background", "done": 3, "total": 9 },
  "result": { "...": "Result envelope when done" }, "error": { "...": "when error" } }
```

## Onboarding (Crustdata used only to fetch the user's own profile)

### `POST /api/onboarding/profile`
Body `{ "linkedin_url": "https://www.linkedin.com/in/..." }` → Crustdata person enrich on that URL. Response:
```json
{ "profile_id": "p_...",
  "person": { "name": "...", "headline": "...", "location": {"city": "...", "country": "..."},
    "education": [ {"school": "...", "degree": "...", "field": "...", "start_year": 2018, "end_year": 2022, "school_country": "India"} ],
    "experience": [ {"company": "...", "company_id": 123, "title": "...", "start_date": "2022-07", "end_date": null, "seniority": "...", "function": "..."} ],
    "skills": ["..."] },
  "derived": { "undergrad_school": "...", "undergrad_field": "...", "undergrad_end_year": 2022,
    "years_experience": 2.3, "current_company": "...", "current_title": "...",
    "persona_guess": "student_abroad | professional | university" },
  "evidence": [ "Evidence" ] }
```
Errors: invalid URL (400), profile not found (404 with hint to check the URL), upstream down (424).

### `POST /api/onboarding/chat`
Body `{ "profile_id": "...", "messages": [ {"role": "user|assistant", "content": "..."} ] }`. The LLM (OpenRouter, `OPENROUTER_MODEL`) runs a short warm-mentor conversation (max ~4 questions) to confirm the profile and capture goals. Response:
```json
{ "reply": "assistant message", "done": false,
  "goals": { "persona": "student_abroad | professional | university",
    "intent": "masters_abroad | job_abroad | switch_role | grow_in_place | program_insights",
    "target_roles": ["Data Engineer"], "target_countries": ["Germany"], "target_cities": ["Berlin"],
    "target_companies": [], "institution": null, "programs": [], "constraints": ["budget under 30 lakh"] },
  "suggested_replies": ["Yes, that's right", "I'm also open to the Netherlands"] }
```
`goals` is the LLM's structured extraction (JSON mode), validated by the engine. If the LLM is unavailable, the endpoint returns a deterministic form-style fallback (`reply` asks the next fixed question).

### `POST /api/onboarding/complete`
Body `{ "profile_id": "...", "goals": { } }` → `{ "profile_id": "...", "home": { "next_steps": [...] } }`.

### `GET /api/profiles/{profile_id}` → stored profile + goals.

## Tools (each `POST` returns `{ "job_id" }`)

| Endpoint | Body (besides `profile_id`) | Result sections |
|---|---|---|
| `POST /api/tools/people-like-me` | `{ "match": "exact_school|school_tier|field_only" (default exact_school, auto-widens), "exp_band": [min,max] }` | stat (cohort size), distribution (current country), ranked_table (top roles), ranked_table (top employers), distribution (further degrees, by country of study), stat (moved abroad share) |
| `POST /api/tools/internship-chances` | `{ "company": "optional", "role": "optional", "country": "optional" }` | stat (chance as Count: interns/working students who later went full-time at the same company), ranked_table (companies by conversion for people like you), text (how the chance was computed) |
| `POST /api/tools/conversion-map` | `{ "scope": { "school": "optional", "field": "optional", "country": "optional", "role": "optional" } }` | ranked_table (company, interns seen, converted, Count), distribution (conversion by country) |
| `POST /api/tools/reverse-gps` | `{ "goal_text": "ML engineer in Berlin" }` or `{ "role": "...", "city": "...", "country": "...", "company": "optional" }` | text (parsed goal), route_list (top routes that fit the user: steps, people count, typical years, gaps to close), routes (graph), keywords (skills common in the goal role that the user lacks) |
| `POST /api/tools/routes-to-position` | `{ "role": "...", "company": "optional", "city": "optional", "country": "optional" }` | routes (feeder employers → titles → position), ranked_table (feeder employers), ranked_table (previous titles), ranked_table (schools/degrees), distribution (years of experience at entry) |
| `POST /api/tools/job-postings` | `{ "role": "...", "city": "optional", "country": "..." }` | stat (open postings, last 30/90 days), timeseries (postings by month), distribution (seniority), keywords (skills in demand), distribution (language requirements: English-only vs German/Dutch/... required), stat (share mentioning visa sponsorship), ranked_table (employers posting most, with hire-through signal: postings vs matching hires) |
| `POST /api/tools/indian-friendly` | `{ "country": "...", "role": "optional", "city": "optional" }` | ranked_table (employers with Indian-educated hires: count, recent hires (last 24 months), seniority reached, median tenure, sponsorship signal badges), text (method) |
| `POST /api/tools/market-saturation` | `{ "role": "...", "city": "optional", "country": "..." }` | stat (entrants per opening as a ratio with label: low/medium/high), timeseries (entrants vs openings by quarter), text (interpretation), ranked_table (comparable cities) |

### Persona lens
For `persona = university`, tools accept `{ "institution": "...", "programs": [...] }` and replace "people like you" with "your graduates" (cohort = graduates of that institution/program). The result envelope is identical.

## Other endpoints

- `GET /api/jobs/{job_id}`, `GET /api/jobs/{job_id}/events` (SSE: `progress`, `done`, `error`).
- `GET /api/evidence/{id}` → Evidence.
- `GET /api/health` → `{ "crustdata": "ok|missing_key|error", "llm": "ok|missing_key|error" }`.
- `GET /api/usage` → credits used this session from the engine's credit log.

## Privacy rules enforced by the engine

- Never return another person's name, profile URL, photo or exact title+company+date combination that identifies them. Only aggregates with `n >= 5` per row; rows below are folded into "Other".
- The user's own profile is returned only to that profile's session.

## Appendix A: section data shapes and ids (engine v0.1, matches `web/src/lib/types.ts`)

Every section is `{ id, kind, title, data, evidence_ids? }`. Optional fields may be absent. `Count` objects always carry `share`/`ci` (null when `n < 10`).

| kind | `data` |
|---|---|
| `distribution` | `{ n, items: [{ label, count: int, share?: number\|null, target?: bool, remainder?: bool }], unit?: "people"\|"degrees"\|"postings"\|"conversions", caption? }`. `target` marks the user's target; `remainder` rows ("Still in India", "No further degree shown") render hollow. Groups under 5 fold into an "Other …" item. |
| `ranked_table` | `{ n?, columns: [{ key, label, type: "text"\|"int"\|"count"\|"share"\|"years"\|"badges", bar?: bool }], rows: [{ id?, cells: {key: string\|number\|null\|Count\|string[]}, count?: Count, badges?: string[], you?: bool, rest?: bool }], default_sort?: { key, dir }, caption? }`. `rest: true` is the folded "Other …" row. |
| `routes` | `{ nodes: [{ id, label, kind }], edges: [{ from, to, count }], caption? }` (edges with fewer than 5 people are dropped). |
| `route_list` | `{ routes: [{ id, title?, steps: [{ label, kind?, years? }], people: Count, typical_years?, fit?: "fits_you"\|"stretch"\|"far", gaps: string[] }], caption? }` |
| `timeseries` | `{ points?: [{ period, value }] }` or `{ series: [{ key, label, points }] }`, plus `unit?`, `caption?` |
| `stat` | `{ label, value?, count?: Count, unit?, display?, level?: "low"\|"medium"\|"high", note? }` (the UI renders "of N {label}", so `label` never starts with "of") |
| `text` | `{ text }` |
| `keywords` | `{ n?, items: [{ term, count, share?, you_have? }], caption? }` |

Section ids per tool (in order; extra sections may follow and render generically):

| Tool | Sections `id:kind` |
|---|---|
| people_like_me | `cohort_size:stat`, `moved_abroad:stat`, `countries:distribution`, `roles:ranked_table` (cells `role, people`), `employers_target:ranked_table` (cells `employer, people`; employers in the user's target country), `further_degrees:distribution`, `degree_countries:distribution` |
| internship_chances | `chance:stat`, `companies:ranked_table` (cells `company, interns, converted: Count`), `method:text` |
| conversion_map | `companies:ranked_table` (cells `company, country, seen, converted, rate: Count`), `by_country:distribution` (unit `conversions`), optional `by_school_group:ranked_table` |
| reverse_gps | `goal:text` ("Role: …. City: …. Country: …."), `routes:route_list`, `graph:routes`, `skills_gap:keywords` |
| routes_to_position | `graph:routes`, `feeders:ranked_table` (cells `employer, people`), `titles:ranked_table` (`title, people`), `schools:ranked_table` (`school, people`), `years:distribution` |
| job_postings | `open_90:stat`, `open_30:stat`, `open_prev:stat` (the 90 days before), `trend:timeseries`, `seniority:distribution`, `skills:keywords`, `languages:distribution`, `visa:stat`, `employers:ranked_table` (cells `employer, postings, hires, signal: string[]`) |
| indian_friendly | `employers:ranked_table` (cells `employer, hires, recent, seniority: Count (reached senior or above), tenure: years, signals: string[]`), `method:text`; `cohort.filters.work_country` |
| market_saturation | `ratio:stat` (`value` = entrants per opening; `level` low < 0.02 ≤ medium < 0.08 ≤ high), `trend:timeseries` (series `entrants`, `openings`), `read:text`, `cities:ranked_table` (cells `city, ratio, openings, entrants`; the chosen city has `you: true`), `entrants:stat`, `openings:stat` |

Result envelope additions: `coverage?: number` (0–1; for people_like_me the share of the cohort with a known current country, elsewhere the share of visible matching records the breakdowns were read from). Cohort filters carry plain-text scope keys (`school`, `field`, `country`, `role`, `city`, `company`, `goal`, `work_country`, `institution`) next to `crustdata` (the exact filter tree sent).

## Appendix B: other response shapes (engine v0.1)

- `GET /api/profiles/{id}` → `{ profile_id, linkedin_url, person, derived, goals: Goals|null, completed: bool, created_at, evidence: Evidence[] }`.
- `GET /api/health` → `{ crustdata, llm, mock: bool }`.
- `GET /api/usage` → `{ session_started_at, live_calls, cached_calls, estimated_credits, reported_credits: number|null, by_endpoint: [{ endpoint, live_calls, cached_calls, results, estimated_credits }] }` (cache and mock calls cost 0).
- Job errors use `error.code` values such as `bad_input`, `missing_key`, `upstream_auth`, `upstream_credits`, `upstream_forbidden`, `rate_limited`, `budget_exceeded`, `upstream_unavailable`, `internal`.



## Appendix C: Drill-down (every count is clickable)

### Drill token
Any `distribution.items[]`, `ranked_table.rows[]`, `route_list.routes[]`, `routes.nodes[]`, or cohort group MAY carry:
```json
"drill": { "tool": "people_like_me", "params": { "...": "the original tool params" },
           "path": [ { "dimension": "country", "value": "Germany", "label": "Germany" } ] }
```
`dimension` ∈ `country | city | company | role | school | degree | degree_country | seniority | years_band | route | route_step | posting_employer | skill | language | quarter`. The UI never builds filters itself; it sends the token back unchanged (plus an optional extra `path` step chosen in the drill panel).

### `POST /api/drill`
Body `{ "profile_id": "...", "drill": DrillToken }` → `{ "job_id" }` (job pattern as tools). `job.result` is a **Drill result**:
```json
{ "tool": "drill", "title": "People like you in Germany",
  "path": [ { "dimension": "country", "value": "Germany", "label": "Germany" } ],
  "count": Count, "cohort": Cohort, "confidence": "high|medium|low",
  "sections": [ "Section (same kinds/shapes as Appendix A); their items/rows carry drill tokens with the path extended one level, e.g. country → city, company, role, years_band" ],
  "people": [ PersonCard ], "people_total": 71, "people_note": "Showing 24 anonymised career paths of at least 71 people.",
  "listing_blocked_reason": null,
  "warnings": [], "evidence": [ Evidence ] }
```
Rules: `people` is empty and `listing_blocked_reason` = "Fewer than 5 people match, so we don't list individuals." when the slice has n < 5. At most 30 people per page (`?page=` later).

### PersonCard (anonymous)
```json
{ "id": "pp_9f2c1a", "headline": "Data Engineer · SAP · Berlin",
  "current": { "title": "Data Engineer", "company": "SAP", "city": "Berlin", "country": "Germany", "since_year": 2024 },
  "match_reasons": ["Same college", "Same field", "Similar experience"],
  "tags": ["Moved abroad 2022", "MS → working student → full-time"],
  "steps": [ { "kind": "education|work|internship", "org": "VIT Vellore", "title": "BTech, Computer Science",
               "city": "Vellore", "country": "India", "start_year": 2018, "end_year": 2022, "years": 4.0 } ] }
```
### `GET /api/people/{person_id}?profile_id=...`
Returns PersonDetail = PersonCard + `skills` (top 8) + `route_stats` (e.g. how many people in the user's cohort took the same route, as Count). Ids are opaque, salted per server instance, and only resolvable for people previously returned to that profile.

### Privacy rules (binding, per Crustdata Data Export Terms §3.1–3.2 and §4)
- Never return a person's name, photo, profile URL, email, Crustdata person id, or exact dates (years only; durations rounded to 0.5 year).
- Never list individuals for a slice with n < 5.
- Cached person data expires within 7 days (well inside the 30-day opt-out deletion window).
- Results are shown inside the app only; no export or bulk download of people.
