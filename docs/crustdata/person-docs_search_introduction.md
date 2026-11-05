> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# People Search API

> Find people with the Person Search API, from a simple name lookup to a query with many filters.

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | All plans. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | Yes, with the free credits every new self-serve account gets |
| **Credit cost** | 0.03 credits per result. [Premium field groups](https://docs.crustdata.com/general/pricing.md#premium-fields-in-search) add 0.1 to 2.5 per result. A request with no `fields` returns experience and education, so it costs 0.23 per result |
| **Rate limit** | 30 requests per minute |

Use the Person Search API to find people by name, title, company, location, and other fields. This page shows:

* Your first search.
* The shape of the response.
* How to combine filters.
* Example requests and recipes that you can copy and change.

For the operator list, the field catalog, and the validation rules, see [Search reference](https://docs.crustdata.com/person-docs/search/reference.md).

Send every request to this endpoint:

```
POST https://api.crustdata.com/person/search
```

> [!NOTE]
>
> In each example, replace `YOUR_API_KEY` with your API key. Every request
> must include the `x-api-version: 2025-11-01` header.

**Pricing:** The base price is `0.03 credits per
result`. Each premium group that you filter on or receive adds a
per-result charge:

* Experience, education, and skills: `0.1`.
* Certifications, honors, professional network signals, languages, and
  summary: `0.2`.
* Dev platform profile filters: `0.8` (profile) or
  `2.5` (repositories).
* Research profiles (enabled on request): `0.4`.

A filter on a premium group is one charge. The same group in the response
is a separate charge. Sorting is free. A request with no
`fields` returns experience and education, so it costs
`0.23` per result on the standard plan. For the full table, see
[Premium fields in search](https://docs.crustdata.com/general/pricing.md#premium-fields-in-search). For
your own prices, open the [**Pricing** tab](https://app.crustdata.com/endpoints/person-search#pricing) in the
dashboard or call [`/account/endpoints`](https://docs.crustdata.com/general/permissions).

> [!TIP]
>
> For the full table of `filters.field` values that you can filter on, see
> [Searchable fields](https://docs.crustdata.com/person-docs/search/reference.md#searchable-fields) in the
> search reference. The table groups the fields by family. The reference
> also shows a one-line way to get the live list from the API.

> [card] [Examples](#example-requests)
>
> See requests for employer and title, geo radius, country, and post-processing exclusions.

> [card] [Pagination and sorting](https://docs.crustdata.com/person-docs/search/reference.md#paginate-through-results)
>
> Get the next page with a cursor. Sort the results to keep a stable order.

> [card] [Reference](https://docs.crustdata.com/person-docs/search/reference.md)
>
> Look up operators, searchable fields, response fields, preview mode, and errors.

***

## Your first search: find a person by name

The simplest search finds a person by their exact name. Send one filter with the `=` operator.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/person/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "field": "basic_profile.name",
      "type": "=",
      "value": "Abhilash Chowdhary"
    },
    "limit": 1
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "profiles": [
        {
            "crustdata_person_id": 1068035,
            "basic_profile": {
                "name": "Abhilash Chowdhary",
                "headline": "Co-founder at Crustdata (YC F24) | Real-time B2B data for AI agents",
                "location": {
                    "raw": "San Francisco, California, United States",
                    "city": "San Francisco",
                    "state": "California",
                    "country": "United States of America",
                    "continent": "North America"
                }
            },
            "social_handles": {
                "professional_network_identifier": {
                    "profile_url": "https://www.linkedin.com/in/abhilashchowdhary"
                }
            },
            "experience": {
                "employment_details": {
                    "current": [
                        {
                            "name": "Crustdata (YC F24)",
                            "title": "Co-Founder & CEO"
                        }
                    ],
                    "past": [
                        {
                            "name": "Serve Robotics",
                            "title": "Engineering Manager, Motion Planning and Controls"
                        },
                        {
                            "name": "Postmates by Uber",
                            "title": "Robotics Lead, Motion Planning and Controls"
                        }
                    ]
                }
            },
            "education": {
                "schools": [
                    {
                        "school": "Virginia Tech",
                        "degree": "Master’s Degree"
                    },
                    {
                        "school": "IIIT Hyderabad",
                        "degree": "Bachelor of Technology (B.Tech.)"
                    },
                    {
                        "school": "Y Combinator",
                        "degree": "F24 Batch"
                    }
                ]
            }
        }
    ],
    "next_cursor": "H4sIAG6-oWkC_xXMMQrDMAxA0a...",
    "total_count": 8
}
```

> [!NOTE]
>
> This example shows only part of the response.

### Understanding the response

Every search response has three fields:

* `profiles`: An array of matching people. Each profile contains identity fields, education, profile handles, and contact availability flags for the fields that you requested.
* `total_count`: The number of people in the full database that match your filters. In this example, 8 people have the name "Abhilash Chowdhary".
* `next_cursor`: A pagination token. To get the next page of results, send this token in the next request. A `null` value means that there are no more pages.

***

## Combine filters with `and`

Most searches need more than one condition. To require all of the conditions, put them in a group with `op: "and"`.

This search finds co-founders in San Francisco. The `(.)` operator matches when every word in the value appears, in any order. It does not match the whole string exactly. On some fields `(.)` also matches close misspellings. When you need the exact words, use `[.]` or `in` instead. See [Choose a text operator](https://docs.crustdata.com/person-docs/search/reference.md#choose-a-text-operator).

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/person/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "op": "and",
      "conditions": [
        {
          "field": "experience.employment_details.title",
          "type": "(.)",
          "value": "Co-Founder"
        },
        {
          "field": "basic_profile.location.full_location",
          "type": "(.)",
          "value": "San Francisco"
        }
      ]
    },
    "limit": 2
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "profiles": [
        {
            "crustdata_person_id": 1279,
            "basic_profile": {
                "name": "Dipesh Garg",
                "headline": "CEO at Truelancer | 2 Million+ Professionals",
                "location": {
                    "raw": "San Francisco, California, United States"
                }
            },
            "experience": {
                "employment_details": {
                    "current": [
                        {
                            "name": "Truelancer.com",
                            "title": "CEO & Founder"
                        }
                    ],
                    "past": [
                        {
                            "name": "MyRemoteTeam Inc",
                            "title": "Founder"
                        },
                        {
                            "name": "MyRemoteTeam Inc",
                            "title": "Lead Developer"
                        }
                    ]
                }
            }
        }
    ],
    "next_cursor": "H4sIAHC-oWkC_xWMMQ7CMAwAv...",
    "total_count": 95577
}
```

> [!NOTE]
>
> This example shows only part of the response.

Compare this request with the first example. The first example sends one condition object in `filters`. This example sends a group with `op: "and"` and a `conditions` array. A profile is in the results only when every condition matches.

For more filter patterns, such as employer and title, geo radius, and
exclusions, see the [example requests](#example-requests) below. To get every
page of a large result set, see [Pagination and sorting](https://docs.crustdata.com/person-docs/search/reference.md#paginate-through-results).

***

## Read normalized titles and education details

Each profile also includes a normalized title classification and structured education data. The education data includes the school location and an institution logo that Crustdata hosts. Use `fields` to request the sections that you need. To get one person, filter by `crustdata_person_id`.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/person/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": { "field": "crustdata_person_id", "type": "=", "value": 14540 },
    "fields": ["crustdata_person_id", "basic_profile", "education"],
    "limit": 1
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "profiles": [
        {
            "crustdata_person_id": 14540,
            "basic_profile": {
                "name": "David Hsu",
                "current_title": "Founder, CEO",
                "normalized_title": {
                    "matched_title": "Co-Founder, CEO, CTO",
                    "department": "Executive Leadership",
                    "sub_department": "Founder & Entrepreneurship Leadership",
                    "similarity": 0.6012,
                    "confident": true
                }
            },
            "education": {
                "schools": [
                    {
                        "school": "University of Oxford",
                        "degree": "Bachelor of Arts (B.A.)",
                        "location": {
                            "raw": "South Hinksey, Wootton, Kennington, Oxford, Boars Hill, England, United Kingdom",
                            "city": "Boars Hill",
                            "state": "England",
                            "country": "United Kingdom",
                            "continent": "Europe"
                        },
                        "institute_logo_permalink": "https://crustdata-media.s3.us-east-2.amazonaws.com/company/3d2093a16f7cf7b459a0d30d4e795d0be5a41a3396f21dee899e43e8a8b6de8d.jpg"
                    }
                ]
            }
        }
    ],
    "next_cursor": "H4sIAAFsGWoC_x...",
    "total_count": 1
}
```

> [!NOTE]
>
> You can filter on `basic_profile.normalized_title` and
> `education.schools.location`, but you cannot sort on them.
>
> You can filter and sort on `professional_network.followers` and
> `professional_network.connections`, but the search response does not
> include them. Use them to narrow or rank the results, not to read the
> counts.
>
> The response includes the school `description` and
> `institute_logo_permalink` fields for display only.

***

## Example requests

These examples show common filter patterns for Person Search. Each example is
a full, tested request to `POST /person/search`. You can copy a request and
change it. Click a row to expand it.

> [accordion] 1. Basic filter examples
>
> Find people whose current title is exactly "Chief Executive Officer":
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "experience.employment_details.current.title",
>       "type": "=",
>       "value": "Chief Executive Officer"
>     },
>     "limit": 100
>   }'
> ```
>
> > [!WARNING]
> >
> > `=` and `in` match the full title string exactly. For example, `"Chief
> >           Information Security Officer"` does not match people with the title "Deputy
> > Chief Information Security Officer" or "SVP and CISO". Titles usually need a
> > substring or word match. For that, use the `(.)` operator, as in the next
> > example.
>
> Find people whose headline contains "founder". This match ignores case:
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": { "field": "basic_profile.headline", "type": "(.)", "value": "founder" },
>     "limit": 100
>   }'
> ```
>
> Find people with more than 10 years of experience:
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": { "field": "years_of_experience_raw", "type": ">", "value": 10 },
>     "limit": 100
>   }'
> ```

> [accordion] 2. Filter with comparison operators
>
> Find people with more than 500 connections who recently changed jobs:
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "professional_network.connections", "type": ">", "value": 500 },
>         { "field": "recently_changed_jobs", "type": "=", "value": true }
>       ]
>     },
>     "limit": 50
>   }'
> ```

> [accordion] 3. Filter with NOT operators
>
> Find people in a region, but exclude some employers and titles:
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "experience.employment_details.current.company_name", "type": "not_in", "value": ["Google", "Meta", "Amazon"] },
>         { "field": "experience.employment_details.current.title", "type": "!=", "value": "Intern" },
>         { "field": "professional_network.location.raw", "type": "=", "value": "San Francisco Bay Area" }
>       ]
>     },
>     "limit": 100
>   }'
> ```

> [accordion] 4. Complex nested filter example
>
> Find senior people (VP, Director, or CXO) who have 10 or more years of experience and work at a company with fewer than 1,000 employees:
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
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
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "VP" },
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "Director" },
>             { "field": "experience.employment_details.current.seniority_level", "type": "=", "value": "CXO" }
>           ]
>         },
>         { "field": "years_of_experience_raw", "type": "=>", "value": 10 },
>         { "field": "experience.employment_details.current.company_headcount_latest", "type": "<", "value": 1000 }
>       ]
>     },
>     "limit": 50
>   }'
> ```

> [accordion] 5. Filter by date ranges
>
> Find people who started a role at a public company in 2023 or later and have 15 or fewer years of experience:
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "experience.employment_details.current.start_date", "type": "=>", "value": "2023-01-01" },
>         { "field": "experience.employment_details.current.company_type", "type": "=", "value": "Public Company" },
>         { "field": "years_of_experience_raw", "type": "=<", "value": 15 }
>       ]
>     },
>     "limit": 50
>   }'
> ```

