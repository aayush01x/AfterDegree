> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Social Post Search reference

> Reference for Social Post Search: filter grammar and operators, every filterable and sortable field, the response field catalog, pagination, field selection, and errors.

Reference material for
[Social Post Search](https://docs.crustdata.com/social-post-docs/indexed-search/introduction.md):
filter grammar and operators, nested-array matching, the filterable and
sortable field lists, the response field catalog, pagination, field
selection, and errors.

For worked examples, see
[Examples](https://docs.crustdata.com/social-post-docs/indexed-search/introduction.md#examples).

```
POST https://api.crustdata.com/social_post/search
```

## API summary

| Detail | Value |
| - | - |
| **Endpoint** | `POST https://api.crustdata.com/social_post/search` |
| **Auth** | `Authorization: Bearer YOUR_API_KEY` |
| **Version** | `x-api-version: 2025-11-01` header (required) |
| **Access** | Enabled on request. Returns `403` until the endpoint is enabled on your account. |
| **Pricing** | `0.5 credits per post returned`. `limit: 0` and empty result sets cost nothing. |
| **Rate limit** | 30 requests per minute (default; contact [gtm@crustdata.co](mailto:gtm@crustdata.co) for higher) |

## Filter grammar

Every filter describes which **individual posts** to keep. The API checks
each post against your filter independently.

There are two building blocks:

| Building block | What it does |
| - | - |
| **`SearchCondition`** (leaf) | Tests one field on one post, for example `actor.actor_type = "company"`. |
| **`SearchConditionGroup`** (node) | Combines conditions with `and`, `or`, or `all_of`. Groups can nest inside other groups. |

### Single condition

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "field": "actor.crustdata_entity_id",
        "type": "=",
        "value": 631394
    }
}
```

### AND / OR group

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "op": "and",
        "conditions": [
            { "field": "text", "type": "[.]", "value": "we raised" },
            { "field": "actor.title", "type": "(.)", "value": "founder" },
            { "field": "date_posted", "type": "=>", "value": "2026-08-01" }
        ]
    }
}
```

> [!WARNING]
>
> **An empty group is rejected.** A `conditions` array with no entries
> returns `400` with `filter group 'conditions' cannot be empty`.

### Array fields

`hashtags`, `mentions.person_id`, `mentions.company_id`,
`mentions.person_url`, and `mentions.company_url` hold several values per
post. A condition on one of them is satisfied when **any** value matches, so
`hashtags = "hiring"` keeps every post that carries that tag among others.

***

## Filter operators

