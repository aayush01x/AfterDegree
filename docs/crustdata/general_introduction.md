> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Introduction

> Crustdata's public Company, Person, Job, Web, and Social Post APIs for search, enrich, identify, autocomplete, and content retrieval.

Crustdata provides public APIs for the data layer behind sales,
recruiting, and research workflows. You can query indexed datasets of
companies, people, jobs, and social posts, enrich a known entity with
fresh attributes, resolve identifiers, search the web, and fetch page
content — all over a single versioned REST surface.

> [!NOTE]
>
> Every endpoint in this version requires `Authorization: Bearer <key>`
> and `x-api-version: 2025-11-01`. Live endpoints (real-time retrieval
> from the web) are enterprise-only and plan-specific — review
> [Pricing](https://docs.crustdata.com/general/pricing.md) before you build against them.

## API areas

Five product areas, grouped by entity. Pick the area for the entity you
work with; each area's introduction page walks the simplest query and
links onward to filters, pagination, and the full reference.

> [card] [Company](https://docs.crustdata.com/company-docs/search/introduction.md)
>
> Search the indexed company dataset, enrich a known company, resolve a
> domain/name/URL to a Crustdata ID, and surface valid filter values with
> autocomplete.

> [card] [Person](https://docs.crustdata.com/person-docs/search/introduction.md)
>
> Search the indexed people dataset, enrich a known person, discover developer
> profiles, and surface valid filter values with autocomplete.

> [card] [Job](https://docs.crustdata.com/job-docs/search/introduction.md)
>
> Search the indexed job-listings dataset with filters, cursor pagination, and
> aggregations. Fetch real-time openings for a single company on demand.

> [card] [Web](https://docs.crustdata.com/web-docs/search/introduction.md)
>
> Search the web across news, web, scholar, social, and deep-research sources,
> or fetch the HTML content of any URL.

> [card] [Social Post](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md#social-post-api)
>
> Search the indexed social post dataset by text, author, engagement,
> reactors, and mentions, enrich recent posts for a person or company, or
> run a live keyword search. Enabled on request.

## What lives where

Every API area's section opens with a
short overview (orientation), then progressive how-to pages (filters,
pagination, recipes), and finishes with reference (the full request /
response schema). Use this map to pick the right page for your task:

| If you want to… | Go to |
| - | - |
| Understand what an API area does | Each area's **Introduction** page |
| Build a query step-by-step | The area's **Filters**, **Pagination**, **Recipes** pages |
| Look up an exact field, parameter, or error code | The area's **Reference** page or the interactive [API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md) |
| Estimate cost | [Pricing](https://docs.crustdata.com/general/pricing.md) |
| Check throughput limits | [Rate limits](https://docs.crustdata.com/general/rate-limits.md) |
| Port an existing integration from the legacy APIs | [Migration guides](https://docs.crustdata.com/migrations/overview) |

## First call

If you haven't called the API yet, start with the simplest possible
request — Company search by name, then layer filters from there.

```bash theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/company/search \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "filters": { "field": "basic_info.name", "type": "=", "value": "Crustdata" },
    "limit": 1
  }'
```

Continue with [Company search](https://docs.crustdata.com/company-docs/search/introduction.md) or
jump to any of the [API areas](#api-areas) above.

## Migrating from the legacy APIs?

If you have an integration on the legacy `/screener/*` or `/data_lab/*`
endpoints, head to the [Migration guides overview](https://docs.crustdata.com/migrations/overview)
— it lists every legacy endpoint, its current replacement, and the
universal changes (auth scheme, version header, error envelope) that
apply across every migration.


## Related topics

- [API Introduction](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md)
- [Social Post Search reference](https://docs.crustdata.com/social-post-docs/indexed-search/reference.md)
- [llms.txt](https://docs.crustdata.com/for-agents/llms.md)
- [Person Enrich reference](https://docs.crustdata.com/person-docs/enrichment/reference.md)