> [accordion] 6. Filter by education and skills
>
> Find Stanford alumni who have a machine learning skill and a degree that is not "Bachelor":
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "education.schools.school", "type": "(.)", "value": "Stanford" },
>         { "field": "education.schools.degree", "type": "!=", "value": "Bachelor" },
>         { "field": "skills.professional_network_skills", "type": "(.)", "value": "machine learning" }
>       ]
>     },
>     "limit": 100
>   }'
> ```

***

## Semantic search (natural language)

You can send a natural-language query in `search.query` instead of building
filters by hand. The API ranks people by the meaning of their full profile.
`search.mode` sets how the matching works:

| `search.mode` | What it does |
| - | - |
| `hybrid` (default) | It combines keyword (lexical) matching and semantic vector matching. |
| `lexical` | It uses keyword matching only. Use it for exact terms, acronyms, tools, and names. |
| `semantic` | It uses vector similarity only. It matches concepts, even when the words differ. |

The API reranks the top results, called the head. Each profile in the head has
a relevance `fit` tier: `strong`, `possible`, or `weak`. Profiles after the
head have `fit: null`. The response uses the standard Person Search shape, plus
the `fit` and `total_count_relation` fields:

```json Response shape theme={"theme":"vitesse-black"}
{
  "profiles": [
    {
      "crustdata_person_id": 123,
      "fit": "strong",
      "basic_profile": { "name": "Example Person", "current_title": "Founding Engineer" }
    }
  ],
  "next_cursor": "H4sIA...",
  "total_count": 1250,
  "total_count_relation": "eq"
}
```

> [!NOTE]
>
> Semantic search is in beta. Do not send `sorts`, because the results are
> already in relevance order. A query never removes a profile that your
> filters selected. In the default `mode: "managed"`, a query can add
> profiles, so `total_count` can be much larger than the count for your
> filters alone. For the recall modes (`managed` and `exact`) and the full
> behavior, see the
> [Person Semantic Search guide](https://docs.crustdata.com/guides/person-semantic-search.md).

> [accordion] Natural-language query (hybrid: keyword + semantic)
>
> `hybrid` is the default mode. Describe the people that you want in plain
> language. `hybrid` combines keyword and semantic matching, which gives the best
> general-purpose recall.
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "search": { "query": "founding engineers at developer tools startups", "mode": "hybrid" },
>     "fields": ["fit", "basic_profile", "experience.employment_details.current"],
>     "limit": 5
>   }'
> ```