Use the table below to pick the right `type` for each condition. Every
operator works on filterable fields only; see
[Filterable fields](#filterable-fields).

| Operator | `value` shape | Meaning |
| - | - | - |
| `=` | scalar (string/number/boolean) | Exact match. String matching is case-insensitive. |
| `!=` | scalar | Not equal. |
| `<` | scalar (numeric or ISO date) | Less than. |
| `=<` | scalar (numeric or ISO date) | Less than or equal. **Not** `<=`. |
| `>` | scalar (numeric or ISO date) | Greater than. |
| `=>` | scalar (numeric or ISO date) | Greater than or equal. **Not** `>=`. |
| `in` | array of scalars | Field value is any entry in the array. |
| `not_in` | array of scalars | Field value is none of the entries in the array. |
| `is_null` | `null` | Field is null or missing. Send `"value": null`; omitting the key returns `400`. |
| `is_not_null` | `null` | Field has a value. Send `"value": null`. See [Current platform behavior](#current-platform-behavior) before using it on attachment fields. |
| `(.)` | string | **Case-insensitive all-words match with per-word typo tolerance.** Every word must appear somewhere in the field, in any order, and each word also matches lookalikes within a small edit distance. Good for titles and headlines. On a short keyword it overmatches: `"rust"` also matches "just", "must", and "trust". |
| `[.]` | string | **Case-insensitive exact-phrase match.** The words must appear contiguously and in order. Use it for keywords, brands, and product names in `text`. |
| `geo_distance` | object (see below) | **Geographic radius include.** Keeps posts whose author is located within `distance` of a center point. Valid only on `actor.location`. |
| `geo_exclude` | object (see below) | **Geographic radius exclude.** Removes posts whose author is located within `distance` of a center point. Same value format and field restriction as `geo_distance`. |
| `geo_polygon` | object (see below) | **Geographic polygon include.** Keeps posts whose author is located inside a polygon of `[lat, lng]` points. Valid only on `actor.location`. See [Geographic polygon filter](#geographic-polygon-filter-geo_polygon). |
| `has_all` | array of scalars | Every listed value is matched by some element of a nested array, possibly different elements. See [Nested-array matching](#nested-array-matching-all_of-and-has_all). |

> [!WARNING]
>
> **Operator footguns.**
>
> * Use `=>` for greater-than-or-equal and `=<` for less-than-or-equal. They are **not** `>=` and `<=`.
> * `in` and `not_in` require JSON arrays. A string value returns `400`.
> * `comments.text`, `comments.headline`, and `reactors.headline` hold free text. On these three fields, `=`, `!=`, `in`, and `not_in` match a phrase anywhere in the text, the same way as `[.]`, not the whole value. `in` and `not_in` take at most 1,000 values on them. A longer list returns `400` with `A free-text filter takes at most 1000 values`.
> * `is_null` and `is_not_null` require the `value` key. Omitting it returns `400` with `Missing required field: 'filters.value'.`
> * `geo_distance`, `geo_exclude` and `geo_polygon` work only on `actor.location`. Any other field, including `reactors.location`, returns `400`.

### Geographic radius filters (`geo_distance` / `geo_exclude`)

The `value` is an object describing a center point and a radius:

| Key | Type | Required | Description |
| - | - | - | - |
| `location` | string | Yes, unless `lat_lng` is provided | Free-form place name, for example `"Bengaluru"`. The API geocodes it into coordinates server-side. |
| `lat_lng` | `[number, number]` | Yes, unless `location` is provided | Explicit `[latitude, longitude]` center point. Takes precedence over `location` when both are sent, and skips geocoding. |
| `distance` | number | **Yes** | Radius around the center point. Must be positive. |
| `unit` | string | No (default `"km"`) | `"km"`, `"mi"`, `"miles"`, `"m"`, `"meters"`, `"ft"`, or `"feet"`. |

Posts by authors within 25 km of Bengaluru:

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "field": "actor.location",
        "type": "geo_distance",
        "value": { "location": "Bengaluru", "distance": 25, "unit": "km" }
    },
    "limit": 5
}
```

### Geographic polygon filter (`geo_polygon`)

The `value` for `geo_polygon` is an object with a single `points` key:

| Key | Type | Required | Description |
| - | - | - | - |
| `points` | `number[][]` | **Yes** | List of `[latitude, longitude]` pairs, at least 3 distinct points and at most 1,000. Latitude `-90` to `90`, longitude `-180` to `180`. |

The polygon closes itself, so repeating the first point is optional. Edges may
not cross, and no point may be revisited. Points are coordinates, not place
names, and are not geocoded. A polygon that crosses the 180° meridian must
list its points counter-clockwise, or it is read as everything outside it.

Posts by authors located inside a box over the San Francisco peninsula:

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "field": "actor.location",
        "type": "geo_polygon",
        "value": { "points": [[37.81, -122.52], [37.81, -122.35], [37.70, -122.35], [37.70, -122.52]] }
    },
    "limit": 5
}
```

***

## Nested-array matching: `all_of` and `has_all`

`reactors` and `comments` are **arrays of nested objects**. Each reactor
entry has its own `reaction_type`, `title`, `company`, and so on, and each
comment has its own `text`, `created_at`, and commenter attributes. When you
put several conditions on one of these arrays, there are two things you
might mean:

* **Same element**: one reactor satisfies every condition (a founder whose
  reaction was `PRAISE`).
* **Cross element**: different reactors each satisfy a condition (a founder
  reacted **and** a recruiter reacted, not necessarily the same person).

A plain `and` group over one nested array means **same element**. To express
**cross element**, use an `all_of` group or the `has_all` operator.

### `all_of`: each condition matched by some element

Each condition inside `all_of` must be satisfied by at least one array
element, evaluated independently. A condition can be a single filter or an
`and`/`or` group; a group is matched within one element.

Posts where some founder reacted and some recruiter reacted:

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "op": "all_of",
        "conditions": [
            { "field": "reactors.title", "type": "(.)", "value": "founder" },
            { "field": "reactors.title", "type": "(.)", "value": "recruiter" }
        ]
    },
    "fields": ["share_urn", "engagement.total_reactions"],
    "limit": 1
}
```

Returns `total_count: 59960`. Wrap a condition in an `and` group to pin it
to one element: a founder whose reaction was `PRAISE`, plus any recruiter.

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "op": "all_of",
        "conditions": [
            {
                "op": "and",
                "conditions": [
                    { "field": "reactors.title", "type": "(.)", "value": "founder" },
                    { "field": "reactors.reaction_type", "type": "=", "value": "PRAISE" }
                ]
            },
            { "field": "reactors.title", "type": "(.)", "value": "recruiter" }
        ]
    },
    "fields": ["share_urn"],
    "limit": 1
}
```

