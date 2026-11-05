> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Company Autocomplete API

> Learn how to discover valid field values for Company Search filters using the Company Autocomplete API.

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | All plans. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | Yes, the endpoint is free |
| **Credit cost** | Free |
| **Rate limit** | See [Rate limits](https://docs.crustdata.com/general/rate-limits.md) |

**Use this when** you need to discover valid filter values before building a
Company Search query — for example, finding the exact industry label or
country code the API expects.

The Company Autocomplete API helps you discover the exact field values the
indexed Company Search API expects. Use it before you build filters for
industries, geographies, company types, funding stages, and more.

Every request goes to the same endpoint:

```
POST https://api.crustdata.com/company/search/autocomplete
```

> [!NOTE]
>
> Replace `YOUR_API_KEY` in each example with your actual API key. All
> requests require the `x-api-version: 2025-11-01` header.

### Request fields

| Field | Type | Required | Description |
| - | - | - | - |
| `field` | string | Yes | Searchable company field to autocomplete, such as `basic_info.industries`, `taxonomy.professional_network_industry`, or `locations.country`. |
| `query` | string | Yes | Partial text to match. Use `""` to get the most common values. |
| `limit` | integer | No | Maximum suggestions to return. Default: `20`. Max: `100`. |

> [!NOTE]
>
> Autocomplete does not take a `filters` scope. Suggestions always come
> from the whole dataset. If you send a `filters` key, the API ignores it
> and returns the same suggestions as a request without it.

### Response body

| Field | Type | Description |
| - | - | - |
| `suggestions` | array | Matching values sorted by relevance (or by frequency when `query` is empty). |
| `suggestions[].value` | string | The exact field value to reuse in a Company Search filter. |

### Rate limits and pricing

**Pricing:** `Free`.

* **Rate limits:** For current plan-specific limits, see
  [Rate limits](https://docs.crustdata.com/general/rate-limits.md).

***

## When to use autocomplete

Use this endpoint when you want to:

* Build filter dropdowns or typeahead inputs in your product.
* Validate the exact values a Company Search filter expects.
* Explore the dataset vocabulary for a field before writing search queries.

***

## Your first autocomplete request: discover industry values

Start with the field you want to query and a partial search string. Here,
`tech` returns matching values from `basic_info.industries`.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
	--url https://api.crustdata.com/company/search/autocomplete \
	--header 'authorization: Bearer YOUR_API_KEY' \
	--header 'content-type: application/json' \
	--header 'x-api-version: 2025-11-01' \
	--data '{
		"field": "basic_info.industries",
		"query": "tech",
		"limit": 5
	}'
```

```json Response theme={"theme":"vitesse-black"}
{
    "suggestions": [
        { "value": "Technology, Information and Media" },
        { "value": "Technology, Information and Internet" },
        { "value": "Information Technology & Services" },
        { "value": "Technical and Vocational Training" },
        { "value": "Space Research and Technology" }
    ]
}
```

### Understanding the response

Autocomplete returns an object with one key:

* **`suggestions`** — an array of matching values, sorted by relevance. Each suggestion contains:
  * **`value`** — the exact field value to reuse in a Company Search filter.

Use the returned `value` exactly as-is in your next search request. This
avoids empty results caused by typos, casing differences, or unsupported
variants.

When `query` is non-empty, suggestions are ranked by match relevance. When
`query` is an empty string, suggestions are ranked by frequency.

***

## Examples

Worked recipes you can copy, paste, and adapt. Each example is a full working
request you can adapt to your own fields.

> [accordion] Autocomplete company names
>
> Use `basic_info.name` to surface company names matching a partial string.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
> 	--url https://api.crustdata.com/company/search/autocomplete \
> 	--header 'authorization: Bearer YOUR_API_KEY' \
> 	--header 'content-type: application/json' \
> 	--header 'x-api-version: 2025-11-01' \
> 	--data '{
> 		"field": "basic_info.name",
> 		"query": "hub",
> 		"limit": 5
> 	}'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "suggestions": [
>         { "value": "HubSpot" },
>         { "value": "HUB International" },
>         { "value": "HubSpot Academy" },
>         { "value": "Hublot" },
>         { "value": "Hubbell Incorporated" }
>     ]
> }
> ```

> [accordion] Get the most common values for a field
>
> Use an empty string for `query` when you want the most frequent values
> instead of a text match. This is useful when you are exploring a field for
> the first time.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
> 	--url https://api.crustdata.com/company/search/autocomplete \
> 	--header 'authorization: Bearer YOUR_API_KEY' \
> 	--header 'content-type: application/json' \
> 	--header 'x-api-version: 2025-11-01' \
> 	--data '{
> 		"field": "locations.country",
> 		"query": "",
> 		"limit": 10
> 	}'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "suggestions": [
>         { "value": "United States of America" },
>         { "value": "France" },
>         { "value": "Germany" },
>         { "value": "United Kingdom" },
>         { "value": "Italy" },
>         { "value": "Australia" },
>         { "value": "United States" },
>         { "value": "India" },
>         { "value": "Spain" },
>         { "value": "Brazil" }
>     ]
> }
> ```
>
> Suggestions are ranked by frequency, so you can quickly see the most common
> values in the dataset.
>
> You can pass a suggested country name to the `locations.country` filter in
> [Search](https://docs.crustdata.com/company-docs/search/introduction.md). Two names for the same country,
> such as `"United States"` and `"United States of America"`, return the same
> companies.

> [accordion] Full workflow: Autocomplete → Search → Enrich
>
> This is the canonical end-to-end Company API workflow. You do not know the
> exact industry value the Search API expects. Autocomplete discovers it,
> Search finds matching companies, and Enrich fills in the details.
>
> ### Step 1: Discover valid industry values
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search/autocomplete \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{"field": "basic_info.industries", "query": "software", "limit": 3}'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "suggestions": [
>         { "value": "Software Development" },
>         { "value": "IT System Custom Software Development" },
>         { "value": "Mobile Computing Software Products" }
>     ]
> }
> ```
>
> **Extract:** Take `suggestions[0].value` → `"Software Development"`. Use this
> exact string in your Search filter.
>
> **If empty:** If `suggestions` is `[]`, your query did not match any indexed
> values. Try a broader term (for example, `"tech"` instead of
> `"software engineering"`).
>
> ### Step 2: Search for matching companies
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {"field": "basic_info.industries", "type": "in", "value": ["Software Development"]},
>         {"field": "locations.country", "type": "=", "value": "USA"}
>       ]
>     },
>     "sorts": [{"field": "headcount.total", "order": "desc"}],
>     "limit": 3,
>     "fields": ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "headcount.total"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 12345,
>             "basic_info": { "name": "Acme Corp", "primary_domain": "acme.com" },
>             "headcount": { "total": 8500 }
>         },
>         {
>             "crustdata_company_id": 67890,
>             "basic_info": { "name": "Retool", "primary_domain": "retool.com" },
>             "headcount": { "total": 450 }
>         },
>         {
>             "crustdata_company_id": 628895,
>             "basic_info": {
>                 "name": "Serve Robotics",
>                 "primary_domain": "serverobotics.com"
>             },
>             "headcount": { "total": 120 }
>         }
>     ],
>     "next_cursor": "H4sIAJj5zGkC...",
>     "total_count": 217318
> }
> ```
>
> **Extract:** Take `companies[].crustdata_company_id` values →
> `[12345, 67890, 628895]`. Pass these to Enrich.
>
> **If empty:** If `companies` is `[]`, no companies matched your filters.
> Broaden your conditions or re-run autocomplete to verify filter values.
>
> **To get more results:** Pass `next_cursor` as `cursor` in the next request.
> Stop paginating when `next_cursor` is `null`. See
> [Pagination & sorting](https://docs.crustdata.com/company-docs/search/reference.md#paginate-through-results).
>
> ### Step 3: Enrich the top matches
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "crustdata_company_ids": [12345, 67890, 628895],
>     "fields": ["basic_info", "headcount", "funding", "hiring"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "12345",
>         "match_type": "crustdata_company_id",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "company_data": {
>                     "basic_info": {
>                         "name": "Acme Corp",
>                         "primary_domain": "acme.com",
>                         "company_type": "Privately Held",
>                         "year_founded": 2015
>                     },
>                     "headcount": { "total": 8500 },
>                     "funding": {
>                         "total_investment_usd": 250000000,
>                         "last_round_type": "series_d"
>                     },
>                     "hiring": { "openings_count": 42 }
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> **Extract:** Each item in the top-level array corresponds to one input ID.
> Access the profile via `response[i].matches[0].company_data`.
>
> **If a match is empty:** If `matches` is `[]` for an identifier, that company
> was not found. The request still succeeds (`200 OK`) for the other
> identifiers. See
> [Partial batch failure](https://docs.crustdata.com/company-docs/enrichment/reference.md#partial-batch-failure).

***

## Reference

Reference material for Company Autocomplete: common fields you can
autocomplete, errors, and the API summary.

### Common fields to autocomplete

| Field | Why you would use it |
| - | - |
| `basic_info.industries` | Find exact industry labels before building industry filters. |
| `basic_info.name` | Surface company names matching a partial string. |
| `basic_info.markets` | Discover indexed market labels (e.g. `NASDAQ`, `NYSE`). |
| `basic_info.employee_count_range` | List the canonical employee-count bucket labels. |
| `taxonomy.professional_network_industry` | Match primary industry values used in company search. |
| `taxonomy.professional_network_specialities` | Discover specialty tags used by the dataset. |
| `taxonomy.categories` | List the high-level category tags used by the dataset. |
| `locations.country` | Discover country values used by the indexed dataset. |
| `locations.headquarters` | Discover indexed HQ location strings. |
| `basic_info.company_type` | Explore company type labels used in the dataset. |
| `funding.last_round_type` | Find valid funding stage labels before filtering by recent financing data. |
| `funding.investors` | Discover investor names indexed in the dataset. |
| `revenue.acquisition_status` | List the indexed acquisition status labels. |
| `revenue.public_markets.stock_symbols` | Discover indexed ticker symbols for public companies. |
| `revenue.public_markets.fiscal_year_end` | Closed enum: returns the twelve calendar months in chronological order. |
| `technology` | Discover detected technology names for the `technographics.technologies.name` and `technographics.top_technologies` search filters. |
| `technology_category` | Discover technology category slugs for the `technographics.technologies.category` search filter. |

> [!NOTE]
>
> The `field` parameter accepts a broader set than this table — the table
> highlights the most useful fields for building filter dropdowns. For the
> full live allowlist, send a deliberately invalid `field` and read the
> `Valid fields` list returned in the `400` error. The shape of that error
> message is for debugging only and may change without notice.

> [!TIP]
>
> `revenue.public_markets.fiscal_year_end` is a **closed-enum** static
> field — an empty `query` returns the twelve months
> (`January`...`December`) in chronological order without any backend
> lookup. Use it to populate a static fiscal-year-end dropdown without an
> extra round-trip.

### Common errors and edge cases

If no values match your query, the API returns an empty array:

```json theme={"theme":"vitesse-black"}
{
    "suggestions": []
}
```

If you send an unsupported field name, the API returns a `400` with the list
of valid fields:

```json theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Field 'invalid_field' is not supported on scope 'company'. Valid fields: basic_info.company_type, basic_info.employee_count_range, basic_info.industries, basic_info.markets, basic_info.name, basic_info.primary_domain, ...",
        "metadata": []
    }
}
```

If that happens, double-check the field path against the supported list and
use a field that is available in the indexed Company Search schema.

### API reference summary

| Detail | Value |
| - | - |
| **Endpoint** | `POST /company/search/autocomplete` |
| **Auth** | Bearer token + `x-api-version: 2025-11-01` |
| **Required params** | `field`, `query` |
| **Optional params** | `limit` (default: 20, max: 100) |
| **Response** | `{ "suggestions": [{ "value": "..." }] }` |
| **Empty result** | `200` with `"suggestions": []` |
| **Errors** | `400` (unsupported field), `401` (bad auth), `500` (server error) |

For pricing, see [Pricing](https://docs.crustdata.com/general/pricing.md). For rate-limit guidance, see
[Rate limits](https://docs.crustdata.com/general/rate-limits.md).

See the [full API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md) for the
complete OpenAPI schema.

***

## What to do next

* **Use values in a search** — head to [Company Search](https://docs.crustdata.com/company-docs/search/introduction.md) once you've picked a value.
* **Enrich a company** — use [Company Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md) after you find a company.


## Related topics

- [Job Autocomplete API](https://docs.crustdata.com/job-docs/autocomplete/introduction.md)
- [Person Autocomplete API](https://docs.crustdata.com/person-docs/autocomplete/introduction.md)
- [API Introduction](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md)
- [Company Identify API](https://docs.crustdata.com/company-docs/identify/introduction.md)
- [Company Enrichment API](https://docs.crustdata.com/company-docs/enrichment/introduction.md)
