> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Company Identify API

> Resolve a company from partial information — a name, domain, profile URL, or Crustdata company ID — and get back matched company records ranked by confidence.

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | All plans. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | Yes, the endpoint is free |
| **Credit cost** | Free |
| **Rate limit** | 30 requests per minute, up to 25 companies per request |

**Use this when** you have partial company information and need to resolve it
to a specific Crustdata company record — for CRM deduplication, lead routing,
entity resolution, or pre-enrichment matching.

The Company Identify API takes an identifier you have — a website domain, a
profile URL, a company name, or a Crustdata company ID — and returns one or
more matched companies ranked by confidence score. Identify is designed for
entity resolution rather than deep profiling.

> [!NOTE]
>
> This page documents the live Identify response directly. Current platform
> behavior returns match metadata plus `company_data.basic_info`. If you
> need the broader company sections used in full profiles, see
> [Enrich reference](https://docs.crustdata.com/company-docs/enrichment/reference.md).

Every request goes to the same endpoint:

```
POST https://api.crustdata.com/company/identify
```

> [!NOTE]
>
> Replace `YOUR_API_KEY` in each example with your actual API key. All
> requests require the `x-api-version: 2025-11-01` header.

### Request body

| Parameter | Type | Required | Description |
| - | - | - | - |
| `domains` / `professional_network_profile_urls` / `names` / `crustdata_company_ids` | array | Yes, one only | Submit exactly one identifier type. Max 25 per request. |
| `exact_match` | boolean | No | Set to `true` for strict domain matching. |

### Response body

The response is a top-level array. Each entry corresponds to one input
identifier.

| Field | Type | Description |
| - | - | - |
| `matched_on` | string | The input identifier you submitted |
| `match_type` | string | `domain`, `name`, `crustdata_company_id`, `professional_network_profile_url` |
| `matches` | array | Candidate matches ranked by relevance. Empty for no-match inputs. |
| `matches[].confidence_score` | number | Higher is better. |
| `matches[].company_data` | object | Match metadata plus `basic_info`. |

### Rate limits and pricing

**Pricing:** `Free`.

* **Rate limits:** For current plan-specific limits, see
  [Rate limits](https://docs.crustdata.com/general/rate-limits.md).

> [!NOTE]
>
> Use Identify first when your input is ambiguous. You can resolve the right
> company for free, then call [Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md) only for
> the records you want in full detail.

> [card] [Reference](#reference)
>
> Request parameters, validation, no-match behavior, errors.

***

## Your first identification: look up a company by domain

Pass a website domain in the `domains` array to find the matching company.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/company/identify \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "domains": ["serverobotics.com"]
  }'
```

```json Response theme={"theme":"vitesse-black"}
[
    {
        "matched_on": "serverobotics.com",
        "match_type": "domain",
        "matches": [
            {
                "confidence_score": 1.0,
                "company_data": {
                    "crustdata_company_id": 628895,
                    "basic_info": {
                        "crustdata_company_id": 628895,
                        "name": "Serve Robotics",
                        "primary_domain": "serverobotics.com",
                        "all_domains": ["serverobotics.com"],
                        "website": "https://www.serverobotics.com/",
                        "professional_network_url": "https://www.linkedin.com/company/serverobotics",
                        "professional_network_id": "72049930",
                        "profile_name": "Serve Robotics",
                        "employee_count_range": "51-200",
                        "industries": [
                            "Technology, Information and Internet",
                            "Technology, Information and Media"
                        ]
                    }
                }
            }
        ]
    }
]
```

### Understanding the response

> [!NOTE]
>
> The live Identify endpoint returns a
> top-level array, not an object with a `results` wrapper.

The Identify API returns a top-level array — one entry per identifier you
submitted. Each entry has three fields:

* **`matched_on`** — the identifier you submitted (the domain, URL, name, or ID).
* **`match_type`** — which identifier type was used. Values: `domain`, `name`, `crustdata_company_id`, `professional_network_profile_url`.
* **`matches`** — an array of candidate companies ranked by relevance. Each
  match includes a `confidence_score` and a `company_data` object. Current
  platform behavior returns `basic_info` here.

For detailed behavior when no identifier matches, see
[No-match behavior](#no-match-behavior).

***

## Identify vs Enrich

| | Identify | Enrich |
| - | - | - |
| **Endpoint** | `/company/identify` | `/company/enrich` |
| **Pricing** | **Free** | **2 credits per record** |
| **Response** | Match results with `company_data.basic_info` | Full company profile |
| **Best for** | Matching, deduplication, entity resolution | Research, scoring, diligence |
| **Use when** | You need to resolve "which company is this?" | You need detailed company data |

**Common pattern:** Use Identify to resolve ambiguous inputs, then pass the
`crustdata_company_id` from the best match into
[Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md) for the full profile.

***

## Examples

Worked recipes you can copy, paste, and adapt. Each example is a full working
request you can copy, paste, and adapt.

> [!NOTE]
>
> Replace `YOUR_API_KEY` in each example with your actual API key. All
> requests require the `x-api-version: 2025-11-01` header.

> [accordion] Identify by company name
>
> Name-based identification often returns multiple candidates. Check
> `confidence_score` and `primary_domain` to pick the right match.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/identify \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "names": ["Serve Robotics"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "Serve Robotics",
>         "match_type": "name",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "company_data": {
>                     "crustdata_company_id": 628895,
>                     "basic_info": {
>                         "name": "Serve Robotics",
>                         "primary_domain": "serverobotics.com",
>                         "employee_count_range": "51-200",
>                         "industries": ["Technology, Information and Internet"]
>                     }
>                 }
>             },
>             {
>                 "confidence_score": 1.0,
>                 "company_data": {
>                     "crustdata_company_id": 5825197,
>                     "basic_info": {
>                         "name": "Site Serve Robotics",
>                         "primary_domain": "siteserverobotics.co.uk",
>                         "employee_count_range": "2-10",
>                         "industries": ["Construction"]
>                     }
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> > [!TIP]
> >
> > When multiple matches are returned, use `primary_domain` and
> > `employee_count_range` to disambiguate. The first match is not always the
> > right one for name-based lookups.

> [accordion] Identify by profile URL
>
> If you have a company profile URL, pass it in
> `professional_network_profile_urls`. Profile URL lookups are direct matches —
> they typically return a single match with high confidence.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/identify \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": [
>       "https://www.linkedin.com/company/mintlify"
>     ]
>   }'
> ```

> [accordion] Identify by Crustdata company ID
>
> Pass a Crustdata company ID (for example, from a previous search call) to
> `crustdata_company_ids` for an exact lookup.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/identify \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "crustdata_company_ids": [628895]
>   }'
> ```
>
> Company ID lookups return an exact match.

> [accordion] Common workflow: Inbound domain → Identify → Search for similar companies
>
> An inbound lead arrives from a known domain. Use Identify to resolve the
> domain to a company record, then use Search to find similar companies for
> prospecting.
>
> ### Step 1: Identify the inbound company
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/identify \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{"domains": ["retool.com"]}'
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
>                         "employee_count_range": "201-500",
>                         "industries": ["Software Development"]
>                     }
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> **Extract:** Take
> `response[0].matches[0].company_data.basic_info.industries[0]` →
> `"Software Development"` and `employee_count_range` → `"201-500"`.
>
> ### Step 2: Search for similar companies
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
>         {"field": "headcount.total", "type": ">", "value": 200},
>         {"field": "headcount.total", "type": "<", "value": 1000}
>       ]
>     },
>     "sorts": [{"field": "headcount.total", "order": "desc"}],
>     "limit": 10,
>     "fields": ["crustdata_company_id", "basic_info.name", "basic_info.primary_domain", "headcount.total"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "companies": [
>         {
>             "crustdata_company_id": 67890,
>             "basic_info": { "name": "Retool", "primary_domain": "retool.com" },
>             "headcount": { "total": 450 }
>         },
>         {
>             "crustdata_company_id": 12345,
>             "basic_info": { "name": "Notion", "primary_domain": "notion.so" },
>             "headcount": { "total": 800 }
>         }
>     ],
>     "next_cursor": "H4sIAM_5zGkC...",
>     "total_count": 1543
> }
> ```
>
> **Extract:** Take `companies[].crustdata_company_id` values and pass them to
> [Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md) for full profiles of promising matches.
>
> **If empty:** If `companies` is `[]`, broaden your filters (for example,
> wider headcount range or more industries). Use
> [Autocomplete](https://docs.crustdata.com/company-docs/autocomplete/introduction.md) to verify valid filter values.

> [accordion] Identify by name: exact\_match vs. fuzzy
>
> Name-based identification supports two matching modes. With `exact_match: true`,
> the input must match the stored name **character for character**
> (case-insensitive) — and the stored name is not always how the company is
> commonly written. For example, "Tomo Credit" is stored as `"TomoCredit"`
> (no space), so an exact lookup for the spaced form returns no matches.
>
> **`exact_match: true` with a space → no match:**
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/identify \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "names": ["Tomo Credit"],
>     "exact_match": true
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "Tomo Credit",
>         "match_type": "name",
>         "matches": []
>     }
> ]
> ```
>
> **`exact_match: false` (default) tolerates the variation → matches:**
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/company/identify \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "names": ["Tomo Credit"],
>     "exact_match": false
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "Tomo Credit",
>         "match_type": "name",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "company_data": {
>                     "crustdata_company_id": 634576,
>                     "basic_info": {
>                         "name": "TomoCredit",
>                         "primary_domain": "tomocredit.ai",
>                         "employee_count_range": "51-200",
>                         "industries": ["Technology, Information and Internet"]
>                     }
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> > [!TIP]
> >
> > **Recommended fallback:** try `exact_match: true` first; if `matches` is
> > empty, retry with `exact_match: false`; then verify the returned `name` or
> > `primary_domain` before using the result. Identify is free, so this
> > two-step resolution costs nothing.

***

## Reference

Reference material for Company Identify: the full
list of request parameters, validation rules, no-match behavior, and error
responses.

### Request parameter reference

| Parameter | Type | Required | Description |
| - | - | - | - |
| `domains` | string\[] | Exactly one identifier type required | Website domains to identify. Max 25. |
| `professional_network_profile_urls` | string\[] | Exactly one identifier type required | Company profile URLs to identify. Max 25. |
| `names` | string\[] | Exactly one identifier type required | Company names to identify. Max 25. |
| `crustdata_company_ids` | integer\[] | Exactly one identifier type required | Crustdata company IDs to identify. Max 25. |
| `exact_match` | boolean | No | Set to `true` for strict domain matching. |

> [!NOTE]
>
> Submit exactly one identifier type per
> request.

> [!NOTE]
>
> Each identifier array accepts a maximum of 25 values per request. Sending
> 26 or more returns `400`. Split larger lists into batches of 25.

> [!NOTE]
>
> `exact_match: true` enforces strict domain
> matching, but it can still return multiple matches when more than one
> company record shares that same domain.

> [!NOTE]
>
> The OpenAPI model currently reuses the Enrich request schema, but this
> reference documents the live Identify behavior. Use
> [Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md) when you need the broader profile
> sections.

### No-match behavior

When no company matches the identifier, current platform behavior returns
`200` with an empty `matches` array:

```json theme={"theme":"vitesse-black"}
[
    {
        "matched_on": "thisdomaindoesnotexist12345xyz.com",
        "match_type": "domain",
        "matches": []
    }
]
```

> [!NOTE]
>
> The OpenAPI spec also defines a `404` response for Identify. Current
> platform behavior returns `200` with empty `matches`, but integrations
> should handle both.

### Errors

| Status | Meaning |
| - | - |
| `400` | Invalid request — missing or multiple identifier types, or malformed input. |
| `401` | Invalid or missing API key. |
| `403` | Permission denied or endpoint unavailable for your account. |
| `404` | No data found. |
| `500` | Internal server error. |

```json 400 — Missing identifier theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Exactly one identifier must be provided: crustdata_company_ids, names, domains, or professional_network_profile_urls",
        "metadata": []
    }
}
```

```json 400 - Too many values theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Maximum 25 values allowed for domains. Found 26",
        "metadata": []
    }
}
```

```json 401 — Invalid API key theme={"theme":"vitesse-black"}
{
    "message": "Invalid API key in request"
}
```

### API reference summary

| Detail | Value |
| - | - |
| **Endpoint** | `POST /company/identify` |
| **Auth** | Bearer token + `x-api-version: 2025-11-01` |
| **Pricing** | Free |
| **Request** | One identifier type: `domains`, `names`, `crustdata_company_ids`, or `professional_network_profile_urls`. Max 25 values. Optional: `exact_match`. |
| **Response** | `[{ "matched_on", "match_type", "matches": [{ "confidence_score", "company_data" }] }]` |
| **Errors** | `400` (bad request), `401` (bad auth), `403` (permission), `404` (no match), `500` (server error) |

See the [full API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md) for the
complete OpenAPI schema.

***

## What to do next

* **Get the full profile** — pass the `crustdata_company_id` from Identify into [Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md) for detailed company data.
* **Search for similar companies** — use [Company Search](https://docs.crustdata.com/company-docs/search/introduction.md) to find companies matching the same industry or headcount range.
* **Verify valid filter values** — use [Autocomplete](https://docs.crustdata.com/company-docs/autocomplete/introduction.md) to check filter values before searching.


## Related topics

- [Capabilities](https://docs.crustdata.com/general/capabilities.md)
- [Identify Companies](https://docs.crustdata.com/api-reference/company-apis/identify-a-company-from-name-domain-id-or-profile-url.md)
- [Person Identify API](https://docs.crustdata.com/person-docs/identify/introduction.md)
- [API Introduction](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md)
- [Company Search API](https://docs.crustdata.com/company-docs/search/introduction.md)