Returns `total_count: 13723`. `all_of` groups nest freely inside `and` and
`or` groups, so you can combine cross-element requirements with post-level
filters such as `date_posted`.

### `has_all`: every value matched by some element

`has_all` is shorthand for the common cross-element case: a value list where
each value is matched by some element of the array. The same query as the
first `all_of` example:

```json theme={"theme":"vitesse-black"}
{
    "filters": {
        "field": "reactors.title",
        "type": "has_all",
        "value": ["founder", "recruiter"]
    },
    "fields": ["share_urn", "engagement.total_reactions"],
    "limit": 1
}
```

Returns `total_count: 5505`. The count is lower than the `all_of` form
because `has_all` matches each value as a whole term rather than with the
typo-tolerant `(.)` operator.

> [!WARNING]
>
> * `all_of` and `has_all` accept only **positive** predicates. `!=` or
>   `not_in` inside them returns `400` with `all_of/has_all conditions only
>   support positive predicates; negation operator NOT_EQUALS is not allowed`.
> * They work only on the nested arrays `reactors` and `comments`. Using
>   them on a flat field returns `400` with `all_of/has_all conditions
>   require nested array fields; 'text' is not a nested field`.

***

## Filterable fields

Only the fields below can appear in `filters`. Any other path returns `400`
with `Unsupported columns in conditions: [...]`.

### Post

