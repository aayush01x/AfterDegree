> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Person Autocomplete API

> Discover valid field values for Person Search filters using the autocomplete API.

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | All plans. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | Yes, the endpoint is free |
| **Credit cost** | Free |
| **Rate limit** | See [Rate limits](https://docs.crustdata.com/general/rate-limits.md) |

**Use this when** you need to discover exact indexed values before building
a Person Search query — for filter dropdowns, input validation, dataset
exploration, or guided query builders.

The Person Autocomplete API returns ranked field-value suggestions so you
can feed the result straight into a [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md)
filter without guessing at valid values.

> [!WARNING]
>
> This endpoint returns **field values, not person profiles**. It also has
> **no pagination or cursor** — the `limit` parameter (max `100`) is the
> only way to control result size. To fetch person records, use
> [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md) or
> [Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md) instead.

> [!NOTE]
>
> Autocomplete does not take a `filters` scope. Suggestions always come
> from the whole dataset. If you send a `filters` key, the API ignores it
> and returns the same suggestions as a request without it.

> [!NOTE]
>
> Replace `YOUR_API_KEY` in each example with your actual API key. All
> requests require the `x-api-version: 2025-11-01` header.

### At a glance

| Detail | Value |
| - | - |
| **Endpoint** | `POST https://api.crustdata.com/person/search/autocomplete` |
| **Auth** | `Authorization: Bearer YOUR_API_KEY` |
| **API version** | `x-api-version: 2025-11-01` header (required) |
| **Required** | `field` (string) · `query` (string, may be empty) |
| **Optional** | `limit` (integer, 1-100, default 20) |
| **Response** | `{ "suggestions": [ { "value": string } ] }` |
| **Errors** | `400` invalid request · `401` unauthorized · `500` internal |
| **Pricing** | Free — see [Pricing](https://docs.crustdata.com/general/pricing.md#person-apis). |

> [!NOTE]
>
> Default `rate-limit` is 45 requests per minute. Send an email to
> [gtm@crustdata.co](mailto:gtm@crustdata.co) to discuss higher limits if
> needed for your use case.

> [card] [Examples](#examples)
>
> Most-common values, closed-enum fields, Autocomplete → Search
> workflow.

> [card] [Reference](#reference)
>
> Contract, request parameters, autocomplete-enabled fields,
> implementation tips, and errors.

***

## When to use Autocomplete vs Search

| You want to… | Use |
| - | - |
| Discover valid filter values for a field | **Autocomplete** (this page) |
| See the distinct values a field takes, ranked by count | **Autocomplete** with an empty `query` |
| Return actual person profiles matching filters | [**Person Search**](https://docs.crustdata.com/person-docs/search/introduction.md) |
| Build a type-ahead dropdown for a filter UI | **Autocomplete** with a partial `query` |
| Build a live multi-field query that returns full rows | [**Person Search**](https://docs.crustdata.com/person-docs/search/introduction.md) |

***

## Quick start: discover job title values

Type-ahead lookup on a single field. Pass the user's partial input as
`query` and cap the dropdown size with `limit`.

```bash curl theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/person/search/autocomplete \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "field": "experience.employment_details.current.title",
    "query": "VP",
    "limit": 5
  }'
```

```python Python theme={"theme":"vitesse-black"}
import os
import requests

response = requests.post(
    "https://api.crustdata.com/person/search/autocomplete",
    headers={
        "Authorization": f"Bearer {os.environ['CRUSTDATA_API_KEY']}",
        "Content-Type": "application/json",
        "x-api-version": "2025-11-01",
    },
    json={
        "field": "experience.employment_details.current.title",
        "query": "VP",
        "limit": 5,
    },
)
response.raise_for_status()
suggestions = response.json()["suggestions"]
```

```javascript Node.js theme={"theme":"vitesse-black"}
const response = await fetch(
    "https://api.crustdata.com/person/search/autocomplete",
    {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.CRUSTDATA_API_KEY}`,
            "Content-Type": "application/json",
            "x-api-version": "2025-11-01",
        },
        body: JSON.stringify({
            field: "experience.employment_details.current.title",
            query: "VP",
            limit: 5,
        }),
    },
);
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const { suggestions } = await response.json();
```

```json Response theme={"theme":"vitesse-black"}
{
    "suggestions": [
        { "value": "VP" },
        { "value": "VP of Sales" },
        { "value": "vp" },
        { "value": "VP Sales" },
        { "value": "VP Operations" }
    ]
}
```

Each suggestion includes:

* **`value`** — the exact **indexed value**: the raw string stored against `field` in Crustdata's person index. Use it verbatim as a Person Search filter value — two distinct indexed values (for example `"VP"` and `"vp"`) are different filter keys, and substituting one for the other will return different results.

Suggestions are returned ranked by internal frequency across the dataset.
The ranking signal itself is not returned in the response.

When no values match the `query`, the response returns an empty array, not
a 404:

```json No results theme={"theme":"vitesse-black"}
{
    "suggestions": []
}
```

***

## Examples

Worked recipes you can copy, paste, and adapt. Each example is a full
working request. For request parameters, autocomplete-enabled
fields, implementation tips, and errors, see the [Reference](#reference)
below.

> [accordion] Get the most common values for a field
>
> Pass an empty `query` to retrieve the top values for the field by frequency.
> Useful for seeding filter dropdowns or showing popular options.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search/autocomplete \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "field": "experience.employment_details.current.title",
>     "query": "",
>     "limit": 5
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "suggestions": [
>         { "value": "Owner" },
>         { "value": "Manager" },
>         { "value": "Project Manager" },
>         { "value": "Intern" },
>         { "value": "Software Engineer" }
>     ]
> }
> ```
>
> > [!NOTE]
> >
> > Empty-query autocomplete can occasionally
> > return blank string values when a field has many empty indexed records.
> > Filter those out in your UI if you do not want a blank option.

> [accordion] Discover research interests for a research\_profiles filter
>
> Pass a partial interest label to get the stored spellings. Feed a returned
> `value` into a `research_profiles.research_interests` filter on Person Search
> with `=` or `in`. The flat name `research_interests` returns the same
> suggestions.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search/autocomplete \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "field": "research_profiles.research_interests",
>     "query": "machine",
>     "limit": 5
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "suggestions": [
>         { "value": "Machine Learning" },
>         { "value": "Applied Machine Learning" },
>         { "value": "Machine Translation" },
>         { "value": "Scientific Machine Learning" },
>         { "value": "Machine Vision" }
>     ]
> }
> ```
>
> > [!NOTE]
> >
> > The `research_profiles` group on Person Search is enabled per account.
> > Autocomplete lists these values for any key that can call the endpoint,
> > but the search filter returns `403` with
> > `Access denied to fields: research_profiles` without the grant.

> [accordion] Get every value of a closed-enum field
>
> Some fields (for example, `open_to_cards` and `employment_type`) have a
> **fixed, known value space**. An empty `query` returns the full set in
> declaration order — useful for populating a static dropdown or chip group
> without an extra round-trip.
>
> > [tab] open\_to\_cards
> >
> > `open_to_cards` is a closed enum of exactly three codes. The alias
> > `professional_network.open_to_cards` returns the same suggestions and is
> > the spelling used by the `/person/search` filter.
> >
> > ```bash Request theme={"theme":"vitesse-black"}
> > curl --request POST \
> >   --url https://api.crustdata.com/person/search/autocomplete \
> >   --header 'authorization: Bearer YOUR_API_KEY' \
> >   --header 'content-type: application/json' \
> >   --header 'x-api-version: 2025-11-01' \
> >   --data '{
> >     "field": "open_to_cards",
> >     "query": "",
> >     "limit": 10
> >   }'
> > ```
> >
> > ```json Response theme={"theme":"vitesse-black"}
> > {
> >     "suggestions": [
> >         { "value": "CAREER_INTEREST" },
> >         { "value": "HIRING_MANAGER" },
> >         { "value": "VOLUNTEERING" }
> >     ]
> > }
> > ```
> >
> > Feed any returned `value` back into a `professional_network.open_to_cards`
> > filter on `/person/search` to find people who have surfaced that
> > open-to signal on their profile.
>
> > [tab] employment\_type
> >
> > `employment_type` returns canonical employment labels by frequency. Use any
> > returned `value` as an exact-match filter on the corresponding employment
> > field — flat (`experience.employment_details.employment_type`),
> > current-only (`experience.employment_details.current.employment_type`), or
> > past-only (`experience.employment_details.past.employment_type`).
> >
> > ```bash Request theme={"theme":"vitesse-black"}
> > curl --request POST \
> >   --url https://api.crustdata.com/person/search/autocomplete \
> >   --header 'authorization: Bearer YOUR_API_KEY' \
> >   --header 'content-type: application/json' \
> >   --header 'x-api-version: 2025-11-01' \
> >   --data '{
> >     "field": "employment_type",
> >     "query": "",
> >     "limit": 10
> >   }'
> > ```
> >
> > ```json Response theme={"theme":"vitesse-black"}
> > {
> >     "suggestions": [
> >         { "value": "Full-time" },
> >         { "value": "Part-time" },
> >         { "value": "Internship" }
> >     ]
> > }
> > ```

> [accordion] Full workflow: Autocomplete → Search → Enrich
>
> This is the canonical end-to-end Person API workflow. Autocomplete discovers
> the exact title value the Search API expects, Search finds matching people,
> and Enrich fills in the details.
>
> ### Step 1: Discover valid title values
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search/autocomplete \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{"field": "experience.employment_details.current.title", "query": "VP Sales", "limit": 3}'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "suggestions": [
>         { "value": "VP Sales" },
>         { "value": "VP of Sales" },
>         { "value": "VP, Sales" }
>     ]
> }
> ```
>
> **Extract:** Take `suggestions[0].value` → `"VP Sales"`. Use this exact
> string in your Search filter.
>
> **If empty:** Try a broader query (for example, `"VP"` instead of
> `"VP Sales"`).
>
> ### Step 2: Search for matching people
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
>         {"field": "experience.employment_details.current.title", "type": "in", "value": ["VP Sales", "VP of Sales"]},
>         {"field": "experience.employment_details.current.company_headcount_range", "type": "in", "value": ["51-200", "201-500"]}
>       ]
>     },
>     "limit": 3,
>     "fields": ["basic_profile.name", "experience.employment_details.current.title", "experience.employment_details.current.name", "social_handles.professional_network_identifier.profile_url"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "profiles": [
>         {
>             "crustdata_person_id": 12345,
>             "basic_profile": { "name": "Jane Smith" },
>             "experience": {
>                 "employment_details": {
>                     "current": [{ "title": "VP of Sales", "name": "Acme Corp" }]
>                 }
>             },
>             "social_handles": {
>                 "professional_network_identifier": {
>                     "profile_url": "https://www.linkedin.com/in/janesmith"
>                 }
>             }
>         }
>     ],
>     "next_cursor": "H4sIACIdzWkC...",
>     "total_count": 15420
> }
> ```
>
> **Extract:** Take
> `social_handles.professional_network_identifier.profile_url` →
> `"https://www.linkedin.com/in/janesmith"`. Pass the profile URL to Enrich.
>
> **If empty:** Broaden filters or verify values with an earlier autocomplete
> call.
>
> ### Step 3: Enrich the top match
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{"professional_network_profile_urls": ["https://www.linkedin.com/in/janesmith"]}'
> ```
>
> **Result:** Full person profile with employment history, education, skills,
> and more. See [Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md) for the full
> response shape.
>
> See [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md) for the full filter grammar.