> [accordion] Keyword search (lexical mode)
>
> Use `lexical` when exact terms, acronyms, tools, or names are the most
> important. This mode uses keyword matching only, with no vector similarity.
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "search": { "query": "Golang Kubernetes platform engineer", "mode": "lexical" },
>     "fields": ["fit", "basic_profile"],
>     "limit": 5
>   }'
> ```

> [accordion] Boolean keyword operators (query\_syntax: boolean)
>
> For a precise keyword search, set `search.query_syntax: "boolean"`. The API
> then reads the query as a boolean expression:
>
> * A space means AND.
> * `|` means OR.
> * `+` requires a term.
> * `-` excludes a term.
> * `"…"` matches an exact phrase.
> * `*` matches a prefix.
> * `()` groups operators.
>
> The API uses `query_syntax` only when you also send `search.mode: "lexical"`
> and the top-level recall `mode: "exact"`.
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "search": {
>       "query": "\"site reliability\" +kubernetes (golang | rust) -recruiter",
>       "mode": "lexical",
>       "query_syntax": "boolean"
>     },
>     "mode": "exact",
>     "fields": ["fit", "basic_profile"],
>     "limit": 5
>   }'
> ```
>
> For the full operator reference, see the
> [Person Semantic Search guide](https://docs.crustdata.com/guides/person-semantic-search.md#boolean-keyword-operators).

> [accordion] Concept search (semantic mode)
>
> Use `semantic` to match the meaning of a query, even when profiles use
> different words. This mode uses vector similarity only.
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "search": { "query": "people who scaled infrastructure at hypergrowth startups", "mode": "semantic" },
>     "fields": ["fit", "basic_profile"],
>     "limit": 5
>   }'
> ```

> [accordion] Semantic ranking inside hard filters (mode: exact)
>
> With the top-level `mode: "exact"`, every result must match your `filters`.
> The query then ranks the profiles inside that set.
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "search": { "query": "machine learning engineers who have built recommender systems", "mode": "hybrid" },
>     "mode": "exact",
>     "filters": { "field": "basic_profile.location.full_location", "type": "(.)", "value": "San Francisco" },
>     "fields": ["fit", "basic_profile"],
>     "limit": 5
>   }'
> ```

***

## More recipes

Each recipe below is a full walkthrough with a tested request. Expand a recipe
to see the pattern, the response, and how the operators work.

> [accordion] Search by employer and title
>
> Sales and recruiting teams use this pattern the most. It finds people with a specific title at a specific company. This search finds VPs, Directors, and Heads of department at Retool.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {
>           "field": "experience.employment_details.company_name",
>           "type": "in",
>           "value": ["Retool"]
>         },
>         {
>           "op": "or",
>           "conditions": [
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "VP" },
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "Vice President" },
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "Director" },
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "Head of" },
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "Head" }
>           ]
>         }
>       ]
>     },
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 97567,
>             "basic_profile": {
>                 "name": "Krithika S.",
>                 "headline": "Marketing at Thrive Capital",
>                 "location": {
>                     "country": "United States of America",
>                     "raw": "United States"
>                 }
>             },
>             "social_handles": {
>                 "professional_network_identifier": {
>                     "profile_url": "https://www.linkedin.com/in/krithix"
>                 }
>             },
>             "experience": {
>                 "employment_details": {
>                     "current": [
>                         {
>                             "name": "Thrive Capital",
>                             "title": "Executive in Residence, Marketing"
>                         }
>                     ],
>                     "past": [
>                         {
>                             "name": "Stripe",
>                             "title": "Head of Marketing"
>                         },
>                         { "name": "Retool", "title": "VP Marketing" },
>                         { "name": "OpenAI", "title": "" },
>                         { "name": "Google", "title": "" },
>                         { "name": "Dropbox", "title": "" }
>                     ]
>                 }
>             }
>         }
>     ],
>     "next_cursor": "H4sIAJO-oWkC_xXMMQ6DMAwAw...",
>     "total_count": 88
> }
> ```
>
> > [!NOTE]
> >
> > This example shows only part of the response.
>
> ### How the operators work
>
> This search uses two operators:
>
> * `in` on `experience.employment_details.company_name` checks if the person worked at any of the listed companies, now or in the past. Send an array, even for one company. To search only current employers, use `experience.employment_details.current.company_name`.
> * `(.)` on `experience.employment_details.current.title` matches when every word in the value appears in the current title, in any order. The `or` group holds one `(.)` condition for each title, so a profile matches when any one of them matches. To also match past titles, use `experience.employment_details.title`.
>
> The `experience.employment_details.company_name` field includes all employers, current and past. A result can have a current role at a different company. That person worked at your target company in the past.
>
> > [!WARNING]
> >
> > A `|` in a `(.)` value does not mean OR. The API reads `"VP|Director"` the
> > same as `"VP Director"`, so a title must contain both words. To match any
> > one of several titles, put one `(.)` condition for each title in an `or`
> > group, as in this example.

> [accordion] Find people at a company by its profile URL
>
> If you know the profile URL of a company but not its exact name, filter on the employer profile URL. Two companies can have the same name, but a profile URL points to one company. This is the most reliable way to find people at one specific company.
>
> To find people who work there now, use the current-employer field:
>
> ```bash Request (current employees) theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "experience.employment_details.current.company_professional_network_profile_url",
>       "type": "=",
>       "value": "https://www.linkedin.com/company/stripe"
>     },
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 13183,
>             "basic_profile": {
>                 "name": "Lucas Dickey",
>                 "headline": "Day Zero Things"
>             },
>             "experience": {
>                 "employment_details": {
>                     "current": [{ "name": "Stripe", "title": "Builder" }]
>                 }
>             }
>         }
>     ],
>     "next_cursor": "H4sIABi5FmoC_xXMMQ7CMAwA...",
>     "total_count": 11528
> }
> ```
>
> > [!NOTE]
> >
> > This example shows only part of the response.
>
> > [!NOTE]
> >
> > Send the company page URL, for example
> > `https://www.linkedin.com/company/stripe`. Search also accepts the URL with
> > a trailing slash (`.../stripe/`), with no scheme
> > (`linkedin.com/company/stripe`), or with no `www.`. Each form returns the
> > same profiles.
>
> ### Current, former, or either
>
> * Current employees: `experience.employment_details.current.company_professional_network_profile_url`
> * Former employees: `experience.employment_details.past.company_professional_network_profile_url`
> * Anyone who ever worked there: combine both fields in an `or` group.
>
> ```json theme={"theme":"vitesse-black"}
> {
>     "filters": {
>         "op": "or",
>         "conditions": [
>             { "field": "experience.employment_details.current.company_professional_network_profile_url", "type": "=", "value": "https://www.linkedin.com/company/stripe" },
>             { "field": "experience.employment_details.past.company_professional_network_profile_url", "type": "=", "value": "https://www.linkedin.com/company/stripe" }
>         ]
>     },
>     "limit": 25
> }
> ```
>
> To search several companies in one request, use the `in` operator with an array of profile URLs.
>
> > [!NOTE]
> >
> > You cannot filter on the bare
> > `experience.employment_details.company_professional_network_profile_url`
> > path (all employers). Use the `current.` or `past.` path above. The API
> > also accepts the alias `...company_linkedin_profile_url`, which points to
> > the same data.
>
> > [!NOTE]
> >
> > These fields take the company page of the employer. A school page, a
> > person profile, or a bare slug returns `400`, because Crustdata stores no
> > employer under these URLs. For the URL shapes that search accepts, see
> > [Employer profile URL values](https://docs.crustdata.com/person-docs/search/reference.md#employer-profile-url-values).

> [accordion] Keep only employers resolved to a live company record
>
> Every employment object has a `company_status` field. It shows the lifecycle
> state of the employer in the Crustdata entity graph. It has three values:
>
> * `active`: The employer is a live company record.
> * `deleted`: Crustdata retired the company record.
> * `null`: Crustdata never resolved the employer to a company record. The role
>   has only the free-text company name.
>
> Filter on `company_status` when a later step needs a real company behind the
> role. For example, use it before you enrich the employer or send the person to
> an account owner. This search finds directors at Stripe. It keeps only roles
> whose employer is a live record.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {
>           "field": "experience.employment_details.current.company_website_domain",
>           "type": "=",
>           "value": "stripe.com"
>         },
>         {
>           "field": "experience.employment_details.current.company_status",
>           "type": "=",
>           "value": "active"
>         },
>         {
>           "field": "experience.employment_details.current.seniority_level",
>           "type": "=",
>           "value": "Director"
>         }
>       ]
>     },
>     "fields": [
>       "basic_profile.name",
>       "experience.employment_details.current.name",
>       "experience.employment_details.current.title",
>       "experience.employment_details.current.company_status"
>     ],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 19835,
>             "basic_profile": { "name": "Raymond Lau" },
>             "experience": {
>                 "employment_details": {
>                     "current": [
>                         { "company_status": "active", "name": "Stripe", "title": "Head of Product" },
>                         { "company_status": "active", "name": "T:0", "title": "Senior Director" }
>                     ]
>                 }
>             }
>         },
>         {
>             "crustdata_person_id": 95799,
>             "basic_profile": { "name": "Tasneen Padiath" },
>             "experience": {
>                 "employment_details": {
>                     "current": [
>                         { "company_status": "active", "name": "Stripe", "title": "Head of Customer Success" }
>                     ]
>                 }
>             }
>         }
>     ],
>     "next_cursor": "H4sIALZElWoC_xXMMQ7CMAwAwK9UmRmcOIltvoJQlRhHHRARbTpUiL9T1hvu4967rce8lG1x18mpqRj4VC0ox2LesGnDyM2AEgKQb1yMKCMJsgpXiQQ5lxqCt4e7TG7r6zivmyQSuZ8w-ijPWfv--jsH-P4Ao2R1k3cAAAA=",
>     "total_count": 820,
>     "total_count_relation": null
> }
> ```
>
> To check a former employer, change `current.` to `past.`. To match any role
> that the person held, remove the prefix:
> `experience.employment_details.company_status`.
>
> > [!WARNING]
> >
> > A profile matches when any one of its roles meets the condition. So this
> > filter does not make sure that every role on a returned profile is
> > `active`. The two profiles above keep all of their current roles, including
> > roles at other companies. Read `company_status` on the role that you use.
> > Do not assume its value because the profile matched.

> [accordion] Exclude specific titles
>
> To get everyone at a company except some roles, use the `not_in` operator to exclude titles.
>
> This search finds people at OpenAI or Retool, but excludes interns and students.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {
>           "field": "experience.employment_details.company_name",
>           "type": "in",
>           "value": ["OpenAI", "Retool"]
>         },
>         {
>           "field": "experience.employment_details.title",
>           "type": "not_in",
>           "value": ["Intern", "Student"]
>         }
>       ]
>     },
>     "limit": 2
>   }'
> ```
>
> The `not_in` operator removes every profile where one of the listed values appears in the title history. Use it to clean up results in recruiting or sales workflows.

