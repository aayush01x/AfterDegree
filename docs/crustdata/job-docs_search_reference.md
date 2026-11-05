> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Jobs Search reference

> Reference for Crustdata Jobs Search: common indexed fields, full field catalog, id map, bucket metadata, and errors.

Reference material for [Search Jobs](https://docs.crustdata.com/job-docs/search/introduction.md): filter
grammar and operators, common indexed fields, the full `Job` catalog, id
semantics, aggregation bucket metadata, null behavior, and errors.

For worked examples, see [Examples](https://docs.crustdata.com/job-docs/search/introduction.md#examples). For sorting,
pagination, field selection, and aggregations, see
[Pagination & sorting](#pagination--sorting).

> [!NOTE]
>
> **Jobs ID cheat sheet.** The Jobs APIs use three id concepts — keep them straight:
>
> * **`crustdata_job_id`** — the Crustdata job identifier. Returned on every `Job`. Use it as your dedupe key.
> * **`company.basic_info.crustdata_company_id`** — the Crustdata company identifier returned on every `Job`.
> * **`company.basic_info.company_id`** (filter alias) — the dot-path used in `filters` and `aggregations.column` for indexed [Search Jobs](https://docs.crustdata.com/job-docs/search/introduction.md). It points to the same integer as `company.basic_info.crustdata_company_id`. This alias is **not sortable**; for deterministic pagination, sort on `metadata.date_added` instead.
>
> When you `group_by` on `company.basic_info.company_id`, each bucket also returns `metadata.company_name`, `metadata.company_website_domain`, and `metadata.linkedin_id` for labeling.

***

## Filter grammar

Every filter describes which **individual job rows** to keep. The API checks
each job listing against your filter independently — it never groups or
combines rows before filtering.

There are two building blocks:

| Building block | What it does |
| - | - |
| **`SearchCondition`** (leaf) | Tests one field on one job row — e.g. `title = "Software Engineer"`. |
| **`SearchConditionGroup`** (node) | Combines conditions with `and` or `or`. Groups can nest inside other groups. |

> [!WARNING]
>
> **Exact-match AND on the same field always returns zero results.** One
> listing has one title, so `(title = "Software Engineer") AND (title =
>       "Account Executive")` can never match. This applies to `=` and `in`.

> [!NOTE]
>
> **All-words operators (`(.)`) work fine in AND.** Because `(.)` checks for
> individual words — not a contiguous substring — a query like `(title (.)
>       "Software Development") AND (title (.) "Software Engineer")` matches any
> title containing all three words "Software", "Development", and "Engineer"
> (e.g. "Software Development Engineer").

> [!TIP]
>
> Need *companies* hiring for both role X **and** role Y (two different
> listings)? Run two separate queries and intersect company ids client-side.
> See [Companies indexing both Software Engineers and Account
> Executives](https://docs.crustdata.com/job-docs/search/introduction.md#examples).

### Single condition

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "field": "job_details.category",
        "type": "=",
        "value": "Engineering"
    }
}
```

### AND / OR group

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "op": "and",
        "conditions": [
            {
                "field": "company.basic_info.company_id",
                "type": "=",
                "value": 631394
            },
            {
                "field": "job_details.category",
                "type": "=",
                "value": "Engineering"
            },
            {
                "field": "metadata.date_added",
                "type": "=>",
                "value": "2025-01-01"
            }
        ]
    }
}
```

### Array-field filters and grouping

> [accordion] Filtering on array fields
>
> When you filter on a string-array field like
> `company.basic_info.industries`, the condition is satisfied if **any**
> element of the array matches.
>
> For example:
>
> ```json theme={"theme":"vitesse-black"}
> { "field": "company.basic_info.industries", "type": "=", "value": "Technology, Information and Internet" }
> ```
>
> This matches any company whose `industries` array contains that
> exact string. Use `(.)` to match words within any element.

> [accordion] Grouping by array fields
>
> When you `group_by` on an array field, each array element becomes
> its own bucket key. A company in two industries contributes one
> count to **each** of the two industry buckets — so the sum of bucket
> counts can exceed `total_count` for array fields.

***

## Filter operators

Use the table below to pick the right `type` for each condition. Every
operator works on indexed fields only.

| Operator | `value` shape | Meaning |
| - | - | - |
| `=` | scalar (string/number/boolean) | Exact match. |
| `!=` | scalar | Not equal. |
| `<` | scalar (numeric or ISO date) | Less than. |
| `=<` | scalar (numeric or ISO date) | Less than or equal. **Not** `<=`. |
| `>` | scalar (numeric or ISO date) | Greater than. |
| `=>` | scalar (numeric or ISO date) | Greater than or equal. **Not** `>=`. |
| `in` | array of scalars | Field value is any entry in the array. |
| `not_in` | array of scalars | Field value is none of the entries in the array. |
| `is_null` | `null` | **Field is null or missing.** The `value` key is required — send `"value": null`; omitting it returns `400`. |
| `is_not_null` | `null` | **Field has a non-null value.** Send `"value": null` — the `value` key is required. |
| `(.)` | string | **Case-insensitive all-words match, with per-word typo tolerance.** Every word in the query is matched somewhere in the field, **not necessarily next to each other or in the same order** — and each word also matches lookalike words within a small edit distance (roughly 1 edit for short words, 2 for longer ones). `"Software Engineer"` matches `"Software Engineer"`, `"Software Development Engineer"`, and `"Engineer, Software Systems"` — but `"vitally"` also matches listings that contain only `"virtually"` or `"finally"`, and `"SDR"` also matches `"USDR"`. Good for broad multi-word matching in `job_details.title` or `content.description`; for a brand, product, or other exact keyword use `[.]`. |
| `[.]` | string | **Case-insensitive exact-phrase match.** The words must appear **contiguously and in order**. `"Software Engineer"` matches `"Senior Software Engineer"` but **not** `"Software Development Engineer"` (extra word in between) and **not** `"Engineer Software"` (wrong order). Use `[.]` when you need precision over recall. |
| `geo_distance` | object (see below) | **Geographic radius include.** Keeps jobs located within `distance` of a center point. Only valid on `location` (or `location.raw` — both target the same geo point). See [Geographic radius filters](#geographic-radius-filters-geo_distance--geo_exclude). |
| `geo_exclude` | object (see below) | **Geographic radius exclude.** Removes jobs located within `distance` of a center point. Same value format and field restrictions as `geo_distance`. |
| `geo_polygon` | object (see below) | **Geographic polygon include.** Keeps jobs located inside a polygon of `[lat, lng]` points. Same field restrictions as `geo_distance`. See [Geographic polygon filter](#geographic-polygon-filter-geo_polygon). |

> [!WARNING]
>
> **Operator footguns.**
>
> * Use `=>` for greater-than-or-equal and `=<` for less-than-or-equal — they are **not** `>=` and `<=`.
> * `in` and `not_in` require **JSON arrays**, not comma-separated strings.
> * `is_null` / `is_not_null` require the `value` key — send `"value": null`. Omitting `value` returns `400`.
> * `geo_distance` / `geo_exclude` only work on `location` and `location.raw`. Using them on any other field, or sending a malformed geo value, returns `500` — see [Errors](#errors).
> * `geo_polygon` has the same field restriction. A malformed polygon returns `400` with a message naming the problem.

### Geographic radius filters (`geo_distance` / `geo_exclude`)

The `value` for `geo_distance` and `geo_exclude` is an object describing a
center point and a radius:

| Key | Type | Required | Description |
| - | - | - | - |
| `location` | string | Yes, unless `lat_lng` is provided | Free-form place name (for example `"San Francisco"`). The API geocodes it into coordinates server-side. |
| `lat_lng` | `[number, number]` | Yes, unless `location` is provided | Explicit `[latitude, longitude]` center point (latitude `-90` to `90`, longitude `-180` to `180`). Takes precedence over `location` when both are sent. |
| `distance` | number | **Yes** | Radius around the center point. Must be positive. |
| `unit` | string | No (default `"km"`) | Distance unit: `"km"`, `"mi"`, `"miles"`, `"m"`, `"meters"`, `"ft"`, or `"feet"`. |

Jobs within 25 km of San Francisco:

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "field": "location",
        "type": "geo_distance",
        "value": { "location": "San Francisco", "distance": 25, "unit": "km" }
    },
    "limit": 5
}
```

US jobs **outside** a 50-mile radius of New York, combining `geo_exclude`
with other conditions in an `and` group:

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "op": "and",
        "conditions": [
            { "field": "location.country", "type": "=", "value": "United States" },
            {
                "field": "location",
                "type": "geo_exclude",
                "value": { "location": "New York", "distance": 50, "unit": "mi" }
            }
        ]
    },
    "limit": 5
}
```

> [!TIP]
>
> If your center point comes from your own geocoder or a map UI, pass
> `lat_lng` directly — for example `{ "lat_lng": [37.7749, -122.4194],
>       "distance": 25 }` — and the server-side geocoding step is skipped.

***

### Geographic polygon filter (`geo_polygon`)

The `value` for `geo_polygon` is an object with a single `points` key:

| Key | Type | Required | Description |
| - | - | - | - |
| `points` | `number[][]` | **Yes** | List of `[latitude, longitude]` pairs, at least 3 distinct points and at most 1,000. Latitude `-90` to `90`, longitude `-180` to `180`. |

The polygon closes itself, so repeating the first point is optional. Edges may
not cross, and no point may be revisited. Points are coordinates, not place
names, and are not geocoded. A polygon that crosses the 180° meridian must
list its points counter-clockwise, or it is read as everything outside it.

Jobs located inside a box over the San Francisco peninsula:

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "field": "location",
        "type": "geo_polygon",
        "value": { "points": [[37.81, -122.52], [37.81, -122.35], [37.70, -122.35], [37.70, -122.52]] }
    },
    "limit": 5
}
```

## Common indexed fields

These are the indexed fields most often used in `filters`, `sorts`, and
`aggregations.field`. This table is a **summary of the most common paths**,
not an authoritative catalog. For the deeper field catalog — including id
semantics, null handling, and bucket metadata — see the full
[Field reference](#field-reference) below.

> [!NOTE]
>
> **Company id filter alias.** The filterable field path uses the short alias
> `company.basic_info.company_id`, but the response shape returns the same
> integer at `company.basic_info.crustdata_company_id`. They point to the same
> value. See [Jobs IDs: a quick map](#jobs-ids-a-quick-map).

> [tab] Job details
>
> | Field | Example |
> | - | - |
> | `job_details.title` | `"Software Engineer"` |
> | `job_details.category` | `"Engineering"`, `"Sales"`, `"Operations"`, `"Others"` |
> | `job_details.workplace_type` | `"Remote"`, `"Hybrid"`, `"On-site"`, `""` |
> | `job_details.source` | `"professional_network"`, `"greenhouse"`, `"workday"` |
> | `job_details.employment_type` | `"full_time"`, `"part_time"`, `"contract"` |
> | `job_details.reposted_job` | `true` / `false` |
> | `job_details.url` | `"https://www.linkedin.com/jobs/view/4398377738"` |

> [tab] Company basic info
>
> | Field | Example |
> | - | - |
> | `company.basic_info.company_id` | `631394` |
> | `company.basic_info.name` | `"Stripe"` |
> | `company.basic_info.primary_domain` | `"stripe.com"` |
> | `company.basic_info.professional_network_id` | `"2135371"` |
> | `company.basic_info.industries` | `["Technology, Information and Internet"]` |

> [tab] Company firmographics
>
> | Field | Example |
> | - | - |
> | `company.headcount.total` | `14522` |
> | `company.headcount.range` | `"5001-10000"` |
> | `company.followers.count` | `1335688` |
> | `company.revenue.estimated.lower_bound_usd` | `500000000` |

> [tab] Location
>
> | Field | Example |
> | - | - |
> | `location.raw` | `"Melbourne, Victoria, Australia"` |
> | `location.country` | `"Australia"` |
> | `location.state` | `"Victoria"` |
> | `location.district` | `"Southbank"` |
> | `location.city` | `"Melbourne"` |
>
> For radius queries ("within 25 km of San Francisco"), filter on `location`
> with the `geo_distance` / `geo_exclude` operators — see
> [Geographic radius filters](#geographic-radius-filters-geo_distance--geo_exclude).

> [tab] Content, metadata, IDs
>
> | Field | Example |
> | - | - |
> | `content.description` | Full job description text. |
> | `crustdata_job_id` | `41053563` |
> | `metadata.date_added` | `"2026-04-07T11:37:29"` |
> | `metadata.date_updated` | `"2026-04-08T00:00:00"` |

> [tab] Technographics
>
> | Field | Example |
> | - | - |
> | `technographics.technologies.name` | `"Snowflake"` |
> | `technographics.technologies.category` | `"data-warehouse"` |
> | `technographics.technologies.super_category` | `"data-analytics"` |
>
> These match the technologies detected **in the posting itself**, not the
> employer's overall stack. They filter only, and are never returned in results.
> See [Technographics (filter-only)](#technographics-filter-only).

> [!NOTE]
>
> Sending a filter on a non-indexed field returns `500` with `Unsupported
>       columns in conditions: ['...']`. Sending an unsupported `group_by` field
> returns a similar `500` listing every supported aggregation field.

***

## Field reference

This section covers the return shape, id semantics, aggregation bucket
metadata, and the most important indexed field catalogs in one place.

### Annotated full `Job` example

> [!NOTE]
>
> The code fence below uses `jsonc` because it includes inline `//` comments
> for annotation. Strip the comments before sending it to a strict JSON
> parser.

```jsonc theme={"theme":"vitesse-black"}
{
    "crustdata_job_id": 41053563, // stable job id (use as dedupe key)
    "job_details": {
        "job_id": 41053563, // mirrors crustdata_job_id
        "title": "Integration Engineer (AUNZ)",
        "category": "Engineering",
        "workplace_type": "",
        "source": "professional_network", // posting source platform — see Job details catalog
        "employment_type": null, // currently populated on postings sourced from company job boards
        "url": "https://www.linkedin.com/jobs/view/4398377738",
        "reposted_job": false,
        "number_of_openings": 1,
    },
    "company": {
        "basic_info": {
            "crustdata_company_id": 631394, // filter with company.basic_info.company_id
            "name": "Stripe",
            "primary_domain": "stripe.com",
            "website": "https://stripe.com",
            "professional_network_id": "2135371",
            "industries": ["Technology, Information and Internet"],
        },
        "locations": {
            "country": "United States",
            "state": "California",
            "city": "South San Francisco",
            "street_address": "354 Oyster Point Blvd, South San Francisco, California, United States",
        },
        "headcount": {
            "total": 7234,
            "range": "5001-10000",
            "largest_headcount_country": "USA",
        },
        "followers": { "count": 1335688 },
        "revenue": {
            "estimated": {
                "lower_bound_usd": 500000000,
                "upper_bound_usd": 1000000000,
            },
            "public_markets": null,
            "acquisition_status": "",
        },
        "funding": {
            "total_investment_usd": 9440247725.0,
            "valuation_usd": 50000000000.0,
            "last_fundraise_date": "2026-03-09T00:00:00",
            "last_round_type": "secondary_market",
            "num_funding_rounds": 23,
            "investors": [
                "Sequoia Capital",
                "Andreessen Horowitz",
                "Founders Fund",
            ],
        },
        "competitors": {
            "websites": ["https://plaid.com", "https://paystack.com"],
        },
    },
    "location": {
        "raw": "Melbourne, Victoria, Australia", // as advertised on the posting
        "city": "Melbourne", // city/state/country are geocoded from raw
        "district": null,
        "state": "Victoria",
        "country": "Australia", // normalized country name
        "pincode": null,
    },
    "content": {
        "description": "Stripe is a financial infrastructure platform for businesses...",
    },
    "metadata": {
        "date_added": "2026-04-07T11:37:29",
        "date_updated": "2026-04-08T00:00:00",
    },
}
```

> [!TIP]
>
> **Nulls are normal.** Nested objects such as `revenue.public_markets`,
> `location.district`, `location.pincode`, and parts of `company.funding` can
> legitimately be `null` or missing.

### Jobs IDs: a quick map

| ID | Lives on | Purpose |
| - | - | - |
| `crustdata_job_id` | Top-level on each `Job` | Crustdata job identifier. Use it as your dedupe key in your own store. |
| `job_details.job_id` | Inside `Job.job_details` | Secondary job identifier. It currently mirrors `crustdata_job_id` and is kept for backwards compatibility. |
| `company.basic_info.crustdata_company_id` | Inside `Job.company.basic_info` | Crustdata company identifier returned on each row. |
| `company.basic_info.company_id` | Search filter / aggregation path | Indexed alias for the same company identifier. Use this in `filters.field` and `aggregations.field`. |

### Aggregation bucket metadata

When you `group_by` on `company.basic_info.company_id`, each bucket carries
a `metadata` object whose keys use bucket-specific names rather than the
`Job` response dot-paths:

| Bucket metadata key | Equivalent `Job` value | Notes |
| - | - | - |
| `company_name` | `company.basic_info.name` | Plain company name. |
| `company_website_domain` | `company.basic_info.primary_domain` | Primary website domain. |
| `linkedin_id` | `company.basic_info.professional_network_id` | Public-profile identifier returned only inside aggregation buckets. |
| `crustdata_company_id` | `company.basic_info.crustdata_company_id` | Crustdata company id. Defined in the spec as nullable; the bucket `key` already carries this value. |

### Job identifiers

| Path | Type | Filter | Sort | Group | Return | Example |
| - | - | - | - | - | - | - |
| `crustdata_job_id` | integer | ✅ | ✅ | — | ✅ | `41053563` |
| `job_details.job_id` | integer | — | — | — | ✅ | `41053563` |

### Job details (`job_details.*`)

| Path | Type | Filter | Sort | Group | Return | Example |
| - | - | - | - | - | - | - |
| `job_details.title` | string | ✅ | — | ✅ | ✅ | `"Software Engineer"` |
| `job_details.category` | string | ✅ | — | ✅ | ✅ | `"Engineering"` |
| `job_details.workplace_type` | string | ✅ | — | ✅ | ✅ | `"Remote"`, `"Hybrid"`, `"On-site"`, `""` |
| `job_details.source` | string | ✅ | — | ✅ | ✅ | `"professional_network"`, `"greenhouse"` |
| `job_details.employment_type` | string | ✅ | — | ✅ | ✅ | `"full_time"` |
| `job_details.reposted_job` | boolean | ✅ | — | — | ✅ | `false` |
| `job_details.url` | string | ✅ | — | — | ✅ | `"https://www.linkedin.com/jobs/view/4398377738"` |
| `job_details.number_of_openings` | integer | — | — | — | ✅ | `1` |

> [!NOTE]
>
> **`job_details.source` — posting source platform.** Every job carries
> exactly one of these values: `professional_network` (listings from
> professional networking platforms), or the platform of the company job
> board that published the posting — `workday`, `smartrecruiters`, `greenhouse`,
> `workable`, `lever`, `icims`, `ashby`, `rippling`, or `yc`. Filter with
> `=` / `in`-style operators or `group_by` on it; it is **not sortable**.

> [!NOTE]
>
> **`job_details.employment_type` — employment type declared by the
> posting.** One of `full_time`, `part_time`, `contract`, `intern`, or
> `temporary`. Currently populated for roughly 85% of postings published on company
> job boards, and `null` for now when `source` is `professional_network` — treat missing values as "not declared", not as
> a specific type. Filterable and groupable; **not sortable**.

> [!NOTE]
>
> **Search-only fields.** `job_details.source` and
> `job_details.employment_type` are available on `POST /job/search` only —
> [Live Search](https://docs.crustdata.com/job-docs/search/live-search.md) does not return them.

### Company basic info (`company.basic_info.*`)

| Path | Type | Filter | Sort | Group | Return | Example |
| - | - | - | - | - | - | - |
| `company.basic_info.company_id` | integer | ✅ | — | ✅ | — | `631394` |
| `company.basic_info.crustdata_company_id` | integer | — | — | — | ✅ | `631394` |
| `company.basic_info.name` | string | ✅ | — | — | ✅ | `"Stripe"` |
| `company.basic_info.primary_domain` | string | ✅ | — | ✅ | ✅ | `"stripe.com"` |
| `company.basic_info.website` | string | — | — | — | ✅ | `"https://stripe.com"` |
| `company.basic_info.professional_network_id` | string | ✅ | — | — | ✅ | `"2135371"` |
| `company.basic_info.industries` | string\[] | ✅ | — | ✅ | ✅ | `["Technology, Information and Internet"]` |

> [!NOTE]
>
> `company.basic_info.company_id` and
> `company.basic_info.crustdata_company_id` refer to the same integer. Use the
> short alias in `filters` and `aggregations.field`. The response shape
> writes the value under `crustdata_company_id`.

### Company firmographics

#### Headcount (`company.headcount.*`)

| Path | Type | Filter | Sort | Group | Return | Example |
| - | - | - | - | - | - | - |
| `company.headcount.total` | integer | ✅ | ✅ | — | ✅ | `14522` |
| `company.headcount.range` | string | ✅ | — | ✅ | ✅ | `"5001-10000"` |
| `company.headcount.largest_headcount_country` | string | — | — | — | ✅ | `"USA"` |

#### Followers (`company.followers.*`)

| Path | Type | Filter | Sort | Group | Return | Example |
| - | - | - | - | - | - | - |
| `company.followers.count` | integer | ✅ | ✅ | — | ✅ | `1335688` |

#### Revenue (`company.revenue.*`)

| Path | Type | Filter | Sort | Group | Return | Example |
| - | - | - | - | - | - | - |
| `company.revenue.estimated.lower_bound_usd` | integer | ✅ | ✅ | — | ✅ | `500000000` |
| `company.revenue.estimated.upper_bound_usd` | integer | ✅ | — | — | ✅ | `1000000000` |
| `company.revenue.acquisition_status` | string | ✅ | — | — | ✅ | `""` |
| `company.revenue.public_markets.stock_symbols` | string\[] | ✅ | — | — | ✅ | `["STRIPE"]` |
| `company.revenue.public_markets.fiscal_year_end` | string | — | — | — | ✅ | `""` |

#### Funding (`company.funding.*`)

| Path | Type | Filter | Sort | Group | Return | Example |
| - | - | - | - | - | - | - |
| `company.funding.total_investment_usd` | number | ✅ | — | — | ✅ | `9440247725.0` |
| `company.funding.valuation_usd` | number | ✅ | — | — | ✅ | `50000000000.0` |
| `company.funding.last_fundraise_date` | string (ISO 8601) | ✅ | ✅ | — | ✅ | `"2026-03-09T00:00:00"` |
| `company.funding.last_round_type` | string | ✅ | — | ✅ | ✅ | `"secondary_market"` |
| `company.funding.num_funding_rounds` | integer | ✅ | ✅ | — | ✅ | `23` |
| `company.funding.investors` | string\[] | ✅ | — | — | ✅ | `["Sequoia Capital"]` |

#### Competitors and company locations

| Path | Type | Filter | Sort | Group | Return | Example |
| - | - | - | - | - | - | - |
| `company.competitors.websites` | string\[] | ✅ | — | — | ✅ | `["https://plaid.com"]` |
| `company.locations.country` | string | ✅ | - | ✅ | ✅ | `"United States"` |
| `company.locations.state` | string | ✅ | — | — | ✅ | `"California"` |
| `company.locations.city` | string | ✅ | — | — | ✅ | `"South San Francisco"` |
| `company.locations.street_address` | string | ✅ | — | — | ✅ | `"354 Oyster Point Blvd, ..."` |

`company.locations.country` accepts a full country name, such as `United States`,
or an ISO 3166-1 alpha-3 code, such as `USA`. Both forms return the same jobs,
and the response returns the full country name.

### Job location (`location.*`)

The `city`, `state`, and `country` fields are derived by **geocoding** the
raw location string, so they carry normalized place names rather than the
raw text's wording. `city` can be an empty string `""` when the raw
location resolves to an area broader than a city (for example
`"San Francisco Bay Area"` geocodes to `state: "California"` with an
empty `city`).

| Path | Type | Filter | Sort | Group | Return | Example |
| - | - | - | - | - | - | - |
| `location` | geo point | ✅ (geo only) | — | — | — | [Geographic radius filters](#geographic-radius-filters-geo_distance--geo_exclude) |
| `location.raw` | string | ✅ | — | — | ✅ | `"Melbourne, Victoria, Australia"` |
| `location.city` | string | ✅ | — | — | ✅ | `"Melbourne"` |
| `location.district` | string | ✅ | — | — | ✅ | `"Southbank"` |
| `location.state` | string | ✅ | — | — | ✅ | `"Victoria"` |
| `location.country` | string | ✅ | — | ✅ | ✅ | `"Australia"` |
| `location.pincode` | string | — | — | — | ✅ | `"3006"` |

> [!NOTE]
>
> **Country values are geocoded and normalized.** `location.country` carries
> normalized full country names (`"United States"`, `"United Kingdom"`). A
> small share of rows still carries a residual variant such as
> `"United States of America"`. When completeness matters, match both with
> `in`, or pre-discover the exact indexed values by running a `group_by` on
> `location.country`.

### Content (`content.*`)

| Path | Type | Filter | Sort | Group | Return | Example |
| - | - | - | - | - | - | - |
| `content.description` | string | ✅ | — | — | ✅ | `"Stripe is a financial infrastructure..."` |

> [!TIP]
>
> To find listings by an exact technology, skill, brand, or keyword, use
> `[.]` on `content.description` — it guarantees the literal word or phrase
> is present. `(.)` is typo-tolerant, so a single keyword can match
> lookalike words instead (`(.) "vitally"` also matches descriptions that
> contain only "virtually" or "finally"). Use `(.)` for multi-word
> descriptive matching.

### Technographics (filter-only)

Filter jobs by the technologies named in the posting. These paths are
**filter-only**: they narrow the result set and are never returned in a
response, and passing one in `fields` returns `400` with
`Invalid fields: technographics.technologies.name`.

| Path | Type | Filter | Sort | Group | Return | Example |
| - | - | - | - | - | - | - |
| `technographics.technologies.name` | string\[] | ✅ | - | - | - | `"Snowflake"` |
| `technographics.technologies.category` | string\[] | ✅ | - | - | - | `"data-warehouse"` |
| `technographics.technologies.super_category` | string\[] | ✅ | - | - | - | `"data-analytics"` |

> [!WARNING]
>
> **Posting-scoped, not employer-scoped.** A job matches only when the
> technology was detected in **that exact posting**. It is never inferred
> from the hiring company's stack, so a posting at a company that runs
> Snowflake does not match `Snowflake` unless the posting itself names it.
> This is the opposite of
> [Company Search](https://docs.crustdata.com/company-docs/search/reference.md#technographics-filter-only),
> where the same paths describe the company as a whole.

```bash theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/job/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "op": "and",
      "conditions": [
        { "field": "technographics.technologies.name", "type": "in", "value": ["Snowflake"] },
        { "field": "job_details.category", "type": "=", "value": "Engineering" }
      ]
    },
    "limit": 10,
    "fields": ["crustdata_job_id", "job_details.title", "company.basic_info.name"]
  }'
```

**Operators.** `=`, `!=`, `in`, `not_in`, `is_null`, `is_not_null`, `(.)`, and
`[.]` all work. Values are **case-sensitive**: `"Snowflake"` matches and
`"snowflake"` returns nothing, so take exact values from
[Autocomplete](https://docs.crustdata.com/job-docs/autocomplete/introduction.md).

**Two conditions mean two technologies.** Two AND conditions on
`technographics.technologies.name` match a posting that names **both**
technologies, in any position in its list. They are not required to be the
same entry, so `Snowflake` AND `dbt` reads as "this posting mentions Snowflake
and mentions dbt". To match either one, put both in a single `in` array.

**Category and super-category are slugs.** `category` takes a category slug
such as `data-warehouse` or `frontend-frameworks`. `super_category` takes one
of the twelve broader group slugs: `cloud-infrastructure`,
`collaboration-productivity`, `customer-success-support`, `data-analytics`,
`data-ml-platform`, `ecommerce-payments`, `engineering-devops`,
`finance-operations`, `hr-workforce`, `languages-frameworks`,
`sales-marketing`, `security`.

**Coverage.** Technology detection runs on postings sourced from the
professional network (`job_details.source` = `"professional_network"`). ATS
postings such as `greenhouse` and `workday` carry no technographics and never
match these filters. Use `is_not_null` on
`technographics.technologies.name` to restrict a query to postings that have
been through detection.

> [!NOTE]
>
> `technographics.total_technologies` and `technographics.top_technologies`
> are **company** fields. They are not filterable on `/job/search` and
> return `Unsupported columns in conditions`. Aggregations are not supported
> on any technographics path either.

### Metadata (`metadata.*`)

| Path | Type | Filter | Sort | Group | Return | Example |
| - | - | - | - | - | - | - |
| `metadata.date_added` | string (ISO 8601) | ✅ | ✅ | — | ✅ | `"2026-04-07T11:37:29"` |
| `metadata.date_updated` | string (ISO 8601) | ✅ | ✅ | — | ✅ | `"2026-04-08T00:00:00"` |

### Null, blank, and sparse field behavior

Most `Job` fields are nullable in the spec and can legitimately be absent
or empty.

* **Null or missing** — the field is not present on a given `Job`.
* **Blank string `""`** — the field was present but had no indexable value (common for `job_details.workplace_type`). Treat blank as "unspecified", not as the same thing as null.
* **Sparse nested objects** — `company.funding`, `company.revenue`, and `company.competitors` are often missing for smaller or private companies.
* **`is_null` / `is_not_null` operators** filter on null or missing fields directly — send `"value": null` (the `value` key is required).

***

## Errors

| Status | `error.type` | Meaning |
| - | - | - |
| `400` | `invalid_request` | Request body failed validation — `limit` out of range, a missing required key, or an unrecognized parameter (for example sending `column` instead of `field`). |
| `401` | `unauthorized` | The `Authorization` header is missing, malformed, or contains an invalid API key. |
| `500` | `internal_error` | The query could not be executed — including when a filter or aggregation references an unsupported field, when a `geo_distance`/`geo_exclude` value is malformed or used on a non-geo field, or when a geo `location` string cannot be resolved to coordinates. Also covers transient server errors; retry after a short delay. |

Every error — including `401` — uses the same nested envelope:
`{ "error": { "type", "message", "metadata" } }`. Branch on `error.type`
rather than string-matching `message`.

```json 400 — limit out of range theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "'limit' must be at most 1000. Got 5000.",
        "metadata": [
            {
                "field": "limit",
                "type": "less_than_equal",
                "message": "'limit' must be at most 1000. Got 5000."
            }
        ]
    }
}
```

```json 400 — column used instead of field theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "'aggregations.0.column' is not a valid parameter.",
        "metadata": [
            {
                "field": "aggregations.0.column",
                "type": "extra_forbidden",
                "message": "'aggregations.0.column' is not a valid parameter."
            }
        ]
    }
}
```

```json 401 — Invalid API key theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "unauthorized",
        "message": "Invalid API key in request.",
        "metadata": []
    }
}
```

```json 500 — Unsupported filter field theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "internal_error",
        "message": "Unsupported columns in conditions: ['invalid_field']",
        "metadata": []
    }
}
```

```json 500 — Malformed geo filter value theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "internal_error",
        "message": "geo_distance filter requires 'distance' field",
        "metadata": []
    }
}
```

```json 500 — Unsupported group_by field theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "internal_error",
        "message": "Unsupported aggregation field: 'company.basic_info.name'. Supported: company.basic_info.company_id, company.basic_info.crustdata_company_id, company.basic_info.industries, company.basic_info.primary_domain, company.funding.last_round_type, company.headcount.range, company.locations.country, job_details.category, job_details.employment_type, job_details.source, job_details.title, job_details.workplace_type, location.country",
        "metadata": []
    }
}
```

## Pagination & sorting

How to paginate, sort, select fields, and aggregate results in
[Search Jobs](https://docs.crustdata.com/job-docs/search/introduction.md).

For worked examples, see [Examples](https://docs.crustdata.com/job-docs/search/introduction.md#examples). For filter
grammar, operators, and the full field catalog, see
[Reference](https://docs.crustdata.com/job-docs/search/reference.md).

> [!NOTE]
>
> Replace `YOUR_API_KEY` in each example with your actual API key. All
> requests require the `x-api-version: 2025-11-01` header.

***

## Sorting

`sorts` is an ordered array. Each item has a `field` and `order` (`"asc"`
or `"desc"`). Sorts apply in array order — the first sort is the primary
key, the second breaks ties, and so on.

```json theme={"theme":"vitesse-black"}
{
    "sorts": [
        { "field": "metadata.date_added", "order": "desc" },
        { "field": "company.headcount.total", "order": "desc" }
    ]
}
```

> [!WARNING]
>
> **Sort allowlist is narrower than filter allowlist.** Sort only works on
> numeric, date, and a small set of scalar fields. Sorting on text fields like
> `job_details.title`, `job_details.category`, or `company.basic_info.name`
> returns `Unsupported columns in conditions`.

### Sortable fields

The following indexed fields are verified sortable:

* `crustdata_job_id`
* `metadata.date_added`
* `metadata.date_updated`
* `company.headcount.total`
* `company.followers.count`
* `company.revenue.estimated.lower_bound_usd`
* `company.funding.last_fundraise_date`
* `company.funding.num_funding_rounds`
* `relevance` — only valid when a text query is present in `filters` (maps to the text-match score); sorting on it without a text condition returns `400`

Common sort choices:

* **Newest postings first** — `{ "field": "metadata.date_added", "order": "desc" }`
* **Biggest companies first** — `{ "field": "company.headcount.total", "order": "desc" }`
* **Most followed companies first** — `{ "field": "company.followers.count", "order": "desc" }`
* **Most funding rounds first** — `{ "field": "company.funding.num_funding_rounds", "order": "desc" }`

***

## Pagination

Pagination is **cursor-based**. Each response returns a `next_cursor` (or
`null` when you reach the end). To fetch the next page, resend the original
request body with `cursor` set to the previous `next_cursor`.

**1. Fetch the first page**

Omit `cursor` and set `limit` to your page size (max `1000`).

**2. Walk forward**

Take `next_cursor` from the response and pass it back as `cursor` in the
next request. Keep `filters`, `sorts`, and `fields` identical — if you
change them, the cursor becomes meaningless.

**3. Stop when `next_cursor` is null**

A `null` cursor means you've reached the end of the result set.

### Consistency between pages

> [!NOTE]
>
> **Best-effort, not strict snapshot.** A
> cursor is consistent with respect to the filter, sort, and field
> selection you sent on the first page, so the same query will keep
> paging forward over a coherent result stream. However, because the
> underlying indexed dataset is continuously updated, new jobs indexed
> between page requests can cause minor drift in `total_count` and in the
> exact position of individual rows. Treat pagination as **best-effort**,
> not a strict snapshot.
>
> For bulk exports where every row matters:
>
> * **Constrain your filter to a bounded date window** (for example
>   `metadata.date_added >= 2025-01-01` AND `< 2025-07-01`) so newly
>   indexed jobs outside the window do not affect the walk, and
> * **Re-run the full walk periodically** and diff against the prior
>   snapshot using `crustdata_job_id` as the dedupe key.

### Dataset freshness and lifecycle

> [!NOTE]
>
> **What the indexed Jobs dataset represents.** The Search Jobs dataset
> is a rolling index of job listings discovered from the web, refreshed
> on an ongoing basis. Each row has:
>
> * **`metadata.date_added`** — when Job was posted.
>
> Closed or removed listings are **not** guaranteed to disappear from the
> index immediately. To approximate "currently hiring" queries, filter on
> a recent `metadata.date_added` window (for example, within the last 30 days) and pair it with the hiring
> company's firmographics. For alerting or repeated exports, keep your
> date windows bounded and dedupe rows with `crustdata_job_id`.

### Date filter semantics

> [!NOTE]
>
> **Dates and timezones.** When you pass a date-only value like
> `"2025-01-01"`, the backend interprets it as `2025-01-01T00:00:00` in
> UTC. Ranges using `=>` are inclusive of the boundary and `<` is
> exclusive, so `"metadata.date_added" >= "2025-01-01"` **AND**
> `< "2025-07-01"` covers every listing indexed between Jan 1 (inclusive)
> and Jul 1 (exclusive) in UTC. Pass full timestamps like
> `"2025-01-01T08:00:00"` when you need finer precision.

### Fetch page 2

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "field": "company.basic_info.company_id",
        "type": "=",
        "value": 631394
    },
    "fields": ["job_details.title"],
    "limit": 1,
    "cursor": "H4sIANBG1mkC_xXMOQ4CMQxA0auMUk9hx3YScxWERs6CpkBEzFIgxN0J1W-e_se9zra9l9X21V0mx0kjMgvdq4dYPZGgclOTlLEZl2bJG_lcdVSqFa-okDlwo1qbmye39-0YryvGKBIwsQLAPDGCkAS6DXL0wx5L6efzL2MC_P4A250zQYoAAAA="
}
```

***

## Field selection

Use `fields` to return only the dot-paths you need. The top-level groups
are `crustdata_job_id`, `job_details`, `company`, `location`, `content`,
`metadata`. You can request:

* **A whole group** — `"company"` returns every `company.*` sub-object.
* **A sub-object** — `"company.basic_info"` returns only the basic info block.
* **A single field** — `"company.basic_info.name"` returns just the name.

```json theme={"theme":"vitesse-black"}
{
    "fields": [
        "job_details.title",
        "job_details.url",
        "company.basic_info.name",
        "company.basic_info.primary_domain",
        "location.raw",
        "metadata.date_added"
    ]
}
```

> [!TIP]
>
> **Recommended default field set** for most dashboards:
> `["job_details.title", "job_details.category", "job_details.url",
>       "company.basic_info.name", "company.basic_info.primary_domain",
>       "location.raw", "metadata.date_added"]`.

***

## Aggregations

Aggregations let you roll up results without returning individual job rows.
Set `limit: 0` when you only want aggregation output. Two types are
supported:

* **`count`** — returns the total number of jobs matching `filters`.
* **`group_by`** — buckets the results by `field` and returns per-bucket counts.

### `AggregationRequest` schema

| Field | Type | Required | Description |
| - | - | - | - |
| `type` | string (enum) | **Yes** | `"count"` for a simple total, `"group_by"` to bucket by `field`. |
| `field` | string | Required for `group_by` | Dot-path to group by. Must be in the [Groupable fields](#groupable-fields) allowlist. |
| `agg` | string (enum) | Required for `group_by` | Sub-aggregation inside each bucket. Currently only `"count"` is supported. |
| `size` | integer | No (default `100`) | Maximum number of buckets to return. Min `1`, max `1000`. |

Each `AggregationResponseItem` echoes `type` and `field`, then carries:

* **`value`** (integer) — populated for `count` aggregations. The total match count.
* **`buckets`** (array) — populated for `group_by` aggregations. Each bucket has a `key`, `count`, and a `metadata` object whose keys depend on the grouped field. See [Aggregation bucket metadata](https://docs.crustdata.com/job-docs/search/reference.md#aggregation-bucket-metadata).

You can include multiple aggregations in a single request; the response
returns them in `aggregations[]` in the same order you sent them.

### Count all Engineering jobs

```bash curl theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/job/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": { "field": "job_details.category", "type": "=", "value": "Engineering" },
    "limit": 0,
    "aggregations": [ { "type": "count" } ]
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "job_listings": [],
    "next_cursor": null,
    "total_count": 4448237,
    "aggregations": [{ "type": "count", "field": null, "value": 4448237 }]
}
```

### Top companies indexing "Software Engineer" listings (bounded window)

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
        { "field": "job_details.title",   "type": "=",  "value": "Software Engineer" },
        { "field": "metadata.date_added", "type": "=>", "value": "2025-01-01" },
        { "field": "metadata.date_added", "type": "<",  "value": "2026-01-01" }
      ]
    },
    "limit": 0,
    "aggregations": [
      {
        "type": "group_by",
        "field": "company.basic_info.company_id",
        "agg": "count",
        "size": 5
      }
    ]
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "job_listings": [],
    "next_cursor": null,
    "total_count": 25748,
    "aggregations": [
        {
            "type": "group_by",
            "field": "company.basic_info.company_id",
            "buckets": [
                {
                    "key": 3674630,
                    "count": 836,
                    "metadata": {
                        "company_name": "Bending Spoons",
                        "company_website_domain": "bndspn.com",
                        "linkedin_id": "3175130"
                    }
                },
                {
                    "key": 821755,
                    "count": 794,
                    "metadata": {
                        "company_name": "Jobs via Dice",
                        "company_website_domain": "dice.com",
                        "linkedin_id": "104085107"
                    }
                },
                {
                    "key": 899641,
                    "count": 490,
                    "metadata": {
                        "company_name": "Lensa",
                        "company_website_domain": "lensa.com",
                        "linkedin_id": "5192530"
                    }
                },
                {
                    "key": 2110301,
                    "count": 438,
                    "metadata": {
                        "company_name": "Microsoft",
                        "company_website_domain": "microsoft.com",
                        "linkedin_id": "1035"
                    }
                },
                {
                    "key": 2676775,
                    "count": 379,
                    "metadata": {
                        "company_name": "Goliath Partners",
                        "company_website_domain": "goliathpartners.com",
                        "linkedin_id": "92699700"
                    }
                }
            ]
        }
    ]
}
```

### Groupable fields

`group_by.field` is restricted to the following indexed fields:

* `company.basic_info.company_id`
* `company.basic_info.crustdata_company_id`
* `company.basic_info.industries`
* `company.basic_info.primary_domain`
* `company.funding.last_round_type`
* `company.headcount.range`
* `company.locations.country`
* `job_details.category`
* `job_details.employment_type`
* `job_details.source`
* `job_details.title`
* `job_details.workplace_type`
* `location.country`

Sending any other field returns `500` with `Unsupported aggregation
field: '...'. Supported: ...`.

***

## What's next

* [Search Jobs](https://docs.crustdata.com/job-docs/search/introduction.md) — back to the main Search page.
* [Examples](https://docs.crustdata.com/job-docs/search/introduction.md#examples) — SDR/BDR keyword hunting, mid-market filtering, funding-triggered queries, and aggregations.
* [Pagination & sorting](#pagination--sorting) — sorting, pagination, field selection, and aggregations.
* [OpenAPI reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md) — the formal schema for every request, response, and error.


## Related topics

- [Job Watcher](https://docs.crustdata.com/watcher-docs/job/watch.md)
- [Search Jobs](https://docs.crustdata.com/api-reference/job-apis/search-the-indexed-job-dataset.md)
- [Batch Search Jobs](https://docs.crustdata.com/api-reference/batch-apis/submit-a-batch-job-listings-search-job.md)
- [Person Search reference](https://docs.crustdata.com/person-docs/search/reference.md)
- [Job Postings Search API](https://docs.crustdata.com/job-docs/search/introduction.md)
