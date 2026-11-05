> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Company Search API

> Learn how to search for companies using structured filters, natural-language relevance, or both.

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | All plans. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | Yes, with the free credits every new self-serve account gets |
| **Credit cost** | 0.03 credits per result. [Premium field groups](https://docs.crustdata.com/general/pricing.md#premium-fields-in-search) cost extra, from 0.1 credits per result |
| **Rate limit** | 30 requests per minute |

**Use this when** you want to explore a market, build a target account list, or
find companies by what they do. You can search with structured filters,
natural-language relevance, or both.

The Company Search API lets you find companies by domain, country, industry,
revenue, funding, headcount, product focus, business model, and more. This page
walks you through structured and ranked search, the response shape, and worked
examples you can adapt. For the operator list, field catalog, and validation
rules, see [Search reference](https://docs.crustdata.com/company-docs/search/reference.md).

Every request goes to the same endpoint:

```
POST https://api.crustdata.com/company/search
```

> [!NOTE]
>
> Replace `YOUR_API_KEY` in each example with your actual API key. All
> requests require the `x-api-version: 2025-11-01` header.

### Request body

| Parameter | Type | Required | Default | Description |
| - | - | - | - | - |
| `filters` | object | Conditional | - | Structured filters. Required when `search` is omitted. With ranked search, filters are applied before retrieval. |
| `search` | object | Conditional | - | Natural-language ranked search. Required when `filters` is omitted. See [`search` fields](#search-fields). |
| `fields` | string\[] | No | all fields | Dot-path fields to include in each company object. `crustdata_company_id` is always included. Always specify in production. |
| `sorts` | object\[] | No | - | Field sort rules for filter-only search. Not supported with `search`. |
| `limit` | integer | No | `20` | Results per page. Max: `1000` for filter-only search and `100` for ranked search. |
| `cursor` | string | No | - | Pass the previous response's `next_cursor` to continue either filter-only or ranked search. |

#### `search` fields

| Field | Type | Required | Default | Description |
| - | - | - | - | - |
| `query` | string | Yes | - | A non-empty natural-language description of the companies you want to find. |
| `mode` | string | No | `hybrid` | `hybrid` uses keyword and semantic retrieval, `lexical` uses keywords, and `semantic` uses embeddings. |

### Find companies by what they do

Use ranked search when your criteria describe a product, capability, or business
model that does not map cleanly to a filter field. This request combines a
natural-language query with a hard country filter.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/company/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "search": {
      "query": "AI infrastructure companies building tools for model deployment and monitoring",
      "mode": "hybrid"
    },
    "filters": {
      "field": "locations.country",
      "type": "=",
      "value": "USA"
    },
    "fields": [
      "basic_info.name",
      "basic_info.primary_domain",
      "basic_info.description",
      "locations.headquarters",
      "headcount.total"
    ],
    "limit": 10
  }'
```

The filter remains exact. The API ranks only companies that satisfy it. Use
`hybrid` for most discovery queries. Use `lexical` when literal wording matters,
or `semantic` when conceptual similarity matters more than shared keywords.

### Match literal keywords

Use `lexical` mode when the exact words in the query matter. This mode uses
keyword retrieval without semantic vector matching.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/company/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "search": {
      "query": "MLOps model monitoring inference platform",
      "mode": "lexical"
    },
    "fields": [
      "basic_info.name",
      "basic_info.primary_domain",
      "basic_info.description"
    ],
    "limit": 10
  }'
```

### Find conceptually similar companies

Use `semantic` mode when companies may describe the same capability with
different terminology. This mode uses embedding similarity without keyword
retrieval.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/company/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "search": {
      "query": "platforms that help engineering teams observe and troubleshoot distributed systems",
      "mode": "semantic"
    },
    "fields": [
      "basic_info.name",
      "basic_info.primary_domain",
      "basic_info.description"
    ],
    "limit": 10
  }'
```

> [!TIP]
>
> **Looking for the list of fields you can filter on?** See [Searchable
> fields](https://docs.crustdata.com/company-docs/search/reference.md#searchable-fields) in the search
> reference for the full table of `filters.field` values (with sortable
> flags). Use [Autocomplete](https://docs.crustdata.com/company-docs/autocomplete/introduction.md) to
> discover valid *values* for fields like `basic_info.industries`,
> `taxonomy.professional_network_industry`, or `locations.country`.

### Response body

| Field | Type | Description |
| - | - | - |
| `companies` | array | Matching company records with `crustdata_company_id` and the requested `fields`. |
| `next_cursor` | string or null | Cursor for the next page. `null` when no more pages. |
| `total_count` | integer or null | Always `null` for ranked search. Filter-only totals may also be `null`. |

### Ranked pagination

Ranked search supports pagination in `hybrid`, `lexical`, and `semantic` modes.
Set `limit` to the number of results you want per page, from 1 to 100. Pass
`next_cursor` back as `cursor` to continue beyond the first 100 results.

A ranked search exposes at most 1,000 candidate positions, not an exhaustive
list of every matching company. The first 100 candidates are reranked. Later
results use retrieval ranking without another reranking pass.

Keep the same `search`, `filters`, and `x-api-version` on subsequent requests.
You can change `limit` and authorized `fields`. Cursors expire 20 minutes after
the initial search; paging does not extend that time. If a cursor expires or
becomes invalid, restart without `cursor`.

Continue until `next_cursor` is `null`, even if a page is short or empty.
Company records can change between pages. See the
[pagination reference](https://docs.crustdata.com/company-docs/search/reference.md#ranked-pagination) for details.

### Rate limits and credits

**Pricing:** `0.03 credits per result`, plus a
per-result charge for each premium group you filter on or receive: taxonomy
`0.1`; followers, headcount, funding, hiring, software reviews
and maps `0.2`; technographics `1` on the filter side
only. Filtering and receiving bill separately, and sorting is free. Premium
groups are returned when you name them in `fields`, or when your
plan includes them at no charge, so a plain request costs the base price. A
request with no results does not consume credits. The full table is under
[Premium fields in search](https://docs.crustdata.com/general/pricing.md#premium-fields-in-search). For
your own prices, open the [**Pricing** tab](https://app.crustdata.com/endpoints/company-search#pricing) in the
dashboard or call [`/account/endpoints`](https://docs.crustdata.com/general/permissions).

* **Rate limit:** 30 requests per minute.

> [!NOTE]
>
> Search results are intentionally lightweight so you can explore and segment
> companies at a low credit cost. When you need the full company profile, use
> [Company Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md).

> [card] [Examples](#examples)
>
> `or`/nested logic, well-funded-by-country, recently founded.

> [card] [Pagination & sorting](https://docs.crustdata.com/company-docs/search/reference.md#paginate-through-results)
>
> Cursor-based pagination and sort rules for stable ordering.

> [card] [Reference](https://docs.crustdata.com/company-docs/search/reference.md)
>
> Operators, searchable fields, response fields, validation, errors.

***

## Your first search: find a company by domain

The simplest search finds a company by its exact primary domain. You pass a single filter with the `=` operator.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/company/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "field": "basic_info.primary_domain",
      "type": "=",
      "value": "retool.com"
    },
    "limit": 1,
    "fields": [
      "crustdata_company_id",
      "basic_info.name",
      "basic_info.primary_domain",
      "basic_info.year_founded",
      "headcount.total",
      "locations.country",
      "funding.total_investment_usd"
    ]
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "companies": [
        {
            "crustdata_company_id": 633593,
            "basic_info": {
                "name": "Retool",
                "primary_domain": "retool.com",
                "year_founded": 2017
            },
            "headcount": {
                "total": 443
            },
            "locations": {
                "country": "United States"
            },
            "funding": {
                "total_investment_usd": 141000000.0
            }
        }
    ],
    "next_cursor": "H4sIAMWlBWoC_xXMMQ7DIAxA0atEzB2MDYb0KlUVgTHKUBU1IUMV5e6l6_vSP83n0O27rGlfzX0yORcIzqGr3iolmIWkAGCiEH0pGB2j44pBVLmCEFPNA0AtxiRgbpPZ29bH68FEfqbnkN56ei3Sjvc_2OsHdWUiVXYAAAA=",
    "total_count": 1
}
```

### Understanding the response

Every search response has three fields:

* **`companies`**: an array of matching company records. Each record contains `crustdata_company_id` and the fields you requested in `fields`.
* **`next_cursor`** — a pagination token. Pass it in the next request to get the next page. `null` means there are no more pages.
* `total_count` is always `null` for ranked search. For filter-only search, it reports the matching count when available.

### How to interpret results

* **`next_cursor` is `null`:** You have reached the last page. No more results.
* `total_count` is `null`: Ranked searches do not report a total. Filter-only totals can also be unavailable. Use `next_cursor` to decide whether to continue.
* Empty `companies` array: On a ranked continuation, records may have changed or no longer match. Continue if `next_cursor` is present. If it is `null`, the search has ended.

### Controlling which fields come back

The `fields` parameter lets you pick exactly which fields to include. This keeps your responses small and focused. If you omit `fields`, the API returns all available fields for each company.

Each company always includes `crustdata_company_id`, even when you do not request it. Every field you request is in the response. If a company has no data for a field, its value is `null`. If a requested group has no data, the whole group is `null`, even when you asked for one of its sub-fields. For example, a company with no maps data returns `{"crustdata_company_id": 1128887, "maps": null}` for `"fields": ["maps"]`.

***

## Combine filters with `and`

Real searches need more than one criterion. Wrap multiple conditions inside an `op: "and"` group to require all of them.

This search finds software development companies headquartered in the USA, sorted by headcount (largest first).

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/company/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "op": "and",
      "conditions": [
        {
          "field": "taxonomy.professional_network_industry",
          "type": "=",
          "value": "Software Development"
        },
        {
          "field": "locations.country",
          "type": "in",
          "value": ["USA"]
        }
      ]
    },
    "sorts": [{"field": "headcount.total", "order": "desc"}],
    "limit": 2,
    "fields": [
      "crustdata_company_id",
      "basic_info.name",
      "basic_info.primary_domain",
      "headcount.total",
      "locations.country"
    ]
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "companies": [
        {
            "crustdata_company_id": 4926893,
            "basic_info": {
                "name": "Google",
                "primary_domain": "goo.gle"
            },
            "headcount": {
                "total": 297296
            },
            "locations": {
                "country": "United States"
            }
        },
        {
            "crustdata_company_id": 2110301,
            "basic_info": {
                "name": "Microsoft",
                "primary_domain": "microsoft.com"
            },
            "headcount": {
                "total": 232354
            },
            "locations": {
                "country": "United States"
            }
        }
    ],
    "next_cursor": "H4sIAEmBw2oC_xXMSQ7DIAxA0asg1lnYGDP...",
    "total_count": 178460
}
```

> [!NOTE]
>
> Response trimmed for clarity.

The key difference from the first example: instead of a single `filters` object, you now have a group with `op: "and"` and a `conditions` array. Every condition must match for a company to be included.

For `or` and nested logic, or for finding well-funded or recently founded
companies, see the [Examples](#examples) below. To walk through
large result sets, see
[Pagination and sorting](https://docs.crustdata.com/company-docs/search/reference.md#paginate-through-results).

***

## Examples

Worked recipes you can copy, paste, and adapt. Each example is a full working
request. For the core walkthrough (first search, combining filters with `and`),
see the sections above. For the operator list, field catalog, and validation
rules, see [Search reference](https://docs.crustdata.com/company-docs/search/reference.md).

> [accordion] Continue a ranked search with a cursor
>
> This example uses two results per page to keep the responses short. You can
> request up to 100 per page. Start without a cursor:
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '
> {
>   "search": {
>     "query": "software companies",
>     "mode": "hybrid"
>   },
>   "fields": [
>     "crustdata_company_id"
>   ],
>   "limit": 2
> }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>   "companies": [
>     {
>       "crustdata_company_id": 64622008
>     },
>     {
>       "crustdata_company_id": 19270920
>     }
>   ],
>   "next_cursor": "NEXT_CURSOR_FROM_RESPONSE",
>   "total_count": null
> }
> ```
>
> For the next page, copy the actual `next_cursor` into `cursor`. The cursor
> strings below are placeholders; company IDs are from the live validation.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '
> {
>   "search": {
>     "query": "software companies",
>     "mode": "hybrid"
>   },
>   "fields": [
>     "crustdata_company_id"
>   ],
>   "limit": 2,
>   "cursor": "PASTE_NEXT_CURSOR_VALUE_HERE"
> }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>   "companies": [
>     {
>       "crustdata_company_id": 1049850
>     },
>     {
>       "crustdata_company_id": 10567734
>     }
>   ],
>   "next_cursor": "NEXT_CURSOR_FROM_RESPONSE",
>   "total_count": null
> }
> ```
>
> Repeat with each returned cursor until `next_cursor` is `null`. Keep the query,
> mode, filters, and API version unchanged. Replaying the same cursor preserves
> candidate order while the search session remains valid.

> [accordion] Find companies with hybrid search and a hard filter
>
> Use `hybrid` mode for broad discovery across keywords and concepts. Add a
> structured filter when part of your criteria must match exactly.
>
> This request finds AI infrastructure companies focused on model deployment and
> monitoring, then restricts the candidates to companies in the USA.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "search": {
>       "query": "AI infrastructure companies building tools for model deployment and monitoring",
>       "mode": "hybrid"
>     },
>     "filters": {
>       "field": "locations.country",
>       "type": "=",
>       "value": "USA"
>     },
>     "fields": [
>       "basic_info.name",
>       "basic_info.primary_domain",
>       "locations.headquarters",
>       "headcount.total"
>     ],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>   "companies": [
>     {
>       "crustdata_company_id": 11925064,
>       "basic_info": {
>         "name": "LlamaFarm",
>         "primary_domain": "llamafarm.dev"
>       },
>       "headcount": { "total": 3 },
>       "locations": {
>         "headquarters": "Raleigh, North Carolina, United States"
>       }
>     },
>     {
>       "crustdata_company_id": 74887750,
>       "basic_info": {
>         "name": "Prime Runtime",
>         "primary_domain": "prime-runtime.com"
>       },
>       "headcount": { "total": null },
>       "locations": {
>         "headquarters": "Los Angeles, California, United States"
>       }
>     }
>   ],
>   "next_cursor": null,
>   "total_count": null
> }
> ```
>
> The country filter is a hard constraint. The API ranks the matching companies
> against the natural-language query.

