> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Company Enrich reference

> Reference for Company Enrich: request parameters, response fields, valid field groups, company_data sections, validation rules, and error responses.

Reference material for [Company Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md): request
parameters, response fields, valid `fields` values, `company_data` section
catalog, validation rules, and error responses.

For walk-through examples, see [Company Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md) and
[Examples](https://docs.crustdata.com/company-docs/enrichment/introduction.md#examples).

***

## Request parameter reference

| Parameter | Type | Required | Default | Description |
| - | - | - | - | - |
| `domains` | string\[] | Exactly one identifier type required | — | Website domains to enrich. |
| `professional_network_profile_urls` | string\[] | Exactly one identifier type required | — | Company profile URLs to enrich. |
| `names` | string\[] | Exactly one identifier type required | — | Company names to enrich. |
| `crustdata_company_ids` | integer\[] | Exactly one identifier type required | — | Crustdata company IDs to enrich. |
| `fields` | string\[] | No | `["basic_info"]` | Specific field groups to include in the response. Defaults to `basic_info` only (plus `crustdata_company_id`). |
| `exact_match` | boolean | No | `null` | Set to `true` to force exact domain matching. |

> [!NOTE]
>
> Submit exactly one identifier type per
> request.

## Response fields reference

The response is a top-level array. Each item in the array contains:

| Field | Type | Description |
| - | - | - |
| `matched_on` | string | The input identifier you submitted |
| `match_type` | string | `domain`, `name`, `crustdata_company_id`, `professional_network_profile_url` |
| `matches` | array | Array of candidate matches (may be empty for no-match) |
| `matches[].confidence_score` | number | How confident the match is. Higher is better. |
| `matches[].company_data` | object | Full enriched company profile. See [`company_data` sections](#company_data-sections) below. |

***

## Using the `fields` parameter

If you omit `fields`, `company_data` contains only `crustdata_company_id`
and `basic_info`. To get `headcount`, `funding`, `people`, `hiring`, or any
other section, you must list it explicitly in `fields`.

```bash Request — default fields theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/company/enrich \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "domains": ["retool.com"]
  }'
```

```bash Request — multiple sections theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/company/enrich \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "domains": ["retool.com"],
    "fields": ["basic_info", "headcount", "funding", "people"]
  }'
```

Each entry in `fields` is the name of a section group. Include `basic_info`
explicitly if you want to keep it alongside other sections.

### Valid `fields` values

| Field group | What it returns |
| - | - |
| `basic_info` | Company name, domain, website, profile URL, type, year founded |
| `headcount` | Employee count, role/region breakdowns, growth metrics |
| `funding` | Total funding, last round details, investor list |
| `locations` | HQ country, state, headquarters address, street address, office addresses |
| `taxonomy` | Industry, category, NAICS, SIC, and speciality fields |
| `revenue` | Revenue estimates (lower/upper bound), public markets, acquisition status |
| `hiring` | Open job count, hiring growth rate, recent job titles |
| `followers` | Follower count, month-over-month/quarter/year growth |
| `seo` | Organic search results, monthly organic clicks, Google Ads budget |
| `competitors` | Aggregated competitor domains and paid/organic SEO competitors |
| `social_profiles` | Crunchbase, professional network, and Twitter profile links |
| `web_traffic` | Monthly visitors, traffic source breakdown |
| `employee_reviews` | Overall, culture, and work-life balance ratings |
| `people` | Decision makers, founders, C-level executives |
| `news` | Recent article URLs, titles, and publish dates |
| `software_reviews` | Review count and average rating |
| `public_launches` | Product launch data — launches, makers, reviews, and ratings |
| `market_intel` | Product and review intelligence — products, reviews, and ratings |
| `technographics` | Detected technologies — count, top names, full list with categories and detection sources (gated add-on; see [`technographics` fields](#technographics-fields)) |
| `social_posts` | Up to the 10 most recent posts the company authored, newest first (gated beta add-on; see [`social_posts` fields](#social_posts-fields)) |
| `reviews` | Other (non-employee) reviews bucket |

### `company_data` sections

The enriched `company_data` object contains the following sections. Each
section maps to a `fields` value above.

| Section | Key fields | Description |
| - | - | - |
| `crustdata_company_id` | integer | Top-level Crustdata identifier |
| `updated_at` | date-time string (nullable) | Top-level last-refresh timestamp |
| `indexed_at` | date-time string (nullable) | Top-level last-indexed timestamp |
| `basic_info` | `name`, `primary_domain`, `all_domains`, `website`, `professional_network_url`, `professional_network_id`, `profile_name`, `logo_permalink`, `year_founded`, `description`, `company_type`, `status`, `employee_count_range`, `markets` | Core identity and classification |
| `headcount` | `total`, `by_role_absolute`, `by_role_percent`, `by_region_absolute`, `growth_percent`, `growth_absolute` | Employee footprint and growth |
| `funding` | `total_investment_usd`, `last_round_amount_usd`, `last_fundraise_date`, `last_round_type`, `investors`, `funding_rounds`, `milestones`, `acquisitions` | Funding, milestones, and acquisitions |
| `locations` | `country`, `state`, `headquarters`, `street_address`, `all_office_addresses` | Headquarters and office locations |
| `taxonomy` | `categories`, `professional_network_industry`, `professional_network_industries`, `professional_network_specialities`, `primary_naics_detail` (`naics_code`, `sector`, `sub_sector`, `industry_group`, `industry`, `year`), `sic_detail_list` (one entry per code: `sic_code`, `industry`, `year`) | Industry and classification data |
| `revenue` | `estimated` (`lower_bound_usd`, `upper_bound_usd`), `public_markets`, `acquisition_status` | Revenue estimates and market data |
| `hiring` | `openings_count`, `openings_growth_percent`, `recent_openings` | Hiring demand and open roles |
| `followers` | `count`, `mom_percent`, `qoq_percent`, `yoy_percent` | Audience and follower metrics |
| `seo` | `total_organic_results`, `monthly_organic_clicks`, `monthly_google_ads_budget` | Search visibility metrics |
| `competitors` | `all_domains`, `paid_seo`, `organic_seo` | Competitor domains and SEO peers |
| `social_profiles` | `crunchbase.url`, `crunchbase.uuid`, `professional_network`, `twitter_url` | External profile links |
| `web_traffic` | per-domain `monthly_visitors` and traffic sources | Website traffic and sources |
| `employee_reviews` | `overall_rating`, `culture_and_values_rating`, `work_life_balance_rating`, `review_count` | Employee review data |
| `people` | `decision_makers`, `founders`, `cxos` | Key people at the company |
| `news` | `article_url`, `article_title`, `article_publish_date` | Recent news articles |
| `software_reviews` | `review_count`, `average_rating` | Software review metrics |
| `public_launches` | `launches`, `makers`, `reviews`, `categories`, `num_upvotes`, `rating` | Product launch data |
| `market_intel` | `products`, `reviews`, `year_founded`, `head_office_city`, `head_office_country`, `num_employees_min`, `num_employees_max` | Market-intelligence data |
| `technographics` | `total_technologies`, `top_technologies`, `technologies`, `updated_at` | Detected technology stack |
| `social_posts` | list of post objects, see [`social_posts` fields](#social_posts-fields) | Recent posts the company authored |
| `reviews` | Other non-employee reviews bucket. May be null when not populated. | General review data |
| `metadata` | Crustdata processing metadata | Internal metadata |

### `headcount.growth_percent` and `headcount.growth_absolute` keys

The two growth maps in the `headcount` object are keyed by **period alias**.
Each key holds the change over a trailing window: a percentage for
`growth_percent`, an absolute employee delta for `growth_absolute`.

| Key | Window |
| - | - |
| `mom` | Month over month |
| `qoq` | Quarter over quarter |
| `six_months` | Trailing six months |
| `yoy` | Year over year |
| `two_years` | Trailing two years |

> [!WARNING]
>
> [`/company/search`](https://docs.crustdata.com/company-docs/search/introduction) returns the same
> growth data under **different period keys** — `1m`, `3m`, `6m`, `12m` —
> and exposes each as a filterable path
> (`headcount.growth_percent.{1m,3m,6m,12m}`,
> `headcount.growth_absolute.{1m,3m,6m,12m}`). The values are equivalent,
> but a client that consumes both endpoints must map the keys explicitly:
> `mom ↔ 1m`, `qoq ↔ 3m`, `six_months ↔ 6m`, `yoy ↔ 12m`. `two_years`
> has no counterpart on `/company/search`.

### `technographics` fields

The `technographics` section describes the technologies detected for a
company. It is **never returned by default** — request it explicitly via
`fields` (for example `"fields": ["technographics"]`).

| Field | Type | Description |
| - | - | - |
| `total_technologies` | integer | Total count of technologies detected for the company. May exceed the length of `technologies` (see note below). |
| `top_technologies` | string\[] | The most notable technology names. |
| `technologies` | object\[] | List of detected technologies, capped at **500 entries** per company. Use `total_technologies` for the true count. |
| `technologies[].name` | string | Technology name. |
| `technologies[].sources` | string\[] | Where the signal was detected: `"web signals"` (the company's web presence) or `"job posting"` (the company's job postings). |
| `technologies[].posting_count` | integer, nullable | Number of the company's job postings the technology was detected in. `null` when there is no job-posting signal, never `0`. |
| `technologies[].categories` | object\[] | Catalog categories for the technology, strongest match first, up to four entries. |
| `technologies[].categories[].category_slug` | string | Category slug, a lowercase kebab-case value (for example `frontend-frameworks`, `cloud-platforms-iaas`). The same values power the `technographics.technologies.category` search filter. Enumerate them with the `technology_category` [autocomplete field](https://docs.crustdata.com/company-docs/autocomplete/introduction.md#common-fields-to-autocomplete). |
| `technologies[].categories[].super_slug` | string | Super-category slug, the broader group the category belongs to (for example `engineering-devops`, `cloud-infrastructure`). The same values power the `technographics.technologies.super_category` search filter. |
| `technologies[].categories[].score` | number | Strength of the category match. Higher is stronger. |
| `technologies[].description` | string, nullable | Short catalog description of the technology. |
| `technologies[].evidence` | object\[], nullable | Evidence entries behind the detection. Each has a `source`, a `posting_id`, and a `confidence`, plus `url`, `title`, and `posted_at`, which are populated for job-posting evidence and `null` for web-signal evidence. |
| `updated_at` | date-time string | Timestamp of the last technographics refresh for the company. |

> [!NOTE]
>
> **Access and pricing.** `technographics` requires field-level permission on
> your account — check your field access with the
> [permissions endpoint](https://docs.crustdata.com/general/permissions.md) or contact Crustdata to enable
> it. It is a billed add-on: **+2 credits** per company that returns
> technographics data, on top of the endpoint's base **2 credits** per
> company. Companies with no technographics data are not charged the add-on.
> The same add-on pricing applies to
> [Batch Company Enrich](https://docs.crustdata.com/company-docs/enrichment/batch.md).

> [!TIP]
>
> [Company Search](https://docs.crustdata.com/company-docs/search/reference.md#technographics-filter-only)
> can filter and sort on technographics fields but does not return the values
> — use this endpoint to fetch them. Discover valid filter values with the
> `technology` and `technology_category`
> [autocomplete fields](https://docs.crustdata.com/company-docs/autocomplete/introduction.md#common-fields-to-autocomplete).

### `social_posts` fields

The `social_posts` section returns posts the company authored. It is never
included by default; request it explicitly via `fields` (for example
`"fields": ["basic_info", "social_posts"]`). Quote posts (reposts with added
commentary) are included; plain reshares of someone else's post are not.

Each entry in `social_posts` is one post, newest first, up to 10 per record:

| Field | Type | Description |
| - | - | - |
| `share_url` | string | Public URL of the post |
| `text` | string | Post text content |
| `date_posted` | date-time string | When the post was published |
| `post_type` | string | `original`, `repost_quote` (a repost with added commentary), or `repost_without_thoughts`. Plain reshares of someone else's post are not returned, so expect `original` and `repost_quote`. |
| `has_video` | boolean | True when the post contains a video |
| `hyperlinks` | object | URLs extracted from the post: `media_urls`, `other_urls`, `company_professional_network_urls`, `person_professional_network_urls` |
| `hashtags` | array of string | Hashtags used in the post |
| `engagement` | object | `total_reactions`, `total_comments`, `num_shares`, and `reactions_by_type` with per-type counts (`LIKE`, `PRAISE`, `APPRECIATION`, `EMPATHY`, `INTEREST`, `ENTERTAINMENT`) |

> [!NOTE]
>
> **Access and pricing.** `social_posts` is a beta add-on that requires
> field-level permission on your account and is available on API version
> `2025-11-01` only; without the grant the section is stripped from the
> response. Contact Crustdata to enable it. The add-on costs a flat **5**
> credits per company on top of the endpoint's base cost, however many posts
> come back, and returns at most 10. No posts returned means no add-on
> charge, and you are only billed when `social_posts` is in `fields`. To search posts across the network by
> keyword, use the
> [Social Post Search API](https://docs.crustdata.com/social-post-docs/search/introduction.md).

***

## Validation rules

> [!NOTE]
>
> These rules reflect current platform behavior. See the [API
> reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md) for the formal
> OpenAPI contract.

| Rule | Behavior |
| - | - |
| One identifier type per request | Submit `domains`, `names`, `crustdata_company_ids`, or `professional_network_profile_urls` — not a mix. Mixing types is not supported. |
| `fields` is optional | Omitting returns `basic_info` only. Pass section group names to include more sections. |
| `exact_match` is optional | Default is `null` (auto-detect). Set `true` for strict domain-only matching. |
| Multi-company requests | You can submit multiple values in one identifier array. Each is matched independently. |

***

## No-match behavior

When enriching, each identifier is matched independently:

* **Full match:** All identifiers match — each array entry has populated `matches`.
* **Partial match:** Some identifiers match and others do not. Matched identifiers have `company_data`; unmatched identifiers return an empty `matches: []` array.
* **No match:** All identifiers fail to match. The API returns `200 OK` with empty `matches: []` for each array entry.

> [!NOTE]
>
> The OpenAPI spec also defines a `404` response for this endpoint.
> The API returns `200` with empty `matches`, but
> integrations should handle both `200` empty-match and `404` cases.

```json No match — 200 with empty matches theme={"theme":"vitesse-black"}
[
    {
        "matched_on": "nonexistent-domain.com",
        "match_type": "domain",
        "matches": []
    }
]
```

### Partial batch failure

When enriching multiple identifiers, some may match and others may not.
The request still succeeds with `200`:

```json theme={"theme":"vitesse-black"}
[
    {
        "matched_on": "hubspot.com",
        "match_type": "domain",
        "matches": [
            {
                "confidence_score": 1.0,
                "company_data": {
                    "basic_info": {
                        "name": "HubSpot",
                        "primary_domain": "hubspot.com"
                    }
                }
            }
        ]
    },
    {
        "matched_on": "nonexistent-domain.com",
        "match_type": "domain",
        "matches": []
    }
]
```

**Action:** Iterate over the top-level array. For each entry, check
`matches.length > 0` before accessing `company_data`. Log or retry
unmatched identifiers separately.

***

## Errors

Common error responses for Enrich:

```json 400 — Bad request theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Exactly one identifier must be provided: crustdata_company_ids, names, domains, or professional_network_profile_urls",
        "metadata": []
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

***

## API reference summary

| Detail | Value |
| - | - |
| **Endpoint** | `POST /company/enrich` |
| **Auth** | Bearer token + `x-api-version: 2025-11-01` |
| **Request** | One identifier type: `domains`, `names`, `crustdata_company_ids`, or `professional_network_profile_urls`. Optional: `fields`, `exact_match`. |
| **Response** | Top-level array: `[{ matched_on, match_type, matches: [{ confidence_score, company_data }] }]` |
| **No match** | `200` with empty `matches: []` for unmatched identifiers. The OpenAPI spec also defines `404`; handle both. |
| **Errors** | `400` (bad request), `401` (bad auth), `403` (permission/credits), `404` (per spec), `500` (server error) |

See the [full API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md) for
the complete OpenAPI schema.


## Related topics

- [Company Entity Watcher](https://docs.crustdata.com/watcher-docs/company/entity.md)
- [Technographics](https://docs.crustdata.com/guides/technographics.md)
- [Enrich Companies](https://docs.crustdata.com/api-reference/company-apis/get-full-company-enrichment.md)
- [Batch Enrich Companies](https://docs.crustdata.com/api-reference/batch-apis/submit-a-batch-company-enrichment-job.md)
- [Person Enrich reference](https://docs.crustdata.com/person-docs/enrichment/reference.md)
