> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Batch Company Search API

> Run one company search query asynchronously and receive the whole result set as a single file — from the indexed database (up to 10,000 records) or retrieved from the web in real time (up to 1,000 records).

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | Enterprise plans. Live batch is an add-on. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | No |
| **Credit cost** | Same as Company Search: 0.03 credits per result plus [premium groups](https://docs.crustdata.com/general/pricing.md#premium-fields-in-search). Live batch is 2 credits per company |
| **Batch size** | 10,000 results per job (1,000 for live) |
| **Rate limit** | Up to 5 jobs can run at the same time. |

This page covers two asynchronous batch endpoints:

* [**Batch search**](#batch-search) — results served from the indexed database, higher caps and faster (up to 10,000 records).
* [**Batch live search**](#batch-live-search) — results retrieved from the web in real time, fresher but capped lower (up to 1,000 records).

> [!NOTE]
>
> Batch live search is available on the **live** plan. The [Batch live
> search](#batch-live-search) section below documents its gating and
> behavior.

***

## Batch search

Batch search runs one query asynchronously and delivers the **entire result
set** as a single file. Where
[Company Search](https://docs.crustdata.com/company-docs/search/introduction.md) returns one cursor page
per call, a batch job walks every page for you.

```
POST https://api.crustdata.com/batch/company/search
```

For fresher results retrieved from the web in real time, see
[Batch live search](#batch-live-search) below.

<Snippet file="batch-headers-note.mdx" />

<Snippet file="batch-pricing-callout.mdx" />

***

### How batch search differs from non-batch search

* **One query, whole result set.** You submit a single query; the job paginates server-side until `max_results` is reached or the matches run out.
* **`max_results` is the only volume control.** It clamps to **10,000** and defaults to that cap when omitted. Values above the cap are silently clamped; zero or negative values return `400`. The non-batch paging knobs — `limit`, `page`, `preview` — are silently ignored.
* **Flat records.** Each line in the results file has exactly the non-batch search record shape. No envelope.
* **Exact field projection.** When you pass `fields`, each record contains exactly those fields — nothing more. Omit `fields` to get every field your account can read.

***

### Database batch search

`POST /batch/company/search` takes the same filter fields and operators as
[Company Search](https://docs.crustdata.com/company-docs/search/reference.md), with one extra rule: the top
level of `filters` **must** be an `{op, conditions}` group — a bare
`{field, type, value}` condition is rejected with `400`. Groups nest inside
`conditions` for complex queries.

This finds companies with more than 1,000 employees:

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/batch/company/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "op": "and",
      "conditions": [
        {"field": "headcount.total", "type": ">", "value": 1000}
      ]
    },
    "max_results": 2,
    "fields": ["basic_info.name", "basic_info.primary_domain", "headcount.total"]
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "batch_id": "ee438e6f-7449-481f-9a2d-2ef57ddab24a",
    "status": "pending",
    "entity": "company",
    "action": "search",
    "identifier_count": 1,
    "entities_requested": 1,
    "status_url": "/batch/ee438e6f-7449-481f-9a2d-2ef57ddab24a"
}
```

Search jobs always report `identifier_count: 1` — the one query. When the job
completes, the downloaded file contains flat records with exactly the
requested fields:

```json The results file (all records) theme={"theme":"vitesse-black"}
{"basic_info": {"name": "Aarti Industries Ltd.", "primary_domain": "aarti-industries.com"}, "headcount": {"total": 4923}}
{"basic_info": {"name": "Aditya Birla Capital", "primary_domain": "adityabirlacapital.com"}, "headcount": {"total": 31747}}
```

#### Two warnings before you submit large jobs

> [!WARNING]
>
> Unknown filter field names are **not rejected at submit time** the way
> non-batch search rejects them — a typo in `field` simply produces a job that
> completes with 0 results. Double-check field names against the [search
> reference](https://docs.crustdata.com/company-docs/search/reference.md) first.

> [!WARNING]
>
> Do not pass a non-empty `sorts` array — the job will complete with **0
> results**. Sort the downloaded file instead, for example `jq -s
>       'sort_by(.headcount.total) | reverse | .[]' results.jsonl`.

***

<Snippet file="batch-job-lifecycle.mdx" />

***

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

```json 400 — invalid max_results theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "`max_results` must be a positive integer",
        "metadata": []
    }
}
```

<Snippet file="batch-errors.mdx" />

***

## Batch live search

> [!NOTE]
>
> Batch live search is available on the **live** plan.

Batch live search runs one query asynchronously and delivers the **entire
result set** as a single file, with results retrieved from the web in real
time. Where [Company Live Search](https://docs.crustdata.com/company-docs/search/live-search.md) returns one
cursor page per call, a batch job walks every page for you.

```
POST https://api.crustdata.com/batch/company/professional_network/search/live
```

For results served from the indexed database — higher caps and faster — see
[Batch search](#batch-search) above.

<Snippet file="batch-headers-note.mdx" />

<Snippet file="batch-pricing-callout.mdx" />

***

### How batch live search differs from non-batch search

* **One query, whole result set.** You submit a single query; the job paginates server-side until `max_results` is reached or the matches run out.
* **`max_results` is the only volume control.** It clamps to **1,000** and defaults to that cap when omitted. Values above the cap are silently clamped; zero or negative values return `400`. The non-batch paging knobs — `limit`, `page`, `preview` — are silently ignored.
* **Flat records.** Each line in the results file has exactly the non-batch search record shape. No envelope.
* **Exact field projection.** When you pass `fields`, each record contains exactly those fields — nothing more. Omit `fields` to get every field your account can read.

***

### Live batch search

`POST /batch/company/professional_network/search/live` retrieves results from
the web in real time — fresher than the database, capped at **1,000** records
per job, fetched internally in pages of 25, and slower. Live jobs are the most
likely to end `failed` with an `error_message`.

Live filters use a **flat list** of `{field, type, value}` objects — not the
`{op, conditions}` group — and `field` takes an uppercase filter type instead
of a dotted path:

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/batch/company/professional_network/search/live \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": [
      {"field": "COMPANY_HEADCOUNT", "type": "in", "value": ["11-50"]},
      {"field": "REGION", "type": "in", "value": ["United States"]}
    ],
    "max_results": 2,
    "fields": ["basic_info.name", "headcount.total"]
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "batch_id": "eeba5683-b309-40a8-862d-b89e7ca78276",
    "status": "pending",
    "entity": "company",
    "action": "search_live",
    "identifier_count": 1,
    "entities_requested": 1,
    "status_url": "/batch/eeba5683-b309-40a8-862d-b89e7ca78276"
}
```

```json The results file (all records) theme={"theme":"vitesse-black"}
{"basic_info": {"name": "Annie Rose Inc"}, "headcount": {"total": 31}}
{"basic_info": {"name": "Stanford Law Review"}, "headcount": {"total": 18}}
```

Valid filter types: `INDUSTRY`, `COMPANY_HEADCOUNT`, `REGION`,
`COMPANY_HEADQUARTERS`, `ANNUAL_REVENUE`, `NUM_OF_FOLLOWERS`, `FORTUNE`,
`DEPARTMENT_HEADCOUNT`, `DEPARTMENT_HEADCOUNT_GROWTH`,
`COMPANY_HEADCOUNT_GROWTH`, `KEYWORD`, `ACCOUNT_ACTIVITIES`,
`JOB_OPPORTUNITIES` — the same filters as the non-batch
[Company Live Search](https://docs.crustdata.com/company-docs/search/live-search.md), which documents
per-filter value formats. An unknown filter type returns `400` listing the
valid values.

Company filters additionally support the `between` match type with an object
value and an optional `sub_filter` qualifier:

```json A between filter theme={"theme":"vitesse-black"}
{"field": "ANNUAL_REVENUE", "type": "between", "value": {"min": 1, "max": 500}, "sub_filter": "USD"}
```

`filters` is required. Omitting it returns `400`.

***

<Snippet file="batch-job-lifecycle.mdx" />

***

### Errors

```json 400 — invalid max_results theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "`max_results` must be a positive integer",
        "metadata": []
    }
}
```

<Snippet file="batch-errors.mdx" />

***

## What to do next

* **Build queries interactively first** — iterate with [Company Search](https://docs.crustdata.com/company-docs/search/introduction.md) or [Company Live Search](https://docs.crustdata.com/company-docs/search/live-search.md) page by page, then submit the final query as a batch job.
* **Look up operators and fields** — see the [search reference](https://docs.crustdata.com/company-docs/search/reference.md).
* **Enrich the companies you found** — see [Batch Company Enrich](https://docs.crustdata.com/company-docs/enrichment/batch.md).
* **Search people in batch** — see [Batch Person Search](https://docs.crustdata.com/person-docs/search/batch-search.md).
* **Search jobs in batch** — see [Batch Job Search](https://docs.crustdata.com/job-docs/search/batch-search.md).
* **Full schema** — see the [API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md).


## Related topics

- [Batch Search Companies](https://docs.crustdata.com/api-reference/batch-apis/submit-a-batch-company-database-search-job.md)
- [Batch People Search API](https://docs.crustdata.com/person-docs/search/batch-search.md)
- [Batch Job Postings Search API](https://docs.crustdata.com/job-docs/search/batch-search.md)
- [Batch Company Enrichment API](https://docs.crustdata.com/company-docs/enrichment/batch.md)
- [Company Search API](https://docs.crustdata.com/company-docs/search/introduction.md)
