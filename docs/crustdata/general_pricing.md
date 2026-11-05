> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Pricing

> Learn how Crustdata credits work, what common endpoints cost, and how to estimate usage before you ship.

> [!WARNING]
>
> Pricing can change by plan, entitlement, and endpoint version. Confirm the
> current credit cost in your dashboard or with the Crustdata team before you
> plan production usage.

Crustdata uses a credit model across its APIs. Use low-cost search endpoints
to narrow your list, then enrich only the records you want to inspect in
detail.

> [card] [Search first](https://docs.crustdata.com/person-docs/search/introduction.md)
>
> Use search endpoints for low-cost discovery, then enrich only the
> records you want to keep.

> [card] [Enrich selectively](https://docs.crustdata.com/person-docs/enrichment/introduction.md)
>
> Person enrich starts with a base profile and adds cost only when you ask
> for higher-value data.

> [card] [Plan for live endpoint usage](https://docs.crustdata.com/general/rate-limits.md)
>
> Web live endpoints are available on self-serve plans. Company and Person
> live endpoints remain plan-gated.

Purchased credits are valid for **12 months** from the purchase date.
Credits granted by your account manager may carry a custom expiry.

## Self-serve endpoint pricing

This page lists pricing for the endpoints currently documented in this docs
site. It does not include unpublished or not-yet-documented routes.

Use these tables to estimate common self-serve search, identify, and enrich
costs. To see what a call actually cost, read the
[`X-Credits-Used` response header](https://docs.crustdata.com/general/credits#per-call-usage-the-x-credits-used-header)
returned on every request.

### Your account's own prices

The tables below are standard list prices. If your account is on a negotiated
or contract rate, the prices you pay are returned by
[`GET /account/endpoints`](https://docs.crustdata.com/general/permissions) — one free call, no credits,
every endpoint with its `base_credits` and any per-field or per-flag extras
priced for *your* account. It is the authoritative answer to "what does this
cost me", and a cost estimator can read it directly:

```bash Request theme={"theme":"vitesse-black"}
curl --request GET \
  --url 'https://api.crustdata.com/account/endpoints?path=/person/enrich' \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'x-api-version: 2025-11-01'
```

```json Response theme={"theme":"vitesse-black"}
{
  "api_version": "2025-11-01",
  "token_limit_rpm": null,
  "endpoints": [
    {
      "path": "/person/enrich",
      "category": "Person",
      "status": "enabled",
      "effective_rate_limit_rpm": 20,
      "fields": { "enabled": ["basic_profile", "..."], "disabled": [] },
      "base_credits": 1,
      "premium_fields": [
        { "field": "contact.business_emails", "credits": 1 },
        { "field": "contact.personal_emails", "credits": 2 },
        { "field": "contact.phone_numbers", "credits": 2 },
        { "field": "dev_platform_profiles", "credits": 1 },
        { "field": "social_posts", "credits": 5 }
      ]
    }
  ]
}
```

The field lists are trimmed above; the live response carries every enabled and
disabled path. See [Permissions](https://docs.crustdata.com/general/permissions.md#how-to-read-the-prices)
for how to read `premium_filters`, `premium_fields`, and `premium_modes`.

You can also see your prices in the [dashboard](https://app.crustdata.com/endpoints).
The "Your price" column in each endpoint table below links to the **Pricing**
tab of that endpoint. The tab shows the prices for your account.

* The link works only for an endpoint enabled for your account. For any other
  endpoint, the dashboard opens your endpoint list.
* A batch endpoint links to the tab of its non-batch endpoint, because batch
  costs the same. For example, `/batch/person/search` links to the tab of
  `/person/search`.
* A free endpoint has no link.
* A watcher row links to the dashboard watch builder instead, because
  `/account/endpoints` does not carry watch prices. The link opens the builder
  on that watcher and that SLA. The screen quotes your price per record. The
  3-day tier has no link, because the builder does not offer it.

### Premium fields in search

Search charges a base price per result, plus a per-field price for premium
fields. The two sides are billed independently: **filtering** on a premium
field is one charge, **receiving** it in the response is another, and sorting
on one is free. Both are per result. A request that touches no premium field
pays the base price alone.
A premium group you request that comes back `null`, because the record has no
data for it, is not billed.

Prices below are standard list prices; call
[`/account/endpoints`](https://docs.crustdata.com/general/permissions) for the prices on your account,
and for which of these fields your plan can use today.

#### Person search

| Field group | Filter | Response |
| - | - | - |
| Basic profile | Base price — **0.03** | — |
| Experience *(incl. recently changed jobs)* | **0.1** | **0.1** |
| Education | **0.1** | **0.1** |
| Skills | **0.1** | **0.1** |
| Certifications | **0.2** | **0.2** |
| Professional network *(followers, connections, open to card, languages)* | **0.2** | **0.2** |
| Summary | — | **0.2** |
| Honors | **0.2** | **0.2** |
| Dev platform profiles *(basic GitHub info)* | **0.8** | — |
| Dev platform profiles *(repositories)* | **2.5** | — |
| Research profiles *(academic author profiles, enabled on request)* | **0.4** | **0.4** |

A group is one charge however many of its members you touch: languages rides
professional network, recently changed jobs rides experience. Summary is
response-only, and the dev platform groups are filter-only — search never
returns them, so only the filter side bills. A result that touches every
returnable premium field costs **2.03** credits, or **2.43** with research
profiles; the GitHub units add **0.8** (basic) or **2.5** (repositories) per
result on the filter side. Research profiles are enabled per account, see
[Research profiles](https://docs.crustdata.com/person-docs/search/reference.md#research-profiles).

#### Company search

| Field group | Filter | Response |
| - | - | - |
| Basic | Base price — **0.03** | — |
| Taxonomy | **0.1** | **0.1** |
| Followers | **0.2** | **0.2** |
| Headcount *(incl. headcount by function)* | **0.2** | **0.2** |
| Funding | **0.2** | **0.2** |
| Hiring | **0.2** | **0.2** |
| Software reviews | **0.2** | **0.2** |
| Maps | **0.2** | **0.2** |
| Technographics | **1** | — |

Technographics is filter-only — search never returns it, so only the filter
side bills. More company groups (market intel, SEO, web traffic, news,
employee reviews, people) are on the way; they will appear here and in
[`/account/endpoints`](https://docs.crustdata.com/general/permissions) as they become available.

### Person endpoints

| Endpoint | Credit usage | Notes | Your price |
| - | - | - | - |
| `/person/search` | **0.03** per result + premium groups | Best for low-cost discovery and filtering. A premium group bills on top when you filter on it and again when you receive it, see [Premium fields in search](#premium-fields-in-search). | [Dashboard](https://app.crustdata.com/endpoints/person-search#pricing) |
| `/person/search/autocomplete` | **Free** | Use for typeahead and filter builders. | Free |
| `/person/enrich` | **1-9** per record | Starts with a base profile and scales with requested data. `research_profiles` (enabled on request) adds **+2** per person with a profile. | [Dashboard](https://app.crustdata.com/endpoints/person-enrich#pricing) |
| `/person/identify` | **1** per match | Resolve a profile URL, email, or Google Scholar profile URL to a `crustdata_person_id`. Unmatched identifiers are free. Enabled per account. | Not in the dashboard |
| `/person/contact/enrich` | **1-5.5** per matched person | Billed per requested contact type, no base credit. `verified: true` adds 0.5. Enterprise plans. | [Dashboard](https://app.crustdata.com/endpoints/person-contact-enrich#pricing) |
| `/batch/person/contact/enrich` | **1-5.5** per matched person | Same per-type prices and `verified` add-on as `/person/contact/enrich`. Enterprise plans. | [Dashboard](https://app.crustdata.com/endpoints/person-contact-enrich#pricing) |
| `/dev_platform/enrich` | **1** per result | Available on enterprise plans. | [Dashboard](https://app.crustdata.com/endpoints/dev_platform-enrich#pricing) |

### Company endpoints

| Endpoint | Credit usage | Notes | Your price |
| - | - | - | - |
| `/company/search` | **0.03** per result + premium groups | Lightweight company discovery. A premium group bills on top when you filter on it and again when you receive it, see [Premium fields in search](#premium-fields-in-search). | [Dashboard](https://app.crustdata.com/endpoints/company-search#pricing) |
| `/company/search/autocomplete` | **Free** | Useful for search UX and filter pickers. | Free |
| `/company/enrich` | **2-4** per record | Base **2**; requesting `technographics` adds **+2** per company that returns technographics data. | [Dashboard](https://app.crustdata.com/endpoints/company-enrich#pricing) |
| `/company/identify` | **Free** | Resolve a company from a domain or other supported identifier. | Free |
| `/employee_review/enrich` | **1** per company | Available on enterprise plans. | [Dashboard](https://app.crustdata.com/endpoints/employee_review-enrich#pricing) |

### Job endpoints

| Endpoint | Credit usage | Notes | Your price |
| - | - | - | - |
| `/job/search` | **0.03** per result | Indexed job discovery, filtering, and hiring analysis. | [Dashboard](https://app.crustdata.com/endpoints/job-search#pricing) |

### Web endpoints

| Endpoint | Credit usage | Notes | Your price |
| - | - | - | - |
| `/web/search/live` | **1** per query | Web search. Available on self-serve and enterprise plans. | [Dashboard](https://app.crustdata.com/endpoints/web-search-live#pricing) |
| `/web/enrich/live` | **1** per page | Web page fetch. Available on self-serve and enterprise plans. | [Dashboard](https://app.crustdata.com/endpoints/web-enrich-live#pricing) |

### Social Post endpoints

| Endpoint | Credit usage | Notes | Your price |
| - | - | - | - |
| `/social_post/search` | **0.5** per post | Indexed social post search with structured filters. `limit: 0` counts are free. Enabled on request. | [Dashboard](https://app.crustdata.com/endpoints/social_post-search#pricing) |
| `/social_post/professional_network/search/live` | **1** per post · **+5** per 100 reactors · **+5** per 100 comments, counted per post. `exact_keyword_match` does not change the price. | Available on enterprise plans. | [Dashboard](https://app.crustdata.com/endpoints/social_post-professional_network-search-live#pricing) |
| `/social_post/professional_network/enrich/live` | **1** per post · **+5** per 100 reactors · **+5** per 100 comments, counted per post | Available on enterprise plans. | [Dashboard](https://app.crustdata.com/endpoints/social_post-professional_network-enrich-live#pricing) |

### Watcher endpoints

Every watcher is priced by its SLA: how fresh the data behind a notification is kept, written as `config.refresh_frequency_days`. A 1-day SLA refreshes daily, which is the level a realtime watch runs at.

| Endpoint | 30-day SLA (default) | 1-day SLA | Notes | Your price |
| - | - | - | - | - |
| `/watch/person/search` | **0.5** per new person | **150** per new person | Discovery watcher. First run is a free baseline (up to 5 matches). | [30-day](https://app.crustdata.com/watch?type=discovery\&dataset=person\&sla=30) · [1-day](https://app.crustdata.com/watch?type=discovery\&dataset=person\&sla=1) |
| `/watch/company/search` | **2** per new company | **150** per new company | Discovery watcher. First run is a free baseline (up to 5 matches). | [30-day](https://app.crustdata.com/watch?type=discovery\&dataset=company\&sla=30) · [1-day](https://app.crustdata.com/watch?type=discovery\&dataset=company\&sla=1) |
| `/watch/job/search` | **0.5** per new job | **150** per new job | Discovery watcher. First run is a free baseline (up to 5 matches). | [30-day](https://app.crustdata.com/watch?type=discovery\&dataset=job\&sla=30) · [1-day](https://app.crustdata.com/watch?type=discovery\&dataset=job\&sla=1) |
| `/watch/social_post/search` | **2** per new post | **150** per new post | Discovery watcher. First run is a free baseline (up to 5 matches). | [30-day](https://app.crustdata.com/watch?type=discovery\&dataset=social_post\&sla=30) · [1-day](https://app.crustdata.com/watch?type=discovery\&dataset=social_post\&sla=1) |
| `/watch/person` | **5** per changed entity | **150** per changed entity | Entity watcher. First run is a free baseline; no charge on runs with no change. Three SLA tiers in between (see below). | [30-day](https://app.crustdata.com/watch?type=list\&dataset=person\&sla=30) · [14-day](https://app.crustdata.com/watch?type=list\&dataset=person\&sla=14) · [7-day](https://app.crustdata.com/watch?type=list\&dataset=person\&sla=7) · [1-day](https://app.crustdata.com/watch?type=list\&dataset=person\&sla=1) |
| `/watch/company` | **5** per changed company | Not available | Entity watcher. 30-day SLA only. First run is a free baseline; no charge on runs with no change. | [30-day](https://app.crustdata.com/watch?type=list\&dataset=company\&sla=30) |

**How you ask for a 1-day SLA depends on the watcher.** A discovery watch takes `config.is_realtime: true`, which searches the web live on each run rather than reading the index; the key is what puts the watch on the 1-day SLA, and the create response echoes `config.refresh_frequency_days: 1`. A person entity watch takes `config.refresh_frequency_days: 1` directly. Either way the rate is the same 150 credits per delivered record.

A 1-day SLA discovery watch runs once a day at most, so `config.trigger.every_hours` must be `24` or more. The filter fields each dataset's live search accepts are on its own watcher page: [Person](https://docs.crustdata.com/watcher-docs/person/discovery.md#realtime-watches), [Company](https://docs.crustdata.com/watcher-docs/company/discovery.md#realtime-watches), [Job](https://docs.crustdata.com/watcher-docs/job/watch.md#realtime-watches), [Social Post](https://docs.crustdata.com/watcher-docs/social-post/discovery.md#realtime-watches).

You're charged only for what's delivered on recurring runs. A discovery run that finds nothing new, or an entity run where nothing changed, costs nothing. Each watcher lives under its dataset. [Person](https://docs.crustdata.com/watcher-docs/person/entity.md) and [Company](https://docs.crustdata.com/watcher-docs/company/entity.md) each have an Entity and a Discovery watcher; [Job](https://docs.crustdata.com/watcher-docs/job/watch.md) and [Social Post](https://docs.crustdata.com/watcher-docs/social-post/discovery.md) have a Discovery watcher only.

A **person** entity watcher has three SLA tiers between the two ends of the table above. The rate is tiered by `config.refresh_frequency_days` and does not depend on how often the watch runs.

| SLA (`refresh_frequency_days`) | Credits per changed entity | Your price |
| - | - | - |
| not set / `30` (default) | 5 | [Dashboard](https://app.crustdata.com/watch?type=list\&dataset=person\&sla=30) |
| `14` | 10 | [Dashboard](https://app.crustdata.com/watch?type=list\&dataset=person\&sla=14) |
| `7` | 20 | [Dashboard](https://app.crustdata.com/watch?type=list\&dataset=person\&sla=7) |
| `3` | 50 | Not in the dashboard |
| `1` | 150 | [Dashboard](https://app.crustdata.com/watch?type=list\&dataset=person\&sla=1) |

Company entity watchers run at the 30-day SLA only (5 credits per changed company).

## Batch endpoint

| Endpoint | Credit usage | Notes | Your price |
| - | - | - | - |
| `/batch/company/search` | **0.03** per result + premium groups | Same as company search pricing, premium groups included. | [Dashboard](https://app.crustdata.com/endpoints/company-search#pricing) |
| `/batch/company/enrich` | **2-4** per record | Same as company enrich pricing, including the `technographics` add-on. | [Dashboard](https://app.crustdata.com/endpoints/company-enrich#pricing) |
| `/batch/company/professional_network/search/live` | **2** per company | Same as live company search pricing. | [Dashboard](https://app.crustdata.com/endpoints/company-professional_network-search-live#pricing) |
| `/batch/person/search` | **0.03** per result + premium groups | Same as person search pricing, premium groups included. | [Dashboard](https://app.crustdata.com/endpoints/person-search#pricing) |
| `/batch/person/enrich` | **1-9** per record | Same as person enrich pricing, including the `research_profiles` add-on. | [Dashboard](https://app.crustdata.com/endpoints/person-enrich#pricing) |
| `/batch/person/professional_network/search/live` | **2** per profile | Same as live people search pricing. | [Dashboard](https://app.crustdata.com/endpoints/person-professional_network-search-live#pricing) |
| `/batch/person/professional_network/enrich/live` | **7** per profile | Same as live people enrich pricing. | [Dashboard](https://app.crustdata.com/endpoints/person-professional_network-enrich-live#pricing) |
| `/batch/person/identify` | **1** per match | Reverse email lookup. Only emails that resolve to a person are billed; unmatched are free. Enabled per account. | Not in the dashboard |
| `/batch/person/verify` | **10** per result | Work-history verification. One result is one verdict. A profile that does not reach a verdict is left out of the results file and is free. Enabled per account. | [Dashboard](https://app.crustdata.com/endpoints/batch-person-verify#pricing) |
| `/batch/job/search` | **0.03** per result | Same as job search pricing. | [Dashboard](https://app.crustdata.com/endpoints/job-search#pricing) |
| `/batch/social_post/professional_network/enrich/live` | **1** per post · **+5** per 100 reactors · **+5** per 100 comments, counted per post | Same as social post enrich pricing. Enterprise plans. | [Dashboard](https://app.crustdata.com/endpoints/social_post-professional_network-enrich-live#pricing) |
| `/batch/{batch_id}` | **Free** | Current pricing assumption: batch status checks are non-billable. | Free |
| `/batch/` | **Free** | Current pricing assumption: batch listing is non-billable. | Free |

## Person enrich pricing

Person enrich uses additive pricing. You pay for the base profile first, then
add credits only for the extra data you request.

| Data returned | Additional credits | What you get |
| - | - | - |
| Base profile | **1** | Core person identity, role, location, experience, education, certifications, skills, and social handles |
| Personal email data | **+2** | Personal email details |
| Phone data | **+2** | Direct phone numbers |
| Business email data | **+1** | Verified business email details |
| Developer platform data | **+1** | Developer platform profile, repos, orgs, and activity |
| Research profiles | **+2** | Matched academic author profiles with citation metrics, articles, and co-authors. Enabled on request, and charged only for a person with at least one profile. See [`research_profiles` fields](https://docs.crustdata.com/person-docs/enrichment/reference#research_profiles-fields). |

The maximum current cost for a single enriched person record is **9 credits**.
The base credit is charged once per matched record.

### Common credit patterns

| Use case | Typical data requested | Credits |
| - | - | - |
| Basic profile lookup | Base profile only | **1** |
| Sales outreach | Base profile + business email | **2** |
| Full outbound prospecting | Base profile + business email + phone | **4** |
| Recruiting with personal contact data | Base profile + personal email + phone | **5** |
| Maximum person enrich payload | Base profile + all add-ons | **9** |

## Person Contact pricing

[`/person/contact/enrich`](https://docs.crustdata.com/person-docs/contact/enrich) bills **per requested
contact type, per matched person — there is no base credit** (the endpoint
returns contact data only).

| Contact type requested | Credits per matched person |
| - | - |
| `contact.business_emails` | **1** |
| `contact.personal_emails` | **2** |
| `contact.phone_numbers` | **2** |

Only the types you request are fetched and billed. Omitting `fields` requests
all three (**5** per matched person, the maximum without `verified`).
`contact.phone_numbers_info` belongs to the phone tier and bills the same **2**
once, with or without `contact.phone_numbers`.
`contact.websites` is not one of the billed contact types, so requesting it
currently uses **0** credits. Identifiers with no match are not billed.

Set `verified: true` to return only business emails that pass a deliverability
check at request time. Each matched person who receives at least one verified
business email costs **0.5** more, so business emails alone cost **1.5** and
all three types cost **5.5**. You pay nothing for the add-on on a person whose
verified list comes back empty. See [Verified business emails
only](https://docs.crustdata.com/person-docs/contact/enrich.md#verified-business-emails-only).

[`/batch/person/contact/enrich`](https://docs.crustdata.com/person-docs/contact/batch) bills the same
per-type prices and the same `verified` add-on, per matched person (maximum
**5.5**), counted per type, not per record (four business-email candidates
count once).

## Person enrich request examples

Use these examples to enrich by profile URL, request specific fields, or
reverse-lookup a person from a business email.

```bash Base profile request (1 credit) theme={"theme":"vitesse-black"}
curl --request POST \
    --url https://api.crustdata.com/person/enrich \
    --header 'authorization: Bearer YOUR_API_KEY' \
    --header 'content-type: application/json' \
    --header 'x-api-version: 2025-11-01' \
    --data '{
        "professional_network_profile_urls": [
            "https://www.linkedin.com/in/abhilashchowdhary"
        ]
    }'
```

```bash Request specific fields theme={"theme":"vitesse-black"}
curl --request POST \
    --url https://api.crustdata.com/person/enrich \
    --header 'authorization: Bearer YOUR_API_KEY' \
    --header 'content-type: application/json' \
    --header 'x-api-version: 2025-11-01' \
    --data '{
        "professional_network_profile_urls": [
            "https://www.linkedin.com/in/abhilashchowdhary"
        ],
        "fields": [
            "basic_profile.summary",
            "professional_network.followers"
        ]
    }'
```

> [!NOTE]
>
> For full request patterns and field selection behavior, see [Person
> enrichment](https://docs.crustdata.com/person-docs/enrichment/introduction.md).

## Enterprise-only and plan-gated live endpoint pricing

Company and Person live endpoints are plan-gated and can have custom quotas or
contract pricing.

> [!NOTE]
>
> Web Search and Web Fetch are available on self-serve plans. The live Company
> and Person endpoints below still require the right plan or enterprise
> access.

### Live people, company, and job data

| Endpoint | Credit usage | Notes | Your price |
| - | - | - | - |
| `/person/professional_network/search/live` | **2** per profile | Fresh live people search. | [Dashboard](https://app.crustdata.com/endpoints/person-professional_network-search-live#pricing) |
| `/person/professional_network/enrich/live` | **7** per profile | Fresh profile retrieval when cached enrich is not enough. | [Dashboard](https://app.crustdata.com/endpoints/person-professional_network-enrich-live#pricing) |
| `/company/professional_network/search/live` | **2** per company | Fresh live company search. | [Dashboard](https://app.crustdata.com/endpoints/company-professional_network-search-live#pricing) |
| `/job/professional_network/search/live` | **2** per result | Fresh live job search for a single company. | [Dashboard](https://app.crustdata.com/endpoints/job-professional_network-search-live#pricing) |

### Shared live-search endpoints

| Endpoint | Credit usage | Notes | Your price |
| - | - | - | - |
| `/professional_network/search/autocomplete` | **Free** | Shared live-search autocomplete when enabled for your account. | Free |

## Free endpoints

These endpoints do not currently consume credits:

* `/person/search/autocomplete`
* `/company/search/autocomplete`
* `/company/identify`
* `/professional_network/search/autocomplete` (when enabled for your
  enterprise plan)

## Search vs enrich

| If you need to... | Best endpoint type | Why |
| - | - | - |
| Explore a large audience cheaply | Search | Search is priced for discovery and returns lightweight records. |
| Build full profiles or contact-ready records | Enrich | Enrich returns detailed person or company data. |
| Power typeahead or filter suggestions | Autocomplete | Autocomplete is free and designed for interactive search UIs. |

## Estimate usage before you launch

**1. List the endpoints your workflow will call**

Separate self-serve, enterprise live, and utility requests. They are not
billed in the same way.

**2. Estimate returned records per request**

Search pricing depends on results returned, not only the number of
calls.

**3. Account for optional data and live modes**

Contact data, developer platform data, and enterprise live workflows can
raise per-record cost.

**4. Multiply by daily volume**

Model normal traffic first, then add weekly or monthly growth
assumptions.

**5. Add a buffer for retries and spikes**

Keep headroom for queue bursts, replay jobs, and production debugging.

## Rate limit considerations

Default rate limits vary by endpoint, ranging from 10 requests per minute on live (real-time) endpoints to 45 requests per minute on autocomplete endpoints. See [Rate limits](https://docs.crustdata.com/general/rate-limits.md) for the full per-endpoint table.

For throughput planning, see [Rate limits](https://docs.crustdata.com/general/rate-limits.md).

## Buying credits

The [credits page](https://app.crustdata.com/billing/credits) in the dashboard
sells credits two ways: a **one-time purchase** (pick a package, check out
through Stripe) and **auto top-up** (a standing rule that buys a reload
automatically when your balance drops below a threshold you set). Both use the
same packages and the same pricing.

See [Auto top-up](https://docs.crustdata.com/general/credits.md#auto-top-up) for how the automatic option
works, when you are charged, and the controls that keep it in check.

## Frequently asked questions

> [accordion] How is search billed?
>
> Search is billed per result returned. For example, 10 results at `0.03`
> credits per result use `0.30` credits. A request that returns no results
> uses no credits. A premium group adds its per-result price on top
> when you filter on it, and again when you receive it, see
> [Premium fields in search](#premium-fields-in-search).

> [accordion] How do I keep person enrich costs under control?
>
> Start with the base profile. Add business email, personal email, phone,
> or developer platform data only when your workflow uses it.

> [accordion] What happens when I run out of credits?
>
> Billable requests return an error until you purchase more credits or
> your account is replenished under your plan. To avoid interruptions,
> turn on [auto top-up](https://docs.crustdata.com/general/credits.md#auto-top-up).

> [accordion] Do unused credits expire?
>
> Yes. Purchased credits expire 12 months after the purchase that added
> them. Credits granted by your account manager may carry a custom
> expiry. See [Credit expiry](https://docs.crustdata.com/general/credits.md#credit-expiry).

For plan, quota, or enterprise pricing questions, contact Crustdata support
through your account channel.


## Related topics

- [Payload delivery: inline or link](https://docs.crustdata.com/watcher-docs/payload-delivery.md)
- [Social Post Watcher](https://docs.crustdata.com/watcher-docs/social-post/discovery.md)
- [Batch Contact Enrichment API](https://docs.crustdata.com/person-docs/contact/batch.md)
- [Company Entity Watcher](https://docs.crustdata.com/watcher-docs/company/entity.md)
- [Company Discovery Watcher](https://docs.crustdata.com/watcher-docs/company/discovery.md)
