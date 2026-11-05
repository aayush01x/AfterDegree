> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Batch Job Postings Search API

> Pull every job listing for up to 10 companies in one asynchronous job and receive the complete result set as a single file.

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | Enterprise plans. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | No |
| **Credit cost** | 0.03 credits per result |
| **Batch size** | 10 companies per job |
| **Rate limit** | Up to 5 jobs can run at the same time. |

Batch job search runs one asynchronous job and delivers the **entire result
set** as a single file. Where [Search Jobs](https://docs.crustdata.com/job-docs/search/introduction.md)
returns one cursor page per call, a batch job walks every page for you and
returns **all** listings for the companies you name.

<Snippet file="batch-headers-note.mdx" />

<Snippet file="batch-pricing-callout.mdx" />

***

## Batch search

```
POST https://api.crustdata.com/batch/job/search
```

Retrieve every job listing in the dataset for up to **10 companies** in a single
asynchronous job. Records in the downloaded file are flat, identical to the
non-batch [Search Jobs](https://docs.crustdata.com/job-docs/search/reference.md) record shape.

### How batch job search differs from non-batch search

* **Companies, not filters.** Provide a `crustdata_company_ids` list — a JSON array of integers (a comma-separated string is rejected). The job returns **all** listings for those companies. To search listings by arbitrary filters, use the non-batch [Search Jobs](https://docs.crustdata.com/job-docs/search/reference.md) instead.
* **Up to 10 companies per job.** More than 10 IDs returns `400`. Resolve IDs from a name, domain, or profile URL with the free [Company Identify](https://docs.crustdata.com/company-docs/identify/introduction.md) endpoint.
* **Whole result set.** The job paginates server-side and delivers every listing — there is no `max_results` or cursor control.
* **Flat records.** Each line in the results file has exactly the non-batch [Search Jobs](https://docs.crustdata.com/job-docs/search/reference.md) record shape. No envelope.
* **Exact field projection.** When you pass `fields`, each record contains exactly those dotted paths — nothing more. Omit `fields` to get every field your account can read. The selectable fields are the same as non-batch Search Jobs.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/batch/job/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "crustdata_company_ids": [6036032]
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "batch_id": "0afed646-ce96-430a-92c0-b6b7589e937c",
    "status": "pending",
    "entity": "job",
    "action": "search",
    "identifier_count": 1,
    "entities_requested": 1,
    "status_url": "/batch/0afed646-ce96-430a-92c0-b6b7589e937c"
}
```

The response is a **ticket, not the listings** — `status: "pending"` means the
job is queued. Poll it with `GET /batch/{batch_id}` until `status` reaches
`completed`, then download the results file, as described in [Working with batch
jobs](#working-with-batch-jobs) below. (Search jobs always report
`identifier_count: 1` — the one submission.)

To keep each record small, project just the fields you need:

```json Request body — title and URL only theme={"theme":"vitesse-black"}
{
    "crustdata_company_ids": [6036032],
    "fields": ["job_details.title", "job_details.url"]
}
```

When the job completes, the downloaded file has one flat JSON record per line —
exactly the fields you requested:

```json The results file (title and URL only) theme={"theme":"vitesse-black"}
{"job_details": {"title": "Senior Software Engineer", "url": "https://example.com/careers/senior-software-engineer"}}
{"job_details": {"title": "Product Manager, Growth", "url": "https://example.com/careers/product-manager-growth"}}
```

### Errors

```json 400 — no company IDs theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Exactly one identifier must be provided: crustdata_company_ids",
        "metadata": []
    }
}
```

```json 400 — comma-separated string instead of a JSON array theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "crustdata_company_ids must be a list",
        "metadata": []
    }
}
```

```json 400 — more than 10 company IDs theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "Maximum 10 identifiers allowed for job/search. Found 11",
        "metadata": []
    }
}
```

***

<Snippet file="batch-job-lifecycle.mdx" />

<Snippet file="batch-errors.mdx" />

***

## What to do next

* **Build queries interactively first** — iterate with [Search Jobs](https://docs.crustdata.com/job-docs/search/introduction.md) page by page, then pull the full set for your target companies as a batch job.
* **Look up fields** — see the [Search reference](https://docs.crustdata.com/job-docs/search/reference.md).
* **Resolve company IDs** — use the free [Company Identify](https://docs.crustdata.com/company-docs/identify/introduction.md) endpoint.
* **Search people or companies in batch** — see [Batch Person Search](https://docs.crustdata.com/person-docs/search/batch-search.md) or [Batch Company Search](https://docs.crustdata.com/company-docs/search/batch-search.md).
* **Full schema** — see the [API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md).


## Related topics

- [Job Postings Search API](https://docs.crustdata.com/job-docs/search/introduction.md)
- [Batch Search Jobs](https://docs.crustdata.com/api-reference/batch-apis/submit-a-batch-job-listings-search-job.md)
- [Batch Company Search API](https://docs.crustdata.com/company-docs/search/batch-search.md)
- [Batch People Search API](https://docs.crustdata.com/person-docs/search/batch-search.md)
- [Batch Search Person](https://docs.crustdata.com/api-reference/batch-apis/submit-a-batch-person-database-search-job.md)