> [accordion] Find companies with lexical keyword search
>
> Use `lexical` mode when the words in your query matter more than conceptual
> similarity. This request looks for company descriptions that match a set of
> MLOps terms.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "search": {
>       "query": "MLOps model monitoring inference platform",
>       "mode": "lexical"
>     },
>     "fields": [
>       "basic_info.name",
>       "basic_info.primary_domain"
>     ],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>   "companies": [
>     {
>       "crustdata_company_id": 31989925,
>       "basic_info": {
>         "name": "Soneva.AI",
>         "primary_domain": "soneva.ai"
>       }
>     },
>     {
>       "crustdata_company_id": 16864769,
>       "basic_info": {
>         "name": "Uplatz MLOps & LLMOps Studio",
>         "primary_domain": "uplatz.com"
>       }
>     }
>   ],
>   "next_cursor": null,
>   "total_count": null
> }
> ```

> [accordion] Find conceptually similar companies with semantic search
>
> Use `semantic` mode when relevant companies may describe the same capability
> with different words. This request finds platforms that help engineering teams
> observe and troubleshoot distributed systems.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "search": {
>       "query": "platforms that help engineering teams observe and troubleshoot distributed systems",
>       "mode": "semantic"
>     },
>     "fields": [
>       "basic_info.name",
>       "basic_info.primary_domain"
>     ],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>   "companies": [
>     {
>       "crustdata_company_id": 63680745,
>       "basic_info": {
>         "name": "FinkyAgents",
>         "primary_domain": "finkyagents.ai"
>       }
>     },
>     {
>       "crustdata_company_id": 22734869,
>       "basic_info": {
>         "name": "Observal",
>         "primary_domain": "observal.io"
>       }
>     }
>   ],
>   "next_cursor": null,
>   "total_count": null
> }
> ```