> [accordion] Search within a geographic radius
>
> The `geo_distance` filter finds people within a specific distance of a city. Use it for territory-based sales or local recruiting.
>
> This search finds people within 10 miles of San Francisco whose current title contains "CTO" or "Chief Technology Officer".
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {
>           "field": "professional_network.location.raw",
>           "type": "geo_distance",
>           "value": {
>             "location": "San Francisco",
>             "distance": 10,
>             "unit": "mi"
>           }
>         },
>         {
>           "op": "or",
>           "conditions": [
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "CTO" },
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "Chief Technology Officer" }
>           ]
>         }
>       ]
>     },
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 1188,
>             "basic_profile": {
>                 "name": "Matthew Trentini",
>                 "headline": "-",
>                 "location": {
>                     "raw": "San Francisco Bay Area",
>                     "state": "California",
>                     "country": "United States"
>                 }
>             },
>             "social_handles": {
>                 "professional_network_identifier": {
>                     "profile_url": "https://www.linkedin.com/in/matthew-trentini-b339bb5"
>                 }
>             },
>             "experience": {
>                 "employment_details": {
>                     "current": [
>                         {
>                             "name": "Farallon Capital Management",
>                             "title": "Chief Technology Officer"
>                         }
>                     ],
>                     "past": [
>                         {
>                             "name": "Farallon Capital Management",
>                             "title": "Lead Software Engineer"
>                         }
>                     ]
>                 }
>             }
>         }
>     ],
>     "next_cursor": "H4sIAAiOwGoC_xXMMQ7CMAxA0a...",
>     "total_count": 5604
> }
> ```
>
> > [!NOTE]
> >
> > This example shows only part of the response.
>
> ### How geo\_distance works
>
> The `geo_distance` filter uses the `professional_network.location.raw` field.
> The `value` is an object that sets the center point in one of two ways:
>
> * A `location` string. The server geocodes it.
> * An explicit `lat_lng` pair. This skips geocoding.
>
> If you send both, the API uses `lat_lng`.
>
> | Field | Required | Description |
> | - | - | - |
> | `location` | Send `location` or `lat_lng` | A city or region name. The server geocodes it. Examples: `"San Francisco"`, `"London"`, `"New York"`. |
> | `lat_lng` | Send `location` or `lat_lng` | An explicit `[lat, lng]` pair. Lat must be in `[-90, 90]`. Lng must be in `[-180, 180]`. This skips geocoding. |
> | `distance` | Yes | The radius from the center point. The value must be positive. |
> | `unit` | No | One of `km`, `mi`, `miles`, `m`, `meters`, `ft`, `feet`. The default is `km`. |
>
> ### Search by explicit coordinates
>
> Use `lat_lng` when you already have coordinates, for example from a map
> picker. You can also use it to skip the geocoding step. The example below finds
> people within 5 km of latitude `37.7749`, longitude `-122.4194` (downtown San
> Francisco).
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "professional_network.location.raw",
>       "type": "geo_distance",
>       "value": {
>         "lat_lng": [37.7749, -122.4194],
>         "distance": 5,
>         "unit": "km"
>       }
>     },
>     "limit": 5
>   }'
> ```