***

## Reference

Reference material for Person Autocomplete: contract vs current behavior,
request parameters, autocomplete-enabled fields,
implementation tips for UI builders, and errors.

For walk-through examples, see the [Examples](#examples) above.

### Guaranteed contract vs current behavior

Use this table to separate the parts you can build against with confidence
from the observed behavior that may evolve.

| Topic | Kind | What it means |
| - | - | - |
| Endpoint, HTTP method, auth headers | **Contract** | `POST /person/search/autocomplete`, bearer auth, `x-api-version: 2025-11-01`. |
| Request body shape | **Contract** | `field` and `query` required, `limit` optional. |
| Response body shape | **Contract** | `{ "suggestions": [ { "value" } ] }`. Empty results return `{"suggestions": []}` with status `200`. |
| `limit` bounds and default | **Contract** | Minimum `1`, maximum `100`, default `20`. |
| Error status codes | **Contract** | `400` (invalid request), `401` (unauthorized), `500` (internal). |
| Suggestion ranking | Current behavior | Suggestions are ranked by internal frequency across the dataset. The ranking signal is not exposed in the response. |
| Case-insensitive query matching | Current behavior | `"vp"` and `"VP"` currently return the same suggestions. |
| Multi-token query loose matching | Current behavior | A multi-word `query` may return values containing only one of the tokens. |
| `filters` key | Current behavior | Accepted and ignored. Suggestions match a request without `filters`, even when the filter is malformed. |
| Blank-string suggestions | Current behavior | Empty-`query` calls can return `""` as the top suggestion when a field has many empty indexed records. |
| `research_profiles.*` vocabulary | Current behavior | Autocomplete checks endpoint access only. A key without the `research_profiles` grant can list these values but cannot filter on them in Person Search. |

### Request parameters

| Parameter | Type | Required | Description |
| - | - | - | - |
| `field` | string | Yes | Dataset field whose values you want suggested. Must be an **autocomplete-enabled field** — see [Autocomplete-enabled fields](#autocomplete-enabled-fields). Unsupported fields return `400`. |
| `query` | string | Yes | Partial text to match against indexed values. Pass `""` to retrieve the top values for the field by frequency. |
| `limit` | integer | No | Maximum number of suggestions to return. Minimum `1`, maximum `100`, default `20`. |

### Autocomplete-enabled fields

The top-level `field` in a Person Autocomplete request (the field whose
values you want suggested) must come from a **fixed allowlist** of
autocomplete-enabled dataset fields. Not every Person Search field is
autocomplete-enabled.

> [!NOTE]
>
> The tables below are a **documented subset** of the autocomplete allowlist.
> They cover the fields most useful for building filter dropdowns, but they
> are **not exhaustive**. If a field you need is not listed, treat its support
> as unknown until you verify it — the safest way to confirm is to call the
> endpoint with that field and check whether you get a `400` error. See
> [Verify the live list](#verify-the-live-list) below for the debug-only live
> source.

> [!NOTE]
>
> **`company_name` vs `name` for employers (current behavior).** For
> autocomplete, use `experience.employment_details.current.name` — the
> `company_name` variant is rejected in autocomplete scope. For
> `/person/search` filters, both `current.name` and `current.company_name` are
> accepted as aliases. In response payloads, the current employer appears
> under the `name` key.

#### Common supported fields

> [tab] Current employment
>
> | Field | What it discovers |
> | - | - |
> | `experience.employment_details.current.title` | Current job titles |
> | `experience.employment_details.current.name` | Current employer names |
> | `experience.employment_details.current.seniority_level` | Seniority level buckets |
> | `experience.employment_details.current.function_category` | Job function |
> | `experience.employment_details.current.company_industries` | Current employer industries |
> | `experience.employment_details.current.company_type` | Current employer type |
> | `experience.employment_details.current.company_hq_location` | Current employer HQ location |
> | `experience.employment_details.current.company_website_domain` | Current employer website domain |
> | `experience.employment_details.current.company_headcount_range` | Current employer size bands |
> | `experience.employment_details.current.company_status` | Current employer lifecycle |
> | `experience.employment_details.current.employment_type` | Current employment type |

> [tab] Past employment
>
> | Field | What it discovers |
> | - | - |
> | `experience.employment_details.past.title` | Past job titles |
> | `experience.employment_details.past.name` | Past employer names |
> | `experience.employment_details.past.seniority_level` | Past seniority level buckets |
> | `experience.employment_details.past.function_category` | Past job function |
> | `experience.employment_details.past.company_type` | Past employer type |
> | `experience.employment_details.past.company_hq_location` | Past employer HQ location |
> | `experience.employment_details.past.company_website_domain` | Past employer website domain |
> | `experience.employment_details.past.company_headcount_range` | Past employer size bands |
> | `experience.employment_details.past.company_status` | Past employer lifecycle |
> | `experience.employment_details.past.employment_type` | Past employment type |

> [tab] Profile & location
>
> | Field | What it discovers |
> | - | - |
> | `basic_profile.name` | Person names |
> | `basic_profile.first_name` | Person first names |
> | `basic_profile.last_name` | Person last names |
> | `basic_profile.headline` | Profile headlines |
> | `basic_profile.languages` | Spoken languages |
> | `basic_profile.location.raw` | Raw location strings |
> | `basic_profile.location.full_location` | Full location strings |
> | `basic_profile.location.city` | Cities |
> | `basic_profile.location.state` | States / regions |
> | `basic_profile.location.country` | Countries |
> | `basic_profile.location.continent` | Continents |
> | `professional_network.location.city` | Profile network cities |
> | `professional_network.location.state` | Profile network states |
> | `professional_network.location.country` | Profile network countries |
> | `professional_network.location.continent` | Profile network continents |
> | `professional_network.open_to_cards` | Open-to signal codes |

> [tab] Education, skills & more
>
> | Field | What it discovers |
> | - | - |
> | `education.schools.school` | Schools / universities |
> | `education.schools.degree` | Degrees |
> | `education.schools.field_of_study` | Fields of study |
> | `skills.professional_network_skills` | Skills |
> | `certifications.name` | Certification names |
> | `certifications.issuing_organization` | Certification issuers |
> | `honors.title` | Honors and awards |
> | `research_profiles.research_interests` | Research interest labels on matched academic author profiles |
> | `research_profiles.affiliated_organisation` | Organisations named in academic author affiliations |
>
> > [!NOTE]
> >
> > The two `research_profiles.*` fields also accept the flat names
> > `research_interests` and `affiliated_organisation`. Autocomplete checks
> > endpoint access only, so any key that can call this endpoint can list
> > these values. The `research_profiles` group on
> > [Person Search](https://docs.crustdata.com/person-docs/search/reference.md#research-profiles) is
> > enabled per account, so a filter on either path returns `403` without the
> > grant.

> [tab] Closed-enum fields
>
> These fields have a **fixed, known value space**. An empty `query` returns
> the full enum in declaration order. They're useful when you need the exact
> set of accepted values for a filter dropdown — for example, populating an
> "open to" picker or an employment-type chip group.
>
> | Field | What it discovers | Returned values |
> | - | - | - |
> | `open_to_cards` | Open-to signal codes | `CAREER_INTEREST`, `HIRING_MANAGER`, `VOLUNTEERING` |
> | `employment_type` | Employment type labels | `Full-time`, `Part-time`, `Internship`, and other indexed labels |
>
> > [!TIP]
> >
> > `professional_network.open_to_cards` is an alias of `open_to_cards` — both
> > return the same suggestions. Use whichever spelling matches the filter path
> > on `/person/search`.

#### Verify the live list

Call the endpoint with a deliberately invalid `field`. The `400` response
lists every currently accepted field in its error `message`:

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/person/search/autocomplete \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "field": "current_title",
    "query": "",
    "limit": 1
  }'
```

```json Response (abbreviated) theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Field 'current_title' is not supported on scope 'person'. Valid fields: affiliated_organisation, basic_info.location, basic_info.location.city, ..., experience.employment_details.current.function_category, experience.employment_details.current.title, ..., research_interests, research_profiles.affiliated_organisation, research_profiles.research_interests, school, seniority_level, skills, skills.professional_network_skills, state",
        "metadata": []
    }
}
```

### Implementation tips for UI builders

> [!TIP]
>
> * **Debounce** autocomplete calls to avoid one request per keystroke — 150–300 ms on input idle works well for typeahead UIs.
> * **Drop blank values.** If `""` is returned as the top suggestion, remove it before rendering the dropdown.
> * **Handle casing variants carefully.** Suggestions like `"VP"` and `"vp"` are **distinct indexed values**. Only merge them into a single UI option if you intentionally want normalized grouping — and if you do, preserve the underlying raw values and expand them in the eventual Person Search filter using `in`, for example `{"type": "in", "value": ["VP", "vp"]}`. If the UI needs exact-value selection, keep them as separate options.
> * **Cap `limit`.** Most dropdowns need 5–15 options. Lower `limit` reduces payload size and gives faster responses.
> * **Cache top-values lookups.** Empty-`query` calls that seed filter dropdowns rarely change — cache them client-side or at the edge.

### Errors

| Status | Meaning |
| - | - |
| `400` | Invalid request: unsupported `field`, missing required field, or a malformed body. |
| `401` | Unauthorized — the `Authorization` header is missing, malformed, or contains an invalid API key. |
| `500` | Internal server error — retry after a short delay. |

Note: a `query` that matches nothing is **not** an error — the endpoint
returns `{"suggestions": []}` with a 200 status. Only use 4xx/5xx handling
for actual request or server failures.

```json 400 — Unsupported field theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Field 'current_title' is not supported on scope 'person'. Valid fields: basic_profile.city, basic_profile.continent, ..., experience.employment_details.current.function_category, experience.employment_details.current.title, ..., skills.professional_network_skills, state",
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
| **Endpoint** | `POST /person/search/autocomplete` |
| **Auth** | Bearer token + `x-api-version: 2025-11-01` |
| **Required params** | `field`, `query` |
| **Optional params** | `limit` (default: 20, max: 100) |
| **Response** | `{ "suggestions": [{ "value": "..." }] }` |
| **Empty result** | `200` with `"suggestions": []` |
| **Errors** | `400` (unsupported field or bad request), `401` (bad auth), `500` (server error) |

See the [full API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md) for
the complete OpenAPI schema.

***

## What to do next

* **Try more patterns**: see [Examples](#examples) for most-common values, closed-enum fields, and the Autocomplete → Search workflow.
* **Reference**: see [Reference](#reference) for request parameters, autocomplete-enabled fields, implementation tips, and errors.
* **Search for people** — use discovered values in [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md).
* **Enrich matches** — use [Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md) to get full profiles after you find people.


## Related topics

- [API Introduction](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md)
- [Person Enrichment API](https://docs.crustdata.com/person-docs/enrichment/introduction.md)
- [Person Identify API](https://docs.crustdata.com/person-docs/identify/introduction.md)
- [Job Autocomplete API](https://docs.crustdata.com/job-docs/autocomplete/introduction.md)
- [Company Autocomplete API](https://docs.crustdata.com/company-docs/autocomplete/introduction.md)