| Field | Type | Notes |
| - | - | - |
| `share_urn` | string | Post URN, the stable post id. |
| `backend_urn` | string | Internal URN of the post. |
| `entity_urn` | string | Feed entity URN. |
| `parent_post_urn` | string | URN of the original post, set on reposts. |
| `share_url` | string | Public URL of the post. |
| `text` | string | Post text. Use `[.]` for a keyword or phrase, `(.)` for a loose multi-word match. |
| `hashtags` | array of string | Case-insensitive match against any tag on the post. |
| `post_type` | string | `original`, `repost_quote`, or `repost_without_thoughts`. |
| `date_posted` | ISO-8601 date | When the post was published. Accepts a date or a timestamp in range operators. |
| `is_edited` | boolean | |
| `has_video` | boolean | See [Current platform behavior](#current-platform-behavior). |

### Author (`actor.*`)

| Field | Type | Notes |
| - | - | - |
| `actor.actor_type` | string | `person` or `company`. |
| `actor.crustdata_entity_id` | integer | Crustdata person id or company id, per `actor_type`. The most reliable way to select an author. |
| `actor.linkedin_id` | string | Numeric professional network id of the author, when known. |
| `actor.professional_network_urn` | string | Author profile URN in URL form, as returned in the response. |
| `actor.professional_network_url` | string | Exact match against the stored public profile URL. Prefer `actor.crustdata_entity_id`. |
| `actor.name` | string | |
| `actor.headline` | string | |
| `actor.title` | string | Current job title. People only. |
| `actor.company_name` | string | Current employer name. People only. |
| `actor.industry` | string | |
| `actor.location` | geo | Target of `geo_distance`, `geo_exclude` and `geo_polygon`. |
| `actor.location.raw` | string | The location string as written on the profile. |
| `actor.location.city` | string | |
| `actor.location.state` | string | |
| `actor.location.country` | string | |
| `actor.location.continent` | string | |

### Reposter (`reposter.*`)

Present on `repost_quote` and `repost_without_thoughts` rows.

| Field | Type |
| - | - |
| `reposter.actor_type` | string |
| `reposter.linkedin_id` | string |
| `reposter.professional_network_urn` | string |
| `reposter.professional_network_url` | string |
| `reposter.name` | string |
| `reposter.headline` | string |

### Engagement (`engagement.*`)

| Field | Type |
| - | - |
| `engagement.total_reactions` | integer |
| `engagement.total_comments` | integer |
| `engagement.num_shares` | integer |
| `engagement.reactions_by_type.LIKE` | integer |
| `engagement.reactions_by_type.PRAISE` | integer |
| `engagement.reactions_by_type.EMPATHY` | integer |
| `engagement.reactions_by_type.INTEREST` | integer |
| `engagement.reactions_by_type.APPRECIATION` | integer |
| `engagement.reactions_by_type.ENTERTAINMENT` | integer |

### Reactors (`reactors.*`, nested)

Filter paths are flat even though the response nests the person under
`reactors[].reactor`.

| Field | Type | Notes |
| - | - | - |
| `reactors.reaction_type` | string | `LIKE`, `PRAISE`, `EMPATHY`, `INTEREST`, `APPRECIATION`, or `ENTERTAINMENT`. |
| `reactors.actor_type` | string | `person` or `company`. |
| `reactors.crustdata_entity_id` | integer | |
| `reactors.linkedin_id` | string | |
| `reactors.name` | string | |
| `reactors.headline` | string | |
| `reactors.location` | string | Free text. Not a geo target. |
| `reactors.title` | string | |
| `reactors.company` | string | |
| `reactors.industry` | string | |
| `reactors.professional_network_url` | string | |

### Comments (`comments.*`, nested)

Filter paths are flat even though the response nests the person under
`comments[].commenter`.

| Field | Type | Notes |
| - | - | - |
| `comments.text` | string | Comment text. |
| `comments.created_at` | ISO-8601 date | |
| `comments.actor_type` | string | `person` or `company`. |
| `comments.crustdata_entity_id` | integer | |
| `comments.linkedin_id` | string | |
| `comments.name` | string | |
| `comments.headline` | string | |
| `comments.location` | string | Free text. Not a geo target. |
| `comments.title` | string | |
| `comments.company` | string | |
| `comments.industry` | string | |
| `comments.professional_network_url` | string | |
| `comments.comment_reactions.LIKE` | integer | |
| `comments.comment_reactions.PRAISE` | integer | |
| `comments.comment_reactions.EMPATHY` | integer | |
| `comments.comment_reactions.INTEREST` | integer | |
| `comments.comment_reactions.APPRECIATION` | integer | |
| `comments.comment_reactions.ENTERTAINMENT` | integer | |

### Mentions and attachments

| Field | Type | Notes |
| - | - | - |
| `mentions.person_id` | integer (array) | Crustdata person ids resolved from profile links in the post. Returned as `mentions.person_ids`. |
| `mentions.company_id` | integer (array) | Crustdata company ids resolved from company links in the post. Returned as `mentions.company_ids`. |
| `mentions.person_url` | string (array) | Raw profile URLs the post links to. Returned as `hyperlinks.person_professional_network_urls`. |
| `mentions.company_url` | string (array) | Raw company page URLs the post links to, in their numeric-id form. Returned as `hyperlinks.company_professional_network_urls`. |
| `document.title` | string | |
| `document.page_count` | integer | |
| `article.title` | string | |
| `poll.question` | string | |
| `poll.closed` | boolean | |
| `poll.multi_select` | boolean | |

### Filter-only fields

These fields accept filters but are not returned and cannot be listed in
`fields`.

| Field | Type | Notes |
| - | - | - |
| `content_type` | string | Attachment class present on the post: `video`, `image`, `document`, `article`, or `poll`. Any other value returns `400`. The response equivalent is `content_types`. |
| `materialized_at` | ISO-8601 date | When the index was built. Identical on every post in a build, so a range filter on it tells you whether you are querying a fresh build rather than selecting posts. |

***

## Sortable fields

The sort allowlist is narrower than the filter allowlist. Sorting on any
other field, including `text`, returns `400` with
`Unsupported columns in conditions: ['text']`.

* `date_posted` (the default, descending)
* `post_type`
* `actor.actor_type`
* `engagement.total_reactions`
* `engagement.total_comments`
* `engagement.num_shares`
* `engagement.reactions_by_type.LIKE`, `.PRAISE`, `.EMPATHY`, `.INTEREST`, `.APPRECIATION`, `.ENTERTAINMENT`
* `is_edited`
* `has_video`
* `poll.closed`
* `poll.multi_select`
* `document.page_count`

***

## Response field reference

Every post carries every group below unless you narrow it with `fields`.
Fields the source record lacks are omitted from `actor` and `reposter`
rather than returned as `null`, so treat each actor field as optional.

### Post

| Field | Type | Description |
| - | - | - |
| `share_urn` | string | Post URN. Always present. |
| `backend_urn` | string | Internal URN of the post. |
| `entity_urn` | string | Feed entity URN. |
| `parent_post_urn` | string | URN of the original post on reposts. Empty string on original posts. |
| `share_url` | string | Public URL of the post. |
| `text` | string | Post text content. |
| `post_type` | string | `original`, `repost_quote`, or `repost_without_thoughts`. |
| `is_edited` | boolean | |
| `has_video` | boolean | See [Current platform behavior](#current-platform-behavior). |
| `date_posted` | string | ISO-8601 UTC timestamp, for example `2026-08-30T09:26:04Z`. |
| `hashtags` | array of string | Tags used in the post, as written. |
| `content_types` | array of string | Attachment classes present: `video`, `image`, `document`, `article`, `poll`. |

### `actor` and `reposter`

`actor` is the author. `reposter` is present on reposts and has the same
shape.

| Field | Type | Description |
| - | - | - |
| `actor_type` | string | `person` or `company`. |
| `crustdata_entity_id` | integer | Crustdata person id or company id, per `actor_type`. |
| `linkedin_id` | string | Numeric professional network id, when known. |
| `professional_network_urn` | string | Profile URN in URL form. |
| `professional_network_url` | string | Public profile URL. |
| `name` | string | |
| `headline` | string | |
| `title` | string | Current job title. People only. |
| `company_name` | string | Current employer name. People only. |
| `industry` | string | |
| `location` | object | `raw`, `city`, `state`, `country`, `continent`. Select it whole; `fields` does not accept `actor.location.city`. |
| `profile_picture_url` | string | |

### `engagement`

| Field | Type | Description |
| - | - | - |
| `total_reactions` | integer | |
| `total_comments` | integer | |
| `num_shares` | integer | |
| `reactions_by_type` | object | Counts for `LIKE`, `PRAISE`, `EMPATHY`, `INTEREST`, `APPRECIATION`, and `ENTERTAINMENT`. Every key is present. |

### `reactors[]`

Every reaction on the post. The array is returned in full, not just the
elements that matched your filter.

| Field | Type | Description |
| - | - | - |
| `reaction_type` | string | `LIKE`, `PRAISE`, `EMPATHY`, `INTEREST`, `APPRECIATION`, or `ENTERTAINMENT`. |
| `reactor` | object | The reacting person or company: `actor_type`, `crustdata_entity_id`, `linkedin_id`, `professional_network_urn`, `professional_network_url`, `name`, `headline`, `location` (string), `title`, `company`, `industry`, `profile_picture_url`. |

### `comments[]`

Every comment on the post, returned in full.

| Field | Type | Description |
| - | - | - |
| `comment_urn` | string | |
| `comment_text` | string | |
| `permalink` | string | Public URL of the comment. |
| `created_at` | string | ISO-8601 UTC timestamp. |
| `commenter` | object | Same shape as `reactors[].reactor`. |
| `comment_reactions` | object | Reaction counts on the comment, one key per reaction type. |

### `mentions` and `hyperlinks`

| Field | Type | Description |
| - | - | - |
| `mentions.person_ids` | array of integer | Crustdata person ids resolved from profile links in the post. |
| `mentions.company_ids` | array of integer | Crustdata company ids resolved from company links in the post. |
| `hyperlinks.company_professional_network_urls` | array of string | Company page URLs the post links to. |
| `hyperlinks.person_professional_network_urls` | array of string | Profile URLs the post links to. |
| `hyperlinks.other_urls` | array of string | Every other URL in the post. |
| `hyperlinks.media_urls` | array of string | Media attachment URLs. |

### Attachments and metadata

| Field | Type | Description |
| - | - | - |
| `document.title` | string | |
| `document.url` | string | |
| `document.page_count` | integer | |
| `article.title` | string | |
| `article.url` | string | |
| `poll.question` | string | |
| `poll.multi_select` | boolean | |
| `poll.total_voters` | integer | |
| `poll.closed` | boolean | |
| `poll.options` | array of string | |
| `metadata.data_updated_at` | string | ISO-8601 UTC timestamp of the last update to the post record. |

Attachment objects are always present. A post without a document, article,
or poll returns the object with empty strings, `0`, `false`, and `[]` rather
than `null`. Use `content_types` or the `content_type` filter to test for an
attachment.

## Current platform behavior

These are observed behaviors of the current index build, not part of the
contract. They resolve at the next full index refresh.

* **`has_video` is `true` on every post**, and the `content_type` filter
  values `video` and `image` match every post. Filter on `document`,
  `article`, or `poll`, and treat `has_video` and the `video` and `image`
  entries in `content_types` as unreliable until then.
* **`is_not_null` overmatches on attachment text fields.** Because empty
  attachments are stored as empty strings, `poll.question is_not_null`
  matches every post. Test attachments with `content_type` instead.

***

## Errors

| Status | `error.type` | Meaning |
| - | - | - |
| `400` | `invalid_request` | The request failed validation: an unsupported filter or sort field, an unknown operator, an empty group, `limit` out of range, an invalid cursor, an unrecognized parameter, a bad `content_type` value, a malformed geo value, or a field in `fields` that does not exist. |
| `401` | none | The `Authorization` header is missing, malformed, or holds an invalid API key. This response comes from the gateway and carries a flat `message` rather than the `error` envelope. |
| `403` | `permission_error` | The endpoint is not enabled on your account, or a requested field is not enabled on your key. |
| `500` | `internal_error` | The query could not be executed. Retry after a short delay. |

Every `400`, `403`, and `500` uses the nested envelope
`{ "error": { "type", "message", "metadata" } }`, and none of them charges
credits. Branch on `error.type` rather than string-matching `message`.

```json 400 - unsupported filter field theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Unsupported columns in conditions: ['actor.company']",
        "metadata": []
    }
}
```

```json 400 - unknown operator theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "'filters.type' must be one of: =, !=, <, =<, >, =>, in, not_in, is_null, is_not_null, (.), [.], geo_distance, geo_exclude, geo_polygon, has_all. Got '~'. Did you mean '(.)' (case-insensitive all-words match)?",
        "metadata": [
            {
                "field": "filters.type",
                "type": "enum",
                "message": "'filters.type' must be one of: =, !=, <, =<, >, =>, in, not_in, is_null, is_not_null, (.), [.], geo_distance, geo_exclude, geo_polygon, has_all. Got '~'. Did you mean '(.)' (case-insensitive all-words match)?"
            }
        ]
    }
}
```

```json 400 - empty condition group theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "filter group 'conditions' cannot be empty",
        "metadata": [
            {
                "field": "filters.conditions",
                "type": "missing",
                "message": "filter group 'conditions' cannot be empty"
            }
        ]
    }
}
```

```json 400 - limit out of range theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "'limit' must be at most 1000. Got 5000.",
        "metadata": [
            {
                "field": "limit",
                "type": "less_than_equal",
                "message": "'limit' must be at most 1000. Got 5000."
            }
        ]
    }
}
```

```json 400 - invalid cursor theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Invalid cursor",
        "metadata": []
    }
}
```

```json 400 - unrecognized parameter theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "page: This field is not allowed.",
        "metadata": []
    }
}
```

```json 400 - unsupported content_type theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Unsupported content_type value: 'gif'. Supported: video, image, document, article, poll",
        "metadata": []
    }
}
```

```json 400 - in without an array theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Operator 'in' on 'post_type' requires a list of strings, numbers, or booleans",
        "metadata": [
            {
                "field": "filters.value",
                "type": "invalid_type",
                "message": "Operator 'in' on 'post_type' requires a list of strings, numbers, or booleans"
            }
        ]
    }
}
```

```json 400 - geo filter missing distance theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "geo_distance filter requires 'distance' field",
        "metadata": []
    }
}
```

```json 400 - geo filter on a non-geo field theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Column 'actor.name' does not support geo_distance queries",
        "metadata": []
    }
}
```

```json 400 - geo filter with an unsupported unit theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "geo_distance 'unit' must be one of: km, mi, miles, m, meters, ft, feet",
        "metadata": []
    }
}
```

```json 400 - geo filter on a nested location theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Column 'reactors.location' does not support geo_distance queries",
        "metadata": []
    }
}
```

```json 400 - negation inside all_of theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "all_of/has_all conditions only support positive predicates; negation operator NOT_EQUALS is not allowed",
        "metadata": []
    }
}
```

```json 400 - all_of on a flat field theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "all_of/has_all conditions require nested array fields; 'text' is not a nested field",
        "metadata": []
    }
}
```

```json 400 - location could not be geocoded theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Location 'xzqjw9834nonsense' could not be geocoded: no matching place found",
        "metadata": []
    }
}
```

```json 400 - unknown field in fields theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Invalid fields: nope",
        "metadata": [
            {
                "available_fields": ["actor", "actor.actor_type", "..."]
            }
        ]
    }
}
```

```json 401 - invalid API key theme={"theme":"vitesse-black"}
{
    "message": "Invalid API key in request"
}
```

```json 403 - endpoint not enabled theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "permission_error",
        "message": "You do not have permission to access /social_post/search.",
        "metadata": []
    }
}
```

```json 403 - field not enabled theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "permission_error",
        "message": "Access denied to fields: reactors. To enable access, please book a call with us at https://meetings-na2.hubspot.com/chris-pisarski/web-demo-request",
        "metadata": [
            {
                "denied_fields": ["reactors"],
                "permitted_fields": ["share_urn", "share_url", "text", "actor", "engagement"]
            }
        ]
    }
}
```

The `available_fields` list in the unknown-field `400` is cut short here; the
API returns every selectable path.

***

## Pagination and sorting

### Sorting

`sorts` is an ordered array. Each item has a `field` and an `order` (`asc`
or `desc`). Sorts apply in array order: the first is the primary key and the
second breaks ties. Omitting `sorts` orders by `date_posted` descending.

```json theme={"theme":"vitesse-black"}
{
    "sorts": [
        { "field": "engagement.total_reactions", "order": "desc" },
        { "field": "date_posted", "order": "desc" }
    ]
}
```

Both keys are required. A sort entry without `order` returns `400` with
`Missing required field: 'sorts.0.order'.`

### Pagination

Pagination is cursor-based. Each response returns a `next_cursor`, or `null`
at the end of the result set. To fetch the next page, resend the original
body with `cursor` set to the previous `next_cursor`.

**1. Fetch the first page**

Omit `cursor` and set `limit` to your page size (max `1000`).

**2. Walk forward**

Take `next_cursor` from the response and pass it back as `cursor`.
Keep `filters`, `sorts`, and `fields` identical. A cursor issued for
a different body is rejected with `Invalid cursor`.

**3. Stop when next\_cursor is null**

A `null` cursor means you have reached the end of the result set.

`total_count` is computed once for the query and stays stable across pages.

### Dataset freshness

The index is rebuilt periodically from the full post dataset, so every post
in a build shares one `materialized_at` value. The newest posts in the index
can be several days old at the time you query. For the latest posts by one
person or company, use
[Enrich Social Posts](https://docs.crustdata.com/social-post-docs/enrichment/introduction.md).

### Field selection

Use `fields` to return only the dot-paths you need. You can request a whole
group such as `"actor"` or `"engagement"`, a sub-object such as
`"actor.location"` or `"engagement.reactions_by_type"`, or a single field
such as `"actor.name"`.

```json theme={"theme":"vitesse-black"}
{
    "fields": [
        "share_url",
        "date_posted",
        "text",
        "actor.name",
        "actor.title",
        "actor.company_name",
        "engagement.total_reactions"
    ]
}
```

* **`actor.location` is selected whole.** Filters accept
  `actor.location.city`, but `fields` does not; request `actor.location`.
* **Filter-only fields cannot be selected.** `content_type` and
  `materialized_at` in `fields` return `400` with `Invalid fields: ...`.
* **Leave `reactors` and `comments` out unless you need them.** They are
  returned in full and a popular post carries thousands of entries.

> [!TIP]
>
> **Recommended default field set:** `["share_url", "date_posted", "text",
>       "post_type", "actor.name", "actor.title", "actor.company_name",
>       "actor.crustdata_entity_id", "engagement.total_reactions",
>       "engagement.total_comments"]`.

## What's next

* [Examples](https://docs.crustdata.com/social-post-docs/indexed-search/introduction.md#examples) on the introduction page.
* [Pricing](https://docs.crustdata.com/general/pricing.md) and [Rate limits](https://docs.crustdata.com/general/rate-limits.md).
* [Permissions](https://docs.crustdata.com/general/permissions.md) to check which fields your key holds on `/social_post/search`.


## Related topics

- [Social Post Search API](https://docs.crustdata.com/social-post-docs/indexed-search/introduction.md)
- [Social Post Watcher](https://docs.crustdata.com/watcher-docs/social-post/discovery.md)
- [Social Post Search](https://docs.crustdata.com/api-reference/social-post-apis/search-the-social-post-dataset.md)
- [Web Search API](https://docs.crustdata.com/web-docs/search/introduction.md)
- [Web Search reference](https://docs.crustdata.com/web-docs/search/reference.md)