> [accordion] Exclude a geographic radius
>
> The `geo_exclude` filter is the inverse of `geo_distance`. It removes people
> inside the radius and keeps everyone else. Use it to remove a metro area that
> you already cover. You can also use it to find candidates outside a relocation
> zone.
>
> This search finds engineers who are not within 50 km of San Francisco.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {
>           "field": "professional_network.location.raw",
>           "type": "geo_exclude",
>           "value": {
>             "location": "San Francisco",
>             "distance": 50,
>             "unit": "km"
>           }
>         },
>         {
>           "field": "experience.employment_details.current.title",
>           "type": "(.)",
>           "value": "engineer"
>         }
>       ]
>     },
>     "limit": 1
>   }'
> ```
>
> `geo_exclude` takes the same value object as `geo_distance`: `location` or
> `lat_lng`, a required `distance`, and an optional `unit`. So you can also
> exclude a radius around explicit coordinates.

> [accordion] Search inside a polygon
>
> The `geo_polygon` filter finds people located inside a polygon you describe
> with coordinates. Reach for it when a circle is the wrong shape for the area
> you care about, such as a sales territory or a commute zone traced on a map.
>
> This search finds engineers located inside a box over the San Francisco
> peninsula.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {
>           "field": "professional_network.location.raw",
>           "type": "geo_polygon",
>           "value": {
>             "points": [[37.81, -122.52], [37.81, -122.35], [37.70, -122.35], [37.70, -122.52]]
>           }
>         },
>         {
>           "field": "experience.employment_details.current.title",
>           "type": "(.)",
>           "value": "engineer"
>         }
>       ]
>     },
>     "limit": 1
>   }'
> ```
>
> The `value` is an object with a single `points` key: a list of `[lat, lng]`
> pairs, at least 3 distinct points and at most 1,000. The polygon closes itself,
> so you do not need to repeat the first point. Coordinates are used as given and
> are not geocoded. See the
> [`geo_polygon` reference](https://docs.crustdata.com/person-docs/search/reference#geo_polygon-inside-a-polygon)
> for the value-object table and the `400` cases.

> [accordion] Exclude profiles matching a substring
>
> Use `(!)` to remove profiles whose value contains a specific phrase. `not_in`
> needs exact values. Use `(!)` when you need a substring exclusion instead.
>
> This search finds VP-level people at Retool. Then it removes anyone whose
> headline contains "Investor" or "Advisor".
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {
>           "field": "experience.employment_details.current.company_name",
>           "type": "=",
>           "value": "Retool"
>         },
>         {
>           "field": "experience.employment_details.current.title",
>           "type": "(.)",
>           "value": "VP"
>         },
>         {
>           "field": "basic_profile.headline",
>           "type": "(!)",
>           "value": "Investor"
>         },
>         {
>           "field": "basic_profile.headline",
>           "type": "(!)",
>           "value": "Advisor"
>         }
>       ]
>     },
>     "limit": 5
>   }'
> ```
>
> > [!NOTE]
> >
> > `(!)` matches a multi-word value as a literal phrase. `(!) "New York"`
> > excludes only profiles that contain the literal phrase `"New York"`. It
> > does not exclude `"New Yorker"`. To exclude each word on its own, send a
> > separate `(!)` condition for each word in an `and` group, as in the
> > example above.

> [accordion] Search by country
>
> For a wider geographic search, filter by country.
>
> > [!NOTE]
> >
> > `basic_profile.location.country` uses full country names, such as `"United
> >           States"` or `"India"`.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "basic_profile.location.country",
>       "type": "=",
>       "value": "United States"
>     },
>     "limit": 2
>   }'
> ```
>
> This search returns all people in the United States. More than 125M profiles match, so combine this filter with a title or employer filter to narrow the results.

> [accordion] Search by employer headquarters country
>
> Use `company_headquarters_country` to filter by the headquarters country of a
> person's current or past employer.
>
> > [!NOTE]
> >
> > `company_headquarters_country` accepts a full country name, such as
> > `United States`, or an ISO 3166-1 alpha-3 code, such as `USA`. Both forms
> > return the same people on the current, past, and all-roles headquarters
> > country fields. The response returns the full country name.
> > `basic_profile.location.country` accepts full names only.
>
> This search finds founders or co-founders whose current employer has its
> headquarters in the United States. Each person also worked at an employer with
> headquarters in India in the past.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
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
>               "field": "experience.employment_details.current.title",
>               "type": "(.)",
>               "value": "Founder"
>             },
>             {
>               "field": "experience.employment_details.current.title",
>               "type": "(.)",
>               "value": "Co-Founder"
>             }
>           ]
>         },
>         {
>           "field": "experience.employment_details.current.company_headquarters_country",
>           "type": "=",
>           "value": "USA"
>         },
>         {
>           "field": "experience.employment_details.past.company_headquarters_country",
>           "type": "=",
>           "value": "IND"
>         }
>       ]
>     },
>     "limit": 10
>   }'
> ```

> [accordion] Exclude specific people from results
>
> Use `post_processing` to remove known profiles from the results. For example, when you run a search again, use it to skip people that you already contacted.
>
> ```bash Exclude specific people theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "experience.employment_details.title",
>       "type": "(.)",
>       "value": "Founder"
>     },
>     "limit": 5,
>     "post_processing": {
>       "exclude_names": ["Ali Kashani"],
>       "exclude_profiles": ["https://www.linkedin.com/in/alikashani"]
>     }
>   }'
> ```
>
> You can exclude by name, by profile URL, or both.

> [accordion] Build a profile card with company and school logos
>
> Person Search returns stable logo permalinks that Crustdata hosts. Employers have `company_profile_picture_permalink`, and schools have `institute_logo_permalink`. You can show a profile card with these links, and you do not have to find the image URLs yourself. Request the `experience` and `education` sections for the person that you want.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": { "field": "crustdata_person_id", "type": "=", "value": 14540 },
>     "fields": ["basic_profile", "experience", "education"],
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 14540,
>             "basic_profile": {
>                 "name": "David Hsu",
>                 "current_title": "Founder, CEO"
>             },
>             "experience": {
>                 "employment_details": {
>                     "current": [
>                         {
>                             "name": "Retool",
>                             "title": "Founder, CEO",
>                             "company_profile_picture_permalink": "https://crustdata-media.s3.us-east-2.amazonaws.com/company/72f60d0ccad488216922fb784abc89890b49eeed8ab1eca1a0a12c72a68a0620.jpg"
>                         }
>                     ]
>                 }
>             },
>             "education": {
>                 "schools": [
>                     {
>                         "school": "University of Oxford",
>                         "institute_logo_permalink": "https://crustdata-media.s3.us-east-2.amazonaws.com/company/3d2093a16f7cf7b459a0d30d4e795d0be5a41a3396f21dee899e43e8a8b6de8d.jpg"
>                     }
>                 ]
>             }
>         }
>     ],
>     "next_cursor": "H4sIAFNsGWoC_xXM...",
>     "total_count": 1
> }
> ```
>
> > [!TIP]
> >
> > The response includes `company_profile_picture_permalink` and
> > `institute_logo_permalink` for display only. You cannot search on these
> > fields.

> [accordion] Find everyone at a company by its website domain
>
> If you know the website domain of a company but not its exact display name, filter on the employer domain. To find people who work there now, use the current-employer field.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "experience.employment_details.current.company_website_domain",
>       "type": "=",
>       "value": "stripe.com"
>     },
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 13183,
>             "basic_profile": {
>                 "name": "Lucas Dickey",
>                 "headline": "Day Zero Things",
>                 "location": { "raw": "Greater Seattle Area", "country": "United States" }
>             },
>             "social_handles": {
>                 "professional_network_identifier": {
>                     "profile_url": "https://www.linkedin.com/in/lucasdickey"
>                 }
>             },
>             "experience": {
>                 "employment_details": {
>                     "current": [
>                         {
>                             "name": "Stripe",
>                             "title": "Builder",
>                             "company_website": "https://stripe.com"
>                         }
>                     ]
>                 }
>             }
>         }
>     ],
>     "next_cursor": "H4sIADnRQWoC_xXMOw...",
>     "total_count": 11897
> }
> ```
>
> > [!NOTE]
> >
> > This example shows only part of the response. The response has the full
> > website URL of the employer in `company_website`. The `company_website_domain`
> > paths are filter names only. They do not appear in search responses.
>
> To search several companies in one request, use the `in` operator with an array of domains. Pick the field for the people that you want:
>
> * Current employees: the `current.` field above.
> * Former employees: `experience.employment_details.past.company_website_domain`.
> * Anyone who ever worked there: the all-roles field `experience.employment_details.company_website_domain`.

