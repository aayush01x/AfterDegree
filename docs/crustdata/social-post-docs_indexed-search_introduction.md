> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Social Post Search API

> Query the indexed Crustdata social post dataset with structured filters on post text, author, engagement, reactors, commenters, mentions, and attachments, with cursor pagination, sorting, and field selection.

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | Enabled per account on request. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | No |
| **Credit cost** | 0.5 credits per post. Counts with `limit: 0` are free |
| **Rate limit** | 30 requests per minute |

**Use this when** you want to find, segment, or count posts across the full
Crustdata social post dataset: who is talking about a topic, what a company
page or a known person has published, which posts a target account was
mentioned in, or which posts drew reactions and comments from a specific kind
of person.

This page walks you through the post record, your first search, the response
shape, and choosing a search pattern, then folds in worked examples you can
copy and adapt. For the filter grammar, the operator table, and the full field
catalog, see [Social Post Search reference](https://docs.crustdata.com/social-post-docs/indexed-search/reference.md).

```
POST https://api.crustdata.com/social_post/search
```

> [!NOTE]
>
> Replace `YOUR_API_KEY` in each example with your actual API key. All
> requests require the `x-api-version: 2025-11-01` header.

> [!NOTE]
>
> **Enabled on request.** This endpoint is off by default on every account
> and returns `403` until it is enabled. To turn it on,
> [contact us](https://crustdata.com/demo). Check your entitlement at any
> time with [`GET /account/endpoints?path=/social_post/search`](https://docs.crustdata.com/general/permissions).

> [!NOTE]
>
> **Indexed, not live.** This endpoint queries a periodically rebuilt index
> of posts. For the freshest posts by one person or company, use
> [Enrich Social Posts](https://docs.crustdata.com/social-post-docs/enrichment/introduction.md). For a
> real-time keyword search, use
> [Search Social Posts](https://docs.crustdata.com/social-post-docs/search/introduction.md).

## Post record mental model

Every result is one post object with these top-level groups:

* **Post identity and content**: `share_urn`, `share_url`, `text`,
  `post_type` (`original`, `repost_quote`, or `repost_without_thoughts`),
  `date_posted`, `hashtags`, `is_edited`, and the URN family (`backend_urn`,
  `entity_urn`, `parent_post_urn`).
* **`actor`**: the author, person or company, enriched with a Crustdata id,
  headline, current title and `company_name`, industry, and a structured
  `location` with `city`, `state`, `country`, and `continent`.
* **`reposter`**: present on reposts. The account that reshared the post,
  with the same shape as `actor`.
* **`engagement`**: `total_reactions`, `total_comments`, `num_shares`, and
  `reactions_by_type` with a count per reaction type.
* **`reactors` and `comments`**: every reaction and comment on the post,
  each with the reacting or commenting person's identity, title, company,
  and location. These arrays are returned in full and can be long.
* **`mentions` and `hyperlinks`**: the Crustdata ids of people and companies
  mentioned in the post, plus the raw URLs the post links to.
* **Attachments**: `document`, `article`, and `poll` objects, plus
  `content_types`, the list of attachment classes present on the post.
* **`metadata`**: `data_updated_at`, when the post record was last updated.

## At a glance

| Detail | Value |
| - | - |
| **Endpoint** | `POST https://api.crustdata.com/social_post/search` |
| **Auth** | `Authorization: Bearer YOUR_API_KEY` |
| **API version** | `x-api-version: 2025-11-01` header (required) |
| **Body** | **Required.** Send `{}` to match the whole dataset; every realistic query uses `filters`. |
| **Body keys** | `filters`, `cursor`, `limit` (0 to 1000, default 20), `sorts`, `fields`, all optional |
| **Response** | `{ "posts": [ Post, ... ], "next_cursor": string or null, "total_count": integer }` |
| **Credits** | **0.5** per post returned. `limit: 0` and empty result sets cost nothing. |
| **Rate limit** | 30 requests per minute by default |
| **Errors** | `400` invalid request, `401` unauthorized, `403` not enabled or field denied, `500` internal |

> [card] [Examples](#examples)
>
> Company page posts, founders announcing a raise, posts mentioning a
> company, reactor and commenter targeting, and more.

> [card] [Pagination and sorting](https://docs.crustdata.com/social-post-docs/indexed-search/reference.md#pagination-and-sorting)
>
> Sorting, cursor-based pagination, and field selection.

> [card] [Reference](https://docs.crustdata.com/social-post-docs/indexed-search/reference.md)
>
> Filter grammar, operators, every filterable and sortable field, the
> response field catalog, and errors.

## Request body

| Parameter | Type | Required | Default | Description |
| - | - | - | - | - |
| `filters` | object | No | none | A single `SearchCondition` or a nested `SearchConditionGroup`. Omit to match every indexed post. |
| `cursor` | string | No | none | Opaque cursor from a prior response's `next_cursor`. Pass it to fetch the next page with the same filter, sort, and field set. |
| `limit` | integer | No | `20` | Posts per page. Min `0`, max `1000`. Use `0` when you only want `total_count`. |
| `sorts` | array of `SearchSort` | No | none | Ordering rules. Each item has `field` (dot-path) and `order` (`asc` or `desc`). Sorts apply in array order. Default order is `date_posted` descending. |
| `fields` | string\[] | No | all fields | Dot-paths to include in each returned post. Omit to return everything. Always set `fields` in production, and leave out `reactors` and `comments` unless you need them. |

### Response body

| Field | Type | Description |
| - | - | - |
| `posts` | `Post[]` | Matching posts for the current page. Empty array `[]` when `limit` is `0` or nothing matches. |
| `next_cursor` | string or null | Opaque cursor to fetch the next page. `null` when there are no more pages or when `limit` is `0`. |
| `total_count` | integer | Total number of posts matching the filter across all pages. |

### Rate limits and credits

**Pricing:** `0.5 credits per post returned`. A
request that returns no posts does not consume credits, and neither does a
`limit: 0` count query. The exact charge comes back in the
`X-Credits-Used` header.
To see the price for your account, open the [**Pricing** tab](https://app.crustdata.com/endpoints/social_post-search#pricing) in the dashboard.

> [!NOTE]
>
> Default `rate-limit` is 30 requests per minute. Send an email to
> [gtm@crustdata.co](mailto:gtm@crustdata.co) to discuss higher limits if
> needed for your use case.

***

## Your first search: a keyword from authors in one city

Find people in Kolkata whose posts mention Rust, newest first. `[.]` on
`text` is an exact-phrase match, the right tool for a short technical keyword.
The fuzzy `(.)` operator would also match "just", "must", and "trust".

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/social_post/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": {
      "op": "and",
      "conditions": [
        { "field": "text", "type": "[.]", "value": "rust" },
        { "field": "actor.actor_type", "type": "=", "value": "person" },
        { "field": "actor.location.city", "type": "=", "value": "Kolkata" }
      ]
    },
    "sorts": [{ "field": "date_posted", "order": "desc" }],
    "fields": ["share_urn", "share_url", "text", "post_type", "actor", "date_posted", "engagement"],
    "limit": 2
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "posts": [
        {
            "actor": {
                "actor_type": "person",
                "company_name": "GDG JIS University",
                "crustdata_entity_id": 239889016,
                "headline": "CS @Jis University Kolkata | Founding Associate @Elixpo | Building Web, SaaS AI & Backend System.",
                "location": {
                    "raw": "Kolkata, West Bengal, India",
                    "city": "Kolkata",
                    "state": "West Bengal",
                    "country": "India",
                    "continent": "Asia"
                },
                "name": "Vivek Yadav",
                "professional_network_url": "https://www.linkedin.com/in/vivekzsh",
                "professional_network_urn": "https://www.linkedin.com/in/ACoAAE12VB8BfHTIQgKg3bab_TyMu4iGbk2URQA",
                "profile_picture_url": "https://media.licdn.com/dms/image/v2/D4D35AQFMDoQuDQcA3Q/...",
                "title": "Web Facilitator"
            },
            "date_posted": "2026-08-30T09:26:04Z",
            "engagement": {
                "num_shares": 0,
                "reactions_by_type": {
                    "APPRECIATION": 0,
                    "EMPATHY": 0,
                    "ENTERTAINMENT": 0,
                    "INTEREST": 2,
                    "LIKE": 6,
                    "PRAISE": 0
                },
                "total_comments": 0,
                "total_reactions": 8
            },
            "post_type": "original",
            "share_url": "https://www.linkedin.com/posts/vivekzsh_i-was-just-using-cloudflare-checking-logs-activity-7499507923715502080-qhip",
            "share_urn": "urn:li:share:7499507922327105538",
            "text": "I was just using Cloudflare checking logs of my projects, then a blog notification came and it was interesting, so here is what I read: Cloudflare managed to sa..."
        },
        {
            "actor": {
                "actor_type": "person",
                "crustdata_entity_id": 560768452,
                "headline": "CSE Undergrad @SRM | Qiskit Advocate @IBM Quantum | Java C++ Python | DSA, AI & ML Enthusiast",
                "location": {
                    "raw": "Kolkata, West Bengal, India",
                    "city": "Kolkata",
                    "state": "West Bengal",
                    "country": "India",
                    "continent": "Asia"
                },
                "name": "Aritra Maji",
                "professional_network_url": "https://www.linkedin.com/in/aritra-maji-8262bb311",
                "professional_network_urn": "https://www.linkedin.com/in/ACoAAE8-sd4B3SYhXhBEKVkZXrrlty0TTzU1Qns",
                "profile_picture_url": "https://media.licdn.com/dms/image/v2/D4E03AQGQ2ipSUlLSmQ/..."
            },
            "date_posted": "2026-08-26T18:56:14Z",
            "engagement": {
                "num_shares": 0,
                "reactions_by_type": {
                    "APPRECIATION": 0,
                    "EMPATHY": 0,
                    "ENTERTAINMENT": 0,
                    "INTEREST": 0,
                    "LIKE": 12,
                    "PRAISE": 1
                },
                "total_comments": 0,
                "total_reactions": 13
            },
            "post_type": "original",
            "share_url": "https://www.linkedin.com/posts/aritra-maji-8262bb311_java-softwareengineering-datastructures-activity-7498361105572999168-v1bq",
            "share_urn": "urn:li:ugcPost:7498361104642007041",
            "text": "Last year, earning daily badges was simple: just sticking to Arrays and Strings yielded instant gratification.\n\nHowever, this 2026 streak has been entirely diff..."
        }
    ],
    "next_cursor": "H4sIAM8JqGoC_xXMQQ7CIBBA...",
    "total_count": 495
}
```

The post text, picture URLs, and cursor are shortened here. Notice that
`actor` fields such as `company_name` and `title` appear only when the author
record carries them, so read every actor field as optional.

## Which search pattern should I use?

> [tab] I want to explore the dataset
>
> Use **Social Post Search**. Slice hundreds of millions of indexed
> posts by text, author attributes, engagement, reactor and commenter
> attributes, mentions, or attachment type, and walk large result sets with
> cursor pagination.

> [tab] I know the author
>
> Filter on `actor.crustdata_entity_id`, the same id
> [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md) and
> [Company Search](https://docs.crustdata.com/company-docs/search/introduction.md) return. It works for
> people and company pages alike. Filtering on `actor.professional_network_url`
> is an exact string match against the stored URL, so prefer the id.

> [tab] I want the freshest posts for one person or company
>
> Use [Enrich Social Posts](https://docs.crustdata.com/social-post-docs/enrichment/introduction.md). It
> retrieves the latest posts from the web at request time, one identifier per
> call.

> [tab] I want a real-time keyword search
>
> Use [Search Social Posts](https://docs.crustdata.com/social-post-docs/search/introduction.md), the live
> keyword search with recency windows. The indexed endpoint on this page is
> rebuilt periodically, so the newest posts can lag by days.

> [tab] I want only a count
>
> Pass `"limit": 0`. You get `total_count` without any post payload and
> without any credit charge.

***

## Examples

Worked recipes you can copy, paste, and adapt. Each example is a full working
request paired with the response it returned. Responses are trimmed to the
fields under discussion, and long text and cursors are shortened. For the
filter grammar, operators, and the full field catalog, see
[Social Post Search reference](https://docs.crustdata.com/social-post-docs/indexed-search/reference.md).

> [accordion] Everything a company page has posted
>
> Filter on `actor.crustdata_entity_id` with the company's Crustdata id and
> sort newest first. Person ids and company ids are separate id spaces, so add
> `actor.actor_type = company` when you want to rule out a person with the
> same number.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/social_post/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": { "field": "actor.crustdata_entity_id", "type": "=", "value": 631394 },
>     "sorts": [{ "field": "date_posted", "order": "desc" }],
>     "fields": ["share_url", "date_posted", "actor.name", "actor.actor_type", "engagement.total_reactions"],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "posts": [
>         {
>             "actor": {
>                 "actor_type": "company",
>                 "name": "Stripe"
>             },
>             "date_posted": "2026-08-29T07:17:40Z",
>             "engagement": {
>                 "total_reactions": 139
>             },
>             "share_url": "https://www.linkedin.com/posts/stripe_give-your-grok-bot-a-card-withlink-bots-activity-7499191937820889089-_uIY"
>         },
>         {
>             "actor": {
>                 "actor_type": "company",
>                 "name": "Stripe"
>             },
>             "date_posted": "2026-08-26T02:01:22Z",
>             "engagement": {
>                 "total_reactions": 253
>             },
>             "share_url": "https://www.linkedin.com/posts/stripe_john-collison-sits-down-with-canva-cofounder-ugcPost-7497853964009230337-P79J"
>         }
>     ],
>     "next_cursor": "H4sIAOIQqGoC_xXMTQrDIBBA4asE...",
>     "total_count": 720
> }
> ```

> [accordion] Founders announcing a raise, ranked by reactions
>
> Combine an exact phrase on `text` with a fuzzy title match and a date floor,
> then sort by `engagement.total_reactions`.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/social_post/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "text", "type": "[.]", "value": "we raised" },
>         { "field": "actor.title", "type": "(.)", "value": "founder" },
>         { "field": "date_posted", "type": "=>", "value": "2026-08-01" }
>       ]
>     },
>     "sorts": [{ "field": "engagement.total_reactions", "order": "desc" }],
>     "fields": ["share_url", "date_posted", "actor.name", "actor.title", "actor.company_name", "engagement.total_reactions", "engagement.total_comments"],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "posts": [
>         {
>             "actor": {
>                 "company_name": "MrBeast",
>                 "name": "Jimmy Donaldson",
>                 "title": "Founder"
>             },
>             "date_posted": "2026-08-05T01:22:04Z",
>             "engagement": {
>                 "total_comments": 477,
>                 "total_reactions": 9273
>             },
>             "share_url": "https://www.linkedin.com/posts/mr-beast_a-year-ago-we-raised-40-million-to-give-ugcPost-7490124665907212288-PdzW"
>         },
>         {
>             "actor": {
>                 "company_name": "Databricks",
>                 "name": "Ali Ghodsi",
>                 "title": "CEO and Co-founder"
>             },
>             "date_posted": "2026-08-19T22:30:41Z",
>             "engagement": {
>                 "total_comments": 164,
>                 "total_reactions": 5282
>             },
>             "share_url": "https://www.linkedin.com/posts/alighodsi_databricks-hits-190-billion-valuation-as-activity-7493675875033403392-HJI6"
>         }
>     ],
>     "next_cursor": "H4sIALEQqGoC_xWMQQrDIBBFrxJc...",
>     "total_count": 123
> }
> ```

> [accordion] Posts that mention a company
>
> `mentions.company_id` holds the Crustdata ids resolved from the company
> pages a post links to. Use it to find who is talking about a target account.
> The matching raw URLs sit in `hyperlinks.company_professional_network_urls`.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/social_post/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": { "field": "mentions.company_id", "type": "=", "value": 631394 },
>     "sorts": [{ "field": "date_posted", "order": "desc" }],
>     "fields": ["share_url", "date_posted", "actor.name", "actor.actor_type", "mentions", "hyperlinks.company_professional_network_urls"],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "posts": [
>         {
>             "actor": {
>                 "actor_type": "person",
>                 "name": "Khushali GUPTA"
>             },
>             "date_posted": "2026-08-30T03:40:01Z",
>             "hyperlinks": {
>                 "company_professional_network_urls": [
>                     "https://www.linkedin.com/company/2135371"
>                 ]
>             },
>             "mentions": {
>                 "company_ids": [631394],
>                 "person_ids": []
>             },
>             "share_url": "https://www.linkedin.com/posts/khushali-gupta-4823463a7_stripe-stripehiring-softwareengineerintern-activity-7499669796561522688-PkWR"
>         },
>         {
>             "actor": {
>                 "actor_type": "person",
>                 "name": "Aayush Jain"
>             },
>             "date_posted": "2026-08-30T01:47:49Z",
>             "hyperlinks": {
>                 "company_professional_network_urls": [
>                     "https://www.linkedin.com/company/12202",
>                     "https://www.linkedin.com/company/2135371",
>                     "https://www.linkedin.com/company/1482"
>                 ]
>             },
>             "mentions": {
>                 "company_ids": [780316, 1112754, 631394],
>                 "person_ids": []
>             },
>             "share_url": "https://www.linkedin.com/posts/aayush-jain-604384382_advent-and-stripe-just-walked-away-from-paypal-activity-7499372656367099904-srzX"
>         }
>     ],
>     "next_cursor": "H4sIAOYQqGoC_xWNQQrDIBAAvxI8...",
>     "total_count": 47259
> }
> ```

> [accordion] Hiring posts in one country, by hashtag
>
> `hashtags` is an array field, so `in` matches a post carrying any of the
> listed tags. Sort by `engagement.total_comments` to surface the posts that
> drew the most replies.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/social_post/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "hashtags", "type": "in", "value": ["hiring", "wearehiring"] },
>         { "field": "actor.location.country", "type": "=", "value": "India" },
>         { "field": "date_posted", "type": "=>", "value": "2026-09-01" }
>       ]
>     },
>     "sorts": [{ "field": "engagement.total_comments", "order": "desc" }],
>     "fields": ["share_url", "hashtags", "actor.name", "actor.location", "engagement.total_comments"],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "posts": [
>         {
>             "actor": {
>                 "location": {
>                     "raw": "Indore, Madhya Pradesh, India",
>                     "city": "Indore",
>                     "state": "Madhya Pradesh",
>                     "country": "India",
>                     "continent": "Asia"
>                 },
>                 "name": "Apoorv Chaturvedi"
>             },
>             "engagement": {
>                 "total_comments": 80
>             },
>             "hashtags": ["marketing", "ai", "hiring", "india"],
>             "share_url": "https://www.linkedin.com/posts/apoorv4vedi_marketing-ai-hiring-activity-7500436104886616065-bHLQ"
>         },
>         {
>             "actor": {
>                 "location": {
>                     "raw": "Mumbai, Maharashtra, India",
>                     "city": "Mumbai",
>                     "state": "Maharashtra",
>                     "country": "India",
>                     "continent": "Asia"
>                 },
>                 "name": "Dharmik harinkhede"
>             },
>             "engagement": {
>                 "total_comments": 14
>             },
>             "hashtags": ["career", "jobs", "hiring", "SDE", "remote", "freshers"],
>             "share_url": "https://www.linkedin.com/posts/dharmik-harinkhede-b51077199_hiring-alert-for-freshers-apply-now-activity-7500396960609099776-ewqs"
>         }
>     ],
>     "next_cursor": "H4sIAOkQqGoC_xWMywqDMBAAf0Vy...",
>     "total_count": 24
> }
> ```

> [accordion] Posts a founder praised where an engineer commented
>
> Conditions on `reactors.*` inside one `and` group bind to the **same
> reactor**: a founder whose reaction was specifically `PRAISE`. The
> `comments.title` condition is evaluated independently against the
> commenters. See
> [Nested-array matching](https://docs.crustdata.com/social-post-docs/indexed-search/reference.md#nested-array-matching-all_of-and-has_all)
> for the cross-element form.
>
> > [!WARNING]
> >
> > `reactors` and `comments` come back in full. This post carries 2,750
> > reactors and 320 comments. Request these arrays only when you need them.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/social_post/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "reactors.title", "type": "(.)", "value": "founder" },
>         { "field": "reactors.reaction_type", "type": "=", "value": "PRAISE" },
>         { "field": "comments.title", "type": "(.)", "value": "engineer" }
>       ]
>     },
>     "sorts": [{ "field": "engagement.total_reactions", "order": "desc" }],
>     "fields": ["share_urn", "text", "actor.name", "engagement.total_reactions", "engagement.total_comments", "reactors", "comments"],
>     "limit": 1
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "posts": [
>         {
>             "actor": {
>                 "name": "Sizwe Mthanti"
>             },
>             "comments": [
>                 {
>                     "commenter": {
>                         "actor_type": "person",
>                         "company": "Bioapps SW LLP",
>                         "crustdata_entity_id": 157421276,
>                         "headline": "Commercial Director | Country Manager | Business Unit Leader | P&L Leadership | Life Scien ...",
>                         "location": "Bengaluru, Karnataka, India",
>                         "name": "Avinash Sahoo",
>                         "professional_network_url": "https://www.linkedin.com/in/avinash-sahoo-sales-director",
>                         "professional_network_urn": "https://www.linkedin.com/in/ACoAAAEjk48BQXdvlI1qpk4n4dh-CHaw00aOLHM",
>                         "title": "Co-Founder"
>                     },
>                     "comment_reactions": {
>                         "APPRECIATION": 0,
>                         "EMPATHY": 0,
>                         "ENTERTAINMENT": 0,
>                         "INTEREST": 0,
>                         "LIKE": 0,
>                         "PRAISE": 0
>                     },
>                     "comment_text": "Amazing 🤩",
>                     "comment_urn": "urn:li:fsd_comment:(7484642627158663169,urn:li:ugcPost:7484109065682481152)",
>                     "created_at": "2026-07-19T16:17:40Z",
>                     "permalink": "https://www.linkedin.com/feed/update/urn:li:ugcPost:7484109065682481152?commentUrn=..."
>                 }
>             ],
>             "engagement": {
>                 "total_comments": 320,
>                 "total_reactions": 18470
>             },
>             "reactors": [
>                 {
>                     "reaction_type": "APPRECIATION",
>                     "reactor": {
>                         "actor_type": "person",
>                         "company": "Investec",
>                         "crustdata_entity_id": 175429237,
>                         "headline": "Platform Lead: Client, Content & Communication (CCnC)",
>                         "location": "City of Johannesburg, Gauteng, South Africa",
>                         "name": "Mumtaz Ally (MBA)",
>                         "professional_network_url": "https://www.linkedin.com/in/mumtaz-ally-mba-8a188950",
>                         "professional_network_urn": "https://www.linkedin.com/in/ACoAAArO6bkB5IR29s6f7AVxmQtiOToHNKz48E8",
>                         "title": "Platform Lead: Client, Content & Communication"
>                     }
>                 },
>                 {
>                     "reaction_type": "LIKE",
>                     "reactor": {
>                         "actor_type": "person",
>                         "company": "Alpha Events",
>                         "crustdata_entity_id": 40624318,
>                         "headline": "Connecting the Full Chain of Women's Health Adoption | Closing the Sex-Specific Data Gap | ...",
>                         "location": "London, England, United Kingdom",
>                         "name": "Lewis Price",
>                         "professional_network_url": "https://www.linkedin.com/in/lewis-price-2332357a",
>                         "professional_network_urn": "https://www.linkedin.com/in/ACoAABDDjgcBLAJ2hdKeupzzmZ9h3p9rP8RIaoE",
>                         "title": "Enterprise Business Development Manager"
>                     }
>                 }
>             ],
>             "share_urn": "urn:li:ugcPost:7484109065682481152",
>             "text": "I'm thrilled to announce that I have resigned from my current Job.\n\nCelebrating this milestone because I've learnd that quitting the wrong t ..."
>         }
>     ],
>     "next_cursor": "H4sIAIoKqGoC_xWMQQ7CIBBFr9Kw...",
>     "total_count": 10240
> }
> ```
>
> The response is cut to the first two reactors and the first comment. The
> arrays hold every reactor and commenter, not only the ones that matched, so
> filter them client-side when you need the matching elements.

