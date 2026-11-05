# AfterDegree API contract (v0.1)

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