> [accordion] Find people who recently changed jobs at a company
>
> Combine the `recently_changed_jobs` flag with a current-employer filter. This limits the job-change signal to one target company. It is a good start for sales and recruiting outreach.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {
>           "field": "experience.employment_details.current.company_name",
>           "type": "in",
>           "value": ["OpenAI"]
>         },
>         { "field": "recently_changed_jobs", "type": "=", "value": true }
>       ]
>     },
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 13535,
>             "basic_profile": {
>                 "name": "Gary Lin",
>                 "headline": "Deployed at OpenAI (we’re hiring!)",
>                 "location": { "raw": "New York, New York, United States" }
>             },
>             "experience": {
>                 "employment_details": {
>                     "current": [
>                         { "name": "OpenAI", "title": "Member of Forward Deployed Staff" }
>                     ]
>                 }
>             }
>         }
>     ],
>     "next_cursor": "H4sIADrRQWoC_xXMPQ...",
>     "total_count": 1051
> }
> ```
>
> > [!NOTE]
> >
> > This example shows only part of the response.
>
> `recently_changed_jobs` is a boolean. Combine it with a `current.` employer or title filter to limit the signal to the people that you want. You can filter and sort on it. To read the value, add `experience.recently_changed_jobs` to `fields`. That field is enabled per account.
>
> The flag marks a past role that ended within 90 days of the last index rebuild. It does not mark a new role that started. To find people who recently started a role, filter `experience.employment_details.current.start_date` on a date range.

> [accordion] Exclude anyone who ever held a senior title
>
> To find only individual contributors, use `not_in` on the all-roles paths: `experience.employment_details.seniority_level` and `experience.employment_details.title`. On these paths, `not_in` removes anyone who ever held that seniority or title, in any role. It does not check only the current role.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {
>           "field": "experience.employment_details.seniority_level",
>           "type": "not_in",
>           "value": ["Owner / Partner", "CXO", "Vice President", "Director"]
>         },
>         {
>           "field": "experience.employment_details.title",
>           "type": "not_in",
>           "value": ["CEO", "President", "Chairman", "Founder", "Co-Founder"]
>         },
>         {
>           "field": "experience.employment_details.current.title",
>           "type": "(.)",
>           "value": "engineer"
>         }
>       ]
>     },
>     "limit": 50
>   }'
> ```
>
> This search keeps people whose current title contains "engineer". It excludes anyone who was ever a VP, Director, or CXO, or who held a founder or CEO-level title. The exclusions are on the all-roles paths, so one past executive role removes a profile.

> [accordion] Exclude people who ever worked at a competitor
>
> Use `not_in` on the all-roles path `experience.employment_details.company_name` to remove anyone who ever worked at a named company, now or in the past. This is the most direct way to remove competitor alumni from a candidate or prospect list.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {
>           "field": "experience.employment_details.current.title",
>           "type": "(.)",
>           "value": "Software Engineer"
>         },
>         {
>           "field": "experience.employment_details.company_name",
>           "type": "not_in",
>           "value": ["Google", "Meta"]
>         }
>       ]
>     },
>     "limit": 50
>   }'
> ```
>
> The all-roles `company_name` path covers current and past employers. So this search excludes a profile if Google or Meta appears anywhere in the work history. To match one exact company, use the company profile URL paths (`...company_professional_network_profile_url`), not names.

> [accordion] VC sourcing: founders from top schools at new companies
>
> Combine filters to find founders for an investor pipeline. This search uses four filters:
>
> * A founder or CEO title.
> * A target school.
> * A recent start date for the current role. This is a proxy for a recently founded company.
> * A country.
>
> Each filter makes the result set smaller.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
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
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "Founder" },
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "CEO" }
>           ]
>         },
>         { "field": "education.schools.school", "type": "(.)", "value": "Stanford" },
>         { "field": "experience.employment_details.current.start_date", "type": "=>", "value": "2023-01-01" },
>         { "field": "basic_profile.location.country", "type": "=", "value": "United States" }
>       ]
>     },
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 1102,
>             "basic_profile": {
>                 "name": "François Locoh-Donou",
>                 "headline": "Chairman, President, & CEO of F5",
>                 "location": { "raw": "Seattle, Washington, United States", "country": "United States" }
>             },
>             "education": {
>                 "schools": [
>                     { "school": "Stanford GSB", "degree": "Master of Business Administration (MBA)" }
>                 ]
>             }
>         }
>     ],
>     "next_cursor": "H4sIADvRQWoC_xXMMQ...",
>     "total_count": 10046
> }
> ```
>
> > [!NOTE]
> >
> > This example shows only part of the response. `basic_profile.location.country` uses full country names. `current.start_date` accepts ISO date strings with the `=>` (greater than or equal) operator.