> [accordion] Use or and nested logic
>
> Use `op: "or"` when a company should match **any** condition. You can also nest `and`/`or` groups for complex queries.
>
> This search finds companies that are either in the software development
> industry or have over \$5M in total investment, AND are headquartered in the
> USA.
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
>         {
>           "op": "or",
>           "conditions": [
>             {
>               "field": "taxonomy.professional_network_industry",
>               "type": "=",
>               "value": "Software Development"
>             },
>             {
>               "field": "funding.total_investment_usd",
>               "type": ">",
>               "value": 5000000
>             }
>           ]
>         },
>         {
>           "field": "locations.country",
>           "type": "=",
>           "value": "USA"
>         }
>       ]
>     },
>     "sorts": [{"field": "headcount.total", "order": "desc"}],
>     "limit": 2,
>     "fields": [
>       "crustdata_company_id",
>       "basic_info.name",
>       "headcount.total",
>       "taxonomy.professional_network_industry",
>       "funding.total_investment_usd"
>     ]
>   }'
> ```
>
> The outer `and` requires both conditions: the inner `or` matches either
> software development companies or well-funded companies, and the outer
> condition restricts to US-headquartered companies.

> [accordion] Find well-funded companies in a country
>
> This is a common pattern for sales and investor research: find companies in a specific market with significant funding. This search finds US-based companies with over \$10M in total investment, sorted by funding (highest first).
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
>         {
>           "field": "locations.country",
>           "type": "in",
>           "value": ["USA"]
>         },
>         {
>           "field": "funding.total_investment_usd",
>           "type": ">",
>           "value": 10000000
>         }
>       ]
>     },
>     "sorts": [{"field": "funding.total_investment_usd", "order": "desc"}],
>     "limit": 2,
>     "fields": [
>       "crustdata_company_id",
>       "basic_info.name",
>       "basic_info.primary_domain",
>       "locations.country",
>       "funding.total_investment_usd",
>       "headcount.total"
>     ]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 6035590,
>             "basic_info": {
>                 "name": "VMware",
>                 "primary_domain": "broadcom.com"
>             },
>             "locations": {
>                 "country": "United States"
>             },
>             "funding": {
>                 "total_investment_usd": 100000000000.0
>             },
>             "headcount": {
>                 "total": 11925
>             }
>         },
>         {
>             "crustdata_company_id": 631466,
>             "basic_info": {
>                 "name": "OpenAI",
>                 "primary_domain": "openai.com"
>             },
>             "locations": {
>                 "country": "United States"
>             },
>             "funding": {
>                 "total_investment_usd": 79000120000.0
>             },
>             "headcount": {
>                 "total": 7397
>             }
>         }
>     ],
>     "next_cursor": "H4sIAC1xqGkC_w3MOw7CMAwA0KtEmTv4E...",
>     "total_count": null
> }
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity.

> [accordion] Filter by revenue and latest funding details
>
> Combine estimated revenue bounds with the latest funding round type, date, and
> amount. You can also require an investor to appear in the company's funding
> history.
>
> This search finds companies whose estimated revenue range is entirely between
> $1M and $50M, whose latest round was Series A or Series B on or after
> 2025-01-01, whose latest round raised at least \$5M, and that list Sequoia
> Capital as an investor.
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
>         {"field": "revenue.estimated.lower_bound_usd", "type": "=>", "value": 1000000},
>         {"field": "revenue.estimated.upper_bound_usd", "type": "=<", "value": 50000000},
>         {"field": "funding.last_round_type", "type": "in", "value": ["series_a", "series_b"]},
>         {"field": "funding.last_fundraise_date", "type": "=>", "value": "2025-01-01"},
>         {"field": "funding.last_round_amount_usd", "type": "=>", "value": 5000000},
>         {"field": "funding.investors", "type": "in", "value": ["Sequoia Capital"]}
>       ]
>     },
>     "sorts": [{"field": "funding.last_fundraise_date", "order": "desc"}],
>     "limit": 1,
>     "fields": [
>       "crustdata_company_id",
>       "basic_info.name",
>       "basic_info.primary_domain",
>       "revenue.estimated.lower_bound_usd",
>       "revenue.estimated.upper_bound_usd",
>       "funding.last_round_type",
>       "funding.last_fundraise_date",
>       "funding.last_round_amount_usd",
>       "funding.investors"
>     ]
>   }'
> ```
>
> > [!NOTE]
> >
> > `funding.investors` contains known investors across the company's funding
> > history. Combining it with `funding.last_*` filters means the company has
> > that investor and its latest round matches the other conditions. It does
> > not mean that investor participated in the latest round.

