> ## Documentation Index
> Fetch the complete documentation index at: https://docs.crustdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Web Search API

> Search the web across multiple sources including web, news, academic papers, deep research mode, and social media.

## Endpoint essentials

| Detail | Value |
| - | - |
| **API key and headers** | Send `Authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01` with every request. |
| **Access** | All plans. Check your account with [Permissions](https://docs.crustdata.com/general/permissions.md). |
| **Free account** | Yes, with the free credits every new self-serve account gets |
| **Credit cost** | 1 credit per query |
| **Rate limit** | 10 requests per minute |

**Use this when** you want to find web pages, news articles, academic
papers, author profiles, AI-generated overviews, or social media posts
matching a search query.

The Web Search API accepts a query and returns results from one or more
source types. This page walks you through the basics: your first search, the
response shape, and human mode, then folds in worked example recipes you can
copy, paste, and adapt. The result shape varies by source — always specify
`sources` explicitly when you need predictable parsing. For result shapes,
request parameters, and error handling, see [Reference](https://docs.crustdata.com/web-docs/search/reference.md).

Every request goes to the same endpoint:

```
POST https://api.crustdata.com/web/search/live
```

<Snippet file="web-auth-headers.mdx" />

**Pricing:** `1 credit per query`.
To see the price for your account, open the [**Pricing** tab](https://app.crustdata.com/endpoints/web-search-live#pricing) in the dashboard.

> [!NOTE]
>
> Default `rate-limit` is 10 requests per minute. Send an email to
> [gtm@crustdata.co](mailto:gtm@crustdata.co) to discuss higher limits if
> needed for your use case.

> [card] [Sources](https://docs.crustdata.com/web-docs/search/reference.md#sources)
>
> Result shapes and field presence for each source: web, news,
> scholar-articles, scholar-author, AI, social.

> [card] [Examples](#examples)
>
> Site/date filtering, multi-page, academic, deep research mode, discovery
> patterns, and search → fetch workflows.

> [card] [Reference](https://docs.crustdata.com/web-docs/search/reference.md)
>
> Request parameters, response body, error handling, and common gotchas.

> [card] [Ask the assistant](https://docs.crustdata.com/web-docs/search/introduction.md?assistant=How%20do%20I%20search%20the%20web%20with%20Crustdata%3F)
>
> Open the docs assistant with a pre-filled question about Web Search.

***

## Your first search

The simplest search uses a `query` with an explicit `sources` array. Always
specify `sources` for predictable result parsing.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
  --url https://api.crustdata.com/web/search/live \
  --header 'authorization: Bearer YOUR_API_KEY' \
  --header 'content-type: application/json' \
  --header 'x-api-version: 2025-11-01' \
  --data '{
    "query": "crustdata",
    "sources": ["web"],
    "location": "US"
  }'
```

```json Response theme={"theme":"vitesse-black"}
{
    "success": true,
    "query": "crustdata",
    "timestamp": 1775195367446,
    "results": [
        {
            "source": "web",
            "title": "Crustdata: Real-Time B2B Data Broker via API or Data Feed",
            "url": "https://crustdata.com/",
            "snippet": "Crustdata is a B2B data provider offering real-time company & people datasets. Access APIs and live signals to power sales and investment workflows.",
            "position": 1
        },
        {
            "source": "web",
            "title": "Crustdata: Real-time B2B data via simple APIs",
            "url": "https://www.ycombinator.com/companies/crustdata",
            "snippet": "Crustdata provides live company and people data via APIs and full dataset delivery.",
            "position": 2
        }
    ],
    "metadata": {
        "total_results": 7,
        "failed_pages": [],
        "empty_pages": []
    }
}
```

> [!NOTE]
>
> Response trimmed for clarity.

**Extract:** Each result in `results[]` contains `source`, `title`, `url`,
`snippet`, and `position`. Use `position` for ranking and `url` for
follow-up fetching.

***

## Use human mode when standard retrieval is blocked

Set `human_mode: true` when you want the API to attempt a browser-like
retrieval path for the search request.

```bash Request theme={"theme":"vitesse-black"}
curl --request POST \
    --url https://api.crustdata.com/web/search/live \
    --header 'authorization: Bearer YOUR_API_KEY' \
    --header 'content-type: application/json' \
    --header 'x-api-version: 2025-11-01' \
    --data '{
        "query": "crustdata",
        "sources": ["web"],
        "human_mode": true
    }'
```

> [!NOTE]
>
> `human_mode: true` returns the normal search
> response shape with `success`, `query`, `timestamp`, `results`, and
> `metadata`.

***

## Examples

Ready-to-copy patterns for Web Search. Each example shows a real request, the
response, and what to extract. For the core walkthrough (your first search,
human mode), see the sections above. For result shapes, request parameters,
and error handling, see [Reference](https://docs.crustdata.com/web-docs/search/reference.md).

### Filtering and pagination

> [accordion] Restrict results to a specific site
>
> Use the `site` parameter to limit results to a single domain. Useful for
> finding company pages on professional networks, profiles on GitHub, or content on a
> specific website.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "ADAMSBROWN, LLC",
>     "sources": ["web"],
>     "site": "linkedin.com/company"
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "success": true,
>     "query": "site:linkedin.com/company ADAMSBROWN, LLC",
>     "timestamp": 1775195371211,
>     "results": [
>         {
>             "source": "web",
>             "title": "Adams Brown",
>             "url": "https://www.linkedin.com/company/adams-brown-cpa",
>             "snippet": "Adams Brown, LLC, a leading CPA and advisory firm, has delivered value-added accounting and advisory services to businesses and their owners since 1945.",
>             "position": 1
>         }
>     ],
>     "metadata": {
>         "total_results": 10,
>         "failed_pages": [],
>         "empty_pages": []
>     }
> }
> ```
>
> **Extract:** The first result URL is typically the best match. For company
> profile URLs, pass the result to
> [Company Identify](https://docs.crustdata.com/company-docs/identify/introduction.md) for a full profile.

> [accordion] Search with date filtering
>
> Use `start_date` and `end_date` (Unix timestamps in seconds) to limit
> results to a specific time range.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "distributed systems",
>     "location": "US",
>     "sources": ["web", "news"],
>     "site": "example.com",
>     "start_date": 1728259200,
>     "end_date": 1730937600
>   }'
> ```
>
> > [!TIP]
> >
> > Convert dates to Unix timestamps: October 7, 2024 = `1728259200`. You can
> > use any Unix timestamp converter tool.

> [accordion] Multi-page search
>
> Use `page` to request multiple result pages in a single response. The
> `metadata` object tells you which pages succeeded.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "artificial intelligence startups",
>     "sources": ["web"],
>     "location": "US",
>     "page": 3
>   }'
> ```
>
> ```json Response (with page 2 failure) theme={"theme":"vitesse-black"}
> {
>     "success": true,
>     "query": "artificial intelligence startups",
>     "timestamp": 1775195500000,
>     "results": [
>         {
>             "source": "web",
>             "title": "AI Startup Landscape 2026",
>             "url": "https://example.com/ai-startups",
>             "snippet": "...",
>             "position": 1
>         },
>         {
>             "source": "web",
>             "title": "Top AI Companies to Watch",
>             "url": "https://example.com/top-ai",
>             "snippet": "...",
>             "position": 2
>         }
>     ],
>     "metadata": {
>         "total_results": 25,
>         "failed_pages": [2],
>         "empty_pages": [3]
>     }
> }
> ```
>
> > [!NOTE]
> >
> > Response trimmed for clarity. Pages 1 succeeded, page 2 failed, page 3 was
> > empty.
>
> The response aggregates results across all successful pages into a single
> `results[]` array. Check `metadata` to understand page-level outcomes:
>
> * **`metadata.total_results`** — total results available across all sources and pages.
> * **`metadata.failed_pages`** — page numbers that returned errors. Retry the request with a smaller `page` value if needed.
> * **`metadata.empty_pages`** — page numbers that returned no results. You have reached the end of available results — **do not retry**.
>
> ```javascript theme={"theme":"vitesse-black"}
> if (response.metadata.failed_pages.length > 0) {
>     console.log("Failed pages:", response.metadata.failed_pages);
> }
>
> if (response.metadata.empty_pages.length > 0) {
>     console.log(
>         "Reached end of results at page",
>         Math.min(...response.metadata.empty_pages),
>     );
> }
> ```
>
> > [!NOTE]
> >
> > **Not guaranteed by the OpenAPI contract:** Each
> > page returns approximately 10 results. If `metadata.empty_pages` contains
> > page numbers, you have reached the end of available results.

### Company and profile discovery

> [accordion] Find a company's website domain
>
> Search for a company by name followed by "website". The first result URL is
> typically the company's website.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "ADAMSBROWN, LLC website",
>     "sources": ["web"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "success": true,
>     "query": "ADAMSBROWN, LLC website",
>     "timestamp": 1775195388180,
>     "results": [
>         {
>             "source": "web",
>             "title": "Adams Brown",
>             "url": "https://www.adamsbrowncpa.com/",
>             "snippet": "Adams Brown is a holistic professional services firm with a team of strategic allies.",
>             "position": 1
>         }
>     ],
>     "metadata": { "total_results": 10, "failed_pages": [], "empty_pages": [] }
> }
> ```
>
> **Extract:** `results[0].url` → `https://www.adamsbrowncpa.com/`
>
> > [!TIP]
> >
> > Do **not** wrap the company name in quotes — this lets the search engine
> > match partial name variations. If the company name is common, add city and
> > state: `"ADAMSBROWN, LLC WICHITA KS website"`.
>
> **Bridge to Company API:** Extract the domain from the URL, then pass it to
> [Company Enrich](https://docs.crustdata.com/company-docs/enrichment/introduction.md) for the full company profile:
>
> ```javascript theme={"theme":"vitesse-black"}
> const url = new URL("https://www.adamsbrowncpa.com/");
> const domain = url.hostname.replace("www.", ""); // "adamsbrowncpa.com"
> ```
>
> ```json Company Enrich request body theme={"theme":"vitesse-black"}
> { "domains": ["adamsbrowncpa.com"] }
> ```

> [accordion] Find a person's profile URL
>
> Use the `site` parameter with the profile host (e.g. `linkedin.com/in`) to
> find a person's profile, then enrich via the Person API.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "Jeff Dean Google",
>     "sources": ["web"],
>     "site": "linkedin.com/in"
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "success": true,
>     "query": "site:linkedin.com/in Jeff Dean Google",
>     "timestamp": 1775195400000,
>     "results": [
>         {
>             "source": "web",
>             "title": "Jeff Dean - Google",
>             "url": "https://www.linkedin.com/in/jeff-dean-8b212555",
>             "snippet": "Chief Scientist at Google DeepMind.",
>             "position": 1
>         }
>     ],
>     "metadata": { "total_results": 5, "failed_pages": [], "empty_pages": [] }
> }
> ```
>
> **Bridge to Person API:** Pass the profile URL to
> [Person Enrich](https://docs.crustdata.com/person-docs/enrichment/introduction.md):
>
> ```json theme={"theme":"vitesse-black"}
> {
>     "professional_network_profile_urls": [
>         "https://www.linkedin.com/in/jeff-dean-8b212555"
>     ]
> }
> ```

> [accordion] Find a developer profile
>
> Use `site: "github.com"` to search for developer profiles on GitHub.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "Tyler Lambe",
>     "sources": ["web"],
>     "site": "github.com",
>     "location": "US"
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "success": true,
>     "query": "site:github.com Tyler Lambe",
>     "timestamp": 1775195572177,
>     "results": [
>         {
>             "source": "web",
>             "title": "Tyler Lambe tylambe",
>             "url": "https://github.com/tylambe",
>             "snippet": "Autodidactic entrepreneur, engineer, educator. tylambe has 9 repositories available.",
>             "position": 1
>         }
>     ],
>     "metadata": { "total_results": 10, "failed_pages": [], "empty_pages": [] }
> }
> ```

### Research and analysis

> [accordion] Search for academic research on a topic
>
> Search for academic articles with date filtering to find papers with
> citation data and PDF links.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "deep learning",
>     "location": "US",
>     "sources": ["scholar-articles"],
>     "start_date": 1672531200,
>     "end_date": 1704067200
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "success": true,
>     "query": "deep learning",
>     "timestamp": 1775195398144,
>     "results": [
>         {
>             "source": "scholar-articles",
>             "title": "Understanding deep learning",
>             "url": "https://books.google.com/books?hl=en&lr=lang_en&id=rvyxEAAAQBAJ",
>             "snippet": "...to this field understand the principles behind deep learning.",
>             "metadata": "SJD Prince - 2023 - books.google.com",
>             "pdf_url": null,
>             "position": 1,
>             "authors": [
>                 {
>                     "name": "SJD Prince",
>                     "profile_url": "https://scholar.google.com/citations?user=fjm67xYAAAAJ",
>                     "profile_id": "fjm67xYAAAAJ"
>                 }
>             ],
>             "citations": 618
>         }
>     ],
>     "metadata": { "total_results": 10, "failed_pages": [], "empty_pages": [] }
> }
> ```
>
> **Extract:**
>
> * `citations` — citation count to gauge impact.
> * `pdf_url` — direct PDF download link (when available).
> * `authors[].profile_url` — Author profile link.
> * `metadata` — citation string: `"Author - Year - Publisher"`.

> [accordion] Look up an academic researcher's profile
>
> Search for a researcher by name to get their full academic profile with
> h-index, citation metrics, and top publications.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "jeff dean",
>     "location": "US",
>     "sources": ["scholar-author"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "success": true,
>     "query": "jeff dean",
>     "timestamp": 1775195567878,
>     "results": [
>         {
>             "source": "scholar-author",
>             "url": "https://scholar.google.com/citations?user=NMS69lQAAAAJ",
>             "name": "Jeff Dean",
>             "affiliation": "Google Chief Scientist, Google Research and Google DeepMind",
>             "citations": { "all": 401624, "since_2020": 231008 },
>             "h_index": { "all": 114, "since_2020": 78 },
>             "i10_index": { "all": 319, "since_2020": 203 },
>             "articles": [
>                 {
>                     "title": "MapReduce: simplified data processing on large clusters",
>                     "year": "2008",
>                     "citations": "37255",
>                     "authors": "J Dean, S Ghemawat"
>                 }
>             ]
>         }
>     ],
>     "metadata": { "total_results": 1, "failed_pages": [], "empty_pages": [] }
> }
> ```
>
> **Extract:** `citations.all` for total impact, `h_index.all` for research
> quality, `articles[]` for top publications.

> [accordion] Get an AI-generated overview of a topic
>
> Use deep research mode for a synthesized answer with source references.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "uv vs pip",
>     "location": "US",
>     "sources": ["ai"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "success": true,
>     "query": "uv vs pip",
>     "timestamp": 1775195563283,
>     "results": [
>         {
>             "source": "ai",
>             "title": "AI Overview",
>             "content": "The primary difference between uv and pip is speed and scope: uv is a modern, high-performance replacement for pip that prioritizes speed and a unified workflow.",
>             "references": [
>                 {
>                     "title": "uv vs pip: Managing Python Packages and Dependencies",
>                     "url": "https://realpython.com/uv-vs-pip/",
>                     "snippet": "When it comes to Python package managers..."
>                 }
>             ],
>             "images": []
>         }
>     ],
>     "metadata": { "total_results": 1, "failed_pages": [], "empty_pages": [] }
> }
> ```
>
> **Extract:** `content` for the overview text, `references[].url` for source
> verification.

> [accordion] Search news with date filtering
>
> Filter news results to a specific date range by providing `start_date` and
> `end_date` as Unix timestamps in seconds.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "artificial intelligence developments",
>     "location": "US",
>     "sources": ["news"],
>     "start_date": 1728259200,
>     "end_date": 1730937600
>   }'
> ```
>
> > [!TIP]
> >
> > `start_date` and `end_date` are Unix timestamps in **seconds**. October 7,
> > 2024 = `1728259200`. November 7, 2024 = `1730937600`.

> [accordion] Search social media posts
>
> Search for recent social media mentions of a topic or person.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "crustdata AI agents",
>     "location": "US",
>     "sources": ["social"]
>   }'
> ```
>
> > [!NOTE]
> >
> > Social media results may return an empty
> > `results` array for some queries depending on availability. Always check
> > `results.length` before processing.

> [accordion] Mixed-source search with safe parsing
>
> When searching multiple sources, the `results[]` array contains items with
> different shapes. Always branch on `result.source`.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "machine learning infrastructure",
>     "location": "US",
>     "sources": ["web", "news", "scholar-articles"]
>   }'
> ```
>
> **Safe parsing logic:**
>
> ```javascript theme={"theme":"vitesse-black"}
> const fetchableUrls = [];
>
> for (const result of response.results) {
>     switch (result.source) {
>         case "web":
>         case "news":
>         case "social":
>             fetchableUrls.push(result.url);
>             break;
>         case "scholar-articles":
>         case "scholar-articles-enriched":
>             fetchableUrls.push(result.url);
>             break;
>         case "scholar-author":
>             console.log(`Author: ${result.name} (${result.affiliation})`);
>             break;
>         case "ai":
>             console.log(`AI Overview: ${result.content}`);
>             result.references?.forEach((ref) => fetchableUrls.push(ref.url));
>             break;
>     }
> }
> ```
>
> > [!NOTE]
> >
> > Not every search result should go to Fetch. Academic author results are
> > profiles, not content pages. Deep research results provide content inline
> > and use `references[].url` for source URLs instead of a top-level `url`.

### Search-then-fetch workflows

> [accordion] End-to-end competitive intelligence
>
> Search for competitor news, then fetch the full article content for
> analysis.
>
> **1. Search for competitor news**
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "OpenAI funding 2026",
>     "location": "US",
>     "sources": ["news", "web"]
>   }'
> ```
>
> Extract URLs from `results[].url`.
>
> **2. Select URLs and fetch content**
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/enrich/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "urls": [
>       "https://www.reuters.com/technology/openai-funding-2026/",
>       "https://techcrunch.com/2026/01/15/openai-funding/"
>     ]
>   }'
> ```
>
> **3. Parse results and handle failures**
>
> Check `success` for each entry. Parse HTML from successful fetches. To
> identify which URLs failed, compare requested URLs against successful
> `url` values.
>
> ```javascript theme={"theme":"vitesse-black"}
> const successfulUrls = new Set(
>   fetchResponse.filter(r => r.success).map(r => r.url)
> );
> const failedUrls = requestedUrls.filter(u => !successfulUrls.has(u));
> ```
>
> > [!NOTE]
> >
> > Failed entries have `url: null`, so correlate failures by comparing
> > successful URLs to your input list. See
> > [Fetch: correlating failures](https://docs.crustdata.com/web-docs/fetch/introduction.md#correlating-failures-to-input-urls).

> [accordion] Full pipeline in Python: search → fetch → parse
>
> A complete Python example that searches, filters fetchable URLs by source,
> fetches content, and handles failures.
>
> ```python theme={"theme":"vitesse-black"}
> import requests
>
> API_KEY = "YOUR_API_KEY"
> HEADERS = {
>     "authorization": f"Bearer {API_KEY}",
>     "content-type": "application/json",
>     "x-api-version": "2025-11-01",
> }
>
> # Step 1: Search
> search_resp = requests.post(
>     "https://api.crustdata.com/web/search/live",
>     headers=HEADERS,
>     json={"query": "OpenAI funding 2026", "sources": ["web", "news"]},
> ).json()
>
> # Step 2: Extract fetchable URLs
> fetchable_urls = []
> for result in search_resp["results"]:
>     if result["source"] in ("web", "news", "social", "scholar-articles", "scholar-articles-enriched"):
>         fetchable_urls.append(result["url"])
>     elif result["source"] == "ai":
>         for ref in result.get("references", []):
>             fetchable_urls.append(ref["url"])
>
> # Step 3: Fetch (max 10 URLs per request)
> fetch_resp = requests.post(
>     "https://api.crustdata.com/web/enrich/live",
>     headers=HEADERS,
>     json={"urls": fetchable_urls[:10]},
> ).json()
>
> # Step 4: Process results and correlate failures
> successful_urls = set()
> for item in fetch_resp:
>     if item["success"]:
>         successful_urls.add(item["url"])
>         print(f"Fetched: {item['title']} ({len(item['content'])} chars)")
>
> failed_urls = [u for u in fetchable_urls[:10] if u not in successful_urls]
> if failed_urls:
>     print(f"Failed URLs: {failed_urls}")
> ```

> [accordion] AI overview → fetch source references
>
> When using deep research mode, the overview `content` is inline. To get the
> full source articles, fetch the URLs from `references[]`.
>
> **1. Search with deep research mode**
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{"query": "uv vs pip", "sources": ["ai"], "location": "US"}'
> ```
>
> **Extract:** `results[0].references[].url` — the source article URLs.
>
> **2. Fetch the reference URLs**
>
> ```bash theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/enrich/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{"urls": ["https://realpython.com/uv-vs-pip/"]}'
> ```
>
> Parse the `content` from successful entries to read the full source
> articles.
>
> > [!NOTE]
> >
> > AI results do not have a top-level `url` field. Always use
> > `references[].url` for fetch targets.

> [accordion] Migrating from fetch\_content to the two-step search → fetch flow
>
> In the older API you could append `?fetch_content=true` to a web search to get
> page HTML inline in a `contents[]` array. **That parameter is removed in
> `2025-11-01`** — it is silently ignored, and the search response never returns
> a `contents[]` field. Instead, run web search first, then pass the result URLs
> to [Web Fetch](https://docs.crustdata.com/web-docs/fetch/introduction.md) (`POST /web/enrich/live`).
>
> **1. Search the web**
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/search/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "query": "parallel ai seed funding",
>     "sources": ["news"]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> {
>     "success": true,
>     "query": "parallel ai seed funding",
>     "timestamp": 1782698294157,
>     "results": [
>         {
>             "source": "news",
>             "title": "Ex-Twitter CEO Agrawal's AI search startup Parallel raises $100 million",
>             "url": "https://www.reuters.com/business/ex-twitter-ceo-agrawals-ai-search-startup-parallel-raises-100-million-2025-11-12/",
>             "snippet": "AI startup Parallel Web Systems, founded by former Twitter CEO Parag Agrawal, has raised $100 million...",
>             "position": 3
>         }
>     ],
>     "metadata": { "total_results": 10, "failed_pages": [], "empty_pages": [] }
> }
> ```
>
> **Extract** the URLs you want from `results[].url`.
>
> **2. Fetch the result URLs**
>
> Pass up to 10 URLs to `POST /web/enrich/live`. Each entry comes back with
> `success`, `url`, `timestamp`, `title`, and the full page `content`.
>
> ```bash Request theme={"theme":"vitesse-black"}
> curl --request POST \
>   --url https://api.crustdata.com/web/enrich/live \
>   --header 'authorization: Bearer YOUR_API_KEY' \
>   --header 'content-type: application/json' \
>   --header 'x-api-version: 2025-11-01' \
>   --data '{
>     "urls": [
>       "https://www.reuters.com/business/ex-twitter-ceo-agrawals-ai-search-startup-parallel-raises-100-million-2025-11-12/"
>     ]
>   }'
> ```
>
> ```json Response theme={"theme":"vitesse-black"}
> [
>     {
>         "success": true,
>         "url": "https://www.reuters.com/business/ex-twitter-ceo-agrawals-ai-search-startup-parallel-raises-100-million-2025-11-12/",
>         "timestamp": 1782698339,
>         "title": "Ex-Twitter CEO Agrawal's AI search startup Parallel raises $100 million | Reuters",
>         "content": "<html>...</html>"
>     }
> ]
> ```
>
> > [!NOTE]
> >
> > **What changed.** The old inline `fetch_content` flag is gone; fetching is
> > now a separate, independently-billed call to `/web/enrich/live`. This lets
> > you fetch only the URLs you actually need (and respect the 10-URL-per-call
> > fetch limit) rather than fetching every search result. Search `timestamp`
> > is in **milliseconds**; Fetch `timestamp` is in **seconds**.

***

## What to do next

* **Understand result shapes** — see [Sources](https://docs.crustdata.com/web-docs/search/reference.md#sources) for field presence by source.
* **Look up request/response details** — see [Reference](https://docs.crustdata.com/web-docs/search/reference.md) for request parameters, response body, error handling, and common gotchas.
* **Fetch page content** — see [Web Fetch](https://docs.crustdata.com/web-docs/fetch/introduction.md) to fetch the HTML content of URLs returned by search results.


## Related topics

- [Capabilities](https://docs.crustdata.com/general/capabilities.md)
- [Web Fetch API](https://docs.crustdata.com/web-docs/fetch/introduction.md)
- [Web Search reference](https://docs.crustdata.com/web-docs/search/reference.md)
- [API Introduction](https://docs.crustdata.com/openapi-specs/2025-11-01/introduction.md)
- [People Search API](https://docs.crustdata.com/person-docs/search/introduction.md)
