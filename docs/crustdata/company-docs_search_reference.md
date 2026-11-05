> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Company Search reference

> Reference for Company Search: ranked-search modes, filter operators, searchable fields, validation rules, and errors.

Reference material for [Company Search](https://docs.crustdata.com/company-docs/search/introduction.md): the full list
of filter operators, searchable fields with sortable flags, response fields,
validation rules, and error responses.

For walk-through examples, see [Company Search](https://docs.crustdata.com/company-docs/search/introduction.md) and
[Examples](https://docs.crustdata.com/company-docs/search/introduction.md#examples).

> [!NOTE]
>
> **Pricing.** Search bills `0.03` credits per result. A premium group adds
> a per-result charge when you filter on it, and another when you receive
> it, so a group that you filter on and receive bills twice. The premium
> families in the tables below are `taxonomy`, `followers`, `headcount`
> (including the `roles` filters), `funding`, `hiring`, `software_reviews`,
> `maps`, and the filter-only `technographics` fields. Prices are under
> [Premium fields in search](https://docs.crustdata.com/general/pricing.md#premium-fields-in-search); your own are on [`/account/endpoints`](https://docs.crustdata.com/general/permissions).

***

## Ranked search

Pass a `search` object to rank companies against a natural-language query.
`search.query` is required and must not be empty. `search.mode` controls which
retrieval methods run.

| Mode | Keyword retrieval | Semantic retrieval | When to use |
| - | - | - | - |
| `hybrid` | Yes | Yes | Most discovery queries. This is the default. |
| `lexical` | Yes | No | Queries where matching the supplied words matters most. |
| `semantic` | No | Yes | Conceptual queries that may use different wording from descriptions. |

When you supply `filters`, the API applies them as hard constraints before
keyword or semantic retrieval. Ranked results are ordered by relevance, so you
cannot combine `search` with `sorts`. Ranked search returns up to 100 results
per page and supports cursors across at most 1,000 candidate positions per search.

```json theme={"theme":"vitesse-black"}
{
    "search": {
        "query": "developer tooling companies building observability products",
        "mode": "hybrid"
    },
    "filters": {
        "field": "locations.country",
        "type": "=",
        "value": "USA"
    },
    "limit": 20
}
```

***

## Filter operator reference

Company Search accepts the following `filters.type` operators.

| Operator | Value shape | Meaning | Example value | Notes |
| - | - | - | - | - |
| `=` | scalar | Exact match | `"retool.com"` | Case-insensitive for text fields |
| `!=` | scalar | Not equal | `"acquired"` | |
| `<` | scalar (number or date string) | Less than | `10000` | Numbers and date strings |
| `=<` | scalar (number or date string) | Less than or equal | `50000000` | **Not** `<=` |
| `>` | scalar (number or date string) | Greater than | `2020` | Numbers and date strings |
| `=>` | scalar (number or date string) | Greater than or equal | `"2024-01-01"` | **Not** `>=` |
| `in` | array | Value is in list | `["USA", "GBR"]` | Case-insensitive for text fields when the list has 100 values or fewer. A longer list is case-sensitive. Matches if **any** array element matches **any** list value. |
| `not_in` | array | Value is not in list | `["acquired"]` | Same case rule as `in`. |
| `is_null` | `null` | Field has no value | `null` | The `value` key is required. Send `"value": null`. |
| `is_not_null` | `null` | Field has a non-null value | `null` | The `value` key is required. Send `"value": null`. |
| `(.)` | string | Fuzzy all-words match | `"Software Development"` | Every query word must match a word in the value, in any order, and typos are tolerated. Matches "Development Software" and "Sftware Devlpment", not ~~"Software Dev"~~. |
| `[.]` | string | Case-insensitive exact-phrase match | `"Software Development"` | `[.]` "Software Development" matches "Software Development Platform", not ~~"Development Software"~~. Words must be contiguous and in order, with no partial words or typos. |
| `geo_distance` | object | HQ within radius of a location or explicit coordinate | `{"location": "Palo Alto, CA", "distance": 50, "unit": "km"}` | Only on `locations.headquarters`. See [`geo_distance`](#geo_distance--radius-around-headquarters) |
| `geo_exclude` | object | HQ outside radius of a location or explicit coordinate | `{"location": "London, UK", "distance": 100, "unit": "km"}` | Inverse of `geo_distance`, with the same value object and field. See [`geo_exclude`](#geo_exclude--exclude-a-radius) |
| `geo_polygon` | object | HQ inside a polygon of explicit coordinates | `{"points": [[37.8, -122.5], [37.8, -122.3], [37.6, -122.4]]}` | Same field as `geo_distance`. See [`geo_polygon`](#geo_polygon-inside-a-polygon) |

> [!WARNING]
>
> The operators `>=` and `<=` are **not supported**. Use `=>` and `=<`
> instead.

> [!NOTE]
>
> To require two values on a list field, such as `basic_info.industries`,
> put two `=` conditions in an `and` group. The API returns the companies
> whose list holds both values. `has_all` returns `400` on
> `basic_info.industries` and `taxonomy.professional_network_industry`.

### `geo_distance` — radius around headquarters

`geo_distance` keeps companies whose **headquarters** is within a radius of a
point. All three geo operators work on the `locations.headquarters` field only.
Supply the centre of the radius using **one** of:

* `location` — a string that is geocoded server-side (e.g. `"Palo Alto, CA"`).
* `lat_lng` — explicit coordinates as `[lat, lng]`. Skips geocoding.

If both are supplied, `lat_lng` wins. `distance` is required; `unit` defaults
to `km`.

| Field | Type | Required | Notes |
| - | - | - | - |
| `location` | string | One of | Geocoded server-side. Ignored when `lat_lng` is also set. |
| `lat_lng` | number\[] | One of | Two-element `[lat, lng]`. Lat in `[-90, 90]`, lng in `[-180, 180]`. |
| `distance` | number | Yes | Radius around the centre. Must be positive. |
| `unit` | string | No | One of `km`, `mi`, `miles`, `m`, `meters`, `ft`, `feet`. Defaults to `km`. |

See [`geo_distance` examples](https://docs.crustdata.com/company-docs/search/introduction#examples)
for end-to-end requests using both `location` and `lat_lng`.

### `geo_exclude` — exclude a radius

`geo_exclude` is the inverse of `geo_distance`: it removes companies
headquartered **inside** the radius and keeps everyone else. It takes the same
value object — `location` or `lat_lng`, a required `distance`, and an optional
`unit` (defaults to `km`) — and works on the same `locations.headquarters`
field. Use it to carve out a metro you already cover, or to target companies
outside a region.

```json theme={"theme":"vitesse-black"}
{
    "field": "locations.headquarters",
    "type": "geo_exclude",
    "value": { "location": "London, UK", "distance": 100, "unit": "km" }
}
```

### `geo_polygon`: inside a polygon

`geo_polygon` keeps companies whose **headquarters** falls inside a polygon you
draw with explicit coordinates. Use it when a radius is the wrong shape: a
sales territory, a metro boundary, or an area you traced on a map. It works on
the same `locations.headquarters` field as `geo_distance`.

| Field | Type | Required | Notes |
| - | - | - | - |
| `points` | number\[]\[] | Yes | List of `[lat, lng]` pairs, at least 3 distinct points and at most 1,000. Lat in `[-90, 90]`, lng in `[-180, 180]`. |

The polygon closes itself, so repeating the first point is optional. Edges may
not cross, and no point may be revisited. Points are coordinates, not place
names, and are not geocoded. A polygon that crosses the 180° meridian must
list its points counter-clockwise, or it is read as everything outside it.

```json theme={"theme":"vitesse-black"}
{
    "field": "locations.headquarters",
    "type": "geo_polygon",
    "value": { "points": [[37.8, -122.5], [37.8, -122.3], [37.6, -122.4]] }
}
```

A polygon with fewer than 3 distinct points, a malformed pair, crossing edges,
or an out-of-range coordinate returns `400` with a message naming the problem,
for example `geo_polygon 'points' needs at least 3 distinct points`.

## Searchable fields

These are common fields that can be used in the `field` key of a filter condition. Some indexed filter fields are search-only and are not returned in the response payload. For the full schema, see the [API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md).

Fields are grouped by family below. Every field listed is filterable; the **Sortable** column marks the subset also valid in `sorts`.

### Identity & timestamps

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `crustdata_company_id` | integer | Yes | Yes | Crustdata company ID |
| `basic_info.company_id` | integer | Yes | Yes | Internal source company ID |
| `metadata.growth_calculation_date` | datetime | Yes | Yes | Anchor date for growth metrics |
| `updated_at` | datetime | Yes | Yes | Last profile update timestamp |
| `indexed_at` | datetime | Yes | Yes | Last index timestamp |

### Basic info

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `basic_info.name` | string | Yes | Yes | Company name |
| `basic_info.primary_domain` | string | Yes | Yes | Primary website domain |
| `basic_info.website` | string | Yes | No | Full website URL |
| `basic_info.professional_network_url` | string | Yes | No | Company profile URL |
| `basic_info.professional_network_id` | string | Yes | No | Company profile ID |
| `basic_info.company_type` | string | Yes | No | e.g., `"Privately Held"`, `"Public Company"` |
| `basic_info.status` | string | Yes | No | Company lifecycle: `"active"` or `"deleted"` |
| `basic_info.year_founded` | integer | Yes | Yes | Year founded (e.g., `2017`) |
| `basic_info.employee_count_range` | string | Yes | Yes | e.g., `"201-500"` |
| `basic_info.markets` | string\[] | Yes | No | Market tags |
| `basic_info.industries` | string\[] | Yes | No | Industry tags; filter alias of `taxonomy.professional_network_industries` |

> [!NOTE]
>
> **`basic_info.status`** is the company's lifecycle in Crustdata's entity
> graph. It is the same value the person APIs return as `company_status` on an
> employment record. Two values are defined:
>
> * `active`: a live company record.
> * `deleted`: a record Crustdata has retired. Other records can still point at
>   it, so you meet this value most often in a person's employment history.
>
> Company search serves the live company index, so a `deleted` company is not a
> result there. Filter `basic_info.status` when you want the check written into
> the query, and read it on the response to see the lifecycle of a company you
> already matched.

### Revenue & funding

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `revenue.estimated.lower_bound_usd` | integer | Yes | Yes | Revenue lower bound (USD) |
| `revenue.estimated.upper_bound_usd` | integer | Yes | Yes | Revenue upper bound (USD) |
| `revenue.acquisition_status` | string | Yes | No | e.g., `"acquired"` |
| `revenue.public_markets.ipo_date` | date | Yes | Yes | IPO date (public companies) |
| `revenue.public_markets.fiscal_year_end` | string | Yes | No | Fiscal year end (public companies) |
| `revenue.public_markets.stock_symbols` | string\[] | Yes | No | Ticker symbols (public companies) |
| `funding.total_investment_usd` | number | Yes | Yes | Total disclosed funding (USD) |
| `funding.last_round_amount_usd` | number | Yes | Yes | Last funding round amount (USD) |
| `funding.last_fundraise_date` | date | Yes | Yes | Last funding date |
| `funding.last_round_type` | string | Yes | No | Latest round type, e.g., `"series_a"` |
| `funding.investors` | string\[] | Yes | No | All-time investor names; not round-specific |

### Headcount & roles

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `headcount.total` | integer | Yes | Yes | Total employee count |
| `headcount.largest_headcount_country` | string | Yes | Yes | Country with the most employees |
| `headcount.growth_percent.1m` | number | Yes | No | 1-month headcount growth percent |
| `headcount.growth_percent.3m` | number | Yes | No | 3-month headcount growth percent |
| `headcount.growth_percent.6m` | number | Yes | No | 6-month headcount growth percent |
| `headcount.growth_percent.12m` | number | Yes | No | 12-month headcount growth percent |
| `headcount.growth_absolute.1m` | integer | Yes | No | 1-month absolute employee delta |
| `headcount.growth_absolute.3m` | integer | Yes | No | 3-month absolute employee delta |
| `headcount.growth_absolute.6m` | integer | Yes | No | 6-month absolute employee delta |
| `headcount.growth_absolute.12m` | integer | Yes | No | 12-month absolute employee delta |
| `roles.distribution.<function>` | integer | Yes | No | Employee count in a function (see list below) |
| `roles.distribution_percent` | object | Yes | No | Share of employees per function |
| `roles.growth_6m` | object | Yes | No | 6-month role growth |
| `roles.growth_yoy` | object | Yes | No | Year-over-year role growth |

> [!NOTE]
>
> The `headcount.growth_percent.*` and `headcount.growth_absolute.*` dotted
> period paths are **filterable but not sortable**. To rank results by growth,
> filter on the period you care about and sort on `headcount.total` (or
> another sortable field). See [Find high-growth mid-size
> companies](https://docs.crustdata.com/company-docs/search/introduction.md#examples).

Replace `<function>` with one of: `accounting`, `administrative`, `arts_and_design`, `business_development`, `community_and_social_services`, `consulting`, `customer_success_and_support`, `education`, `engineering`, `entrepreneurship`, `finance`, `healthcare_services`, `human_resources`, `information_technology`, `legal`, `marketing`, `media_and_communication`, `military_and_protective_services`, `operations`, `product_management`, `program_and_project_management`, `purchasing`, `quality_assurance`, `real_estate`, `research`, `sales`, `support`. For example, `roles.distribution.engineering` filters on the number of engineers. See [Find companies by team size in a function](https://docs.crustdata.com/company-docs/search/introduction.md#examples).

### Locations

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `locations.country` | string | Yes | Yes | HQ country. Filter with ISO-3 codes or full names; returns the normalized full name |
| `locations.state` | string | Yes | No | HQ state / region, normalized (e.g. `"California"`) |
| `locations.city` | string | Yes | No | HQ city, normalized (e.g. `"Palo Alto"`) |
| `locations.headquarters` | string | Yes | No | Full HQ location string, also the target of `geo_distance`, `geo_exclude` and `geo_polygon` |
| `locations.street_address` | string | Yes | No | HQ street address (e.g. `"510 Townsend St."`) |
| `locations.all_office_addresses` | string\[] | Yes | No | All office addresses, HQ and non-HQ; match a city or region substring with `(.)` |

> [!NOTE]
>
> **Normalized location facets.** `locations.state` and `locations.city`
> filter against and return normalized values derived from geocoding each
> company's headquarters address — the value you see in a response is the
> value you filter with. `locations.country` **accepts both** vocabularies:
> ISO-3 codes (`"USA"`, `"GBR"`) and full country names (`"United States"`)
> each match all companies, so existing ISO-3 filters keep working unchanged.
> Responses return the normalized full country name. Use
> [Autocomplete](https://docs.crustdata.com/company-docs/autocomplete/introduction.md) to discover indexed
> values before filtering.

### Taxonomy

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `taxonomy.professional_network_industry` | string\[] | Yes | No | Industry labels. A filter matches any label, the same as `basic_info.industries`. The response returns only the primary label, as a string |
| `taxonomy.categories` | string\[] | Yes | No | Category tags |
| `taxonomy.professional_network_specialities` | string\[] | Yes | No | Speciality tags |
| `taxonomy.primary_naics_detail.naics_code` | string | Yes | No | Six-digit NAICS code, for example `"541511"` |
| `taxonomy.primary_naics_detail.sector` | string | Yes | No | NAICS sector, the two-digit level |
| `taxonomy.primary_naics_detail.sub_sector` | string | Yes | No | NAICS sub-sector, the three-digit level |
| `taxonomy.primary_naics_detail.industry_group` | string | Yes | No | NAICS industry group, the four-digit level |
| `taxonomy.primary_naics_detail.industry` | string | Yes | No | NAICS industry title, the six-digit level |
| `taxonomy.primary_naics_detail.year` | integer | Yes | No | NAICS edition year |
| `taxonomy.sic_detail_list.sic_code` | string | Yes | No | Four-digit SIC code, for example `"7372"` |
| `taxonomy.sic_detail_list.industry` | string | Yes | No | SIC industry title |
| `taxonomy.sic_detail_list.year` | integer | Yes | No | SIC edition year |

> [!NOTE]
>
> **NAICS and SIC.** A company has one primary NAICS classification and a
> list of SIC entries. Search returns both as part of the `taxonomy` group.
> You can also name `taxonomy.primary_naics_detail`,
> `taxonomy.sic_detail_list`, or any leaf under them in `fields`. They have
> no price of their own. Most companies carry no classification and return
> `null` for both.
>
> Two `taxonomy.sic_detail_list.sic_code` conditions under `and` match a
> company whose list holds both codes, even in different entries. `has_all`
> with the same two codes returns the same companies.
>
> Every indexed NAICS code comes from the 2022 edition, and every SIC code
> from the 1987 edition, so each `year` field holds one value today. The
> `year` fields are not sortable. A sort on one returns `400` with the
> message `Unsupported columns in conditions:     ['taxonomy.primary_naics_detail.year']`.

### Followers

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `followers.count` | integer | Yes | Yes | Follower count |
| `followers.mom_percent` | number | Yes | No | Month-over-month follower growth % |
| `followers.qoq_percent` | number | Yes | No | Quarter-over-quarter growth % |
| `followers.six_months_growth_percent` | number | Yes | No | 6-month follower growth % |
| `followers.yoy_percent` | number | Yes | No | Year-over-year follower growth % |

### Social profiles

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `social_profiles.twitter_url` | string | Yes | No | Company X/Twitter URL |
| `social_profiles.crunchbase.url` | string | Yes | No | Company Crunchbase URL |
| `social_profiles.crunchbase.uuid` | string | Yes | No | Company Crunchbase UUID |
| `social_profiles.professional_network` | string | Yes | No | Company profile URL |

### Competitors (filter-only)

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `competitors.company_ids` | integer\[] | Yes | No | Competitor Crustdata IDs |
| `competitors.websites` | string\[] | Yes | No | Competitor domains |

### Technographics (filter-only)

| Field | Type | Filterable | Sortable | Description |
| - | - | - | - | - |
| `technographics.total_technologies` | integer | Yes | Yes | Number of detected technologies |
| `technographics.top_technologies` | string\[] | Yes | No | Most notable technology names |
| `technographics.technologies.name` | string\[] | Yes | No | Detected technology names |
| `technographics.technologies.category` | string\[] | Yes | No | Detected technology category slugs |
| `technographics.technologies.super_category` | string\[] | Yes | No | Detected technology super-category slugs |

> [!NOTE]
>
> Technographics values are **not returned** in search responses. These
> fields are filter-only. `technographics.total_technologies` is filterable
> and sortable, but it is **not returned** in results.
> `technographics.top_technologies` is filterable but likewise not returned.
> `technographics.technologies.name` is likewise not returned, and
> `technographics.technologies.category` and
> `technographics.technologies.super_category` are likewise not returned. To
> get the values, request the `technographics` field group on [Company
> Enrich](https://docs.crustdata.com/company-docs/enrichment/reference.md#technographics-fields). Use
> [Autocomplete](https://docs.crustdata.com/company-docs/autocomplete/introduction.md#common-fields-to-autocomplete)
> with the `technology` and `technology_category` fields to discover valid
> filter values.

> [!TIP]
>
> Use [Autocomplete](https://docs.crustdata.com/company-docs/autocomplete/introduction.md) to discover
> exact values for fields like `basic_info.industries`,
> `taxonomy.professional_network_industry`, `locations.country`,
> `basic_info.company_type`, and `funding.last_round_type`.

## Response fields

Each company in the response has `crustdata_company_id`, even when you do not request it. It can also include these sections, depending on `fields`. A section you request that has no data for the company is `null`.

| Section | Key fields | Description |
| - | - | - |
| `basic_info` | `name`, `primary_domain`, `website`, `professional_network_url`, `year_founded`, `status` | Core identity and profile |
| `headcount` | `total` | Employee footprint |
| `funding` | `total_investment_usd`, `last_round_amount_usd`, `investors` | Funding and investor data |
| `locations` | `country`, `state`, `city`, `headquarters`, `street_address`, `all_office_addresses` | Headquarters and office locations, with `country`, `state`, and `city` normalized as geocoded values |
| `taxonomy` | `professional_network_industry`, `professional_network_industries`, `categories`, `professional_network_specialities`, `primary_naics_detail`, `sic_detail_list` | Industry and category tags, plus the primary NAICS classification and the SIC entries |
| `revenue` | `estimated`, `public_markets`, `acquisition_status` | Revenue and market data |
| `hiring` | `openings_count`, `openings_growth_percent` | Hiring demand |
| `followers` | `count`, `mom_percent`, `yoy_percent` | Social follower metrics |
| `social_profiles` | `twitter_url`, `professional_network`, `crunchbase.url`, `crunchbase.uuid` | Third-party profile links |
| `software_reviews` | `average_rating`, `review_count`, and review-count growth percentages | Software review metrics (when available) |

### Filterable but not returned

Some indexed fields can be used in `filters` to narrow results but are **not**
part of the response payload — search is lightweight discovery, not full
enrichment. Filter on them, then fetch their values with
[Company Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md).

| Field family | Filterable | Returned |
| - | - | - |
| `basic_info.industries` (returned as `taxonomy.professional_network_industries`) | Yes | No |
| `competitors.*` (`company_ids`, `websites`) | Yes | No |
| `roles.*` (`distribution.<function>`, `distribution_percent`, `growth_6m`, `growth_yoy`) | Yes | No |
| `technographics.*` (`total_technologies`, `top_technologies`, `technologies.name`, `technologies.category`, `technologies.super_category`) | Yes | No |

***

## Validation rules

> [!NOTE]
>
> Default/max limits and pagination behavior reflect current platform
> behavior. See the [API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md)
> for the formal OpenAPI contract.

| Rule | Behavior |
| - | - |
| Request criteria | Supply at least one of `filters` or `search`. |
| `search.query` | Required and non-empty when `search` is present. |
| `search.mode` | One of `hybrid`, `lexical`, or `semantic`. Defaults to `hybrid`. |
| `fields` is optional | Omitting returns all fields (large payload). Always specify in production. |
| Filter-only `limit` | 1 to 1000. Default: 20. |
| Ranked-search `limit` | 1 to 100. Default: 20. |
| Ranked search with `sorts` | Not supported. Ranked results preserve relevance order. |
| Ranked search with `cursor` | Supported in all three modes. See [ranked pagination](#ranked-pagination). |
| `sorts` with pagination | For filter-only search, include `sorts` when paginating to ensure stable result ordering. |
| `cursor` must match query | For filter-only search, changing `filters`, `sorts`, or `fields` between pages invalidates it. |

> [!NOTE]
>
> **Filter sizing.** To match many values of a field, put them all in a single
> `in` condition rather than many separate conditions — `in` compiles to one
> efficient query. A single `in` list of up to \~5,000-10,000 values returns in
> a few seconds; larger lists get progressively slower, and very large lists
> (roughly 50,000+) are rejected. For bigger sets, split the values into
> \~5,000-10,000 chunks across multiple requests and merge. The request body is
> hard-capped at **10 MB** (larger bodies return `413 request_too_large`),
> though with typical payloads you reach the query-size limit first.

## Errors

Common error responses for Search:

### Ranked cursor errors

A malformed or expired signed cursor returns HTTP 400:

```json theme={"theme":"vitesse-black"}
{
  "error": {
    "type": "invalid_request",
    "message": "Invalid cursor: expired or malformed; restart without cursor",
    "metadata": []
  }
}
```

Changing the query, mode, filters, or API version returns HTTP 400:

```json theme={"theme":"vitesse-black"}
{
  "error": {
    "type": "invalid_request",
    "message": "Invalid cursor: query, mode, filters and API version must remain unchanged",
    "metadata": []
  }
}
```

Restart without `cursor` after these errors. Do not retry the same invalid cursor.

### Other search errors

```json 400 — Unsupported field theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Unsupported columns in conditions: ['nonexistent_field']",
        "metadata": []
    }
}
```

```json 400 — Invalid operator theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "'filters.type' must be one of: =, !=, <, =<, >, =>, in, not_in, contains, not_contains, is_null, is_not_null, (.), [.]. Got '>='.",
        "metadata": [
            {
                "field": "filters.type",
                "type": "enum",
                "message": "'filters.type' must be one of: =, !=, <, =<, >, =>, in, not_in, contains, not_contains, is_null, is_not_null, (.), [.]. Got '>='."
            }
        ]
    }
}
```

> [!NOTE]
>
> Use `=>` for greater-than-or-equal and `=<` for less-than-or-equal. The operators `>=` and `<=` are not supported.

```json 401 — Invalid API key theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "unauthorized",
        "message": "Invalid API key in request.",
        "metadata": []
    }
}
```

***

## API reference summary

| Detail | Value |
| - | - |
| **Endpoint** | `POST /company/search` |
| **Auth** | Bearer token + `x-api-version: 2025-11-01` |
| **Request** | `filters`, `search`, `fields`, `sorts`, `limit`, `cursor` |
| **Response** | `{ companies, next_cursor, total_count }` |
| **Pagination** | Cursor-based for both filter-only and ranked search; ranked pages have a 100-result maximum. |
| **Empty result** | `200` with `"companies": []` |
| **Errors** | `400` (bad field/operator), `401` (bad auth), `403` (permission/credits), `500` (server error) |

## How sorts work

The `sorts` parameter orders your results. Each sort rule needs:

* **`column`** — a dot-path field (e.g., `funding.total_investment_usd`, `headcount.total`, `basic_info.name`).
* **`order`** — either `asc` (ascending) or `desc` (descending).

You can provide multiple sort rules. The API applies them in order. For the
full list of sortable fields, see
[Search reference](https://docs.crustdata.com/company-docs/search/reference.md#searchable-fields).

`sorts` is not supported with ranked `search`. Ranked results are ordered by
relevance.

***

## Paginate through results

### Ranked pagination

For `hybrid`, `lexical`, and `semantic` search, pass the previous response's
`next_cursor` as `cursor`. Each page accepts `limit` from 1 to 100 (default 20).
A search covers at most 1,000 candidate positions. `total_count` is always `null`;
it does not report the candidate ceiling or the total matching population.

* Keep `search.query`, `search.mode`, `filters`, and `x-api-version` unchanged.
* You may change `limit` and authorized `fields` between pages.
* Do not send `sorts` with ranked search.
* Cursors expire 20 minutes after the initial search. Paging does not renew them.
* The first 100 candidates are reranked. Later candidates use retrieval ranking
  without another reranking pass.
* Candidate order is retained, but company records are read again for each page.
  Deleted companies or records that no longer satisfy filters are omitted and
  still consume their original positions. A short or empty page can have a cursor.
* Continue until `next_cursor` is `null`. A cursor does not guarantee a nonempty next page.
* If the cursor expires, cached results are unavailable, or the search index changes,
  restart without `cursor`.

See the [worked request and response](https://docs.crustdata.com/company-docs/search/introduction.md#examples).

### Filter-only pagination

When your search matches more companies than your `limit`, use cursor-based pagination to walk through all pages.

**First page:** send your normal search request.

```bash First page theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/company/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "field": "locations.country",
      "type": "in",
      "value": ["USA"]
    },
    "sorts": [{"field": "crustdata_company_id", "order": "asc"}],
    "limit": 100,
    "fields": [
      "crustdata_company_id",
      "basic_info.name",
      "basic_info.primary_domain"
    ]
  }'
```

**Next page:** take the `next_cursor` value from the response and pass it in your next request. Keep the same `filters`, `sorts`, `limit`, and `fields`.

```bash Next page theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/company/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "field": "locations.country",
      "type": "in",
      "value": ["USA"]
    },
    "sorts": [{"field": "crustdata_company_id", "order": "asc"}],
    "limit": 100,
    "fields": [
      "crustdata_company_id",
      "basic_info.name",
      "basic_info.primary_domain"
    ],
    "cursor": "PASTE_NEXT_CURSOR_VALUE_HERE"
  }'
```

Continue until `next_cursor` is `null`, which means you have reached the last page.

> [!WARNING]
>
> Changing `filters`, `sorts`, or `fields` between pages invalidates the
> cursor. Always include `sorts` when paginating to guarantee stable ordering.

See the [full API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md) for the complete OpenAPI schema.


## Related topics

- [Company Discovery Watcher](https://docs.crustdata.com/watcher-docs/company/discovery.md)
- [Search Companies](https://docs.crustdata.com/api-reference/company-apis/search-companies-with-indexed-fields-only.md)
- [Jobs Search reference](https://docs.crustdata.com/job-docs/search/reference.md)
- [Person Search reference](https://docs.crustdata.com/person-docs/search/reference.md)
- [Batch Search Companies](https://docs.crustdata.com/api-reference/batch-apis/submit-a-batch-company-database-search-job.md)
