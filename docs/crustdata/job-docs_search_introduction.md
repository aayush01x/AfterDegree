> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Job Postings Search API

> Query the indexed Crustdata job dataset with structured filters, cursor-based pagination, sorting, field selection, and aggregations.

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | All plans. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | Yes, with the free credits every new self-serve account gets |
| **Credit cost** | 0.03 credits per result |
| **Rate limit** | 30 requests per minute |

**Use this when** you need to find, segment, or count job listings across
the full Crustdata job dataset — for hiring-trend analysis, building target
account lists from recent hiring activity, monitoring specific roles, or
powering a dashboard.

This page walks you through the basics: the job record mental model, your
first search, the response shape, and choosing a search pattern, then folds
in worked example recipes you can copy, paste, and adapt. For filter grammar,
operators, and the full field catalog, see [Search reference](https://docs.crustdata.com/job-docs/search/reference.md).

> [!NOTE]
>
> **`metadata.date_added` is the job-posted date: the date the listing was
> added on the source portal.** Every query in this page that filters on
> `metadata.date_added` is asking about **job-posted time**, not Crustdata
> indexing time. Treat this endpoint as a query interface over Crustdata's
> indexed dataset, not as a direct poll of an employer-managed listings feed.

```
POST https://api.crustdata.com/job/search
```

> [!NOTE]
>
> Replace `YOUR_API_KEY` in each example with your actual API key. All
> requests require the `x-api-version: 2025-11-01` header.

> [!NOTE]
>
> **Pulling every listing for a set of companies?** Submit an asynchronous
> [batch job-listings search](https://docs.crustdata.com/api-reference/batch-apis/submit-a-batch-job-listings-search-job.md)
> instead — up to 10 companies per job, with the complete result set
> delivered as a single downloadable file.

## Job record mental model

Every job listing returned by Search Jobs is a single `Job` object with five
top-level groups:

* **`crustdata_job_id` and `job_details`** — The stable job id plus the
  posting's own metadata: title, category, URL, workplace type, source
  platform, employment type, and number of openings.
* **`company`** — The hiring company's firmographics at index time: basic
  info, headcount, followers, revenue, funding, locations, and competitors.
  No extra `/company/enrich` call required.
* **`location`** — The job's advertised location (city, state, country, raw
  string), not the company HQ.
* **`content`** — Full job description text. Use `[.]` on
  `content.description` to find an exact keyword or brand, and `(.)` for
  multi-word descriptive matching (`(.)` is typo-tolerant, so a single
  keyword can match lookalike words).
* **`metadata`** — Job timing metadata: `date_added` for the date the
  listing was posted (added on the source portal) and `date_updated` for
  the most recent refresh. These are your primary sort and filter fields
  for recent windows.

> [!NOTE]
>
> **Jobs ID cheat sheet.** The Jobs APIs use three id concepts — keep them straight:
>
> * **`crustdata_job_id`** — the Crustdata job identifier. Returned on every `Job`. Use it as your dedupe key.
> * **`company.basic_info.crustdata_company_id`** — the Crustdata company identifier returned on every `Job`.
> * **`company.basic_info.company_id`** (filter alias) — the dot-path used in `filters` and `aggregations.column` for indexed [Search Jobs](https://docs.crustdata.com/job-docs/search/introduction.md). It points to the same integer as `company.basic_info.crustdata_company_id`. This alias is **not sortable**; for deterministic pagination, sort on `metadata.date_added` instead.
>
> When you `group_by` on `company.basic_info.company_id`, each bucket also returns `metadata.company_name`, `metadata.company_website_domain`, and `metadata.linkedin_id` for labeling.

## At a glance

| Detail | Value |
| - | - |
| **Endpoint** | `POST https://api.crustdata.com/job/search` |
| **Auth** | `Authorization: Bearer YOUR_API_KEY` |
| **API version** | `x-api-version: 2025-11-01` header (required) |
| **Body** | **Required.** Send `{}` to match the whole dataset; every realistic query uses `filters`. |
| **Body keys** | `filters`, `cursor`, `limit` (0–1000, default 20), `sorts`, `fields`, `aggregations` — all optional |
| **Response** | `{ "job_listings": [ Job, ... ], "next_cursor": string?, "total_count": integer?, "aggregations"?: [ ... ] }` |
| **Errors** | `400` invalid request · `401` unauthorized · `500` internal |

### Guaranteed contract vs current behavior

| Topic | What it means |
| - | - |
| Endpoint, HTTP method, auth headers | `POST /job/search`, bearer auth, `x-api-version: 2025-11-01`. |
| Request body shape | Optional `filters`, `cursor`, `limit`, `sorts`, `fields`, `aggregations`. `filters` is a `SearchCondition` or a `SearchConditionGroup`. |
| Response body shape | `{ "job_listings", "next_cursor", "total_count", "aggregations"? }`. Aggregation-only queries return `"job_listings": []`. |
| Supported operators | `=`, `!=`, `<`, `=<`, `>`, `=>`, `in`, `not_in`, `(.)`, `[.]`. See [Filter operators](https://docs.crustdata.com/job-docs/search/reference.md#filter-operators). |
| `limit` bounds and default | Minimum `0`, maximum `1000`, default `20`. Set `limit: 0` when you only want aggregations. |
| Error status codes | `400`, `401`, `500`. |
| Indexed-field allowlist | Only indexed fields can appear in `filters`, `sorts`, or `aggregations.field`. See [Reference](https://docs.crustdata.com/job-docs/search/reference.md) for the detailed catalog, or [Common indexed fields](https://docs.crustdata.com/job-docs/search/reference.md#common-indexed-fields) for the most-used subset. |
| Pricing and rate limits | See [Pricing](https://docs.crustdata.com/general/pricing.md) and [Rate limits](https://docs.crustdata.com/general/rate-limits.md) for current numbers. |

> [card] [Examples](#examples)
>
> Worked examples like "SDR hiring in mid-market", "companies that closed
> Series B", and full-text keyword hunts.

> [card] [Pagination & sorting](https://docs.crustdata.com/job-docs/search/reference.md#pagination--sorting)
>
> Sorting, cursor-based pagination, field selection, and aggregations with
> `count` and `group_by`.

> [card] [Reference](https://docs.crustdata.com/job-docs/search/reference.md)
>
> Common indexed fields, annotated `Job` example, full field catalog, id
> map, bucket metadata, errors.

## Request body

| Parameter | Type | Required | Default | Description |
| - | - | - | - | - |
| `filters` | object | No | — | Single `SearchCondition` or nested `SearchConditionGroup`. Omit to match all indexed jobs. |
| `cursor` | string | No | — | Opaque cursor from a prior response's `next_cursor`. Pass it to fetch the next page with the same filter, sort, and field set. |
| `limit` | integer | No | `20` | Rows per page. Min `0`, max `1000`. Use `0` for aggregation-only queries. |
| `sorts` | array of `SearchSort` | No | — | Ordering rules. Each item has `field` (dot-path) and `order` (`asc` or `desc`). Sorts are applied in array order. |
| `fields` | string\[] | No | all fields | Dot-paths to include in each returned job. Omit to return everything. Always specify `fields` in production for smaller payloads and faster responses. |
| `aggregations` | array of `AggregationRequest` | No | — | Roll-up queries. Supports `count` and `group_by`. Use with `limit: 0` if you only want counts. |

### Response body

| Field | Type | Description |
| - | - | - |
| `job_listings` | `Job[]` | Matching job listings for the current page. Empty array `[]` when `limit` is `0` or when an aggregation-only query is made. |
| `next_cursor` | string or null | Opaque cursor to fetch the next page. `null` when there are no more pages. |
| `total_count` | integer or null | Total number of jobs matching the filter across all pages. Can be `null` for very broad queries where computing an exact total would be prohibitively expensive — never assume it is populated. |
| `aggregations` | array | Aggregation results, present only when the request included an `aggregations` array. |

### Rate limits and credits

> [!NOTE]
>
> Current pricing for indexed Jobs Search:

**Pricing:** `0.03 credits per result returned`. A
request with no results does not consume credits.
To see the price for your account, open the [**Pricing** tab](https://app.crustdata.com/endpoints/job-search#pricing) in the dashboard.

> [!NOTE]
>
> Default `rate-limit` is 30 requests per minute. Send an email to
> [gtm@crustdata.co](mailto:gtm@crustdata.co) to discuss higher limits if
> needed for your use case.

***

## Your first search: filter by company and title

Find the most recent Software Engineer listings at Stripe (filtered via the
`company.basic_info.company_id` alias, which maps to `crustdata_company_id = 631394`).

```bash curl theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/job/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "op": "and",
      "conditions": [
        { "field": "company.basic_info.company_id", "type": "=", "value": 631394 },
        { "field": "job_details.title",              "type": "=", "value": "Software Engineer" }
      ]
    },
    "fields": [
      "job_details.title",
      "job_details.url",
      "company.basic_info.name",
      "location.raw",
      "metadata.date_added"
    ],
    "sorts": [
      { "field": "metadata.date_added", "order": "desc" }
    ],
    "limit": 2
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "job_listings": [
        {
            "company": { "basic_info": { "name": "Stripe" } },
            "job_details": {
                "title": "Software Engineer",
                "url": "https://www.linkedin.com/jobs/view/4342849906"
            },
            "location": { "raw": "United States" },
            "metadata": { "date_added": "2025-12-10T15:57:16" }
        },
        {
            "company": { "basic_info": { "name": "Stripe" } },
            "job_details": {
                "title": "Software Engineer",
                "url": "https://www.linkedin.com/jobs/view/4302655996"
            },
            "location": { "raw": "Dublin, County Dublin, Ireland" },
            "metadata": { "date_added": "2025-09-23T13:52:55" }
        }
    ],
    "next_cursor": "H4sIAJKOKmoC_xXMSw4CIQwA0KsQ1rNowbbUqxgzgQKZhZE4n4Ux3t1x__I-_nW09T0veVv81XnixFYYFTg3JO2qQDUUNjGG3hjImqiVEFECYr1IN-ylBhW23P3k_DbW_bxuKJQ4EgkBwOQihiiCdD_JPvb8mG0cz7_E9P0BNbRcOogAAAA=",
    "total_count": 18
}
```

> [!TIP]
>
> **Always send `fields`.** The full `Job` schema is large (firmographics +
> location + description + metadata). Fetching only the dot-paths you need
> keeps responses small, fast, and predictable.

***

## Which search pattern should I use?

> [tab] I want to explore the dataset
>
> Use **Search Jobs**. You can slice millions of indexed job listings by
> company, title, category, location, date, or any other indexed field — and
> roll up results with `count` or `group_by` aggregations. Pair it with
> cursor-based pagination to walk through large result sets.

> [tab] I only have a company domain or name
>
> Call [`POST /company/identify`](https://docs.crustdata.com/company-docs/identify/introduction) first to resolve
> the domain, name, or profile URL into a `crustdata_company_id`, then use
> that id in your Jobs Search filters.

> [tab] I don't know the exact value to filter on
>
> Use [Autocomplete](https://docs.crustdata.com/job-docs/autocomplete/introduction.md) to discover valid
> values for a field — start typing a title, category, or company name and get
> back matching values you can drop straight into a Search Jobs filter.

> [tab] I want only counts, not job rows
>
> Pass `"limit": 0` and an `aggregations` array to Search Jobs. You get the
> total match count (and optional `group_by` buckets) without consuming any
> row payload. See
> [Aggregations](https://docs.crustdata.com/job-docs/search/reference.md#aggregations) for examples.

> [tab] I want a repeatable account list
>
> Stay on Search Jobs and filter by indexed company, title, category,
> funding, location, or date fields. Use cursor pagination to walk the full
> result set and dedupe companies with
> `company.basic_info.crustdata_company_id`.

> [tab] I want fresh live listings for one company
>
> Use [Live Search](https://docs.crustdata.com/job-docs/search/live-search.md) to fetch fresh job
> listings directly from a single company's source profile. Narrow by
> design — one company per call, no filters, no pagination.

***

## Examples

Worked recipes you can copy, paste, and adapt. Each example is a full working
request. For the core walkthrough (job record mental model, your first search,
choosing a search pattern), see the sections above. For filter grammar,
operators, and the full field catalog, see [Search reference](https://docs.crustdata.com/job-docs/search/reference.md).
For sorting, pagination, field selection, and aggregations, see
[Pagination & sorting](https://docs.crustdata.com/job-docs/search/reference.md#pagination--sorting).

> [accordion] SDR / BDR keyword search across multiple companies
>
> > [!TIP]
> >
> > The long forms `"Sales Development Representative"` and `"Business
> >           Development Representative"` use `(.)` (all-words match), but the short
> > acronym `"SDR"` uses `[.]` (exact phrase). Short acronyms with `(.)`
> > can overmatch — e.g. `"SDR"` would also match `"USDR"`. Use `[.]` for
> > 2–3 character acronyms.
>
> ```bash curl theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/job/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "company.basic_info.company_id", "type": "in", "value": [631394, 631811, 673947] },
>         { "field": "metadata.date_added",           "type": "=>", "value": "2025-01-01" },
>         {
>           "op": "or",
>           "conditions": [
>             { "field": "job_details.title", "type": "(.)", "value": "Sales Development Representative" },
>             { "field": "job_details.title", "type": "[.]", "value": "SDR" },
>             { "field": "job_details.title", "type": "(.)", "value": "Business Development Representative" }
>           ]
>         }
>       ]
>     },
>     "fields": [
>       "job_details.title",
>       "company.basic_info.name",
>       "location.raw",
>       "metadata.date_added"
>     ],
>     "sorts": [{ "field": "metadata.date_added", "order": "desc" }],
>     "limit": 2
>   }'
> ```

> [accordion] Companies indexing both Software Engineers and Account Executives
>
> Because filters operate on individual job rows, you cannot ask for
> "companies with both roles" in a single query. Instead, run two
> bounded-window aggregations and intersect the company ids client-side.
>
> > [!TIP]
> >
> > **Watch out for short-acronym false positives.** `(.)` is an all-words
> > match, so a query of `"AE"` in `job_details.title` can also match
> > unrelated titles. Prefer `[.]` for 2–3 character acronyms.
>
> **1. Query 1 — companies with Software Engineer listings**
>
> ```json theme={"theme":"vitesse-black"}
> {
>     "filters": {
>         "op": "and",
>         "conditions": [
>             { "field": "metadata.date_added", "type": "=>", "value": "2025-01-01" },
>             { "field": "metadata.date_added", "type": "<", "value": "2026-01-01" },
>             {
>                 "op": "or",
>                 "conditions": [
>                     { "field": "job_details.title", "type": "(.)", "value": "Software Engineer" },
>                     { "field": "job_details.title", "type": "[.]", "value": "SWE" }
>                 ]
>             }
>         ]
>     },
>     "limit": 0,
>     "aggregations": [
>         { "type": "group_by", "field": "company.basic_info.company_id", "agg": "count", "size": 500 }
>     ]
> }
> ```
>
> **2. Query 2 — companies with Account Executive listings**
>
> ```json theme={"theme":"vitesse-black"}
> {
>     "filters": {
>         "op": "and",
>         "conditions": [
>             { "field": "metadata.date_added", "type": "=>", "value": "2025-01-01" },
>             { "field": "metadata.date_added", "type": "<", "value": "2026-01-01" },
>             {
>                 "op": "or",
>                 "conditions": [
>                     { "field": "job_details.title", "type": "(.)", "value": "Account Executive" },
>                     { "field": "job_details.title", "type": "[.]", "value": "AE" }
>                 ]
>             }
>         ]
>     },
>     "limit": 0,
>     "aggregations": [
>         { "type": "group_by", "field": "company.basic_info.company_id", "agg": "count", "size": 500 }
>     ]
> }
> ```
>
> **3. Intersect the company ids client-side**
>
> ```python theme={"theme":"vitesse-black"}
> engineering_ids = {b["key"] for b in response_1["aggregations"][0]["buckets"]}
> ae_ids = {b["key"] for b in response_2["aggregations"][0]["buckets"]}
>
> both = engineering_ids & ae_ids
> ```

> [accordion] Mid-market companies indexing SDR listings
>
> Combine an inclusive headcount range with keyword search on the title field.
>
> ```json theme={"theme":"vitesse-black"}
> {
>     "filters": {
>         "op": "and",
>         "conditions": [
>             { "field": "company.headcount.total", "type": "=>", "value": 51 },
>             { "field": "company.headcount.total", "type": "=<", "value": 500 },
>             { "field": "metadata.date_added", "type": "=>", "value": "2025-01-01" },
>             {
>                 "op": "or",
>                 "conditions": [
>                     { "field": "job_details.title", "type": "(.)", "value": "Sales Development Representative" },
>                     { "field": "job_details.title", "type": "[.]", "value": "SDR" },
>                     { "field": "job_details.title", "type": "(.)", "value": "Business Development Representative" }
>                 ]
>             }
>         ]
>     },
>     "fields": [
>         "crustdata_job_id",
>         "job_details.title",
>         "company.basic_info.crustdata_company_id",
>         "company.basic_info.name",
>         "company.basic_info.primary_domain",
>         "company.headcount.total",
>         "location.raw",
>         "metadata.date_added"
>     ],
>     "sorts": [{ "field": "metadata.date_added", "order": "desc" }],
>     "limit": 50
> }
> ```

> [accordion] Companies that closed a Series B between two dates and are indexing new listings
>
> ```json theme={"theme":"vitesse-black"}
> {
>     "filters": {
>         "op": "and",
>         "conditions": [
>             { "field": "company.funding.last_round_type", "type": "=", "value": "series_b" },
>             { "field": "company.funding.last_fundraise_date", "type": "=>", "value": "2025-01-01" },
>             { "field": "company.funding.last_fundraise_date", "type": "<", "value": "2025-07-01" },
>             { "field": "metadata.date_added", "type": "=>", "value": "2025-01-01" }
>         ]
>     },
>     "fields": [
>         "job_details.title",
>         "company.basic_info.crustdata_company_id",
>         "company.basic_info.name",
>         "company.basic_info.primary_domain",
>         "company.funding.last_round_type",
>         "company.funding.last_fundraise_date",
>         "company.funding.total_investment_usd"
>     ],
>     "sorts": [
>         { "field": "company.funding.last_fundraise_date", "order": "desc" }
>     ],
>     "limit": 100
> }
> ```

> [accordion] Hiring volume by workplace type in the United States
>
> > [!WARNING]
> >
> > **Country values are not normalized.** `location.country` can appear as
> > `"USA"`, `"United States"`, or `"United States of America"`. The `in`
> > array below covers the three most common forms, but for full coverage
> > you should first run a `group_by` on `location.country` and collect the
> > exact bucket keys present in your dataset slice.
>
> ```json theme={"theme":"vitesse-black"}
> {
>     "filters": {
>         "op": "and",
>         "conditions": [
>             {
>                 "field": "location.country",
>                 "type": "in",
>                 "value": ["USA", "United States", "United States of America"]
>             },
>             { "field": "metadata.date_added", "type": "=>", "value": "2025-01-01" },
>             { "field": "metadata.date_added", "type": "<", "value": "2026-01-01" }
>         ]
>     },
>     "limit": 0,
>     "aggregations": [
>         { "type": "group_by", "field": "job_details.workplace_type", "agg": "count", "size": 10 }
>     ]
> }
> ```

> [accordion] Filter listings by source platform and employment type
>
> `job_details.source` identifies the platform each posting comes from —
> `professional_network`, or the platform of the company job board that
> published it (`workday`, `smartrecruiters`, `greenhouse`, `workable`,
> `lever`, `icims`, `ashby`, `rippling`, `yc`). Use `in` to keep only postings
> from specific job-board platforms, and pair it with
> `job_details.employment_type` to keep only the
> declared employment type.
>
> ```bash curl theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/job/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "job_details.source",          "type": "in", "value": ["greenhouse", "lever", "ashby"] },
>         { "field": "job_details.employment_type", "type": "=",  "value": "full_time" },
>         { "field": "metadata.date_added",         "type": "=>", "value": "2026-01-01" }
>       ]
>     },
>     "fields": [
>       "crustdata_job_id",
>       "job_details.title",
>       "job_details.source",
>       "job_details.employment_type",
>       "job_details.url",
>       "company.basic_info.name",
>       "location.raw",
>       "metadata.date_added"
>     ],
>     "sorts": [{ "field": "metadata.date_added", "order": "desc" }],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "job_listings": [
>         {
>             "company": { "basic_info": { "name": "Brotherhood Crusade" } },
>             "crustdata_job_id": 7490363025689380,
>             "job_details": {
>                 "employment_type": "full_time",
>                 "source": "lever",
>                 "title": "Director, Employment Services",
>                 "url": "https://jobs.lever.co/brotherhoodcrusade/34093131-8d82-4dc2-bcf5-dcf765de5f9f"
>             },
>             "location": { "raw": "Los Angeles, CA" },
>             "metadata": { "date_added": "2026-07-24T19:54:49" }
>         },
>         {
>             "company": { "basic_info": { "name": "Filevine" } },
>             "crustdata_job_id": 8481514540418341,
>             "job_details": {
>                 "employment_type": "full_time",
>                 "source": "lever",
>                 "title": "Sales Performance Data Analyst",
>                 "url": "https://jobs.lever.co/filevine/4b142eb0-be3a-4a09-bc05-944cf1569833"
>             },
>             "location": { "raw": "United States" },
>             "metadata": { "date_added": "2026-07-23T23:04:58" }
>         }
>     ],
>     "next_cursor": "H4sIAC90ZGoC_x...",
>     "total_count": 57403
> }
> ```
>
> > [!TIP]
> >
> > `job_details.employment_type` is currently populated for most postings
> > published on company job boards and is `null` for now when `source` is
> > `professional_network`, so combine it with a `source` filter as shown
> > above. See the
> > [Job details catalog](https://docs.crustdata.com/job-docs/search/reference.md#job-details-job_details)
> > for both value vocabularies.

> [accordion] Hiring volume by source platform
>
> Group by `job_details.source` to see how many matching listings each source
> platform contributes. Each bucket key is one `source` value. Sent without
> `filters`, it profiles the whole dataset; add `filters` to profile any slice.
>
> ```bash curl theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/job/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "limit": 0,
>     "aggregations": [
>       { "type": "group_by", "field": "job_details.source", "agg": "count", "size": 10 }
>     ]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "job_listings": [],
>     "next_cursor": null,
>     "total_count": 48713983,
>     "aggregations": [
>         {
>             "type": "group_by",
>             "field": "job_details.source",
>             "buckets": [
>                 { "key": "professional_network", "count": 45699178 },
>                 { "key": "workday", "count": 1696836 },
>                 { "key": "smartrecruiters", "count": 581815 },
>                 { "key": "greenhouse", "count": 250725 },
>                 { "key": "workable", "count": 151311 },
>                 { "key": "lever", "count": 123552 },
>                 { "key": "icims", "count": 106868 },
>                 { "key": "ashby", "count": 76885 },
>                 { "key": "rippling", "count": 21350 },
>                 { "key": "yc", "count": 5463 }
>             ]
>         }
>     ]
> }
> ```
>
> > [!NOTE]
> >
> > Buckets only appear for `source` values with at least one matching
> > listing, so a filtered query can return fewer than 10 buckets. Counts
> > drift as the dataset is refreshed.

> [accordion] Full-text keyword hunt in job descriptions
>
> ```json theme={"theme":"vitesse-black"}
> {
>     "filters": {
>         "op": "and",
>         "conditions": [
>             { "field": "content.description", "type": "[.]", "value": "kubernetes" },
>             { "field": "metadata.date_added", "type": "=>", "value": "2025-01-01" }
>         ]
>     },
>     "fields": [
>         "job_details.title",
>         "company.basic_info.name",
>         "location.raw",
>         "metadata.date_added"
>     ],
>     "sorts": [{ "field": "metadata.date_added", "order": "desc" }],
>     "limit": 20
> }
> ```

> [accordion] Count matching jobs without returning rows
>
> To get just the total number of jobs matching a filter, send a `count`
> aggregation with `limit: 0`. No job rows are returned, so the call consumes
> no per-result credits, and the total comes back in both `total_count` and the
> aggregation `value`.
>
> ```bash curl theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/job/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "company.basic_info.company_id", "type": "=",   "value": 631394 },
>         { "field": "job_details.title",             "type": "(.)", "value": "Software Engineer" }
>       ]
>     },
>     "limit": 0,
>     "aggregations": [ { "type": "count" } ]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "job_listings": [],
>     "next_cursor": null,
>     "total_count": 549,
>     "aggregations": [{ "type": "count", "field": null, "value": 549 }]
> }
> ```
>
> > [!TIP]
> >
> > For a simple total, read `total_count`. The `count` aggregation returns the
> > same number in `aggregations[0].value` and is handy when you send it
> > alongside other aggregations in one request.

> [accordion] Exact-title match across companies
>
> Use `in` on `job_details.title` when you want listings whose title is exactly
> one of a known set — for example a normalized list of sales titles across a
> target account list. This is the precise alternative to fuzzy `(.)` all-words
> matching.
>
> ```bash curl theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/job/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "company.basic_info.company_id", "type": "in", "value": [631394, 680992, 673947] },
>         { "field": "metadata.date_added",           "type": "=>", "value": "2025-01-01" },
>         {
>           "field": "job_details.title",
>           "type": "in",
>           "value": [
>             "Account Executive",
>             "Business Development Representative",
>             "Sales Development Representative"
>           ]
>         }
>       ]
>     },
>     "fields": [
>       "job_details.title",
>       "company.basic_info.name",
>       "location.raw",
>       "metadata.date_added"
>     ],
>     "sorts": [{ "field": "metadata.date_added", "order": "desc" }],
>     "limit": 3
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "job_listings": [
>         {
>             "company": { "basic_info": { "name": "Stripe" } },
>             "job_details": { "title": "Sales Development Representative" },
>             "location": { "raw": "Bengaluru, Karnataka, India" },
>             "metadata": { "date_added": "2026-05-20T14:24:08" }
>         }
>     ],
>     "next_cursor": "H4sIACTRQWoC_x...",
>     "total_count": 21
> }
> ```
>
> > [!TIP]
> >
> > `in` matches the **whole** title exactly (case-insensitive), so
> > `"Sales Development Representative"` will not match `"Senior Sales
> >           Development Representative"`. When you want partial or word-level matches
> > instead, use `(.)` for all-words or `[.]` for an exact contiguous phrase.

> [accordion] Rank keyword hits by relevance
>
> When your filter includes a text operator (`(.)`), you can sort by `relevance`
> to surface the strongest title matches first instead of the most recent.
>
> ```bash curl theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/job/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "job_details.title",   "type": "(.)", "value": "machine learning" },
>         { "field": "metadata.date_added", "type": "=>",  "value": "2025-01-01" }
>       ]
>     },
>     "fields": [
>       "job_details.title",
>       "company.basic_info.name",
>       "location.raw",
>       "metadata.date_added"
>     ],
>     "sorts": [{ "field": "relevance", "order": "desc" }],
>     "limit": 3
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "job_listings": [
>         {
>             "company": { "basic_info": { "name": "eTeam" } },
>             "job_details": { "title": "Machine Learning - Machine Learning" },
>             "location": { "raw": "Irvine, California, United States" },
>             "metadata": { "date_added": "2025-11-13T14:26:33" }
>         }
>     ],
>     "next_cursor": "H4sIACTRQWoC_x...",
>     "total_count": 50879
> }
> ```
>
> > [!WARNING]
> >
> > **`relevance` needs a text query.** Sorting by `relevance` without a `(.)`
> > (or `[.]`) text condition in your filter returns `400` with
> > `Unsupported columns in conditions: ['relevance (no text query present)']`.
> > Pair `relevance` with at least one text filter, or sort by
> > `metadata.date_added` instead.

***

## What to do next

* **Discover filter values** — use [Autocomplete](https://docs.crustdata.com/job-docs/autocomplete/introduction.md) to find the exact title, category, or company-name values a filter accepts.
* **Paginate and aggregate** — see [Pagination & sorting](https://docs.crustdata.com/job-docs/search/reference.md#pagination--sorting) for cursor pagination, sorting, field selection, and aggregations.
* **Look up fields** — see [Reference](https://docs.crustdata.com/job-docs/search/reference.md) for the full `Job` catalog, id map, bucket metadata, and errors.
* **Fetch fresh listings for one company** — see [Live Search](https://docs.crustdata.com/job-docs/search/live-search.md).
* **Inspect the full schema** — read the [OpenAPI reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md).


## Related topics

- [Batch Job Postings Search API](https://docs.crustdata.com/job-docs/search/batch-search.md)
- [Capabilities](https://docs.crustdata.com/general/capabilities.md)
- [Data updates](https://docs.crustdata.com/general/data-updates.md)
- [Search Jobs](https://docs.crustdata.com/api-reference/job-apis/search-the-indexed-job-dataset.md)
- [Job Autocomplete API](https://docs.crustdata.com/job-docs/autocomplete/introduction.md)
