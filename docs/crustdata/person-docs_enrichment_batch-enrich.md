> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Batch Person Enrichment API

> Enrich people in a single asynchronous job — from the indexed database (up to 10,000) or retrieved fresh from the web at request time (up to 300).

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | Enterprise plans. Live batch is an add-on. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | No |
| **Credit cost** | Same as Person Enrichment, up to 4 credits per person. Live batch is 7 credits per profile |
| **Batch size** | 10,000 people per job (300 for live) |
| **Rate limit** | Up to 5 jobs can run at the same time. |

Batch Person Enrichment takes up to 10,000 profile URLs per job from the indexed database. Batch Live Enrichment (`POST /batch/person/professional_network/enrich/live`) retrieves each profile from the web at request time and takes up to 300 per job. It is an add-on. Both jobs run in the background. You get a `batch_id` straight away, then poll `GET /batch/{batch_id}` or pass a `webhook_url` to be told when it finishes. A completed job returns a `download_url` for one results file and `download_urls` for the same data split into parts. Files are gzipped JSONL with one person per line, and the links stay valid for 5 days.

Batch enrichment takes a list of identifiers you already have and returns the
enriched record for each as a single results file, instead of one
[Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md) call per person.

This page covers two endpoints:

* [**Batch enrich**](#batch-enrich) — records served from the indexed database, with higher caps and faster turnaround.
* [**Batch live enrich**](#batch-live-enrich) — each profile retrieved **fresh from the web at request time**.

<Snippet file="batch-headers-note.mdx" />

<Snippet file="batch-pricing-callout.mdx" />

***

## Batch enrich

```
POST https://api.crustdata.com/batch/person/enrich
```

For profiles retrieved fresh from the web at request time, see
[Batch live enrich](#batch-live-enrich) below.

### Database batch enrichment

`POST /batch/person/enrich` takes up to **10,000** values in
`professional_network_profile_urls`. Missing and over-cap submissions are
rejected. The identifier list also accepts a single comma-separated string.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/batch/person/enrich \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "professional_network_profile_urls": ["https://www.linkedin.com/in/dvdhsu/"],
    "fields": ["basic_profile.name", "basic_profile.headline", "basic_profile.current_title"]
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "batch_id": "22f80b2b-e5bd-480b-86cc-29f79dc6c821",
    "status": "pending",
    "entity": "person",
    "action": "enrich",
    "identifier_count": 1,
    "entities_requested": 1,
    "status_url": "/batch/22f80b2b-e5bd-480b-86cc-29f79dc6c821"
}
```

When the job completes, each line in the downloaded file is one person wrapped
in the enrichment envelope:

```json One record from the results file theme={"theme":"vitesse-black"}
{
    "original_identifier": "https://www.linkedin.com/in/dvdhsu/",
    "internal_id": 14540,
    "data": {
        "basic_profile": {
            "name": "David Hsu",
            "headline": "Founder, CEO @ Retool",
            "current_title": "Founder, CEO"
        },
        "social_handles": {
            "professional_network_identifier": {
                "profile_url": "https://www.linkedin.com/in/dvdhsu"
            }
        },
        "crustdata_person_id": 14540
    }
}
```

> [!NOTE]
>
> Record trimmed for clarity.

<Snippet file="batch-enrich-envelope.mdx" />

### Fields: requested plus defaults

`fields` accepts dotted leaf paths, whole family names (`basic_profile`), or a
comma-separated string of either. A family name expands to its entire subtree.
The response contains the **requested fields plus the default families**
(`basic_profile` and `social_handles`) — matching the non-batch
[Person Enrich](https://docs.crustdata.com/person-docs/enrichment/reference.md) exactly, including the
selectable field list. An unsupported value returns `400` with every
selectable field in `metadata.available_fields`.

### `chunk_size`

Optional internal processing chunk size (identifiers per processing unit),
10–1000, default 100. Out-of-range values return `400` with
`"chunk_size must be between 10 and 1000"`.

***

<Snippet file="batch-job-lifecycle.mdx" />

***

### Errors

```json 400 — no identifier theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Exactly one identifier must be provided: professional_network_profile_urls",
        "metadata": []
    }
}
```

```json 400 — chunk_size out of range theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "chunk_size must be between 10 and 1000",
        "metadata": []
    }
}
```

<Snippet file="batch-errors.mdx" />

***

## Batch live enrich

> [!NOTE]
>
> Live enrichment is an add-on. If your plan doesn't include it, contact your
> Crustdata account team to enable it.

Batch live enrichment takes a list of profile URLs you already have and returns
the enriched record for each as a single results file, with each profile
retrieved **fresh from the web at request time** — instead of one
[Person Live Enrich](https://docs.crustdata.com/person-docs/enrichment/live-enrich.md) call per person.

```
POST https://api.crustdata.com/batch/person/professional_network/enrich/live
```

For records served from the indexed database — higher caps and faster — see
[Batch enrich](#batch-enrich) above.

### Live batch enrichment

`POST /batch/person/professional_network/enrich/live` retrieves each profile
**fresh from the web at request time**. Use it when you need the latest title,
headline, or employment data and the database record is not recent enough.

Key differences from database enrichment:

* **Profile URLs only.** `professional_network_profile_urls` is the only identifier type — anything else returns `400`.
* **Cap of 300 per job** (instead of 10,000). Larger submissions are rejected with `400`.
* **Slower.** Expect seconds per profile; live jobs are the most likely to end `failed` with an `error_message`.
* **`internal_id` echoes the URL.** In the envelope, `internal_id` is the submitted profile URL — not the numeric Crustdata ID.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/batch/person/professional_network/enrich/live \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "professional_network_profile_urls": ["https://www.linkedin.com/in/dvdhsu/"],
    "fields": ["basic_profile.name", "basic_profile.current_title", "basic_profile.headline"]
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "batch_id": "1a5786e5-0e9a-4d58-b55d-7df6f40ecdff",
    "status": "pending",
    "entity": "person",
    "action": "enrich_live",
    "identifier_count": 1,
    "entities_requested": 1,
    "status_url": "/batch/1a5786e5-0e9a-4d58-b55d-7df6f40ecdff"
}
```