> [accordion] Posts with a document attachment from one company's employees
>
> `content_type` is a filter-only field that matches posts carrying a given
> attachment class: `document`, `article`, `poll`, `video`, or `image`. The
> matching attachment comes back in its own object.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/social_post/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "content_type", "type": "=", "value": "document" },
>         { "field": "actor.company_name", "type": "=", "value": "Stripe" }
>       ]
>     },
>     "sorts": [{ "field": "date_posted", "order": "desc" }],
>     "fields": ["share_url", "date_posted", "document.title", "document.page_count", "actor.name", "actor.company_name"],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "posts": [
>         {
>             "actor": {
>                 "company_name": "Stripe",
>                 "name": "Shivaprasad Gujarathi"
>             },
>             "date_posted": "2026-08-21T02:45:42Z",
>             "document": {
>                 "page_count": 1,
>                 "title": "Resume - Shivaprasad - Full Stack Developer"
>             },
>             "share_url": "https://www.linkedin.com/posts/shivaprasad-gujarathi-70908632a_resume-shivaprasad-full-stack-developer-activity-7496315282991439872-SY0S"
>         },
>         {
>             "actor": {
>                 "company_name": "Stripe",
>                 "name": "Zain Abiddin"
>             },
>             "date_posted": "2026-08-08T02:24:50Z",
>             "document": {
>                 "page_count": 3,
>                 "title": "What Lovable, Notion, and Gemini Get Right"
>             },
>             "share_url": "https://www.linkedin.com/posts/zainabiddin_what-lovable-notion-and-gemini-get-right-activity-7491123467568926720-e2ER"
>         }
>     ],
>     "next_cursor": "H4sIALERqGoC_xXMQQ7CIBBA0as0...",
>     "total_count": 507
> }
> ```

> [accordion] Hiring hashtags from authors within 25 km of a city
>
> `geo_distance` on `actor.location` keeps posts whose author is located
> within the radius. The server geocodes the `location` string, or pass
> `lat_lng` to skip that step. Hashtag matching is case-insensitive.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/social_post/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         {
>           "field": "actor.location",
>           "type": "geo_distance",
>           "value": { "location": "Bengaluru", "distance": 25, "unit": "km" }
>         },
>         { "field": "hashtags", "type": "=", "value": "hiring" }
>       ]
>     },
>     "fields": ["share_url", "actor.name", "actor.location", "hashtags"],
>     "limit": 2
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "posts": [
>         {
>             "actor": {
>                 "location": {
>                     "raw": "Bengaluru, Karnataka, India",
>                     "city": "Bengaluru",
>                     "state": "Karnataka",
>                     "country": "India",
>                     "continent": "Asia"
>                 },
>                 "name": "Hiba Niyaz"
>             },
>             "hashtags": ["1", "Hiring", "Presales", "NoBroker", "ProptechJobs", "SalesJobs", "Bangalore", "JobOpening", "workfromhome"],
>             "share_url": "https://www.linkedin.com/posts/hiba-niyaz_hiring-presales-nobroker-activity-7500831749824819201-4y3m"
>         },
>         {
>             "actor": {
>                 "location": {
>                     "raw": "Bengaluru, Karnataka, India",
>                     "city": "Bengaluru",
>                     "state": "Karnataka",
>                     "country": "India",
>                     "continent": "Asia"
>                 },
>                 "name": "Ankita Gantayat"
>             },
>             "hashtags": ["Hiring", "Flutter", "MobileDevelopment", "VendorPartners", "BenchResources", "MarketResources", "C2C", "RemoteJobs", "Mobillor", "ITSupport", "Collaboration", "AIEngineering"],
>             "share_url": "https://www.linkedin.com/posts/ankita-gantayat_hiring-sr-flutter-mobility-developer-activity-7500794955607486464-ke9Q"
>         }
>     ],
>     "next_cursor": "H4sIAJEKqGoC_xXMTQqDMBBA4atI...",
>     "total_count": 604058
> }
> ```

