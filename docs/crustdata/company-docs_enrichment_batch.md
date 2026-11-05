> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Batch Company Enrichment API

> Enrich up to 10,000 companies in a single asynchronous job from a list of names, domains, profile URLs, or Crustdata IDs.

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | Enterprise plans. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | No |
| **Credit cost** | Same as Company Enrichment, 2 to 4 credits per company |
| **Batch size** | 10,000 companies per job |
| **Rate limit** | Up to 5 jobs can run at the same time. |

Batch Company Enrichment takes up to 10,000 companies per job, identified by domain, name, profile URL or Crustdata ID, with one identifier type per job. The job runs in the background. You get a `batch_id` straight away, then poll `GET /batch/{batch_id}` or pass a `webhook_url` to be told when it finishes. A completed job returns a `download_url` for one results file and `download_urls` for the same data split into parts. Files are gzipped JSONL with one company per line, and the links stay valid for 5 days.

Batch enrichment takes a list of identifiers you already have and returns the
enriched record for each as a single results file, instead of one
[Company Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md) call per company.

```
POST https://api.crustdata.com/batch/company/enrich
```

<Snippet file="batch-headers-note.mdx" />

<Snippet file="batch-pricing-callout.mdx" />

***

## Identifiers: exactly one type per job

Each job takes **exactly one** identifier type with up to **10,000
identifiers** — providing none, or more than one type, returns `400`;
over-cap submissions are rejected. String-list identifiers also accept a
single comma-separated string.

| Identifier type | Example values |
| - | - |
| `domains` | `["stripe.com", "openai.com"]` |
| `names` | `["Stripe", "OpenAI"]` |
| `professional_network_profile_urls` | `["https://www.linkedin.com/company/stripe"]` |
| `crustdata_company_ids` | `[631394, 631466]` |

***

## Your first batch enrichment: companies by domain

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/batch/company/enrich \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "domains": ["stripe.com", "openai.com"],
    "fields": ["basic_info.name", "basic_info.primary_domain", "headcount.total"]
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "batch_id": "53ab686b-c054-496b-8baf-baff5ecc85cf",
    "status": "pending",
    "entity": "company",
    "action": "enrich",
    "identifier_count": 2,
    "entities_requested": 2,
    "status_url": "/batch/53ab686b-c054-496b-8baf-baff5ecc85cf"
}
```

When the job completes, each line in the downloaded file is one company
wrapped in the enrichment envelope:

```json One record from the results file theme={"theme":"vitesse-black"}
{
    "original_identifier": "stripe.com",
    "internal_id": 631394,
    "data": {
        "crustdata_company_id": 631394,
        "basic_info": {
            "name": "Stripe",
            "primary_domain": "stripe.com",
            "company_type": "Privately Held",
            "year_founded": 2010
        },
        "headcount": {
            "total": 15554
        }
    }
}
```

> [!NOTE]
>
> Record trimmed for clarity.

<Snippet file="batch-enrich-envelope.mdx" />

***

## Enrich by Crustdata ID

If you already hold `crustdata_company_id` values — for example from a
previous search — they are the most precise identifier type. In the results
file, `original_identifier` echoes the ID you submitted as a string:

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/batch/company/enrich \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "crustdata_company_ids": [631394, 631466],
    "fields": ["basic_info.name", "basic_info.primary_domain"]
  }'
```

```json One record from the results file theme={"theme":"vitesse-black"}
{
    "original_identifier": "631394",
    "internal_id": 631394,
    "data": {
        "crustdata_company_id": 631394,
        "basic_info": {
            "name": "Stripe",
            "primary_domain": "stripe.com"
        }
    }
}
```

> [!NOTE]
>
> Record trimmed for clarity.

***

## Fields: requested plus defaults

`fields` accepts dotted leaf paths (`headcount.total`), whole family names
(`headcount`), or a comma-separated string of either. A family name expands to
its entire subtree. The response contains the **requested fields plus the
default `basic_info` family** — matching the non-batch
[Company Enrich](https://docs.crustdata.com/company-docs/enrichment/reference.md) exactly, including the
selectable field list. An unsupported value returns `400` with every
selectable field in `metadata.available_fields`.

This request also shows the comma-separated string identifier form:

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/batch/company/enrich \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "domains": "stripe.com,openai.com",
    "fields": ["headcount"]
  }'
```

```json One record, trimmed — the full headcount family comes back theme={"theme":"vitesse-black"}
{
    "original_identifier": "stripe.com",
    "internal_id": 631394,
    "data": {
        "basic_info": { "name": "Stripe", "primary_domain": "stripe.com" },
        "crustdata_company_id": 631394,
        "headcount": {
            "by_function_timeseries": {
                "CURRENT_FUNCTION": {
                    "Accounting": [
                        { "date": "2024-12-01 00:00:00", "employee_count": 222 }
                    ]
                }
            }
        }
    }
}
```

### `chunk_size`

Optional internal processing chunk size (identifiers per processing unit),
10–1000, default 100. Out-of-range values return `400`.

***

<Snippet file="batch-job-lifecycle.mdx" />

***

## Errors

```json 400 — no identifier theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Exactly one identifier must be provided: names, domains, professional_network_profile_urls, or crustdata_company_ids",
        "metadata": []
    }
}
```

```json 400 — two identifier types theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Only one identifier type can be provided. Found: domains, crustdata_company_ids",
        "metadata": []
    }
}
```

```json 400 — invalid field (with available_fields) theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Invalid fields: bogus.field",
        "metadata": [
            {
                "available_fields": [
                    "basic_info.name",
                    "basic_info.primary_domain",
                    "headcount.total"
                ]
            }
        ]
    }
}
```

<Snippet file="batch-errors.mdx" />

***

## What to do next

* **Find companies first** — see [Batch Company Search](https://docs.crustdata.com/company-docs/search/batch-search.md) to turn one query into an input list.
* **Single-company enrichment** — see [Company Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md).
* **Resolve a domain to a company first** — see [Company Identify](https://docs.crustdata.com/company-docs/identify/introduction.md).
* **Valid `fields` values** — see the [enrich reference](https://docs.crustdata.com/company-docs/enrichment/reference.md).
* **Enrich people in batch** — see [Batch Person Enrich](https://docs.crustdata.com/person-docs/enrichment/batch-enrich.md).
* **Full schema** — see the [API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md).


## Related topics

- [Capabilities](https://docs.crustdata.com/general/capabilities.md)
- [Batch Person Enrichment API](https://docs.crustdata.com/person-docs/enrichment/batch-enrich.md)
- [Company Enrichment API](https://docs.crustdata.com/company-docs/enrichment/introduction.md)
- [Batch Company Search API](https://docs.crustdata.com/company-docs/search/batch-search.md)
- [Batch Contact Enrichment API](https://docs.crustdata.com/person-docs/contact/batch.md)