> [accordion] Find people by graduation year
>
> Find people who finished a bachelor's degree from 2023 to 2025 and now work as private equity analysts. `education.schools.end_year` takes a whole-number year. The degree and both year conditions sit in one `and` group, so they must match one school.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "education.schools.degree", "type": "(.)", "value": "Bachelor" },
>         { "field": "education.schools.end_year", "type": "=>", "value": 2023 },
>         { "field": "education.schools.end_year", "type": "=<", "value": 2025 },
>         { "field": "experience.employment_details.current.title", "type": "(.)", "value": "private equity analyst" }
>       ]
>     },
>     "limit": 2,
>     "fields": ["basic_profile.name", "education.schools.school", "education.schools.degree", "education.schools.end_year", "experience.employment_details.current.title"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 367383,
>             "basic_profile": { "name": "Samuel Chang" },
>             "education": {
>                 "schools": [
>                     { "degree": "Bachelor of Arts - BA", "end_year": 2025, "school": "Princeton University" },
>                     { "degree": "High School Diploma", "end_year": 2020, "school": "Phillips Exeter Academy" }
>                 ]
>             },
>             "experience": {
>                 "employment_details": { "current": [{ "title": "Private Equity Analyst" }] }
>             }
>         },
>         {
>             "crustdata_person_id": 581135,
>             "basic_profile": { "name": "Un Lersvidhaya" },
>             "education": {
>                 "schools": [
>                     { "degree": "Master in Management - MIM", "end_year": 2027, "school": "INSEAD" },
>                     { "degree": "Bachelor of Arts - BA", "end_year": 2024, "school": "Durham University" }
>                 ]
>             },
>             "experience": {
>                 "employment_details": { "current": [{ "title": "Private Equity Analyst" }] }
>             }
>         }
>     ],
>     "next_cursor": "H4sIAJFy6WoC_xXMyw...",
>     "total_count": 968
> }
> ```
>
> > [!NOTE]
> >
> > This response shows two schools per person. The API returned four more for the second person. An `end_year` can be a future year, such as `2027` for a degree in progress. For the year operators and errors, see [Education](https://docs.crustdata.com/person-docs/search/reference.md#education).

> [accordion] Cross-border talent: from one country's companies to another's
>
> A cross-border mover is a person who moved from an employer in one country to an employer in another country. To find cross-border movers, filter on the headquarters country of the past and current employers. For example, find engineers who worked at companies with headquarters in India and now work at companies with headquarters in the US. The headquarters country fields accept an ISO 3166-1 alpha-3 code, such as `IND`, or a full country name, such as `India`.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "experience.employment_details.past.company_headquarters_country", "type": "=", "value": "IND" },
>         { "field": "experience.employment_details.current.company_headquarters_country", "type": "=", "value": "USA" },
>         { "field": "experience.employment_details.current.title", "type": "(.)", "value": "Engineer" }
>       ]
>     },
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 1394,
>             "basic_profile": {
>                 "name": "Harbin Lee",
>                 "location": { "raw": "Amsterdam, North Holland, Netherlands" }
>             },
>             "experience": {
>                 "employment_details": {
>                     "current": [
>                         {
>                             "name": "OSIsoft",
>                             "title": "Senior Software Engineer",
>                             "company_headquarters_country": "United States"
>                         }
>                     ],
>                     "past": [
>                         {
>                             "name": "InMobi Advertising",
>                             "title": "Senior Software Engineer",
>                             "company_headquarters_country": "India"
>                         }
>                     ]
>                 }
>             }
>         }
>     ],
>     "next_cursor": "H4sIAJWBw2oC_xXMMQ...",
>     "total_count": 661780
> }
> ```
>
> > [!NOTE]
> >
> > This example shows only part of the response. The location of the person and the headquarters country of the employer are independent. This person is in the Netherlands, but the employers have headquarters in the US and India.

> [accordion] Filter by continent
>
> For the widest geographic search, filter on `basic_profile.location.continent`. It takes a full continent name, such as `"Europe"`, `"Asia"`, or `"North America"`.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "basic_profile.location.continent", "type": "=", "value": "Europe" },
>         { "field": "experience.employment_details.current.title", "type": "(.)", "value": "Founder" }
>       ]
>     },
>     "limit": 2
>   }'
> ```
>
> This search returns founders anywhere in Europe. At the time of writing, `total_count` was 1,055,157. To narrow a large result set, combine the continent filter with a title, employer, or country filter. You can filter on `basic_profile.location.continent`, but you cannot sort on it.

> [accordion] People who worked at two specific companies
>
> To find people who worked at both of two named companies, use one company as the current employer and the other as a past employer. Use a different path for each company: `experience.employment_details.current.company_name` and `experience.employment_details.past.company_name`.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "experience.employment_details.current.company_name", "type": "=", "value": "Stripe" },
>         { "field": "experience.employment_details.past.company_name", "type": "=", "value": "Google" }
>       ]
>     },
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 153784,
>             "basic_profile": {
>                 "name": "Vadim Jelezniakov",
>                 "headline": "Head of Engineering for Data Infrastructure @ Stripe"
>             },
>             "experience": {
>                 "employment_details": {
>                     "current": [
>                         { "name": "Stripe", "title": "Head of Data Infrastructure" }
>                     ],
>                     "past": [
>                         { "name": "Meta", "title": "Director of Engineering, Core Services PE" },
>                         { "name": "Google", "title": "" }
>                     ]
>                 }
>             }
>         }
>     ],
>     "next_cursor": "H4sIADzRQWoC_xXMMQ...",
>     "total_count": 754
> }
> ```
>
> > [!NOTE]
> >
> > This example shows only part of the response.
>
> > [!WARNING]
> >
> > This pattern works because the search matches each company against a
> > different employment slot: `current.` or `past.`. Two `=` conditions with
> > two different company names on the same all-roles path
> > (`experience.employment_details.company_name`) return zero results. One
> > employment record cannot equal both names.