> [accordion] Find recently founded companies
>
> Use comparison operators like `>` and `<` on numeric or date fields. This search finds companies founded after 2020, sorted by headcount.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "basic_info.year_founded",
>       "type": ">",
>       "value": 2020
>     },
>     "sorts": [{"field": "headcount.total", "order": "desc"}],
>     "limit": 2,
>     "fields": [
>       "crustdata_company_id",
>       "basic_info.name",
>       "basic_info.year_founded",
>       "headcount.total",
>       "locations.country"
>     ]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 4069929,
>             "basic_info": {
>                 "name": "Kendi İşim",
>                 "year_founded": 2023
>             },
>             "headcount": {
>                 "total": 181137
>             },
>             "locations": {
>                 "country": "Turkey"
>             }
>         },
>         {
>             "crustdata_company_id": 1038926,
>             "basic_info": {
>                 "name": "Stellantis",
>                 "year_founded": 2021
>             },
>             "headcount": {
>                 "total": 114361
>             },
>             "locations": {
>                 "country": "Netherlands"
>             }
>         }
>     ],
>     "next_cursor": "H4sIAC9xqGkC_w3MMQ7CMAwF0KtEmTvEdkh...",
>     "total_count": null
> }
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity.

> [accordion] Find companies by team size in a function
>
> Filter on `roles.distribution.<function>` to find companies by the number of employees in a specific function — for example, companies with a large engineering team. Combine it with an industry or location filter to narrow the result.
>
> ```bash Request — software companies with 1,000+ engineers theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "taxonomy.professional_network_industry", "type": "=", "value": "Software Development" },
>         { "field": "roles.distribution.engineering", "type": ">", "value": 1000 }
>       ]
>     },
>     "fields": ["basic_info.name", "basic_info.primary_domain", "headcount.total"],
>     "sorts": [{ "field": "headcount.total", "order": "desc" }],
>     "limit": 3
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         { "crustdata_company_id": 6034577, "basic_info": { "name": "Amazon", "primary_domain": "aboutamazon.com" }, "headcount": { "total": 771499 } },
>         { "crustdata_company_id": 4926893, "basic_info": { "name": "Google", "primary_domain": "goo.gle" }, "headcount": { "total": 342901 } },
>         { "crustdata_company_id": 2110301, "basic_info": { "name": "Microsoft", "primary_domain": "microsoft.com" }, "headcount": { "total": 231238 } }
>     ],
>     "next_cursor": "H4sIA...",
>     "total_count": 276
> }
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity.
>
> > [!WARNING]
> >
> > `roles.distribution.<function>` is **filter-only** — you can filter on it, but it is not returned in the search response (requesting it in `fields` returns `400`). Select `headcount.total` or other returnable fields instead. The valid function names are listed in the [searchable fields reference](https://docs.crustdata.com/company-docs/search/reference.md#searchable-fields).

> [accordion] Find high-growth mid-size companies
>
> Filter on the dotted period path `headcount.growth_percent.6m` to find companies whose 6-month headcount growth exceeds a threshold. The same shape applies to `.1m`, `.3m`, `.12m` and to `headcount.growth_absolute.*` for absolute employee deltas.
>
> ```bash Request — mid-size companies with >15% 6-month growth theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "headcount.growth_percent.6m", "type": ">", "value": 15 },
>         { "field": "headcount.total", "type": ">", "value": 200 },
>         { "field": "headcount.total", "type": "<", "value": 2000 }
>       ]
>     },
>     "fields": ["basic_info.name", "basic_info.primary_domain", "headcount.total", "headcount.growth_percent"],
>     "sorts": [{ "field": "headcount.total", "order": "desc" }],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 3117226,
>             "basic_info": { "name": "IRT", "primary_domain": "irt.uy" },
>             "headcount": {
>                 "total": 1991,
>                 "growth_percent": { "1m": 3.0, "3m": 3.0, "6m": 17.26, "12m": 32.73 }
>             }
>         },
>         {
>             "crustdata_company_id": 1082282,
>             "basic_info": { "name": "MS Office", "primary_domain": "msofice.org" },
>             "headcount": {
>                 "total": 1990,
>                 "growth_percent": { "1m": 29.22, "3m": 29.22, "6m": 32.76, "12m": 47.3 }
>             }
>         }
>     ],
>     "next_cursor": "H4sIAE5P...",
>     "total_count": 4685
> }
> ```
>
> > [!WARNING]
> >
> > The dotted period paths (`headcount.growth_percent.6m`, etc.) are
> > **filterable but not sortable** — passing one as a `sorts.field` returns
> > `400 "Unsupported columns"`. Sort on `headcount.total` (or another
> > sortable field) and use the growth filter to narrow the population.
>
> > [!NOTE]
> >
> > `/company/search` returns the growth map under period keys `1m`, `3m`,
> > `6m`, `12m`. The same underlying data is also returned by
> > [`/company/enrich`](https://docs.crustdata.com/company-docs/enrichment/introduction), but with
> > different keys (`mom`, `qoq`, `six_months`, `yoy`, `two_years`).

> [accordion] Find a company's competitors
>
> Pass a known company's `crustdata_company_id` to `competitors.company_ids` (or
> its domains to `competitors.websites`) to pull the companies Crustdata tracks
> as its competitors. Here, competitors of OpenAI (`631466`).
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "competitors.company_ids",
>       "type": "in",
>       "value": [631466]
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
>             "crustdata_company_id": 15358,
>             "basic_info": { "name": "Aprecomm", "primary_domain": "aprecomm.ai" },
>             "headcount": { "total": 75 }
>         },
>         {
>             "crustdata_company_id": 49618,
>             "basic_info": { "name": "Automaton AI Infosystem Pvt. Ltd.", "primary_domain": "automatonai.com" },
>             "headcount": { "total": 46 }
>         },
>         {
>             "crustdata_company_id": 609348,
>             "basic_info": { "name": "Cron AI", "primary_domain": "cronai.ai" },
>             "headcount": { "total": 37 }
>         }
>     ],
>     "next_cursor": "H4sIABHRQWoC_x...",
>     "total_count": 520
> }
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity.
>
> > [!WARNING]
> >
> > `competitors.company_ids` and `competitors.websites` are **filter-only** —
> > you can filter on them, but they are not returned in the response (passing
> > one in `fields` returns `400 "Invalid fields"`). Select returnable fields
> > like `headcount.total` instead.

> [accordion] Find companies backed by a specific investor
>
> Filter on `funding.investors` to find every company an investor has backed.
> This search finds Sequoia Capital portfolio companies, sorted by total funding.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "funding.investors",
>       "type": "in",
>       "value": ["Sequoia Capital"]
>     },
>     "sorts": [{"field": "funding.total_investment_usd", "order": "desc"}],
>     "limit": 3,
>     "fields": ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "funding.total_investment_usd"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 631466,
>             "basic_info": { "name": "OpenAI", "primary_domain": "openai.com" },
>             "funding": { "total_investment_usd": 201125120000.0 }
>         },
>         {
>             "crustdata_company_id": 635252,
>             "basic_info": { "name": "Anthropic", "primary_domain": "anthropic.com" },
>             "funding": { "total_investment_usd": 63740377627.0 }
>         },
>         {
>             "crustdata_company_id": 681042,
>             "basic_info": { "name": "Oracle", "primary_domain": "oracle.com" },
>             "funding": { "total_investment_usd": 55750000000.0 }
>         }
>     ],
>     "next_cursor": "H4sIABHRQWoC_y...",
>     "total_count": 1199
> }
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity. Request `funding.investors` in `fields` to
> > see the company's all-time investor list. This field does not identify
> > participants in a specific funding round.

> [accordion] Find educational institutions in a country
>
> Combine `basic_info.company_type` with an industry and a country filter — a
> common first step in alumni or talent-flow workflows. This search finds UK
> universities, ranked by headcount.
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
>         {"field": "basic_info.company_type", "type": "=", "value": "Educational Institution"},
>         {"field": "taxonomy.professional_network_industry", "type": "=", "value": "Higher Education"},
>         {"field": "locations.country", "type": "in", "value": ["GBR"]}
>       ]
>     },
>     "sorts": [{"field": "headcount.total", "order": "desc"}],
>     "limit": 3,
>     "fields": ["crustdata_company_id", "basic_info.name", "basic_info.company_type", "headcount.total", "locations.country"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 1201786,
>             "basic_info": { "name": "University of Oxford", "company_type": "Educational Institution" },
>             "headcount": { "total": 23154 },
>             "locations": { "country": "United Kingdom" }
>         },
>         {
>             "crustdata_company_id": 1182667,
>             "basic_info": { "name": "The University of Manchester", "company_type": "Educational Institution" },
>             "headcount": { "total": 20301 },
>             "locations": { "country": "United Kingdom" }
>         },
>         {
>             "crustdata_company_id": 770034,
>             "basic_info": { "name": "University of Birmingham", "company_type": "Educational Institution" },
>             "headcount": { "total": 14943 },
>             "locations": { "country": "United Kingdom" }
>         }
>     ],
>     "next_cursor": "H4sIABLRQWoC_x...",
>     "total_count": 3593
> }
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity.

> [accordion] Find companies by HQ country
>
> Filter on `locations.country` with a full country name, such as `Canada`, or
> an ISO 3166-1 alpha-3 code, such as `CAN`. Both forms return the same
> companies. This search finds companies with headquarters in Canada and more
> than 100 employees.
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
>         {"field": "locations.country", "type": "in", "value": ["Canada"]},
>         {"field": "headcount.total", "type": ">", "value": 100}
>       ]
>     },
>     "sorts": [{"field": "headcount.total", "order": "desc"}],
>     "limit": 3,
>     "fields": ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "headcount.total", "locations.country"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 890813,
>             "basic_info": { "name": "KPMG", "primary_domain": "kpmg.com" },
>             "headcount": { "total": 242950 },
>             "locations": { "country": "Canada" }
>         },
>         {
>             "crustdata_company_id": 909849,
>             "basic_info": { "name": "TD", "primary_domain": "td.com" },
>             "headcount": { "total": 105467 },
>             "locations": { "country": "Canada" }
>         },
>         {
>             "crustdata_company_id": 1049593,
>             "basic_info": { "name": "RBC", "primary_domain": "rbc.com" },
>             "headcount": { "total": 100576 },
>             "locations": { "country": "Canada" }
>         }
>     ],
>     "next_cursor": "H4sIAIuBw2oC_x...",
>     "total_count": 11794
> }
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity. The response returns the full country name, such as `"Canada"`, for either filter form. See [Normalized location facets](https://docs.crustdata.com/company-docs/search/reference.md#locations).

> [accordion] Search within a radius of headquarters
>
> The `geo_distance` filter finds companies whose headquarters is within a
> specific distance of a point. Apply it to the `locations.headquarters` field.
>
> This search finds companies with more than 100 employees headquartered within
> 50 km of Palo Alto.
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
>         {
>           "field": "locations.headquarters",
>           "type": "geo_distance",
>           "value": {
>             "location": "Palo Alto, CA",
>             "distance": 50,
>             "unit": "km"
>           }
>         },
>         {"field": "headcount.total", "type": ">", "value": 100}
>       ]
>     },
>     "limit": 25,
>     "fields": ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "headcount.total", "locations.headquarters", "locations.city", "locations.state", "locations.country"]
>   }'
> ```
>
> The `value` is an object whose centre is given as **either** a `location`
> string (geocoded server-side) **or** an explicit `lat_lng` pair (which skips
> geocoding). If both are supplied, `lat_lng` wins. `distance` is required and
> must be positive; `unit` is optional and defaults to `km` (also accepts `mi`,
> `miles`, `m`, `meters`, `ft`, `feet`). See the
> [`geo_distance` reference](https://docs.crustdata.com/company-docs/search/reference#geo_distance--radius-around-headquarters)
> for the full value-object table.
>
> ### Search by explicit coordinates
>
> Use `lat_lng` when you already have coordinates (for example, from a map
> picker) or you want to skip the geocoding step. The example below finds
> companies headquartered within 25 miles of latitude `37.4419`, longitude
> `-122.143` (Palo Alto).
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "locations.headquarters",
>       "type": "geo_distance",
>       "value": {
>         "lat_lng": [37.4419, -122.143],
>         "distance": 25,
>         "unit": "mi"
>       }
>     },
>     "limit": 5
>   }'
> ```

> [accordion] Exclude a geographic radius
>
> The `geo_exclude` filter is the inverse of `geo_distance` — it removes
> companies headquartered **inside** the radius and keeps everyone else. Use it
> to carve out a metro you already cover, or to target companies outside a
> region.
>
> This search finds companies that are **not** headquartered within 100 km of
> London.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "locations.headquarters",
>       "type": "geo_exclude",
>       "value": {
>         "location": "London, UK",
>         "distance": 100,
>         "unit": "km"
>       }
>     },
>     "limit": 5
>   }'
> ```
>
> `geo_exclude` accepts the same value object as `geo_distance` (`location` or
> `lat_lng`, a required `distance`, and an optional `unit`), so you can also
> exclude a radius around explicit coordinates.