Note the `action` is `enrich_live` — that's how live jobs are labeled wherever
you poll or list jobs.

```json One record from the results file theme={"theme":"vitesse-black"}
{
    "original_identifier": "https://www.linkedin.com/in/dvdhsu/",
    "internal_id": "https://www.linkedin.com/in/dvdhsu/",
    "data": {
        "basic_profile": {
            "name": "David Hsu",
            "current_title": "Founder, CEO",
            "headline": "Founder, CEO @ Retool"
        },
        "social_handles": {
            "professional_network_identifier": {
                "profile_url": "https://www.linkedin.com/in/dvdhsu"
            }
        }
    }
}
```

> [!NOTE]
>
> Record trimmed for clarity. For single-profile live enrichment without the
> batch lifecycle, see
> [Person Live Enrich](https://docs.crustdata.com/person-docs/enrichment/live-enrich.md).

<Snippet file="batch-enrich-envelope.mdx" />

### Fields: requested plus defaults

`fields` accepts dotted leaf paths, whole family names (`basic_profile`), or a
comma-separated string of either. A family name expands to its entire subtree.
The response contains the **requested fields plus the default families**
(`basic_profile` and `social_handles`) — matching the non-batch
[Person Live Enrich](https://docs.crustdata.com/person-docs/enrichment/live-enrich.md) exactly. An
unsupported value returns `400` with every selectable field in
`metadata.available_fields`.

***

<Snippet file="batch-job-lifecycle.mdx" />

***

### Errors

```json 400 — wrong identifier type on live enrich theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "professional_network_profile_urls must be provided for live enrich",
        "metadata": []
    }
}
```

```json 400 — more than 300 URLs on live enrich theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Maximum 300 identifiers allowed for person/enrich_live. Found 301",
        "metadata": []
    }
}
```

<Snippet file="batch-errors.mdx" />

***

## What to do next

* **Need the freshest data?** — see [Batch live enrich](#batch-live-enrich) above for profiles retrieved from the web at request time.
* **Higher caps, faster** — see [Batch enrich](#batch-enrich) above for records served from the indexed database.
* **Find people first** — see [Batch Person Search](https://docs.crustdata.com/person-docs/search/batch-search.md) to turn one query into an input list.
* **Find people first (live)** — see [Batch Person Live Search](https://docs.crustdata.com/person-docs/search/batch-search.md) to turn one query into an input list.
* **Single-person enrichment** — see [Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md).
* **Single-profile live enrichment** — see [Person Live Enrich](https://docs.crustdata.com/person-docs/enrichment/live-enrich.md).
* **Valid `fields` values** — see the [enrich reference](https://docs.crustdata.com/person-docs/enrichment/reference.md).
* **Enrich companies in batch** — see [Batch Company Enrich](https://docs.crustdata.com/company-docs/enrichment/batch.md).
* **Full schema** — see the [API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md).


## Related topics

- [Capabilities](https://docs.crustdata.com/general/capabilities.md)
- [Person Enrichment API](https://docs.crustdata.com/person-docs/enrichment/introduction.md)
- [Batch Contact Enrichment API](https://docs.crustdata.com/person-docs/contact/batch.md)
- [Batch Company Enrichment API](https://docs.crustdata.com/company-docs/enrichment/batch.md)
- [Batch Person Verification API](https://docs.crustdata.com/person-docs/verification/batch.md)