> [accordion] Find people with a verified business email
>
> Filter on `experience.employment_details.current.business_email_verified` to keep only profiles that have a verified business email on the current role. Use it when you plan to enrich the profiles and contact people by email.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "experience.employment_details.current.business_email_verified", "type": "=", "value": true },
>         { "field": "experience.employment_details.current.company_name", "type": "in", "value": ["Stripe"] }
>       ]
>     },
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 44532,
>             "basic_profile": {
>                 "name": "Maureen Aguilar",
>                 "headline": "Co-Founder at Stripe",
>                 "location": { "raw": "White Post, Virginia, United States" }
>             },
>             "experience": {
>                 "employment_details": {
>                     "current": [
>                         {
>                             "name": "Stripe",
>                             "title": "Co-Founder",
>                             "business_email_verified": true
>                         }
>                     ]
>                 }
>             }
>         }
>     ],
>     "next_cursor": "H4sIAD3RQWoC_xXMSw...",
>     "total_count": 2858
> }
> ```
>
> > [!NOTE]
> >
> > This example shows only part of the response. You can filter on `business_email_verified` on the current, past, and all-roles paths. The response also includes it in the current role, as in the example above. The response does not include the email address. To get the email address, use [Contact Enrich](https://docs.crustdata.com/person-docs/contact/enrich.md).

> [accordion] Sort a company's people by follower count
>
> Add a `sorts` array to sort the results. This search finds everyone who worked at Retool, now or in the past, and sorts them by professional network followers, highest first. In `fields`, request the fields that you want to read with the sort key.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "experience.employment_details.company_name",
>       "type": "in",
>       "value": ["Retool"]
>     },
>     "sorts": [{ "field": "professional_network.followers", "order": "desc" }],
>     "limit": 3,
>     "fields": ["crustdata_person_id", "basic_profile.name"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         { "crustdata_person_id": 193594, "basic_profile": { "name": "Jeff An" } },
>         { "crustdata_person_id": 3408565, "basic_profile": { "name": "Jake Fox (on leave)" } },
>         { "crustdata_person_id": 1061161, "basic_profile": { "name": "Cailen DSa" } }
>     ],
>     "next_cursor": "H4sIAL8XRmoC_x...",
>     "total_count": 952
> }
> ```
>
> > [!NOTE]
> >
> > This example shows only part of the response.
>
> You can filter and sort on `professional_network.followers`, but the results do not include it. The sort orders profiles by follower count, but it does not show the count. When you paginate, always send a `sorts` array so that the order stays the same across pages. See [Pagination and sorting](https://docs.crustdata.com/person-docs/search/reference.md#paginate-through-results).

> [accordion] Find the most-cited researchers (research\_profiles, enabled on request)
>
> Filter on `research_profiles.h_index.all` to keep people whose matched
> academic author profile has an h-index above 100, sort by lifetime citations,
> and read the name and citation count back in `fields`. The group is enabled per
> account. Without the grant, the request returns `403` with
> `Access denied to fields: research_profiles`.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "research_profiles.h_index.all",
>       "type": ">",
>       "value": 100
>     },
>     "sorts": [{ "field": "research_profiles.citations_count.all", "order": "desc" }],
>     "fields": ["basic_profile.name", "research_profiles.name", "research_profiles.citations_count.all"],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 4550955,
>             "basic_profile": { "name": "Yoshua Bengio" },
>             "research_profiles": [
>                 { "name": "Yoshua Bengio", "citations_count": { "all": 1153498 } }
>             ]
>         },
>         {
>             "crustdata_person_id": 282824395,
>             "basic_profile": { "name": "Ahmedin Jemal" },
>             "research_profiles": [
>                 { "name": "Ahmedin Jemal", "citations_count": { "all": 1010816 } }
>             ]
>         }
>     ],
>     "next_cursor": "H4sIAG67x2oC...",
>     "total_count": 7860,
>     "total_count_relation": null,
>     "remarks": []
> }
> ```
>
> `research_profiles` is an array because a person can hold more than one author
> profile. A filter matches when any of them matches. Search returns a smaller
> copy of each profile than enrich does. See
> [Research profiles](https://docs.crustdata.com/person-docs/search/reference.md#research-profiles) for the
> filterable and sortable paths, and
> [Person Enrich](https://docs.crustdata.com/person-docs/enrichment/reference.md#research_profiles-fields)
> for the full article and co-author lists.

> [accordion] Read certifications and years of experience (enabled per account)
>
> Filter on `certifications.name` to find people who hold a certification. Then
> name the certification fields and `years_of_experience_raw` in `fields` to read
> them back. These fields are enabled per account. Without access, the request
> returns `403`. The message lists each denied path:
> `Access denied to fields: certifications.issue_date, certifications.issuing_organization, certifications.name, years_of_experience_raw`.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "certifications.name",
>       "type": "(.)",
>       "value": "AWS Certified Solutions Architect"
>     },
>     "fields": [
>       "basic_profile.name",
>       "certifications.name",
>       "certifications.issuing_organization",
>       "certifications.issue_date",
>       "years_of_experience_raw"
>     ],
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 1173,
>             "basic_profile": { "name": "Man Sum Simon Yuen" },
>             "certifications": [
>                 {
>                     "issue_date": "2023-10-01T00:00:00",
>                     "issuing_organization": "Project Management Institute",
>                     "name": "Project Management Professional (PMP)"
>                 },
>                 {
>                     "issue_date": "2021-03-01T00:00:00",
>                     "issuing_organization": "Amazon Web Services (AWS)",
>                     "name": "AWS Certified Solutions Architect - Associate "
>                 }
>             ],
>             "years_of_experience_raw": 20
>         }
>     ],
>     "next_cursor": "H4sIAFrK4WoC_xXMMQ...",
>     "total_count": 362358,
>     "total_count_relation": null,
>     "remarks": []
> }
> ```
>
> > [!NOTE]
> >
> > This example shows 2 of the person's 5 certifications.
>
> `certifications` is an array, and the response returns every certification on
> the profile, not only the one that matched. The filter matches when any
> certification matches. A certification with no value for a field that you name
> returns `null` for that field.

> [accordion] Preview a search before running it in full
>
> Preview mode returns smaller results. Use it to check a filter and read `total_count` before you run a full search. To use it, set `preview: true` with your normal filters.
>
> > [!NOTE]
> >
> > Preview is a premium feature. To turn it on for your account, contact
> > [gtm@crustdata.co](mailto:gtm@crustdata.co). If your account does not have
> > preview, the API returns `403 permission_error`. For the full error, see
> > [Preview mode](https://docs.crustdata.com/person-docs/search/reference.md#preview-mode) in the search
> > reference.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "field": "experience.employment_details.title",
>       "type": "(.)",
>       "value": "Founder"
>     },
>     "preview": true,
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>   "profiles": [
>     {
>       "crustdata_person_id": 958,
>       "basic_profile": {
>         "headline": "CEO & Co-Founder, Noise (Hiring at all levels)",
>         "location": {
>           "raw": "Gurgaon, Haryana, India"
>         },
>         "name": "Gaurav Khatri",
>         "professional_network_name": "Gaurav Khatri",
>         "profile_picture_permalink": "https://crustdata-media.s3.us-east-2.amazonaws.com/person/1cf520715028fad9e20ae5a7dfda3a45cd5eaec540e944f873ce7d02e22316cb.jpg"
>       },
>       "crustdata_person_id": 958,
>       "social_handles": {
>         "dev_platform_identifier": {
>           "profile_url": null
>         },
>         "professional_network_identifier": {
>           "profile_url": "https://www.linkedin.com/in/gauravkhatrigonoise"
>         }
>       }
>     }
>   ],
>   "next_cursor": "H4sIAHyEXmoC_xXMMQ6DMAxA0asgzx3i2CSkV6kq5DiOGKpGhTBUiLuXjv8N_4DPbut3XmRb4D5AThktc1R0rqBjRKU8GYfiiYtXKYEkUBWKtapZ8sYUU6nRVSVhuA2wtbVfr0cap-eVvXV5zdr291_HFNB7Pn_nuKkBeQAAAA==",
>   "total_count": 5961224,
>   "total_count_relation": null
> }
> ```
>
> > [!NOTE]
> >
> > This example shows only part of the response.
>
> A preview response has the same top-level shape as a normal search: `profiles`, `next_cursor`, and `total_count`. But each profile has fewer fields. For details, see [Preview mode](https://docs.crustdata.com/person-docs/search/reference.md#preview-mode) in the search reference.

***

## What to do next

* To try more filter patterns, see the [example requests](#example-requests) above. They cover employer and title, geo radius, and exclusion patterns.
* To get every matching profile in a stable order, see [Pagination and sorting](https://docs.crustdata.com/person-docs/search/reference.md#paginate-through-results).
* To look up operators, searchable fields, response fields, request parameters, and errors, see [Search reference](https://docs.crustdata.com/person-docs/search/reference.md).
* To get the full cached profile for a profile URL from search, use [Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md).
* To find the exact indexed values for a filter before you build it, use [Person Autocomplete](https://docs.crustdata.com/person-docs/autocomplete/introduction.md).
* For the full schema, see the [OpenAPI spec](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md).


## Related topics

- [Semantic People Search API](https://docs.crustdata.com/guides/person-semantic-search.md)
- [Batch People Search API](https://docs.crustdata.com/person-docs/search/batch-search.md)
- [Capabilities](https://docs.crustdata.com/general/capabilities.md)
- [Search People](https://docs.crustdata.com/api-reference/person-apis/search-people-using-filters-and-sorting.md)
- [Batch Company Search API](https://docs.crustdata.com/company-docs/search/batch-search.md)
