> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Person Enrichment API

> Enrich person profiles by profile URL — first enrichment, field selection, batch, and the Search-then-Enrich workflow.

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | All plans. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | Yes, with the free credits every new self-serve account gets |
| **Credit cost** | 1 credit per person for the base profile, up to 4 with developer platform data and research profiles |
| **Rate limit** | 15 requests per minute, up to 25 people per request |

The Person Enrich API takes a profile URL and returns a rich person profile.
This page covers the basics (your first enrichment and the response shape)
plus worked example recipes. For the request/response schema and errors, see
[Enrich reference](https://docs.crustdata.com/person-docs/enrichment/reference.md).

Every request goes to the same endpoint:

```
POST https://api.crustdata.com/person/enrich
```

> [!NOTE]
>
> Replace `YOUR_API_KEY` in each example with your actual API key. All
> requests require the `x-api-version: 2025-11-01` header.

### Request body

| Parameter | Type | Required | Description |
| - | - | - | - |
| `professional_network_profile_urls` | array | Yes | Profile URLs to enrich. Max 25 per request. |
| `fields` | array | No | Specific field paths or section groups to include. |

### Response body

The response is a top-level array. Each entry corresponds to one input
identifier.

| Field | Type | Description |
| - | - | - |
| `matched_on` | string | The input profile URL |
| `match_type` | string | `professional_network_profile_url` |
| `match_status` | string | `matched`, `not_found`, or `redacted`. `redacted` means the person asked Crustdata to remove their data: `matches` stays empty, nothing is billed, and retrying or live enrich does not change it. `not_found` means the profile is not in the dataset yet. |
| `matches` | array | Candidate matches. Empty for no-match inputs. |
| `matches[].confidence_score` | number | 0 to 1. Higher is better. `1.0` is common for direct URL lookups. |
| `matches[].person_data` | object | Full enriched profile. |

### Rate limits and pricing

**Pricing:** Base profile is `1 credit`. Developer
platform data adds `1 credit`. Research profiles (enabled on
request) add `2 credits`. Maximum:
`4 credits per profile`.
To see the price for your account, open the [**Pricing** tab](https://app.crustdata.com/endpoints/person-enrich#pricing) in the dashboard.

> [!TIP]
>
> Need email addresses or phone numbers? Use
> [Contact Enrich](https://docs.crustdata.com/person-docs/contact/enrich.md).

> [card] [Reference](https://docs.crustdata.com/person-docs/enrichment/reference.md)
>
> Request parameters, response fields, valid `fields` values,
> `person_data` sections, advanced flags, errors.

***

## Your first enrichment: look up a profile

The simplest enrichment takes a single profile URL and returns the person's
cached profile. Pass the URL in the `professional_network_profile_urls`
array.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/person/enrich \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "professional_network_profile_urls": [
      "https://www.linkedin.com/in/abhilashchowdhary/"
    ]
  }'
```

```json Response theme={"theme":"vitesse-black"}
[
    {
        "matched_on": "https://www.linkedin.com/in/abhilashchowdhary/",
        "match_type": "professional_network_profile_url",
        "matches": [
            {
                "confidence_score": 1.0,
                "person_data": {
                    "basic_profile": {
                        "name": "Abhilash Chowdhary",
                        "headline": "Co-founder at Crustdata (YC F24) | Real-time B2B data for AI agents",
                        "current_title": "Co-Founder & CEO",
                        "summary": "Love building things. A software engineer with vast experience in shipping products spanning robotics, web technologies and quantitative finance.",
                        "location": {
                            "city": null,
                            "continent": null,
                            "country": null,
                            "raw": "San Francisco, California, United States",
                            "state": null
                        },
                        "languages": ["English", "Hindi"],
                        "last_updated": "2026-03-03T17:09:31.949863Z"
                    },
                    "crustdata_person_id": 1068035,
                    "social_handles": {
                        "twitter_identifier": {}
                    }
                }
            }
        ]
    }
]
```

> [!NOTE]
>
> Response trimmed for clarity. The full response can include employment
> history, education, skills, and developer platform profiles when available.

### Understanding the response

The Enrich API returns an **array** — one entry per identifier you
submitted. Each entry has three fields:

* **`matched_on`** — the profile URL you submitted.
* **`match_type`** — `professional_network_profile_url`.
* **`matches`** — an array of candidate profiles. Each match includes a `confidence_score` (0 to 1) and the full `person_data` object.

For profile URL lookups, you will typically get exactly one match with a
`confidence_score` of `1.0`, because the URL is a direct identifier.

### Need fresh data from the web?

If the cached enrich response is missing a recent update or you need
real-time retrieval from the web, use
[Person Live Enrich](https://docs.crustdata.com/person-docs/enrichment/live-enrich.md). That endpoint is designed for
fresh profile retrieval when cached enrich is not enough.

***

## Examples

Worked recipes you can copy, paste, and adapt.

### Selecting fields: education, employers, and more

> [!WARNING]
>
> By default, `/person/enrich` returns only the `basic_profile` and
> `social_handles` sections. Employment history, education, and skills are
> **not** returned unless you request them with the `fields` parameter.

Request any of these sections (or dot-paths within them) in `fields`:

| Section | Returns |
| - | - |
| `experience` | Employment history — current and past roles, each with company, `crustdata_company_id`, title, and dates |
| `education` | Schools, degrees, and fields of study |
| `skills` | Professional skills |
| `professional_network` | Connections, followers, and profile metadata |
| `dev_platform_profiles` | Developer platform context (extra credit) |
| `social_posts` | Up to the person's 10 most recent posts (gated beta, flat 5 credits per profile) |
| `research_profiles` | Matched academic author profiles with citation metrics, articles, and co-authors (enabled on request, +2 credits per person with a profile) |
| `certifications`, `honors` | Certifications and awards (gated — require field-level permission on your key) |

> [!NOTE]
>
> `experience`, `education`, `skills`, and `professional_network` are part of
> the base profile (**1 credit**) — requesting them adds **no extra credits**.
> `dev_platform_profiles` costs more. See [Pricing](https://docs.crustdata.com/general/pricing.md) and the full
> [field catalog](https://docs.crustdata.com/person-docs/enrichment/reference.md#person_data-sections).

> [accordion] Employment history — all current and past employers
>
> Pass `experience` to get each role's company, `crustdata_company_id`, title, and dates.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": ["https://www.linkedin.com/in/dvdhsu/"],
>     "fields": ["basic_profile", "experience"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>   {
>     "matched_on": "https://www.linkedin.com/in/dvdhsu/",
>     "match_type": "professional_network_profile_url",
>     "matches": [
>       {
>         "confidence_score": 1.0,
>         "person_data": {
>           "basic_profile": { "name": "David Hsu", "current_title": "Founder, CEO" },
>           "experience": {
>             "employment_details": {
>               "current": [
>                 {
>                   "name": "Retool",
>                   "title": "Founder, CEO",
>                   "crustdata_company_id": 633593,
>                   "start_date": "2017-01-01T00:00:00+00:00"
>                 }
>               ],
>               "past": []
>             }
>           }
>         }
>       }
>     ]
>   }
> ]
> ```

> [accordion] Education background
>
> Pass `education` for each school, degree, and field of study.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": ["https://www.linkedin.com/in/dvdhsu/"],
>     "fields": ["basic_profile", "education"]
>   }'
> ```
>
> ```json Response (trimmed to the education section) theme={"theme":"vitesse-black"}
> {
>   "education": {
>     "schools": [
>       {
>         "school": "University of Oxford",
>         "degree": "Bachelor of Arts (B.A.)",
>         "field_of_study": "Philosophy and Computer Science"
>       }
>     ]
>   }
> }
> ```

> [accordion] Request all available fields
>
> Name every section you want in one call. `experience`, `education`, `skills`,
> and `professional_network` are part of the base profile (no extra credits).
> `dev_platform_profiles` adds a credit. `certifications`, `honors`, and
> `research_profiles` are omitted here. They require field-level permission on
> your key and otherwise return an error (see the gated examples below).
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": ["https://www.linkedin.com/in/dvdhsu/"],
>     "fields": [
>       "basic_profile",
>       "professional_network",
>       "experience",
>       "education",
>       "skills",
>       "social_handles",
>       "dev_platform_profiles"
>     ]
>   }'
> ```
>
> ```json Response (trimmed) theme={"theme":"vitesse-black"}
> {
>   "basic_profile": { "name": "David Hsu", "current_title": "Founder, CEO" },
>   "professional_network": { "connections": 700, "followers": 14319, "joined_date": "2007-12-01T00:00:00+00:00", "open_to_cards": [] },
>   "experience": {
>     "employment_details": {
>       "current": [
>         { "name": "Retool", "title": "Founder, CEO", "crustdata_company_id": 633593 }
>       ],
>       "past": []
>     }
>   },
>   "education": {
>     "schools": [
>       { "school": "University of Oxford", "degree": "Bachelor of Arts (B.A.)", "field_of_study": "Philosophy and Computer Science" }
>     ]
>   },
>   "skills": { "professional_network_skills": [] },
>   "social_handles": {
>     "professional_network_identifier": { "profile_url": "https://www.linkedin.com/in/dvdhsu" }
>   },
>   "dev_platform_profiles": []
> }
> ```
>
> > [!NOTE]
> >
> > To also include `certifications` and `honors`, your API key needs
> > field-level permission — contact Crustdata to enable them. `skills` and
> > `dev_platform_profiles` may be empty for some profiles.

> [accordion] Specific nested fields only
>
> Use dot-paths to pull just the sub-fields you need instead of whole sections.
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": ["https://www.linkedin.com/in/dvdhsu/"],
>     "fields": ["basic_profile.name", "experience.employment_details.current.title", "education.schools.degree"]
>   }'
> ```

> [accordion] Get the profile URLs — vanity and permanent (URN)
>
> Request the `social_handles` section to get the person's canonical profile
> URLs — useful for keying records or linking out to the profile.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": ["https://www.linkedin.com/in/dvdhsu/"],
>     "fields": ["basic_profile.name", "social_handles"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "https://www.linkedin.com/in/dvdhsu/",
>         "match_type": "professional_network_profile_url",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "person_data": {
>                     "basic_profile": { "name": "David Hsu" },
>                     "social_handles": {
>                         "professional_network_identifier": {
>                             "profile_url": "https://www.linkedin.com/in/dvdhsu",
>                             "urn_url": "https://www.linkedin.com/in/ACoAAAEnBBoBUwCVyafB-XsEBTeHaFN8ScMKh6U"
>                         },
>                         "dev_platform_identifier": { "profile_url": null },
>                         "twitter_identifier": { "slug": "" }
>                     }
>                 }
>             }
>         ]
>     }
> ]
> ```
>
> * **`profile_url`** — the canonical vanity URL. The slug can change if the
>   person edits it.
>
> * **`urn_url`** — the permanent URN-based URL, which never changes. Use it (or
>   `crustdata_person_id`) as a stable per-person key.
>
> > [!NOTE]
> >
> > `urn_url` requires **field-level permission** on your API key and is absent
> > from the response by default — contact support to enable it. Both URL forms
> > are accepted as input identifiers in `professional_network_profile_urls`, and
> > both match case-insensitively.

> [accordion] Preview mode (enabled per account on request)
>
> > [!NOTE]
> >
> > Preview is off by default. Crustdata enables it per account on request, so
> > contact the Crustdata team before you build on it. Without it, every
> > `preview: true` request returns `400 invalid_request` with the message
> > `Preview feature is not available for your account. Please reach out to
> >           Crustdata team.` The refused call costs 0 credits.
>
> Where preview is enabled, set `preview: true` to get a lightweight response at
> **0 credits**: the `crustdata_person_id`, `basic_profile`,
> `social_handles.professional_network_identifier`, and the person's connection
> count and profile picture. Any `fields` you pass are ignored in preview mode,
> and `preview` cannot be combined with `enrich_realtime`.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": ["https://www.linkedin.com/in/dvdhsu/"],
>     "preview": true
>   }'
> ```
>
> ```json Response without preview enabled theme={"theme":"vitesse-black"}
> {
>     "error": {
>         "type": "invalid_request",
>         "message": "Preview feature is not available for your account. Please reach out to Crustdata team.",
>         "metadata": []
>     }
> }
> ```

> [accordion] Developer platform profile (extra credit)
>
> `dev_platform_profiles` returns developer platform context (repos, orgs,
> activity) and adds **+1** credit.
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": ["https://www.linkedin.com/in/dvdhsu/"],
>     "fields": ["basic_profile", "dev_platform_profiles"]
>   }'
> ```
>
> > [!NOTE]
> >
> > Starting **from** a dev-platform URL instead? `/person/enrich` does not
> > accept dev-platform URLs as identifiers (the legacy endpoint did). Use the
> > [Dev Platform API](https://docs.crustdata.com/person-docs/dev_platform/introduction.md).
> > `POST /dev_platform/enrich` takes `profile_url:
> >           "https://github.com/<handle>"` or a `crustdata_person_id` directly. If you
> > need only the dev platform data for a profile URL, send it to the same
> > endpoint as `professional_network_profile_url`.

> [accordion] Recent posts (social\_posts, gated beta)
>
> Pass `social_posts` in `fields` to get up to the 10 most recent posts the
> person authored, newest first, in the same enrich call. The add-on costs a flat
> 5 credits per profile. Quote posts (reposts
> with added commentary) are included; plain reshares of someone else's post are
> not. Each post carries its text, `share_url`, `date_posted`, `post_type`,
> hashtags, and engagement counts. See the full
> [post field list](https://docs.crustdata.com/person-docs/enrichment/reference.md#social_posts-fields).
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": ["https://www.linkedin.com/in/satyanadella"],
>     "fields": ["basic_profile", "social_posts"]
>   }'
> ```
>
> Posts arrive under `matches[].person_data.social_posts`:
>
> ```json Response (trimmed) theme={"theme":"vitesse-black"}
> [
>   {
>     "matched_on": "https://www.linkedin.com/in/satyanadella",
>     "match_type": "professional_network_profile_url",
>     "matches": [
>       {
>         "confidence_score": 1.0,
>         "person_data": {
>           "basic_profile": {
>             "name": "Satya Nadella",
>             "current_title": "Chairman and CEO"
>           },
>           "social_posts": [
>             {
>               "share_url": "https://www.linkedin.com/posts/satyanadella_today-we-are-announcing-a-series-of-updates-activity-7487546696537923584-Itvi",
>               "text": "Today, we are announcing a series of updates that give customers frontier-grade security at half the cost. ...",
>               "date_posted": "2026-08-03T01:09:13.314042+00:00",
>               "post_type": "original",
>               "has_video": true,
>               "hashtags": [],
>               "engagement": {
>                 "total_reactions": 0,
>                 "total_comments": 0,
>                 "num_shares": 0,
>                 "reactions_by_type": {
>                   "LIKE": 0,
>                   "PRAISE": 0,
>                   "APPRECIATION": 0,
>                   "EMPATHY": 0,
>                   "INTEREST": 0,
>                   "ENTERTAINMENT": 0
>                 }
>               }
>             }
>           ]
>         }
>       }
>     ]
>   }
> ]
> ```
>
> > [!NOTE]
> >
> > **Access and pricing.** `social_posts` is a beta add-on that requires
> > field-level permission on your account and is available on API version
> > `2025-11-01` only; without the grant the section is stripped from the
> > response. Contact Crustdata to enable it. The add-on costs a flat **5**
> > credits per profile on top of the base enrich pricing, however many posts
> > come back, and returns at most 10. No posts returned means no add-on
> > charge, and you are only billed when `social_posts` is in `fields`. Posts are per-profile only: to search posts
> > across the network by keyword, use the
> > [Social Post Search API](https://docs.crustdata.com/social-post-docs/search/introduction.md).

> [accordion] Profile authenticity (assessment, gated, needs field permission)
>
> Pass `assessment` in `fields` to get Crustdata's computed view of how well the
> profile stands up to verification. It is never returned by default, and it
> costs nothing extra on top of the base enrich charge. See the
> [`assessment` field list](https://docs.crustdata.com/person-docs/enrichment/reference#assessment-fields).
>
> The section arrives under `matches[].person_data.assessment`. `verdict` is one
> of `clearly_genuine`, `probably_genuine`, `cannot_verify`,
> `probably_fabricated`, or `clearly_fabricated`. `tier` runs from 0 (most
> trusted) to 9 (least trusted). Either can be null.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": ["https://www.linkedin.com/in/dvdhsu/"],
>     "fields": ["basic_profile.name", "assessment"]
>   }'
> ```
>
> ```json Response (trimmed) theme={"theme":"vitesse-black"}
> [
>   {
>     "matched_on": "https://www.linkedin.com/in/dvdhsu/",
>     "match_type": "professional_network_profile_url",
>     "matches": [
>       {
>         "confidence_score": 1.0,
>         "person_data": {
>           "basic_profile": {
>             "name": "David Hsu"
>           },
>           "assessment": {
>             "authenticity": {
>               "verdict": "probably_genuine",
>               "tier": 1
>             }
>           }
>         }
>       }
>     ]
>   }
> ]
> ```
>
> Request a single leaf to get just that one, for example
> `"fields": ["basic_profile.name", "assessment.authenticity.verdict"]` returns
> `assessment.authenticity.verdict` on its own.
>
> `assessment` is returned only by `/person/enrich`. On `/person/search` you can
> filter on `assessment.authenticity.tier` and `assessment.authenticity.verdict`,
> and sort on `tier` (ascending puts the most trusted first), but neither is
> returned in search results. Naming one in that endpoint's `fields` returns
> `400` with `Invalid fields: assessment.authenticity.tier`. Use the filter to
> screen profiles before you spend an enrich credit:
>
> ```bash Request (search, filter on tier) theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": { "field": "assessment.authenticity.tier", "type": "=", "value": 0 },
>     "limit": 2,
>     "fields": ["crustdata_person_id", "basic_profile.name"]
>   }'
> ```
>
> > [!NOTE]
> >
> > **Access.** `assessment` requires field-level permission on your API key.
> > Without it, the enrich call returns `403` with
> > `{"error": {"type": "permission_error", "message": "Access denied to fields: assessment. ..."}}`
> > and `x-credits-used: 0`. Contact Crustdata to enable it for your key. The
> > search filter above works without the grant.

> [accordion] Research profiles (research\_profiles, enabled on request)
>
> Pass `research_profiles` in `fields` to get the person's matched academic author
> profiles in the same enrich call. The section is never returned by
> default. It is enabled per account, so ask your Crustdata contact to turn it
> on. Without the grant, naming it in `fields` returns `403` with
> `Access denied to fields: research_profiles`.
>
> The value is an array, because one person can hold more than one author
> profile. The best match comes first. A profile is linked to a person only after
> a confident match. Unmatched or still-under-review profiles never appear. When
> the person has no matched profile, the key is absent from `person_data`. More
> than 1.7 million people carry at least one.
>
> Each profile carries identity (`id`, `profile_url`, `name`, `designation`,
> `affiliated_organisation`, `verified_email_domain`, `website`,
> `research_interests`, `thumbnail`), lifetime and recent values of
> `citations_count`, `h_index`, and `i10_index`, a `citations_timeseries` by
> year, every publication in `articles`, every linked co-author in
> `co_authors`, and `metadata.last_scraped_source`. See the
> [`research_profiles` fields](https://docs.crustdata.com/person-docs/enrichment/reference#research_profiles-fields)
> table for types and fill rates.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": ["https://www.linkedin.com/in/yann-lecun/"],
>     "fields": ["basic_profile.name", "research_profiles"]
>   }'
> ```
>
> ```json Response (trimmed) theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "https://www.linkedin.com/in/yann-lecun/",
>         "match_type": "professional_network_profile_url",
>         "match_status": "matched",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "person_data": {
>                     "crustdata_person_id": 1284112,
>                     "basic_profile": { "name": "Yann LeCun" },
>                     "research_profiles": [
>                         {
>                             "id": "WLN3QrAAAAAJ",
>                             "profile_url": "https://scholar.google.com/citations?user=WLN3QrAAAAAJ",
>                             "name": "Yann LeCun",
>                             "designation": "Executive Chairman AMI Labs & Jacob T Schwarz Professor, Courant Institute, New York University",
>                             "affiliated_organisation": "New York University",
>                             "verified_email_domain": "cs.nyu.edu",
>                             "website": "http://yann.lecun.com/",
>                             "research_interests": ["AI", "machine learning", "computer vision", "robotics", "image compression"],
>                             "thumbnail": "https://scholar.googleusercontent.com/citations?view_op=view_photo&user=WLN3QrAAAAAJ&citpid=2",
>                             "article_count": 799,
>                             "co_author_count": 117,
>                             "citations_count": { "all": 495332, "recent": 300443, "recent_since_year": 2021 },
>                             "h_index": { "all": 175, "recent": 129, "recent_since_year": 2021 },
>                             "i10_index": { "all": 504, "recent": 404, "recent_since_year": 2021 },
>                             "citations_timeseries": [
>                                 { "year": 2008, "citations": 1264 },
>                                 { "year": 2009, "citations": 1456 }
>                             ],
>                             "articles": [
>                                 {
>                                     "title": "Deep learning",
>                                     "url": "https://scholar.google.com/citations?view_op=view_citation&hl=en&user=WLN3QrAAAAAJ&pagesize=100&citation_for_view=WLN3QrAAAAAJ:lo0OIn9KAZgC",
>                                     "publication_year": "2015",
>                                     "total_citations": 122610,
>                                     "authors": ["Y LeCun", "Y Bengio", "G Hinton"],
>                                     "all_authors": true,
>                                     "publication": "nature 521 (7553), 436-444"
>                                 }
>                             ],
>                             "co_authors": [
>                                 {
>                                     "id": "kukA0LcAAAAJ",
>                                     "profile_url": "https://scholar.google.com/citations?hl=en&user=kukA0LcAAAAJ",
>                                     "name": "Yoshua Bengio",
>                                     "designation": "Professor of computer science, University of Montreal, Mila, IVADO, CIFAR",
>                                     "thumbnail": "https://scholar.googleusercontent.com/citations?view_op=view_photo&user=kukA0LcAAAAJ&citpid=3"
>                                 }
>                             ],
>                             "metadata": { "last_scraped_source": "2026-09-09T07:39:01.451002Z" }
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
> > The response above is trimmed. The live call returned 799 articles, 117
> > co-authors, and 19 timeseries points, and `social_handles` is left out.
>
> The full section is large. It averages about 26 KB per person and can reach
> about 1 MB, because `articles` and `co_authors` list everything. When you do not
> need the publication list, request only the sub-fields you read. This call
> returns the name, the profile URL, and the lifetime h-index on their own:
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": ["https://www.linkedin.com/in/yann-lecun/"],
>     "fields": ["basic_profile.name", "research_profiles.name", "research_profiles.profile_url", "research_profiles.h_index.all"]
>   }'
> ```
>
> ```json Response (trimmed) theme={"theme":"vitesse-black"}
> {
>     "crustdata_person_id": 1284112,
>     "basic_profile": { "name": "Yann LeCun" },
>     "research_profiles": [
>         {
>             "name": "Yann LeCun",
>             "profile_url": "https://scholar.google.com/citations?user=WLN3QrAAAAAJ",
>             "h_index": { "all": 175 }
>         }
>     ]
> }
> ```
>
> > [!NOTE]
> >
> > **Access and pricing.** `research_profiles` is enabled per account on API
> > version `2025-11-01`. Contact Crustdata to turn it on. The add-on costs
> > **2** credits per person returned with at least one research profile, on
> > top of the base enrich pricing. A person with no matched profile is not
> > charged the add-on. To filter and sort people by citation metrics, use the
> > `research_profiles.*` fields on
> > [Person Search](https://docs.crustdata.com/person-docs/search/reference.md#research-profiles).

> [accordion] Certifications and honors (gated — needs field permission)
>
> `certifications` and `honors` require field-level permission on your API key.
> Without it, the request returns a permission error — contact Crustdata to enable
> them for your key.
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": ["https://www.linkedin.com/in/dvdhsu/"],
>     "fields": ["basic_profile", "certifications", "honors"]
>   }'
> ```

### More recipes

> [accordion] Handle no-match results
>
> Not every identifier will resolve to a person. When there is no match, the
> `matches` array is empty.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": [
>       "https://www.linkedin.com/in/no-such-profile/"
>     ]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "https://www.linkedin.com/in/no-such-profile/",
>         "match_type": "professional_network_profile_url",
>         "matches": []
>     }
> ]
> ```
>
> You still get a response entry for the identifier — `matched_on` tells you
> which input had no match. This makes it easy to track which lookups
> succeeded and which need a different approach.

> [accordion] Batch enrichment — look up multiple people at once
>
> You can enrich up to **25 identifiers** in a single request. The response
> returns one entry per identifier, in the same order you submitted them.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": [
>       "https://www.linkedin.com/in/dvdhsu/",
>       "https://www.linkedin.com/in/abhilashchowdhary/"
>     ]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "matched_on": "https://www.linkedin.com/in/dvdhsu/",
>         "match_type": "professional_network_profile_url",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "person_data": {
>                     "basic_profile": {
>                         "name": "David Hsu",
>                         "headline": "Founder, CEO @ Retool",
>                         "current_title": "Founder, CEO",
>                         "location": {
>                             "city": "San Francisco",
>                             "state": "California",
>                             "country": "United States",
>                             "continent": "North America",
>                             "raw": "San Francisco Bay Area"
>                         }
>                     },
>                     "social_handles": {
>                         "professional_network_identifier": {
>                             "profile_url": "https://www.linkedin.com/in/dvdhsu"
>                         }
>                     }
>                 }
>             }
>         ]
>     },
>     {
>         "matched_on": "https://www.linkedin.com/in/abhilashchowdhary/",
>         "match_type": "professional_network_profile_url",
>         "matches": [
>             {
>                 "confidence_score": 1.0,
>                 "person_data": {
>                     "basic_profile": {
>                         "name": "Abhilash Chowdhary",
>                         "headline": "Co-founder at Crustdata (YC F24) | Real-time B2B data for AI agents",
>                         "current_title": "Co-Founder & CEO",
>                         "location": {
>                             "city": "San Francisco",
>                             "state": "California",
>                             "country": "United States of America",
>                             "continent": "North America",
>                             "raw": "San Francisco, California, United States"
>                         }
>                     },
>                     "social_handles": {
>                         "professional_network_identifier": {
>                             "profile_url": "https://www.linkedin.com/in/abhilashchowdhary"
>                         }
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
> **Batch enrichment tips**
>
> * The maximum batch size is **25 identifiers** per request.
> * Each entry in the response corresponds to the input at the same position, so you can match results back to your input list by index.
> * If some identifiers fail to match, their `matches` array will be empty, but the request still succeeds for the others.

> [accordion] Workflow — Search then Enrich
>
> The most powerful pattern combines [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md) with
> Person Enrich. Search finds people matching your criteria; Enrich gets the
> full profile for each match.
>
> **Step 1:** Search for decision-makers at a target company.
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
>           "field": "experience.employment_details.current.company_name",
>           "type": "in",
>           "value": ["Retool"]
>         },
>         {
>           "op": "or",
>           "conditions": [
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "VP" },
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "Director" },
>             { "field": "experience.employment_details.current.title", "type": "(.)", "value": "Head of" }
>           ]
>         }
>       ]
>     },
>     "limit": 5
>   }'
> ```
>
> **Step 2:** Take the profile URLs from the search results and enrich them
> for full profiles.
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/person/enrich \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "professional_network_profile_urls": [
>       "https://www.linkedin.com/in/dvdhsu/",
>       "https://www.linkedin.com/in/abhilashchowdhary/"
>     ]
>   }'
> ```
>
> This two-step pattern is the foundation for most sales, recruiting, and
> research workflows. Search narrows the universe; Enrich fills in the
> details.

***

## What to do next

* **Look up request/response details** — see [Enrich reference](https://docs.crustdata.com/person-docs/enrichment/reference.md) for parameters, valid `fields` values, `person_data` sections, and errors.
* **Search first, then enrich** — use [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md) to find people by name, title, company, or location, then enrich the results.
* **Fetch fresh data from the web** — use [Person Live Enrich](https://docs.crustdata.com/person-docs/enrichment/live-enrich.md) when cached enrich is not enough.


## Related topics

- [Batch Person Enrichment API](https://docs.crustdata.com/person-docs/enrichment/batch-enrich.md)
- [Capabilities](https://docs.crustdata.com/general/capabilities.md)
- [Contact Enrichment API](https://docs.crustdata.com/person-docs/contact/enrich.md)
- [Batch Contact Enrichment API](https://docs.crustdata.com/person-docs/contact/batch.md)
- [Batch Company Enrichment API](https://docs.crustdata.com/company-docs/enrichment/batch.md)
