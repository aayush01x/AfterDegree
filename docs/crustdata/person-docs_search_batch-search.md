> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Batch People Search API

> Run one person search query asynchronously and receive the whole result set as a single file — from the indexed database (up to 10,000 records) or retrieved from the web in real time (up to 1,000 records).

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | Enterprise plans. Live batch is an add-on. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | No |
| **Credit cost** | Same as People Search: 0.03 credits per result plus [premium groups](https://docs.crustdata.com/general/pricing.md#premium-fields-in-search). Live batch is 2 credits per profile |
| **Batch size** | 10,000 results per job (1,000 for live) |
| **Rate limit** | Up to 5 jobs can run at the same time. |

Batch search runs one query asynchronously and delivers the **entire result
set** as a single file. Where [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md)
returns one cursor page per call, a batch job walks every page for you.

This page covers two batch endpoints:

* [**Batch search**](#batch-search) — results served from the indexed database, with higher caps and faster turnaround.
* [**Batch live search**](#batch-live-search) — results retrieved from the web in real time, fresher but with lower caps and slower.

<Snippet file="batch-headers-note.mdx" />

<Snippet file="batch-pricing-callout.mdx" />

***

## Batch search

```
POST https://api.crustdata.com/batch/person/search
```

Batch search runs one query asynchronously and delivers the **entire result
set** as a single file. Where [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md)
returns one cursor page per call, a batch job walks every page for you.

For fresher results retrieved from the web in real time, see
[Batch live search](#batch-live-search) below.

### How batch search differs from non-batch search

* **One query, whole result set.** You submit a single query; the job paginates server-side until `max_results` is reached or the matches run out.
* **`max_results` is the only volume control.** It clamps to **10,000** and defaults to that cap when omitted. Values above the cap are silently clamped; zero or negative values return `400`. The non-batch paging knobs — `limit`, `page`, `preview` — are silently ignored.
* **Flat records.** Each line in the results file has exactly the non-batch search record shape. No envelope.
* **Exact field projection.** When you pass `fields`, each record contains exactly those fields — nothing more. Omit `fields` to get every field your account can read.

### Database batch search

`POST /batch/person/search` takes the same filter fields and operators as
[Person Search](https://docs.crustdata.com/person-docs/search/reference.md), with one extra rule: the top
level of `filters` **must** be an `{op, conditions}` group — a bare
`{field, type, value}` condition is rejected with `400`.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/batch/person/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "op": "and",
      "conditions": [
        {"field": "experience.employment_details.current.title", "type": "(.)", "value": "engineer"}
      ]
    },
    "max_results": 2,
    "fields": ["basic_profile.name", "basic_profile.current_title"]
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "batch_id": "a9afc353-8876-4e64-8b84-02a599561021",
    "status": "pending",
    "entity": "person",
    "action": "search",
    "identifier_count": 1,
    "entities_requested": 1,
    "status_url": "/batch/a9afc353-8876-4e64-8b84-02a599561021"
}
```

Search jobs always report `identifier_count: 1` — the one query. When the job
completes, the downloaded file contains flat records with exactly the
requested fields:

```json The results file (all records) theme={"theme":"vitesse-black"}
{"basic_profile": {"current_title": "Principal Software Engineer", "name": "Man Sum Simon Yuen"}}
{"basic_profile": {"current_title": "Knowledge Systems Architect · Context Engineer", "name": "Emily Anderson"}}
```

#### Nest groups for or-logic

Groups nest inside `conditions`. This finds engineers in either the United
States or Canada:

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/batch/person/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "op": "and",
      "conditions": [
        {"field": "experience.employment_details.current.title", "type": "(.)", "value": "engineer"},
        {
          "op": "or",
          "conditions": [
            {"field": "basic_profile.location.country", "type": "=", "value": "United States"},
            {"field": "basic_profile.location.country", "type": "=", "value": "Canada"}
          ]
        }
      ]
    },
    "max_results": 2,
    "fields": ["basic_profile.name", "basic_profile.location.country"]
  }'
```

```json The results file (all records) theme={"theme":"vitesse-black"}
{"basic_profile": {"location": {"country": "United States"}, "name": "Emily Anderson"}}
{"basic_profile": {"location": {"country": "United States"}, "name": "Michael Phillips"}}
```

> [!TIP]
>
> Exact-match values must match the **indexed** value — both `"United States"`
> and `"United States of America"` exist as `basic_profile.location.country`
> values. Use an `or` group or [Person
> Autocomplete](https://docs.crustdata.com/person-docs/autocomplete/introduction.md) to discover indexed
> values first.

#### Two warnings before you submit large jobs

> [!WARNING]
>
> Unknown filter field names are **not rejected at submit time** the way
> non-batch search rejects them — a typo in `field` simply produces a job that
> completes with 0 results. Double-check field names against the [search
> reference](https://docs.crustdata.com/person-docs/search/reference.md) first.

> [!WARNING]
>
> Do not pass a non-empty `sorts` array — the job will complete with **0
> results**. Sort the downloaded file instead, for example `jq -s
>       'sort_by(.basic_profile.name) | .[]' results.jsonl`.

### Errors

```json 400 — no filters theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "`filters` must be provided for search",
        "metadata": []
    }
}
```

```json 400 — bare condition instead of a group theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Invalid filter shape: [{'type': 'missing', 'loc': ('op',), 'msg': 'Field required', ...}]",
        "metadata": []
    }
}
```

***

## Batch live search

> [!NOTE]
>
> Batch live search is available to accounts with the `live` entitlement. The
> [Batch search](#batch-search) endpoint above is generally available.

```
POST https://api.crustdata.com/batch/person/professional_network/search/live
```

Batch live search runs one query asynchronously and delivers the **entire
result set** as a single file, with results retrieved from the web in real
time. Where [Person Live Search](https://docs.crustdata.com/person-docs/search/live-search.md) returns one
cursor page per call, a batch job walks every page for you.

For results served from the indexed database — higher caps and faster — see
[Batch search](#batch-search) above.

### How batch live search differs from non-batch search

* **One query, whole result set.** You submit a single query; the job paginates server-side until `max_results` is reached or the matches run out.
* **`max_results` is the only volume control.** It clamps to **1,000** and defaults to that cap when omitted. Values above the cap are silently clamped; zero or negative values return `400`. The non-batch paging knobs — `limit`, `page`, `preview` — are silently ignored.
* **Flat records.** Each line in the results file has exactly the non-batch search record shape. No envelope.
* **Exact field projection.** When you pass `fields`, each record contains exactly those fields — nothing more. Omit `fields` to get every field your account can read.

### Live batch search

`POST /batch/person/professional_network/search/live` retrieves results from
the web in real time — fresher than the database, capped at **1,000** records
per job, fetched internally in pages of 25, and slower. Live jobs are the most
likely to end `failed` with an `error_message`.

Live filters use a **flat list** of `{field, type, value}` objects — not the
`{op, conditions}` group — and `field` takes an uppercase filter type instead
of a dotted path:

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/batch/person/professional_network/search/live \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": [
      {"field": "CURRENT_TITLE", "type": "in", "value": ["Software Engineer"]},
      {"field": "REGION", "type": "in", "value": ["United States"]}
    ],
    "max_results": 2,
    "fields": ["basic_profile.name", "basic_profile.headline"]
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "batch_id": "65de822c-f7d3-4b4c-af89-ef683704889e",
    "status": "pending",
    "entity": "person",
    "action": "search_live",
    "identifier_count": 1,
    "entities_requested": 1,
    "status_url": "/batch/65de822c-f7d3-4b4c-af89-ef683704889e"
}
```

```json The results file (all records) theme={"theme":"vitesse-black"}
{"basic_profile": {"headline": "Full-Stack Software Developer | Spring Boot | Angular | MySQL | Java | TypeScript | US Citizen", "name": "Sael Torres - Diaz"}}
{"basic_profile": {"headline": "Software Engineer - Frontend / Backend / TypeScript / JavaScript / React / Nest.js / Angular / Spring. Authorized to work in the USA without a current/future sponsorship.", "name": "Daniel Ignatyev"}}
```

Valid filter types: `CURRENT_COMPANY`, `PAST_COMPANY`, `CURRENT_TITLE`,
`PAST_TITLE`, `SCHOOL`, `COMPANY_HEADQUARTERS`, `COMPANY_HEADCOUNT`,
`COMPANY_TYPE`, `FUNCTION`, `INDUSTRY`, `NUM_OF_FOLLOWERS`, `REGION`,
`SENIORITY_LEVEL`, `YEARS_AT_CURRENT_COMPANY`, `YEARS_IN_CURRENT_POSITION`,
`YEARS_OF_EXPERIENCE`, `FOLLOWER_OF`, `CONNECTION_OF`, `KEYWORD`,
`FIRST_NAME`, `LAST_NAME`,
`NETWORK_DEGREE`, `PROFILE_LANGUAGE`, `SERVICE_CATEGORY`, `CONTACT_INTEREST` —
the same filters as the non-batch
[Person Live Search](https://docs.crustdata.com/person-docs/search/live-search.md), which documents
per-filter value formats. An unknown filter type returns `400` listing the
valid values.

`filters` is required. Omitting it returns `400`.

### Errors

```json 400 — group instead of a flat list theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "`filters` for live search must be a list of {field, type, value} objects",
        "metadata": []
    }
}
```

***

<Snippet file="batch-job-lifecycle.mdx" />

<Snippet file="batch-errors.mdx" />

***

## What to do next

* **Build queries interactively first** — iterate with [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md) or [Person Live Search](https://docs.crustdata.com/person-docs/search/live-search.md) page by page, then submit the final query as a batch job.
* **Look up operators and fields** — see the [search reference](https://docs.crustdata.com/person-docs/search/reference.md).
* **Enrich the people you found** — see [Batch Person Enrich](https://docs.crustdata.com/person-docs/enrichment/batch-enrich.md) or [Batch Person Live Enrich](https://docs.crustdata.com/person-docs/enrichment/batch-enrich.md).
* **Search companies in batch** — see [Batch Company Search](https://docs.crustdata.com/company-docs/search/batch-search.md) or [Batch Company Live Search](https://docs.crustdata.com/company-docs/search/batch-search.md).
* **Search jobs in batch** — see [Batch Job Search](https://docs.crustdata.com/job-docs/search/batch-search.md).
* **Full schema** — see the [API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md).


## Related topics

- [Batch Company Search API](https://docs.crustdata.com/company-docs/search/batch-search.md)
- [Batch Job Postings Search API](https://docs.crustdata.com/job-docs/search/batch-search.md)
- [People Search API](https://docs.crustdata.com/person-docs/search/introduction.md)
- [Semantic People Search API](https://docs.crustdata.com/guides/person-semantic-search.md)
- [Batch Search Person](https://docs.crustdata.com/api-reference/batch-apis/submit-a-batch-person-database-search-job.md)