> [accordion] Count matching posts without returning rows
>
> Set `limit` to `0`. The response carries `total_count` only, and the request
> costs nothing.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/social_post/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": { "field": "post_type", "type": "in", "value": ["repost_quote", "repost_without_thoughts"] },
>     "limit": 0
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "posts": [],
>     "next_cursor": null,
>     "total_count": 225197543
> }
> ```

> [accordion] Walk a result set with the cursor
>
> Send the same body again with `cursor` set to the previous `next_cursor`.
> Keep `filters`, `sorts`, and `fields` identical between pages.
>
> ```bash Page 1 theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/social_post/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "actor.company_name", "type": "=", "value": "Stripe" },
>         { "field": "actor.actor_type", "type": "=", "value": "person" }
>       ]
>     },
>     "sorts": [{ "field": "date_posted", "order": "desc" }],
>     "fields": ["share_urn", "date_posted", "actor.name"],
>     "limit": 2
>   }'
> ```
>
> ```json Page 1 response theme={"theme":"vitesse-black"}
> {
>     "posts": [
>         {
>             "actor": { "name": "Andrew Wang" },
>             "date_posted": "2026-09-01T04:10:30Z",
>             "share_urn": "urn:li:share:7500355663261249536"
>         },
>         {
>             "actor": { "name": "Ekenekamchukwu Ezeala" },
>             "date_posted": "2026-08-28T06:30:21Z",
>             "share_urn": "urn:li:share:7498989462585122816"
>         }
>     ],
>     "next_cursor": "H4sIALUQqGoC_xWMQQrDIBBFrxJc...",
>     "total_count": 67909
> }
> ```
>
> ```bash Page 2 theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/social_post/search \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "filters": {
>       "op": "and",
>       "conditions": [
>         { "field": "actor.company_name", "type": "=", "value": "Stripe" },
>         { "field": "actor.actor_type", "type": "=", "value": "person" }
>       ]
>     },
>     "sorts": [{ "field": "date_posted", "order": "desc" }],
>     "fields": ["share_urn", "date_posted", "actor.name"],
>     "limit": 2,
>     "cursor": "H4sIALUQqGoC_xWMQQrDIBBFrxJc..."
>   }'
> ```
>
> ```json Page 2 response theme={"theme":"vitesse-black"}
> {
>     "posts": [
>         {
>             "actor": { "name": "Kate Congyi Li" },
>             "date_posted": "2026-08-27T18:54:28Z",
>             "share_urn": "urn:li:share:7498805548641832960"
>         },
>         {
>             "actor": { "name": "Janelle Henry" },
>             "date_posted": "2026-08-26T10:10:10Z",
>             "share_urn": "urn:li:share:7498087892515180544"
>         }
>     ],
>     "next_cursor": "H4sIALYQqGoC_xWMQQrDIBAAvxI8...",
>     "total_count": 67909
> }
> ```

## What to do next

* **Look up fields and operators**: see [Social Post Search reference](https://docs.crustdata.com/social-post-docs/indexed-search/reference.md) for the filter grammar, every filterable and sortable field, the response catalog, and errors.
* **Resolve an author to an id**: use [Person Search](https://docs.crustdata.com/person-docs/search/introduction.md) or [Company Identify](https://docs.crustdata.com/company-docs/identify/introduction.md), then filter on `actor.crustdata_entity_id`. Person ids and company ids are separate id spaces, so add `actor.actor_type` set to `person` or `company` to say which one you mean.
* **Get the freshest posts for one account**: see [Enrich Social Posts](https://docs.crustdata.com/social-post-docs/enrichment/introduction.md).
* **Run a real-time keyword search**: see [Search Social Posts](https://docs.crustdata.com/social-post-docs/search/introduction.md).
* **Inspect the full schema**: read the [OpenAPI reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md).


## Related topics

- [Social Post Watcher](https://docs.crustdata.com/watcher-docs/social-post/discovery.md)
- [Company Enrichment API](https://docs.crustdata.com/company-docs/enrichment/introduction.md)
- [Person Enrichment API](https://docs.crustdata.com/person-docs/enrichment/introduction.md)
- [Capabilities](https://docs.crustdata.com/general/capabilities.md)
- [Social Post Search](https://docs.crustdata.com/api-reference/social-post-apis/search-the-social-post-dataset.md)