> [accordion] Search inside a polygon
>
> The `geo_polygon` filter finds companies whose headquarters falls inside a
> polygon you describe with coordinates. Reach for it when a circle is the wrong
> shape for the area you care about, such as a sales territory or a metro
> boundary traced on a map. Apply it to the `locations.headquarters` field.
>
> This search finds companies with more than 100 employees headquartered inside
> a triangle covering the San Francisco peninsula.
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
>         {
>           "field": "locations.headquarters",
>           "type": "geo_polygon",
>           "value": {
>             "points": [[37.81, -122.52], [37.81, -122.35], [37.70, -122.35], [37.70, -122.52]]
>           }
>         },
>         {"field": "headcount.total", "type": ">", "value": 100}
>       ]
>     },
>     "limit": 25,
>     "fields": ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "headcount.total", "locations.headquarters", "locations.city", "locations.state", "locations.country"]
>   }'
> ```
>
> The `value` is an object with a single `points` key: a list of `[lat, lng]`
> pairs, at least 3 distinct points and at most 1,000. The polygon closes itself,
> so you do not need to repeat the first point. Coordinates are used as given and
> are not geocoded. See the
> [`geo_polygon` reference](https://docs.crustdata.com/company-docs/search/reference#geo_polygon-inside-a-polygon)
> for the value-object table and the `400` cases.

> [accordion] Find companies by follower count and growth
>
> Filter on `followers.count` and `followers.six_months_growth_percent` to find
> companies with a large, fast-growing audience.
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
>         {"field": "followers.count", "type": ">", "value": 100000},
>         {"field": "followers.six_months_growth_percent", "type": ">", "value": 20}
>       ]
>     },
>     "sorts": [{"field": "followers.count", "order": "desc"}],
>     "limit": 2,
>     "fields": ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "followers.count", "followers.six_months_growth_percent"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 7434923,
>             "basic_info": { "name": "Zip, a puzzle by LinkedIn", "primary_domain": "linkedin.com" },
>             "followers": { "count": 45891930, "six_months_growth_percent": 114.27916071283744 }
>         },
>         {
>             "crustdata_company_id": 1523288,
>             "basic_info": { "name": "Queens, a puzzle by LinkedIn", "primary_domain": "linkedin.com" },
>             "followers": { "count": 9457905, "six_months_growth_percent": 125.50956541643271 }
>         }
>     ],
>     "next_cursor": "H4sIABTRQWoC_x...",
>     "total_count": 1617
> }
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity. `followers.count` is sortable; the follower-growth fields are filterable but not sortable.

> [accordion] Look up companies by domain
>
> Pass one or more exact primary domains to `basic_info.primary_domain` with the
> `in` operator to resolve known domains in a single call.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "basic_info.primary_domain",
>       "type": "in",
>       "value": ["retool.com", "serverobotics.com"]
>     },
>     "limit": 10,
>     "fields": ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "headcount.total", "locations.country"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 628895,
>             "basic_info": { "name": "Serve Robotics", "primary_domain": "serverobotics.com" },
>             "headcount": { "total": 404 },
>             "locations": { "country": "United States" }
>         },
>         {
>             "crustdata_company_id": 633593,
>             "basic_info": { "name": "Retool", "primary_domain": "retool.com" },
>             "headcount": { "total": 416 },
>             "locations": { "country": "United States" }
>         }
>     ],
>     "next_cursor": null,
>     "total_count": 2
> }
> ```
>
> > [!TIP]
> >
> > A widely shared domain (for example, a platform domain that many small
> > profiles reuse) can return several low-headcount records alongside the
> > primary company. To resolve a single best-match company from a domain, use
> > [Company Identify](https://docs.crustdata.com/company-docs/identify/introduction.md) or
> > [Company Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md) with
> > `exact_match: true`.

> [accordion] Fetch specific companies by Crustdata ID
>
> When you already have `crustdata_company_id` values (from a previous search or
> Identify call), fetch those exact records with the `in` operator. This is the
> most deterministic way to pull specific companies.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "crustdata_company_id",
>       "type": "in",
>       "value": [631466, 635252]
>     },
>     "limit": 10,
>     "fields": ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "headcount.total"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 631466,
>             "basic_info": { "name": "OpenAI", "primary_domain": "openai.com" },
>             "headcount": { "total": 9538 }
>         },
>         {
>             "crustdata_company_id": 635252,
>             "basic_info": { "name": "Anthropic", "primary_domain": "anthropic.com" },
>             "headcount": { "total": 4832 }
>         }
>     ],
>     "next_cursor": null,
>     "total_count": 2
> }
> ```

> [accordion] Find recently IPO'd or acquired companies
>
> Use `revenue.public_markets.ipo_date` to find companies that went public in a
> date window, or `revenue.acquisition_status` to find acquired companies.
>
> **Companies that IPO'd in 2020–2021 (1,000+ employees):**
>
> ```bash Request — recent IPOs theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {"field": "basic_info.company_type", "type": "=", "value": "Public Company"},
>         {"field": "revenue.public_markets.ipo_date", "type": "=>", "value": "2020-01-01"},
>         {"field": "revenue.public_markets.ipo_date", "type": "=<", "value": "2021-12-31"},
>         {"field": "headcount.total", "type": ">", "value": 1000}
>       ]
>     },
>     "sorts": [{"field": "revenue.public_markets.ipo_date", "order": "desc"}],
>     "limit": 2,
>     "fields": ["basic_info.name", "basic_info.primary_domain", "revenue.public_markets.ipo_date", "headcount.total"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 1038926,
>             "basic_info": { "name": "Stellantis", "primary_domain": "stellantis.com" },
>             "revenue": { "public_markets": { "ipo_date": "2021-01-18" } },
>             "headcount": { "total": 117523 }
>         },
>         {
>             "crustdata_company_id": 6036985,
>             "basic_info": { "name": "Concentrix", "primary_domain": "concentrix.com" },
>             "revenue": { "public_markets": { "ipo_date": "2020-12-01" } },
>             "headcount": { "total": 218080 }
>         }
>     ],
>     "next_cursor": "H4sIAGjRQWoC_x...",
>     "total_count": 343
> }
> ```
>
> **Acquired software companies:**
>
> ```bash Request — acquired companies theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {"field": "revenue.acquisition_status", "type": "=", "value": "acquired"},
>         {"field": "taxonomy.professional_network_industry", "type": "=", "value": "Software Development"}
>       ]
>     },
>     "sorts": [{"field": "headcount.total", "order": "desc"}],
>     "limit": 2,
>     "fields": ["basic_info.name", "basic_info.primary_domain", "revenue.acquisition_status", "headcount.total"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 632439,
>             "basic_info": { "name": "Instagram", "primary_domain": "instagram.com" },
>             "revenue": { "acquisition_status": "acquired" },
>             "headcount": { "total": 53313 }
>         },
>         {
>             "crustdata_company_id": 780316,
>             "basic_info": { "name": "PayPal", "primary_domain": "paypal.com" },
>             "revenue": { "acquisition_status": "acquired" },
>             "headcount": { "total": 36990 }
>         }
>     ],
>     "next_cursor": "H4sIAGjRQWoC_y...",
>     "total_count": 12877
> }
> ```
>
> > [!NOTE]
> >
> > Responses trimmed for clarity. `revenue.acquisition_status` matches the lowercase value `"acquired"`.

> [accordion] Find companies by recent funding round
>
> Combine `funding.last_round_type` with `funding.last_fundraise_date` to find
> companies that recently raised a specific round. This search finds companies
> whose latest round was Series A/B/C and closed on or after 2024-01-01.
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
>         {"field": "funding.last_round_type", "type": "in", "value": ["series_a", "series_b", "series_c"]},
>         {"field": "funding.last_fundraise_date", "type": "=>", "value": "2024-01-01"}
>       ]
>     },
>     "sorts": [{"field": "funding.last_fundraise_date", "order": "desc"}],
>     "limit": 2,
>     "fields": ["basic_info.name", "basic_info.primary_domain", "funding.last_round_type", "funding.last_fundraise_date", "funding.last_round_amount_usd"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 689719,
>             "basic_info": { "name": "Upside", "primary_domain": "joinupside.com" },
>             "funding": { "last_round_type": "series_a", "last_fundraise_date": "2026-06-25", "last_round_amount_usd": 20000000.0 }
>         },
>         {
>             "crustdata_company_id": 809882,
>             "basic_info": { "name": "Warp", "primary_domain": "warp.co" },
>             "funding": { "last_round_type": "series_b", "last_fundraise_date": "2026-06-25", "last_round_amount_usd": 60000000.0 }
>         }
>     ],
>     "next_cursor": "H4sIAC_RQWoC_x...",
>     "total_count": 9749
> }
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity. Round-type values are lowercase with underscores (`series_a`, `series_b`). Use `=>` / `=<` for date ranges — `>=` and `<=` are not supported.

> [accordion] Find companies by category and market
>
> Filter on `taxonomy.categories` and `basic_info.markets` for fine-grained
> segmentation. This search finds AI companies in the software-development
> industry, ranked by headcount.
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
>         {"field": "taxonomy.categories", "type": "in", "value": ["Artificial Intelligence (AI)"]},
>         {"field": "basic_info.industries", "type": "in", "value": ["Software Development"]}
>       ]
>     },
>     "sorts": [{"field": "headcount.total", "order": "desc"}],
>     "limit": 2,
>     "fields": ["basic_info.name", "basic_info.primary_domain", "headcount.total"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 6034577,
>             "basic_info": { "name": "Amazon", "primary_domain": "aboutamazon.com" },
>             "headcount": { "total": 768927 }
>         },
>         {
>             "crustdata_company_id": 4926893,
>             "basic_info": { "name": "Google", "primary_domain": "goo.gle" },
>             "headcount": { "total": 308114 }
>         }
>     ],
>     "next_cursor": "H4sIAFjRQWoC_x...",
>     "total_count": 19844
> }
> ```
>
> > [!TIP]
> >
> > Case does not matter for category and market values under `in`, but the
> > wording does. Use [Autocomplete](https://docs.crustdata.com/company-docs/autocomplete/introduction.md)
> > to find the stored value. For example, the AI category is stored as
> > `"Artificial Intelligence (AI)"`. For public-market tags like `"NASDAQ"`,
> > filter on `basic_info.markets`.

> [accordion] Find companies by NAICS or SIC code
>
> Filter on `taxonomy.primary_naics_detail.naics_code` to find companies in one
> NAICS industry. Name `taxonomy.primary_naics_detail` and
> `taxonomy.sic_detail_list` in `fields` to get the classification back with
> each result. This search finds the largest US companies under NAICS 541511,
> Custom Computer Programming Services.
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
>         {"field": "taxonomy.primary_naics_detail.naics_code", "type": "=", "value": "541511"},
>         {"field": "locations.country", "type": "=", "value": "USA"}
>       ]
>     },
>     "sorts": [{"field": "headcount.total", "order": "desc"}],
>     "limit": 2,
>     "fields": ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "taxonomy.primary_naics_detail", "taxonomy.sic_detail_list"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 681181,
>             "basic_info": { "name": "Adobe", "primary_domain": "adobe.com" },
>             "taxonomy": {
>                 "primary_naics_detail": {
>                     "naics_code": "541511",
>                     "sector": "Professional, Scientific, and Technical Services",
>                     "sub_sector": "Professional, Scientific, and Technical Services",
>                     "industry_group": "Computer Systems Design and Related Services",
>                     "industry": "Custom Computer Programming Services",
>                     "year": 2022
>                 },
>                 "sic_detail_list": [
>                     { "sic_code": "7371", "industry": "Custom Computer Programming Services", "year": 1987 }
>                 ]
>             }
>         },
>         {
>             "crustdata_company_id": 821449,
>             "basic_info": { "name": "Outlier", "primary_domain": "outlier.ai" },
>             "taxonomy": {
>                 "primary_naics_detail": {
>                     "naics_code": "541511",
>                     "sector": "Professional, Scientific, and Technical Services",
>                     "sub_sector": "Professional, Scientific, and Technical Services",
>                     "industry_group": "Computer Systems Design and Related Services",
>                     "industry": "Custom Computer Programming Services",
>                     "year": 2022
>                 },
>                 "sic_detail_list": [
>                     { "sic_code": "7371", "industry": "Custom Computer Programming Services", "year": 1987 }
>                 ]
>             }
>         }
>     ],
>     "next_cursor": "H4sIAHl70moC_xXMSwrDIBAA0KsE11moM86nVykljKJkUSpNzCKU3r3p-sH7uPdRt3NZbV_dbXLBQkZKYs1b40bCHimHXIREUTzmFopCTMIIYhWkGmimAkrMAm6e3N63cV33qMJhniQGRH1cMPqw51L68fo7MiX6_gD2rxRygQAAAA==",
>     "total_count": 47656
> }
> ```
>
> > [!NOTE]
> >
> > The `taxonomy` group also returns both objects, and they have no price of
> > their own. To match on a SIC code instead, filter on
> > `taxonomy.sic_detail_list.sic_code`. Two `sic_code` conditions under `and`
> > match a company whose list holds both codes, even in different entries.
> > Most companies carry no NAICS or SIC classification and return `null` for
> > both. See the
> > [NAICS and SIC note](https://docs.crustdata.com/company-docs/search/reference.md#taxonomy) in the
> > search reference.

> [accordion] Find companies by type and fuzzy name match
>
> Use the `(.)` fuzzy operator on `basic_info.name` to match name variants and
> tolerate typos, combined with a `basic_info.company_type` filter. This search
> finds privately held companies with "robotics" in the name.
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
>         {"field": "basic_info.company_type", "type": "=", "value": "Privately Held"},
>         {"field": "basic_info.name", "type": "(.)", "value": "robotics"}
>       ]
>     },
>     "sorts": [{"field": "headcount.total", "order": "desc"}],
>     "limit": 3,
>     "fields": ["basic_info.name", "basic_info.primary_domain", "basic_info.company_type", "headcount.total"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 711967,
>             "basic_info": { "name": "ECOVACS ROBOTICS", "primary_domain": "ecovacs.com", "company_type": "Privately Held" },
>             "headcount": { "total": 1006 }
>         },
>         {
>             "crustdata_company_id": 1059224,
>             "basic_info": { "name": "VEX Robotics", "primary_domain": "vexrobotics.com", "company_type": "Privately Held" },
>             "headcount": { "total": 850 }
>         },
>         {
>             "crustdata_company_id": 1059591,
>             "basic_info": { "name": "Torc Robotics", "primary_domain": "torc.ai", "company_type": "Privately Held" },
>             "headcount": { "total": 848 }
>         }
>     ],
>     "next_cursor": "H4sIADHRQWoC_x...",
>     "total_count": 4428
> }
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity. `(.)` is fuzzy (tolerates typos, ignores word order); use `[.]` for exact token matching.

***

## What to do next

* **Paginate and sort** — see [Pagination and sorting](https://docs.crustdata.com/company-docs/search/reference.md#paginate-through-results) to walk through all matching companies.
* **Look up operators and fields** — see [Search reference](https://docs.crustdata.com/company-docs/search/reference.md) for operators, searchable fields, response fields, validation, and errors.
* **Enrich a company** — use [Company Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md) to get a detailed profile for a known company.
* **Discover filter values** — use [Company Autocomplete](https://docs.crustdata.com/company-docs/autocomplete/introduction.md) to find valid values for industries, categories, and countries before building search filters.


## Related topics

- [Batch Company Search API](https://docs.crustdata.com/company-docs/search/batch-search.md)
- [Company Autocomplete API](https://docs.crustdata.com/company-docs/autocomplete/introduction.md)
- [Search Companies](https://docs.crustdata.com/api-reference/company-apis/search-companies-with-indexed-fields-only.md)
- [Web Search API](https://docs.crustdata.com/web-docs/search/introduction.md)
- [Company Enrichment API](https://docs.crustdata.com/company-docs/enrichment/introduction.md)
