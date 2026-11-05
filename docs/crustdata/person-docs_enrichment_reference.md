> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Person Enrich reference

> Reference for Person Enrich: request parameters, response fields, fields parameter, person_data sections, and errors.

Reference material for [Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md): request
parameters, response fields, valid `fields` values, `person_data` section
catalog, and errors.

For walk-through examples, see [Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md).

***

## Request parameter reference

| Parameter | Type | Required | Default | Description |
| - | - | - | - | - |
| `professional_network_profile_urls` | string\[] | Yes | — | Profile URLs to enrich. Max 25. |
| `fields` | string\[] | No | `basic_profile`, `social_handles` | Specific field paths or section groups to return. When omitted, only `basic_profile` and `social_handles` are returned. |
| `preview` | boolean | No | `false` | Enabled per account on request. Where enabled, the API returns a basic profile at 0 credits and ignores `fields`. You cannot combine it with `enrich_realtime`. Without the grant, the API returns `400 invalid_request`. See [Errors](#errors). |

Vanity URLs (`/in/dvdhsu`) and URN URLs (`/in/ACoAA...`, `/in/ACwAA...`) are
both accepted, and both match case-insensitively. `matched_on` echoes the
identifier exactly as you sent it.

***

## Response fields reference

Each item in the response array contains:

| Field | Type | Description |
| - | - | - |
| `matched_on` | string | The input profile URL |
| `match_type` | string | `professional_network_profile_url` |
| `match_status` | string | `matched`, `not_found`, or `redacted`. `redacted` means the person asked Crustdata to remove their data: `matches` stays empty, nothing is billed, and retrying or live enrich does not change it. `not_found` means the profile is not in the dataset yet. |
| `matches` | array | Array of candidate matches (may be empty for no-match) |
| `matches[].confidence_score` | number | 0 to 1. How confident the match is. `1.0` = exact match. |
| `matches[].person_data` | object | Full enriched profile. See [`person_data` sections](#person_data-sections) below. |

***

## Using the `fields` parameter

By default, the API returns only the `basic_profile` and `social_handles`
sections. Use the `fields` parameter to request the additional sections or
dot-paths you need.

```bash Request — specific fields theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/person/enrich \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "professional_network_profile_urls": [
      "https://www.linkedin.com/in/dvdhsu/"
    ],
    "fields": [
      "basic_profile.summary",
      "dev_platform_profiles"
    ]
  }'
```

> [!TIP]
>
> Need email addresses or phone numbers? Use
> [Contact Enrich](https://docs.crustdata.com/person-docs/contact/enrich.md).

### Popular fields for profile and developer workflows

| Field path | What it returns |
| - | - |
| `basic_profile.summary` | The person's summary or about text |
| `dev_platform_profiles` | Developer platform profiles when available |
| `social_handles.dev_platform_identifier.profile_url` | Canonical developer platform profile URL when available |
| `experience.employment_details.current.name` | The person's current company name |

### `person_data` sections

The `person_data` object contains the following sections. Pass any of these
names to `fields` to include that section, or use dot-paths like
`basic_profile.summary` to request a specific sub-field.

| Section | Key fields | Description |
| - | - | - |
| `crustdata_person_id` | integer | Top-level Crustdata identifier for the enriched profile |
| `updated_at` | date-time string (nullable) | Top-level timestamp of the most recent profile refresh |
| `basic_profile` | `name`, `first_name`, `last_name`, `headline`, `current_title`, `normalized_title` ([JTN](https://docs.crustdata.com/guides/job-title-normalization.md), beta), `professional_network_name`, `summary`, `location`, `languages`, `last_updated`, `profile_picture_permalink` | Core identity and role |
| `professional_network` | `profile_picture_permalink`, `connections`, `followers`, `joined_date`, `verifications`, `open_to_cards`, `pronoun`, `location.raw`, `location.city`, `location.state`, `location.country`, `location.continent` | Profile metadata when available |
| `social_handles` | `professional_network_identifier.profile_url`, `professional_network_identifier.urn_url` (permanent URN-based URL; requires field-level permission on your API key), `dev_platform_identifier.profile_url`, `twitter_identifier.slug` | Available social identifiers |
| `experience` | `employment_details.current[]`, `employment_details.past[]` (each role includes `company_status`), `years_of_experience` (career total as a band, for example `More than 10 years`), `years_of_experience_raw` (number) | Full employment history and career totals |
| `education` | `schools[]` | Education background |
| `certifications` | `name`, `issuing_organization`, `issue_date`, `expiration_date` | Certifications. Requires field-level permission on your API key. |
| `honors` | `title`, `issuer`, `issued_date`, `description` | Honors and awards. Requires field-level permission on your API key. |
| `skills` | `professional_network_skills[]` | Professional skills |
| `dev_platform_profiles` | developer platform profile objects | Developer platform data when available |
| `social_posts` | list of post objects | Up to the 10 most recent posts the person authored, newest first (gated beta add-on; see [`social_posts` fields](#social_posts-fields)) |
| `assessment` | `authenticity.verdict`, `authenticity.tier` | Computed authenticity assessment of the profile (see [`assessment` fields](#assessment-fields)) |
| `research_profiles` | list of author profile objects | Matched academic author profiles, best match first (enabled on request; see [`research_profiles` fields](#research_profiles-fields)) |

### `assessment` fields

The `assessment` section carries a computed view of how well a profile stands
up to verification. It is never returned by default: request it explicitly via
`fields`, either as the whole group (`"fields": ["assessment"]`) or as a single
leaf such as `assessment.authenticity.verdict`.

`assessment` is returned only by `/person/enrich`, and it requires field-level
permission on your API key. Without the grant, naming it in `fields` returns
`403` with `Access denied to fields: assessment`. On `/person/search` both
paths are filterable and `tier` is sortable, but they are never returned in
search results: naming one in that endpoint's `fields` returns `400` with
`Invalid fields: assessment.authenticity.tier`. Sorting on
`assessment.authenticity.tier` ascending puts the most trusted profiles first.
For a worked request and response, see the
[Examples](https://docs.crustdata.com/person-docs/enrichment/introduction.md#examples) on the introduction page.

| Field | Type | Description |
| - | - | - |
| `authenticity.verdict` | string (nullable) | One of `clearly_genuine`, `probably_genuine`, `cannot_verify`, `probably_fabricated`, `clearly_fabricated`. |
| `authenticity.tier` | integer (nullable) | Authenticity tier from 0 (most trusted) to 9 (least trusted). Sort ascending to put the most trusted first. |

Both paths are filterable on `/person/search`. `authenticity.verdict` takes the
five values above; an unrecognized value is not rejected, it simply matches
nothing. `authenticity.tier` accepts 0 through 9, and a filter for 10 matches
nothing.

Request a single leaf to get just that one, for example
`"fields": ["basic_profile.name", "assessment.authenticity.verdict"]` returns
`assessment.authenticity.verdict` on its own.

> [!WARNING]
>
> Read `cannot_verify` as thin evidence, not as fraud. It is the expected
> verdict for a sparse profile. Treat `probably_fabricated` as a flag for
> human review rather than a trigger for automated action, and do not use
> either verdict as the sole basis for a decision about a person.

> [!NOTE]
>
> **Not a billed add-on.** Unlike `social_posts`, requesting `assessment`
> costs nothing extra. A person enrich for `["basic_profile.name"]` and one
> for `["basic_profile.name", "assessment"]` both report
> `x-credits-used: 1`.

> [!NOTE]
>
> `verdict` and `tier` are populated independently, so a profile can carry a
> `tier` with a null `verdict`. The two ends of the range behave differently:
> every tier 0 profile also carries `clearly_genuine`, while of the 25,434
> profiles at tier 9 only 11 carry any verdict at all. Read a null `verdict`
> as "not labelled", and prefer `tier` when you need a signal that is present
> on the untrusted end of the range.

***

### `social_posts` fields

The `social_posts` section returns posts the person authored. It is never
included by default; request it explicitly via `fields` (for example
`"fields": ["basic_profile", "social_posts"]`). Quote posts (reposts with
added commentary) are included; plain reshares of someone else's post are not.

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
> credits per profile on top of the base enrich pricing, however many posts
> come back, and returns at most 10. No posts returned means no add-on
> charge, and you are only billed when `social_posts` is in `fields`. To search posts across the network by
> keyword, use the
> [Social Post Search API](https://docs.crustdata.com/social-post-docs/search/introduction.md).

### `research_profiles` fields

The `research_profiles` section carries the person's matched academic
author profiles. It is never returned by default: request it explicitly via
`fields`, either as the whole group (`"fields": ["research_profiles"]`) or as
sub-paths such as `research_profiles.h_index.all`. It is enabled per account.
Without the grant, naming it in `fields` returns `403` with
`Access denied to fields: research_profiles`. Contact Crustdata to turn it on.

The value is an array, best match first, because one person can hold more than
one author profile. A profile is linked only after a confident match, so
unmatched and under-review profiles never appear. When the person has no
matched profile, the key is absent from `person_data`. For a worked request and
response, see the
[Examples](https://docs.crustdata.com/person-docs/enrichment/introduction.md#examples) on the introduction
page.

| Field | Type | Filled | Description |
| - | - | - | - |
| `id` | string | 100% | Profile identifier, the `user` parameter of `profile_url`. |
| `profile_url` | string | 100% | URL of the author profile. |
| `name` | string | 100% | Name displayed on the profile. |
| `designation` | string | 100% | Free-text affiliation as displayed on the profile. |
| `affiliated_organisation` | string (nullable) | 62.4% | Organisation extracted from the affiliation. Can be an empty string. |
| `verified_email_domain` | string (nullable) | 99.99% | Institution domain verified for the profile. |
| `website` | string (nullable) | 36.9% | Homepage supplied on the profile. |
| `research_interests` | string\[] | 88.3% | Interest labels as listed on the profile. |
| `thumbnail` | string (nullable) | 71.4% | Profile picture URL. |
| `article_count` | integer | 100% | Number of publications on the profile. |
| `co_author_count` | integer | 100% | Number of linked co-authors. |
| `citations_count` | object | 100% | `all`, `recent`, and `recent_since_year`. `recent` counts from `recent_since_year` onwards. |
| `h_index` | object | 100% | Same three keys as `citations_count`. |
| `i10_index` | object | 100% | Same three keys as `citations_count`. |
| `citations_timeseries[]` | object\[] | 98.9% | `year` and `citations`, oldest year first. |
| `articles[]` | object\[] | 100% | Every publication: `title`, `url`, `publication_year` (string), `total_citations`, `authors[]`, `all_authors` (false when the source truncated the list), `publication`. |
| `co_authors[]` | object\[] | 49.0% | Every linked co-author: `id`, `profile_url`, `name`, `designation`, `thumbnail`. |
| `metadata.last_scraped_source` | date-time | 100% | When the profile was last refreshed from the web. |

Fill rates are the share of matched profiles that carry a value for the field.

> [!NOTE]
>
> **Size.** The section averages about 26 KB per person and can reach about
> 1 MB, because `articles` and `co_authors` list everything. Request the
> sub-paths you read, for example
> `"fields": ["basic_profile.name", "research_profiles.h_index.all"]`, when
> you do not need the publication list.

> [!NOTE]
>
> **Access and pricing.** `research_profiles` is enabled per account on API
> version `2025-11-01`. Contact Crustdata to turn it on. The add-on costs
> **2** credits per person returned with at least one research profile, on
> top of the base enrich pricing. A person with no matched profile is not
> charged the add-on. [Person Search](https://docs.crustdata.com/person-docs/search/reference.md#research-profiles)
> can filter and sort on the same fields and returns a smaller copy of each
> profile.

***

## Fresh data and realtime enrichment

`/person/enrich` serves data from the cached dataset. When you need fresh
profile data retrieved in real time, use the dedicated
[Person Live Enrich](https://docs.crustdata.com/person-docs/enrichment/live-enrich.md) endpoint
(`POST /person/professional_network/enrich/live`), which is designed for
real-time retrieval from the web.

> [!NOTE]
>
> If cached enrich is not enough, use
> [Person Live Enrich](https://docs.crustdata.com/person-docs/enrichment/live-enrich.md) — it is
> designed for fresh profile retrieval from the web.

***

## Errors

| Status | Meaning |
| - | - |
| `400` | Invalid request: missing or wrong identifier type, malformed body, or `preview: true` on an account without preview. |
| `401` | Invalid or missing API key. |
| `403` | Permission denied or insufficient credits. |
| `500` | Internal server error. |

```json 400 — Bad request theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Exactly one identifier type must be provided.",
        "metadata": []
    }
}
```

```json 400 - Preview not enabled on the account theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Preview feature is not available for your account. Please reach out to Crustdata team.",
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

```json 403 - Field not enabled on the account theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "permission_error",
        "message": "Access denied to fields: research_profiles. To enable access, please book a call with us at https://meetings-na2.hubspot.com/chris-pisarski/web-demo-request",
        "metadata": [
            {
                "denied_fields": ["research_profiles"],
                "permitted_fields": ["basic_profile", "education", "experience"]
            }
        ]
    }
}
```

***

## API reference summary

| Detail | Value |
| - | - |
| **Endpoint** | `POST /person/enrich` |
| **Auth** | Bearer token + `x-api-version: 2025-11-01` |
| **Request** | `professional_network_profile_urls` (max 25). Optional: `fields`, `preview` (enabled per account on request). |
| **Response** | Top-level array: `[{ matched_on, match_type, match_status, matches: [{ confidence_score, person_data }] }]` |
| **No match** | `200` with empty `matches: []` for unmatched identifiers. |
| **Errors** | `400` (bad request), `401` (bad auth), `403` (permission/credits), `500` (server error) |

See the [full API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md) for
the complete OpenAPI schema.


## Related topics

- [Person Entity Watcher](https://docs.crustdata.com/watcher-docs/person/entity.md)
- [Person Identify API](https://docs.crustdata.com/person-docs/identify/introduction.md)
- [Contact Enrichment API](https://docs.crustdata.com/person-docs/contact/enrich.md)
- [Batch Enrich Person](https://docs.crustdata.com/api-reference/batch-apis/submit-a-batch-person-enrichment-job.md)
- [Person Search reference](https://docs.crustdata.com/person-docs/search/reference.md)
