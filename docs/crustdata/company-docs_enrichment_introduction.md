> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Company Enrichment API

> Learn how to enrich company records using domains, profile URLs, names, or IDs, and get a detailed company profile.

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | All plans. Technographics is an add-on. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | Yes, with the free credits every new self-serve account gets |
| **Credit cost** | 2 credits per company, or 4 with technographics |
| **Rate limit** | 15 requests per minute, up to 25 companies per request |

**Use this when** you already know the company and want its full profile —
for research, scoring, personalization, or diligence.

The Company Enrich API takes an identifier you already have — a website
domain, a profile URL, a company name, or a Crustdata company ID — and
returns a detailed company profile with headcount, funding, industry, hiring,
and more. The same endpoint supports both single-company lookups and
multi-company requests. This page covers the basics (your first enrichment and
the response shape) plus worked example recipes. For the request/response
schema and errors, see [Enrich reference](https://docs.crustdata.com/company-docs/enrichment/reference.md).

Every request goes to the same endpoint:

```
POST https://api.crustdata.com/company/enrich
```

> [!NOTE]
>
> Replace `YOUR_API_KEY` in each example with your actual API key. All
> requests require the `x-api-version: 2025-11-01` header.

### Request body

| Parameter | Type | Required | Default | Description |
| - | - | - | - | - |
| `domains` / `professional_network_profile_urls` / `names` / `crustdata_company_ids` | array | Yes — one only | — | Submit exactly one identifier type. Max 25 per request. |
| `fields` | string\[] | No | `["basic_info"]` | Sections of `company_data` to include in the response. |
| `exact_match` | boolean | No | `null` | Set to `true` to restrict results to exact `primary_domain` matches. |

> [!TIP]
>
> **Looking for the list of sections you can request?** See [Valid `fields`
> values](https://docs.crustdata.com/company-docs/enrichment/reference#valid-fields-values) for the full
> table of section group names you can pass to `fields`.

### Response body

The response is a top-level array. Each entry corresponds to one input
identifier.

| Field | Type | Description |
| - | - | - |
| `matched_on` | string | The input identifier you submitted |
| `match_type` | string | `domain`, `name`, `crustdata_company_id`, `professional_network_profile_url` |
| `matches` | array | Candidate matches. Empty for no-match inputs. |
| `matches[].confidence_score` | number | Higher is better. `1.0` is common for direct identifier lookups. |
| `matches[].company_data` | object | Full enriched company profile. |

### Rate limits and pricing

**Pricing:** `2 credits per record`. Requesting
`technographics` adds **+2 credits** per company
that returns technographics data.
To see the price for your account, open the [**Pricing** tab](https://app.crustdata.com/endpoints/company-enrich#pricing) in the dashboard.

* **Rate limit:** 15 requests per minute.

> [!NOTE]
>
> If you only need lightweight discovery, start with [Company
> Search](https://docs.crustdata.com/company-docs/search/introduction.md), then enrich the companies you
> want in full detail.

> [card] [Reference](https://docs.crustdata.com/company-docs/enrichment/reference.md)
>
> Request parameters, response fields, valid `fields` values,
> `company_data` sections, validation, errors.

***

## Your first enrichment: look up a company by domain

The simplest enrichment takes a website domain and returns matching company
profiles. Pass the domain in the `domains` array.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/company/enrich \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "domains": ["retool.com"]
  }'
```

```json Response theme={"theme":"vitesse-black"}
[
    {
        "matched_on": "retool.com",
        "match_type": "domain",
        "matches": [
            {
                "confidence_score": 11.0,
                "company_data": {
                    "crustdata_company_id": 633593,
                    "basic_info": {
                        "name": "Retool",
                        "primary_domain": "retool.com",
                        "all_domains": ["retool.com"],
                        "website": "https://retool.com/",
                        "description": "Build internal software better with AI...",
                        "company_type": "Privately Held",
                        "year_founded": 2017,
                        "employee_count_range": "201-500",
                        "markets": ["PRIVATE"]
                    }
                }
            }
        ]
    }
]
```

> [!NOTE]
>
> `description` in `basic_info` is truncated in this snippet for readability.
> Other fields reflect the default response — when `fields` is omitted,
> `company_data` only contains `crustdata_company_id` and `basic_info`.
> Request additional sections such as `headcount`, `funding`, or `people`
> explicitly via `fields` (see [Using the `fields`
> parameter](https://docs.crustdata.com/company-docs/enrichment/reference#using-the-fields-parameter)).

### Understanding the response

The Enrich API returns a **top-level array** — one entry per identifier you
submitted. Each entry has three fields:

* **`matched_on`** — the identifier you submitted (the domain, URL, name, or ID).
* **`match_type`** — which identifier type was used. Possible values: `domain`, `name`, `crustdata_company_id`, `professional_network_profile_url`.
* **`matches`** — an array of candidate companies. Each match includes a `confidence_score` and the full `company_data` object.

Domain lookups may return multiple matches if the domain is ambiguous. The
highest `confidence_score` indicates the best match. Use `exact_match: true`
to restrict results to companies whose `primary_domain` exactly matches your
input (see the [exact match recipe](#use-exact-match-for-stricter-domain-matching) below).

### How to interpret results

* **Multiple matches:** If `matches` contains more than one entry, check `confidence_score` — the highest score is the best match. Use `primary_domain` to verify.
* **Empty `matches` array:** The identifier did not match any company. Check for typos or try a different identifier type.
* **`confidence_score`:** Higher is better. A score of `1.0` is common for
  direct identifier lookups such as profile URLs or company IDs.

***

## Examples

Worked recipes you can copy, paste, and adapt. Each example is a full working
request. For the full list of request and response fields, see
[Enrich reference](https://docs.crustdata.com/company-docs/enrichment/reference.md).

> [accordion] Enrich by profile URL
>
> If you have a company profile URL, pass it in
> `professional_network_profile_urls`. This gives you a direct match.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": [
>       "https://www.linkedin.com/company/serverobotics"
>     ]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "https://www.linkedin.com/company/serverobotics",
>         "match_type": "professional_network_profile_url",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "company_data": {
>                     "crustdata_company_id": 628895,
>                     "basic_info": {
>                         "name": "Serve Robotics",
>                         "primary_domain": "serverobotics.com",
>                         "all_domains": ["serverobotics.com"],
>                         "website": "https://www.serverobotics.com/",
>                         "company_type": "Public Company",
>                         "year_founded": 2021,
>                         "employee_count_range": "51-200",
>                         "markets": ["PRIVATE", "NASDAQ"]
>                     }
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity.
>
> Profile URL lookups are direct matches — they typically return a single match
> with high confidence.

> [accordion] Enrich by company name
>
> You can also enrich by company name. This is useful when you only have a name
> from a form submission or event badge scan.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "names": ["Retool"]
>   }'
> ```
>
> Name-based enrichment may return multiple candidates. Check `confidence_score`
> and `primary_domain` to pick the right match.

> [accordion] Enrich by company ID
>
> If you already have a Crustdata company ID (from a previous search call),
> pass it in `crustdata_company_ids` for an exact lookup.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "crustdata_company_ids": [633593]
>   }'
> ```
>
> Company ID lookups typically return a single exact match, making this the most
> precise enrichment method.

> [accordion] Use exact match for stricter domain matching
>
> By default, domain-based enrichment can return multiple candidates. Set
> `exact_match: true` to restrict results to companies whose `primary_domain`
> exactly matches your input.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "domains": ["cashfree.com"],
>     "exact_match": true
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "cashfree.com",
>         "match_type": "domain",
>         "matches": [
>             {
>                 "confidence_score": 15.0,
>                 "company_data": {
>                     "basic_info": {
>                         "name": "Cashfree Payments",
>                         "primary_domain": "cashfree.com"
>                     }
>                 }
>             },
>             {
>                 "confidence_score": 4.0,
>                 "company_data": {
>                     "basic_info": {
>                         "name": "Cashfree Tech",
>                         "primary_domain": "cashfree.com"
>                     }
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity.
>
> With `exact_match: true`, results are limited to records whose
> `primary_domain` exactly matches your input. You may still receive multiple
> matches when more than one company record shares that same domain.

> [accordion] Enrich multiple companies in one request
>
> The same endpoint supports multiple identifiers in a single request, so
> multi-company enrich stays on this page rather than as a separate API.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "crustdata_company_ids": [633593, 628895]
>   }'
> ```
>
> ### Multi-company enrich tips
>
> * Submit **one identifier type** per request. Mixing identifier types (e.g., sending both `domains` and `names`) is not supported.
> * Each entry in the response corresponds to the input at the same position, so you can match results back to your input list by index.
> * If some identifiers fail to match, their `matches` array will be empty, but the request still succeeds for the others.

> [accordion] Choosing the right identifier
>
> Each identifier type has trade-offs in precision and convenience.
>
> | | Domain | Profile URL | Company Name | Company ID |
> | - | - | - | - | - |
> | **Precision** | High | Highest | Medium | Highest |
> | **Best for** | CRM cleanup, inbound leads | Known company profiles | Fuzzy matching | Internal pipelines and search follow-up |
> | **Typical matches** | One or more exact-domain candidates | 1 | Multiple candidates | 1 |

> [accordion] Common workflow: Search then Enrich
>
> The most powerful pattern combines [Company Search](https://docs.crustdata.com/company-docs/search/introduction.md) with
> Company Enrich. Search finds companies matching your criteria; Enrich gets
> the full profile for each match.
>
> **Step 1:** Search for well-funded software companies.
>
> ```bash theme={"theme":"vitesse-black"}
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
>           "field": "basic_info.industries",
>           "type": "in",
>           "value": ["Software Development"]
>         },
>         {
>           "field": "funding.total_investment_usd",
>           "type": ">",
>           "value": 10000000
>         }
>       ]
>     },
>     "limit": 5,
>     "fields": ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain"]
>   }'
> ```
>
> **Step 2:** Take the `crustdata_company_id` values from the search results and
> pass them in `crustdata_company_ids` to enrich.
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "crustdata_company_ids": [633593, 628895]
>   }'
> ```
>
> This two-step pattern is the foundation for sales, research, and investment
> workflows. Search narrows the universe; Enrich fills in the details. Because
> `crustdata_company_ids` is an array, the same endpoint works for one company
> or many companies.

> [accordion] Get a full company profile (multiple sections)
>
> Request every standard section in one call to build a complete profile —
> the equivalent of the legacy endpoint's return-everything default. Omitted
> sections come back as `null` placeholders, so list each section you want.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "domains": ["retool.com"],
>     "fields": [
>       "basic_info", "revenue", "headcount", "funding", "hiring",
>       "locations", "taxonomy", "people", "competitors", "followers",
>       "web_traffic", "seo", "news", "social_profiles", "software_reviews",
>       "employee_reviews", "reviews", "public_launches", "market_intel"
>     ]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "retool.com",
>         "match_type": "domain",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "company_data": {
>                     "crustdata_company_id": 633593,
>                     "basic_info": {
>                         "name": "Retool",
>                         "primary_domain": "retool.com",
>                         "year_founded": 2017,
>                         "employee_count_range": "201-500"
>                     },
>                     "headcount": {
>                         "total": 416,
>                         "largest_headcount_country": "USA",
>                         "growth_percent": { "mom": 0.0, "qoq": -3.48, "six_months": -7.76, "yoy": -10.54, "two_years": 11.83 }
>                     },
>                     "funding": {
>                         "total_investment_usd": 141000000.0,
>                         "last_round_type": "series_c",
>                         "last_fundraise_date": "2022-07-27",
>                         "last_round_amount_usd": 45000000.0,
>                         "investors": ["Liquid 2 Ventures", "SV Angel", "John Collison", "Pedro Franceschi"]
>                     },
>                     "locations": {
>                         "country": "USA",
>                         "headquarters": "San Francisco, California, United States",
>                         "all_office_addresses": ["915 Broadway, New York, NY, 10010, US", "221 Pentonville Road, London, England, N1 9, GB"]
>                     },
>                     "taxonomy": { "professional_network_industry": "Software Development" },
>                     "revenue": { "estimated": { "lower_bound_usd": 20000000, "upper_bound_usd": 50000000 } },
>                     "hiring": { "openings_count": 6, "openings_growth_percent": { "mom": -0.45, "qoq": 0.0, "yoy": -0.67 } },
>                     "followers": { "count": 41310, "yoy_percent": 25.44 },
>                     "people": {
>                         "founders": [ { "crustdata_person_id": 14540, "basic_profile": { "name": "David Hsu", "current_title": "Founder, CEO" } } ]
>                     }
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity — only a few of the requested sections are
> > shown. The full response also includes per-section timeseries, role/region
> > breakdowns, and `people.decision_makers` and `people.cxos` arrays. Each
> > entry in `fields` is a section group — see
> > [Valid `fields` values](https://docs.crustdata.com/company-docs/enrichment/reference#valid-fields-values).
> > Add-on sections such as `technographics` require a field grant on your
> > account.
>
> > [!WARNING]
> >
> > `/company/enrich` keys the headcount growth maps by **period alias** (`mom`,
> > `qoq`, `six_months`, `yoy`, `two_years`), whereas
> > [`/company/search`](https://docs.crustdata.com/company-docs/search/introduction) uses `1m`, `3m`,
> > `6m`, `12m`. The values are equivalent; map the keys explicitly.

> [accordion] Get product and review intelligence (market\_intel)
>
> The product-and-review intelligence formerly returned as a separate analyst
> dataset is now the `market_intel` field group. It includes products,
> categories, and detailed reviews.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "domains": ["builder.io"],
>     "fields": ["market_intel"],
>     "exact_match": true
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "builder.io",
>         "match_type": "domain",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "company_data": {
>                     "crustdata_company_id": 698873,
>                     "market_intel": {
>                         "slug": "builder-io",
>                         "company_name": "Builder.io",
>                         "year_founded": 2018,
>                         "head_office_city": "San Francisco",
>                         "head_office_country": "US",
>                         "num_employees_min": 51,
>                         "num_employees_max": 200,
>                         "products": [
>                             { "slug": "builder-io", "name": "Builder.io", "category": "landing-page-software" }
>                         ],
>                         "reviews": [
>                             {
>                                 "review_id": 5433620,
>                                 "headline": "Builder.io: Drag-and-Drop Bliss with A/B Testing Power (But Onboard with Care!)",
>                                 "overall_rating": 4
>                             }
>                         ]
>                     }
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity. Each review also carries rating breakdowns,
> > purchase reasons, and competitors considered.

> [accordion] Get product launch data (public\_launches)
>
> Product-launch data (launches, makers, ratings, and reviews) is now the
> `public_launches` field group.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "domains": ["builder.io"],
>     "fields": ["public_launches"],
>     "exact_match": true
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "builder.io",
>         "match_type": "domain",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "company_data": {
>                     "crustdata_company_id": 698873,
>                     "public_launches": {
>                         "slug": "builder-io",
>                         "company_name": "Builder.io",
>                         "producthunt_url": "https://www.producthunt.com/products/builder-io",
>                         "rating": 4.62,
>                         "num_upvotes": 1803,
>                         "num_reviews": 28,
>                         "num_followers": 1175,
>                         "categories": ["Headless CMS software", "No-code platforms", "Website builders"],
>                         "makers": [
>                             { "username": "steve_sewell", "name": "Steve Sewell", "headline": "Founder, CEO of Builder.io" }
>                         ]
>                     }
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity.

> [accordion] Get technology stack data (technographics)
>
> The `technographics` field group returns the technologies detected for a
> company — a count, the most notable names, and the full list with categories
> and detection sources. It is **never included by default**: request it
> explicitly via `fields`. It also requires field-level permission on your
> account — contact Crustdata to enable it.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "domains": ["hubspot.com"],
>     "fields": ["technographics"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "hubspot.com",
>         "match_type": "domain",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "company_data": {
>                     "technographics": {
>                         "total_technologies": 32,
>                         "top_technologies": ["AWS", "AngularJS", "Cloudflare DNS"],
>                         "technologies": [
>                             {
>                                 "name": "AWS",
>                                 "sources": ["web signals", "job posting"],
>                                 "posting_count": 3,
>                                 "categories": [
>                                     { "category_slug": "cloud-platforms-iaas", "super_slug": "cloud-infrastructure", "score": 1.0 }
>                                 ],
>                                 "description": "Cloud platform.",
>                                 "evidence": [
>                                     {
>                                         "source": "job posting",
>                                         "posting_id": "p-1",
>                                         "confidence": 0.9,
>                                         "url": "https://jobs.example/p-1",
>                                         "title": "DevOps Engineer",
>                                         "posted_at": "2026-06-01T09:30:00Z"
>                                     }
>                                 ]
>                             }
>                         ],
>                         "updated_at": "2026-07-03T04:19:03.112000Z"
>                     }
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity. `technologies` contains one entry per
> > detected technology (`total_technologies` of them). Each entry has a
> > `name`, its detection `sources` (`"web signals"` for the company's web
> > presence, `"job posting"` for the company's job postings), its catalog
> > `categories` and `description`, and its job-posting signal: a
> > `posting_count` and `evidence` entries. See
> > [`technographics` fields](https://docs.crustdata.com/company-docs/enrichment/reference#technographics-fields)
> > for the full field reference.
>
> **Add-on pricing:** requesting `technographics`
> adds **+2 credits** per company that returns technographics
> data, on top of the endpoint's base cost. Companies with no technographics
> data are not charged the add-on. The same add-on pricing applies to
> [Batch Company Enrich](https://docs.crustdata.com/company-docs/enrichment/batch.md).
>
> > [!TIP]
> >
> > Company Search can **filter** on technographics
> > (`technographics.total_technologies`, `technographics.technologies.name`,
> > and more) but does not return technographics values in its responses —
> > filter with
> > [Company Search](https://docs.crustdata.com/company-docs/search/reference.md#technographics-filter-only),
> > then enrich the matches here to get the values.

> [accordion] Get recent company posts (social\_posts, gated beta)
>
> Pass `social_posts` in `fields` to get up to the 10 most recent posts the
> company authored, newest first, in the same enrich call. The add-on costs a
> flat 5 credits per company. It is **never
> included by default**, and it is a beta add-on that requires field-level
> permission on your account: contact Crustdata to enable it. Quote posts
> (reposts with added commentary) are included; plain reshares of someone
> else's post are not.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "domains": ["microsoft.com"],
>     "fields": ["basic_info", "social_posts"]
>   }'
> ```
>
> ```json Response (trimmed) theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "microsoft.com",
>         "match_type": "domain",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "company_data": {
>                     "basic_info": { "name": "Microsoft" },
>                     "social_posts": [
>                         {
>                             "share_url": "https://www.linkedin.com/posts/microsoft_at-the-microsoft-development-center-in-estonia-activity-7491372580835192834-06b1",
>                             "text": "At the Microsoft Development Center in Estonia, Bootcamp gave students hands-on experience...",
>                             "date_posted": "2026-08-07T12:01:22.783309+00:00",
>                             "post_type": "original",
>                             "has_video": false,
>                             "hashtags": [],
>                             "engagement": {
>                                 "total_reactions": 0,
>                                 "total_comments": 0,
>                                 "num_shares": 0,
>                                 "reactions_by_type": {
>                                     "LIKE": 0,
>                                     "PRAISE": 0,
>                                     "APPRECIATION": 0,
>                                     "EMPATHY": 0,
>                                     "INTEREST": 0,
>                                     "ENTERTAINMENT": 0
>                                 }
>                             }
>                         }
>                     ]
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity. Posts arrive under
> > `matches[].company_data.social_posts`, the same post shape Person Enrich
> > returns. See
> > [`social_posts` fields](https://docs.crustdata.com/company-docs/enrichment/reference#social_posts-fields)
> > for the full field reference.
>
> **Add-on pricing:** each post returned adds
> **+1 credit** on top of the endpoint's base cost, up to 20
> per company. No posts returned means no add-on charge, and you are only
> billed when `social_posts` is in `fields`. Available
> on API version `2025-11-01` only.
>
> > [!TIP]
> >
> > Posts here are per-profile only. To search posts across the network by
> > keyword, use the
> > [Social Post Search API](https://docs.crustdata.com/social-post-docs/search/introduction.md), or query
> > the indexed dataset with
> > [Social Post Search](https://docs.crustdata.com/social-post-docs/indexed-search/introduction.md).

> [accordion] Get parsed location data (locations)
>
> The `locations` section returns the headquarters as a raw string **and** as
> parsed `country` / `state` / `street_address` fields, plus every office
> address.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "domains": ["stripe.com"],
>     "fields": ["basic_info", "locations"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "stripe.com",
>         "match_type": "domain",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "company_data": {
>                     "basic_info": {
>                         "name": "Stripe",
>                         "primary_domain": "stripe.com"
>                     },
>                     "locations": {
>                         "country": "USA",
>                         "state": "California",
>                         "headquarters": "South San Francisco, California, United States",
>                         "street_address": "354 Oyster Point Blvd, South San Francisco, California, United States",
>                         "all_office_addresses": [
>                             "1 Wilton Park, Wilton Terrace, Dublin, County Dublin, D02 FX04, IE",
>                             "920 5th Ave, Seattle, Washington, 98104, US",
>                             "201 Bishopsgate, London, England, EC2M 3NS, GB"
>                         ]
>                     }
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity.
>
> > [!WARNING]
> >
> > Request the **full section name** (`"locations"`) to get the parsed fields.
> > Requesting only a subfield (for example `"locations.headquarters"`) returns
> > the sibling keys (`country`, `state`, `street_address`) as `null` — they
> > are placeholders, not missing data. The same applies to every other
> > section: pass the section name from the
> > [field reference](https://docs.crustdata.com/company-docs/enrichment/reference.md) to get all of its
> > fields populated.

***

## What to do next

* **Look up request/response details and `fields`** — see [Enrich reference](https://docs.crustdata.com/company-docs/enrichment/reference.md) for request parameters, `company_data` sections, valid `fields` values, validation, and errors.
* **Search for companies first** — use [Company Search](https://docs.crustdata.com/company-docs/search/introduction.md) to find companies by industry, funding, headcount, and more, then enrich the matches.
* **Discover filter values** — use [Company Autocomplete](https://docs.crustdata.com/company-docs/autocomplete/introduction.md) to find valid values before building search filters.


## Related topics

- [Batch Company Enrichment API](https://docs.crustdata.com/company-docs/enrichment/batch.md)
- [Capabilities](https://docs.crustdata.com/general/capabilities.md)
- [Person Enrichment API](https://docs.crustdata.com/person-docs/enrichment/introduction.md)
- [Contact Enrichment API](https://docs.crustdata.com/person-docs/contact/enrich.md)
- [Batch Person Enrichment API](https://docs.crustdata.com/person-docs/enrichment/batch-enrich.md)
