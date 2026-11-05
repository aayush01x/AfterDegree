> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Web Search reference

> Reference for Web Search: request parameters, response body, error handling, common gotchas, and API summary.

Reference material for [Web Search](https://docs.crustdata.com/web-docs/search/introduction.md): request parameters,
response body, error handling, common gotchas, and the API summary.

For walk-through examples, see [Web Search](https://docs.crustdata.com/web-docs/search/introduction.md) and
[Examples](https://docs.crustdata.com/web-docs/search/introduction.md#examples). For result shapes and field presence
by source, see [Sources](#sources).

<Snippet file="web-auth-headers.mdx" />

***

## Request parameter reference

| Parameter | Type | Required | Default | Description |
| - | - | - | - | - |
| `query` | string | Yes | — | Search query text. Max 5,000 characters. Supports search operators like `site:` and `filetype:`. |
| `location` | string | No | — | ISO 3166-1 alpha-2 country code for region-specific results (e.g., `"US"`, `"GB"`, `"JP"`). |
| `sources` | string\[] | No | — | Sources to query: `web`, `news`, `scholar-articles`, `scholar-articles-enriched`, `scholar-author`, `ai`, `social`. Omitting this field searches all sources. |
| `site` | string | No | — | Restrict results to a domain (e.g., `"linkedin.com/company"`, `"github.com"`). Max 500 characters. |
| `start_date` | integer | No | — | Unix timestamp (seconds). Only results after this date. |
| `end_date` | integer | No | — | Unix timestamp (seconds). Only results before this date. Must be > `start_date`. |
| `human_mode` | boolean | No | `false` | Attempt a browser-like retrieval path when standard search access is blocked by bot protection. |
| `page` | integer | No | `1` | Number of result pages to aggregate into the response. Minimum `1`, maximum `15`. Values above `15` return `400`. When `page` is greater than `1`, `sources` must contain exactly one source. |

<Snippet file="web-site-parameter.mdx" />

***

## Response fields reference

| Field | Type | Description |
| - | - | - |
| `success` | boolean | Whether the search executed successfully. |
| `query` | string | The query as interpreted by the API (includes `site:` prefix if `site` was set). |
| `timestamp` | integer | Unix timestamp in milliseconds when the search was performed. |
| `results` | array | Search results. Shape varies by `source` — see [Sources](#sources). |
| `metadata.total_results` | integer | Total number of results available across all pages (may exceed the number in the `results` array if you requested fewer pages). |
| `metadata.failed_pages` | array | Page numbers that failed to return results. |
| `metadata.empty_pages` | array | Page numbers that returned no results. |

> [!NOTE]
>
> **Timestamps:** Search `timestamp` is in **milliseconds**. Fetch `timestamp`
> is in **seconds**. Divide Search timestamps by 1000 when comparing across
> endpoints.

***

## Error handling

Search returns `400` for invalid requests and `401` for auth failures.

```json 400 — missing query theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "query: This field is required.",
        "metadata": []
    }
}
```

```json 400 — invalid source theme={"theme":"vitesse-black"}
{
    "error": {
        "type": "invalid_request",
        "message": "sources: {0: [ErrorDetail(string='\"invalid_source\" is not a valid choice.', code='invalid_choice')]}",
        "metadata": []
    }
}
```

```json 401 — bad API key theme={"theme":"vitesse-black"}
{
    "message": "Invalid API key in request"
}
```

<Snippet file="web-error-responses.mdx" />

***

## Common gotchas

| Mistake | Fix |
| - | - |
| Omitting `sources` and expecting uniform results | Different sources return different fields. Specify `sources` explicitly for predictable parsing. |
| Using `site` with `scholar-author` or `ai` sources | `site` only applies to `web` and `news` sources. It has no effect on academic or deep research searches. |
| Expecting `snippet` in deep research mode results | Deep research mode returns `content` and `references` instead of `snippet` and `position`. |
| Expecting `position` in scholar-author results | Academic author results don't have `position` — they have `name`, `affiliation`, `citations`, etc. |
| Using `start_date` >= `end_date` | `start_date` must be strictly less than `end_date`. |

***

## API reference summary

| Detail | Value |
| - | - |
| **Endpoint** | `POST /web/search/live` |
| **Auth** | Bearer token + `x-api-version: 2025-11-01` |
| **Pricing** | `1 credit per query` |
| **Request** | `query` (required). Optional: `location`, `sources`, `site`, `start_date`, `end_date`, `human_mode`, `page`. |
| **Response** | Object: `{ success, query, timestamp, results[], metadata }` |
| **Errors** | `400` (bad request), `401` (bad auth) |

See the [full API reference](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md) for
the complete OpenAPI schema.

## Sources

[Web Search](https://docs.crustdata.com/web-docs/search/introduction.md) supports seven source types. Each returns a
different result shape — always specify `sources` explicitly when you need
predictable parsing.

<Snippet file="web-auth-headers.mdx" />

| Source | Best use case | Fetchable `url`? | `site` effective? | Date filters effective? |
| - | - | - | - | - |
| `web` | General web search | Yes | Yes | Yes |
| `news` | News articles | Yes | Yes | Yes |
| `scholar-articles` | Academic papers | Yes | No | Yes |
| `scholar-articles-enriched` | Papers + author profiles | Yes | No | Yes |
| `scholar-author` | Researcher profiles | No | No | No |
| `ai` | AI-generated summaries | No | No | No |
| `social` | Social media mentions | Yes | No | No |

***

## Result shapes by source

The `results[]` array shape depends on the `source` field of each result.
Use this reference when parsing multi-source responses.

> [tab] web / news
>
> Standard web and news results share the same shape.
>
> | Field | Type | Description |
> | - | - | - |
> | `source` | string | `"web"` or `"news"`. |
> | `title` | string | Page title. |
> | `url` | string | Page URL. |
> | `snippet` | string | Text excerpt. |
> | `position` | integer | Result position (1-based). |
>
> ```json theme={"theme":"vitesse-black"}
> {
>     "source": "web",
>     "title": "Crustdata: Real-Time B2B Data Broker via API or Data Feed",
>     "url": "https://crustdata.com/",
>     "snippet": "Crustdata is a B2B data provider offering real-time company & people datasets.",
>     "position": 1
> }
> ```

> [tab] scholar-articles
>
> Academic article results include citation data, author information, and optional PDF links.
>
> | Field | Type | Description |
> | - | - | - |
> | `source` | string | `"scholar-articles"` or `"scholar-articles-enriched"`. |
> | `title` | string | Article title. |
> | `url` | string | Link to the article. |
> | `snippet` | string | Abstract excerpt. |
> | `metadata` | string | Citation string: `"Author - Year - Publisher"`. |
> | `pdf_url` | string? | Direct PDF link, if available. |
> | `position` | integer | Result position (1-based). |
> | `authors` | array | `[{ name, profile_url, profile_id }]`. |
> | `citations` | integer | Total citation count. |
>
> ```json theme={"theme":"vitesse-black"}
> {
>     "source": "scholar-articles",
>     "title": "Understanding deep learning",
>     "url": "https://books.google.com/books?hl=en&lr=lang_en&id=rvyxEAAAQBAJ",
>     "snippet": "...to this field understand the principles behind deep learning.",
>     "metadata": "SJD Prince - 2023 - books.google.com",
>     "pdf_url": null,
>     "position": 1,
>     "authors": [
>         {
>             "name": "SJD Prince",
>             "profile_url": "https://scholar.google.com/citations?user=fjm67xYAAAAJ&hl=en&oi=sra",
>             "profile_id": "fjm67xYAAAAJ"
>         }
>     ],
>     "citations": 618
> }
> ```
>
> > [!TIP]
> >
> > Use `scholar-articles-enriched` instead of `scholar-articles` to get richer author profile data. The result shape is the same, with more author fields populated.

> [tab] scholar-author
>
> Author profile results have a completely different shape — no `snippet`, `position`, or `title`. Instead, you get a full researcher profile.
>
> | Field | Type | Description |
> | - | - | - |
> | `source` | string | `"scholar-author"`. |
> | `url` | string | Academic profile URL. |
> | `name` | string | Author full name. |
> | `affiliation` | string | Institutional affiliation. |
> | `website` | string? | Personal or institutional website. |
> | `interests` | array | `[{ title, link }]` — research interests. |
> | `thumbnail` | string? | Profile photo URL. |
> | `citations` | object | `{ all, since_2020 }` — total and recent counts. |
> | `h_index` | object | `{ all, since_2020 }`. |
> | `i10_index` | object | `{ all, since_2020 }`. |
> | `articles` | array | Top publications: `[{ title, url, year, citations, authors, publication }]`. |
>
> ```json theme={"theme":"vitesse-black"}
> {
>     "source": "scholar-author",
>     "url": "https://scholar.google.com/citations?user=NMS69lQAAAAJ&hl=en&oi=ao",
>     "name": "Jeff Dean",
>     "affiliation": "Google Chief Scientist, Google Research and Google DeepMind",
>     "website": "http://research.google.com/people/jeff",
>     "interests": [
>         { "title": "Distributed systems", "link": "https://scholar.google.com/..." }
>     ],
>     "citations": { "all": 401624, "since_2020": 231008 },
>     "h_index": { "all": 114, "since_2020": 78 },
>     "i10_index": { "all": 319, "since_2020": 203 },
>     "articles": [
>         {
>             "title": "MapReduce: simplified data processing on large clusters",
>             "url": "https://scholar.google.com/...",
>             "year": "2008",
>             "citations": "37255",
>             "authors": "J Dean, S Ghemawat",
>             "publication": "Communications of the ACM 51 (1), 107-113, 2008"
>         }
>     ]
> }
> ```

> [tab] ai
>
> Deep research mode returns a single AI-generated overview with source references. No `snippet`, `position`, or standard search fields.
>
> | Field | Type | Description |
> | - | - | - |
> | `source` | string | `"ai"`. |
> | `title` | string | Always `"AI Overview"`. |
> | `content` | string | AI-generated overview text. |
> | `references` | array | Source articles: `[{ title, url, snippet }]`. |
> | `images` | array | Embedded images: `[{ url, alt, width, height }]`. |
>
> ```json theme={"theme":"vitesse-black"}
> {
>     "source": "ai",
>     "title": "AI Overview",
>     "content": "The primary difference between uv and pip is speed and scope...",
>     "references": [
>         {
>             "title": "uv vs pip: Managing Python Packages and Dependencies",
>             "url": "https://realpython.com/uv-vs-pip/",
>             "snippet": "When it comes to Python package managers..."
>         }
>     ],
>     "images": []
> }
> ```

> [tab] social
>
> Social media results use the same shape as web/news results.
>
> | Field | Type | Description |
> | - | - | - |
> | `source` | string | `"social"`. |
> | `title` | string | Post or page title. |
> | `url` | string | Post URL. |
> | `snippet` | string | Post excerpt. |
> | `position` | integer | Result position (1-based). |
>
> > [!NOTE]
> >
> > Social search results may return empty
> > for some queries depending on availability. Always check `results.length`
> > before processing.

### Result ordering and ranking

> [!NOTE]
>
> When querying a single source, `position`
> reflects the source's natural ranking order. When querying multiple sources,
> results from different sources are interleaved and `position` may reflect a
> per-source rank rather than a global rank. `metadata.total_results` is the
> total count across everything the call requested. Note that multi-source and
> multi-page cannot be combined: `page` above `1` requires exactly one source.

### Parsing multi-source responses

When you query multiple sources at once (or omit `sources`), the `results[]`
array can contain items with different shapes. Always check the `source`
field of each result to determine which fields are available:

```javascript theme={"theme":"vitesse-black"}
for (const result of response.results) {
    switch (result.source) {
        case "web":
        case "news":
        case "social":
            // Standard: title, url, snippet, position
            console.log(result.title, result.url);
            break;
        case "scholar-articles":
        case "scholar-articles-enriched":
            // Academic: standard fields + authors, citations, pdf_url, metadata
            console.log(result.title, result.citations, result.authors);
            break;
        case "scholar-author":
            // Author profile: name, affiliation, h_index, articles[]
            console.log(result.name, result.affiliation, result.h_index);
            break;
        case "ai":
            // AI overview: content, references[]
            console.log(result.content, result.references);
            break;
    }
}
```

***

## Field presence by source

Use this reference to determine which fields are present for each source type.

> [!NOTE]
>
> **Naming note:** The API uses `metadata` in two different contexts. The
> **response-level** `metadata` is an object with `total_results`,
> `failed_pages`, and `empty_pages`. The **per-result** `metadata` field
> (scholar-articles only) is a citation string like `"Author - Year -
>       Publisher"`. Always use the full path (`response.metadata` vs
> `result.metadata`) to avoid confusion.

**Standard fields** — present in `web`, `news`, `social`, and
`scholar-articles` / `scholar-articles-enriched`:

| Field | Sources with this field | Notes |
| - | - | - |
| `source` | All sources | Always present |
| `title` | `web`, `news`, `social`, `scholar-articles*`, `ai` | AI: always `"AI Overview"` |
| `url` | `web`, `news`, `social`, `scholar-articles*`, `scholar-author` | Academic author: profile link |
| `snippet` | `web`, `news`, `social`, `scholar-articles*` | Absent in `ai`, `scholar-author` |
| `position` | `web`, `news`, `social`, `scholar-articles*` | Absent in `ai`, `scholar-author` |

**Academic article fields** — `scholar-articles` and
`scholar-articles-enriched` only:

| Field | Type | Notes |
| - | - | - |
| `metadata` | string | Citation string: `"Author - Year - Publisher"` |
| `pdf_url` | string? | Direct PDF download link — handle outside Web Fetch |
| `authors` | array | `[{ name, profile_url, profile_id }]` |
| `citations` | integer | Total citation count |

**Academic author fields** — `scholar-author` only:

| Field | Type | Notes |
| - | - | - |
| `name` | string | Author full name |
| `affiliation` | string | Institutional affiliation |
| `website` | string? | Personal or institutional website |
| `interests` | array | `[{ title, link }]` |
| `thumbnail` | string? | Profile photo URL |
| `citations` | object | `{ all, since_2020 }` — different type than scholar-articles |
| `h_index` | object | `{ all, since_2020 }` |
| `i10_index` | object | `{ all, since_2020 }` |
| `articles` | array | `[{ title, url, year, citations, authors, publication }]` |

**Deep research mode fields** — `ai` only:

| Field | Type | Notes |
| - | - | - |
| `content` | string | AI-generated overview text |
| `references` | array | `[{ title, url, snippet }]` — fetch these URLs |
| `images` | array | `[{ url, alt, width, height }]` |

***


## Related topics

- [Web Search API](https://docs.crustdata.com/web-docs/search/introduction.md)
- [Person Search reference](https://docs.crustdata.com/person-docs/search/reference.md)
- [Jobs Search reference](https://docs.crustdata.com/job-docs/search/reference.md)
- [Company Search reference](https://docs.crustdata.com/company-docs/search/reference.md)
- [Search](https://docs.crustdata.com/api-reference/web-apis/web-search.md)
