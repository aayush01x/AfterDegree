> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Rate limits

> Learn how to design clients for Crustdata API rate limits and avoid 429 responses.

> [!WARNING]
>
> Exact per-endpoint limits can change by plan and endpoint version. Verify active limits in your dashboard.

> [!NOTE]
>
> Rate limits vary by endpoint. The defaults below apply to most accounts. Send an email to [gtm@crustdata.co](mailto:gtm@crustdata.co) to discuss higher limits if needed for your use case.

## Core behavior

Crustdata applies per-endpoint request limits.

Operationally, you should assume that **steady request distribution** is safer than bursts, even when total requests per minute look acceptable.

## Default rate limits by endpoint

| Endpoint | Default `rate-limit` (RPM) |
| - | - |
| `/person/enrich` | 15 |
| `/person/search` | 30 |
| `/person/professional_network/enrich/live` | 10 |
| `/person/professional_network/search/live` | 10 |
| `/person/contact/enrich` | 15 |
| `/person/identify` | 30 |
| `/person/search/autocomplete` | 300 |
| `/company/enrich` | 15 |
| `/company/search` | 30 |
| `/company/identify` | 30 |
| `/company/search/autocomplete` | 300 |
| `/company/professional_network/search/live` | 10 |
| `/employee_review/enrich` | 15 |
| `/job/search` | 30 |
| `/job/professional_network/search/live` | 10 |
| `/web/search/live` | 10 |
| `/web/enrich/live` | 10 |
| `/dev_platform/enrich` | 15 |
| `/social_post/search` | 30 |
| `/social_post/professional_network/enrich/live` | 10 |
| `/social_post/professional_network/search/live` | 10 |
| `/batch/person/enrich` | 30 |
| `/batch/person/search` | 30 |
| `/batch/person/professional_network/search/live` | 5 |
| `/batch/person/professional_network/enrich/live` | 5 |
| `/batch/person/contact/enrich` | 5 |
| `/batch/person/verify` | 5 |
| `/batch/company/enrich` | 30 |
| `/batch/company/search` | 30 |
| `/batch/company/professional_network/search/live` | 5 |
| `/batch/job/search` | 30 |
| `/batch/job/professional_network/search/live` | 5 |
| `/batch/social_post/professional_network/enrich/live` | 5 |
| `/account/endpoints` | 300 |
| `/account/credits` | 300 |
| `/account/usage/summary` | 60 |
| `/account/usage/events` | 60 |
| `/account/usage/events/{request_id}` | 60 |
| `/account/usage/errors` | 60 |
| `/watch/{dataset}/search` | 10 |
| `/watch/{dataset}` | 10 |
| `/watch/{dataset}/search/{id}` | 10 |
| `/watch/{dataset}/{id}` | 10 |

> [!NOTE]
>
> **Contact and identify endpoints** `/person/contact/enrich`,
> `/batch/person/contact/enrich`, `/person/identify`, and
> `/batch/person/identify` are grouped with the live endpoints, not with
> in-database, so their limits do not move with the limits on search and
> enrich. Raising a live limit is constrained. Contact sales or write to
> [gtm@crustdata.co](mailto:gtm@crustdata.co) with your volume.

Watch-management requests are limited to 10 per minute, covering create, list,
get, update, test, and delete on both discovery and entity watches. Each watch
path keeps its own budget, so exhausting `/watch/company/search` leaves
`/watch/company`, `/watch/person/search`, and `/watch/job/search` with a full
allowance. This bounds bursty create and update loops; steady use is unaffected.

Every watch response carries the usual counters, and the eleventh request in a
minute is refused:

```json 429 - watch-management rate limit theme={"theme":"vitesse-black"}
{
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit exceeded for this endpoint. Please write to gtm@crustdata.co.",
    "metadata": []
  }
}
```

```http Response headers theme={"theme":"vitesse-black"}
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 46
```

`X-RateLimit-Reset` counts down the seconds until the window rolls over, so wait
that long rather than retrying immediately.

The four [`/account/usage/*`](https://docs.crustdata.com/general/usage) endpoints share one budget of 60
requests per minute. A burst of `/account/usage/events` calls also blocks
`/account/usage/summary` until the window resets.

## Batch job concurrency

Batch endpoints carry a second limit on top of the per-minute rate: a cap on how
many jobs you may have in flight at once. A job counts as active while its
`status` is `pending` or `processing`.

Active jobs are counted in **two independent pools**, so a queue of enrichment
jobs never blocks a live lookup and vice versa:

| Pool | Endpoints |
| - | - |
| **Live** | every `/batch/.../live` endpoint, plus `/batch/person/contact/enrich`, `/batch/person/identify`, and `/batch/person/verify` |
| **Standard** | `/batch/person/enrich`, `/batch/person/search`, `/batch/company/enrich`, `/batch/company/search`, `/batch/job/search` |

Each pool's cap is derived from your rate limit on that pool's endpoints: the
highest RPM you hold on any endpoint in the pool, divided by six, then held
between **5 and 30**. On default limits that is 5 active jobs in each pool, and
raising your rate limit raises the cap with it. Your current per-endpoint limits
are visible in your dashboard.

Exceeding a pool's cap returns `429` with `error.type` of `rate_limit_error` and
a `Retry-After` header:

```json 429 - too many active jobs theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "rate_limit_error",
        "message": "You already have 5 active standard batch jobs, the maximum for your account. This is a concurrency cap on long-running jobs, not your per-minute request limit. Wait for one to complete, or contact support@crustdata.co to raise it.",
        "metadata": []
    }
}
```

The check runs before the endpoint permission check and the credit gate, so a
`429` here costs nothing. Poll `GET /batch/{batch_id}` until a job reaches
`completed` or `failed`, then submit the next one. A job that has been active
for more than 24 hours stops counting toward the limit, so a stuck job does not
block your account indefinitely.

Rarely, the platform as a whole is at batch capacity. That also returns `429`
`rate_limit_error`, with a message saying so and a shorter `Retry-After`. It is
unrelated to your account's limits - retry after the interval given.

## Implementation guidance

To reduce `429 Too Many Requests` responses:

1. Spread traffic across the full minute instead of burst-sending.
2. Use retry logic with exponential backoff and jitter.
3. Keep request queues bounded.
4. Add circuit breakers around non-critical enrichment flows.
5. Monitor request logs and alert on sustained `429` rates.

## Client-side best practices

* Centralize throttling in one shared HTTP client.
* Use endpoint-specific concurrency and QPS controls.
* Prioritize business-critical requests when backpressure starts.
* Cache stable results where your workflow allows it.

## Rollout checklist

* Start with conservative throughput.
* Increase gradually while tracking latency and error rates.
* Recalibrate limits when you add new endpoints or workflows.

For higher-throughput needs, request custom limits through Crustdata support.


## Related topics

- [API Introduction](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md)
- [Batch Person Verification API](https://docs.crustdata.com/person-docs/verification/batch.md)
- [Permissions and rate limits](https://docs.crustdata.com/api-reference/account-apis/list-endpoint-permissions-and-rate-limits.md)
- [Company Autocomplete API](https://docs.crustdata.com/company-docs/autocomplete/introduction.md)
- [Pricing](https://docs.crustdata.com/general/pricing.md)
