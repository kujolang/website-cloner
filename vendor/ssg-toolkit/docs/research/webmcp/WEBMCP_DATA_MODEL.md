# Static agent-facing data model

## Decision

Create a generic, versioned **public site index**, not `webmcp.json`. WebMCP is one consumer; a non-browser-specific name and schema leave room for docs search, local AI, future MCP adapters, and static APIs.

Working contract name:

```text
kujo-ssg-site-index/v1
```

Working output location:

```text
/.well-known/kujo-site-index.json
```

The exact path should be confirmed during implementation against subpath/static-host behavior. If dot-directories are awkward on a supported host, use `/assets/kujo/site-index.json`; schema identity matters more than the filename.

## Internal model versus published projection

The builder should have one normalized public-content record model and several projections:

```text
parsed public content
        |
        v
normalized public records + public routes
        |
        +-> HTML
        +-> sitemap route projection
        +-> RSS post projection
        +-> llms link projection
        +-> site-index projection
        +-> docs search projection (later)
```

This does not require immediately rewriting every existing output. Introduce the normalized record for the index, prove parity, then migrate duplicate consumers incrementally.

## Eligibility and field policy

An index item must satisfy all of these:

- it has a generated public content route in the current build;
- it is not a draft, even when `--drafts` renders a preview build;
- it is a page, post, custom collection item, or intentionally modeled listing;
- its URL and ID pass normalization/duplicate validation;
- only explicit allowlisted fields are serialized.

`nav_hide` affects only the navigation projection. `search_exclude` sets `searchable: false`. Neither means private. Preview-only drafts require a future separate explicit unsafe/preview feature if ever needed; v1 excludes them unconditionally.

Do not publish:

- source or absolute filesystem paths;
- arbitrary frontmatter or build settings;
- environment variables, credentials, tokens, remote-fetch headers;
- internal numeric taxonomy/author lookup IDs;
- template names or implementation flags;
- draft/unpublished record existence;
- raw Markdown, full HTML, scripts, event attributes, or form secrets;
- alias routes as separate items.

## V1 schema shape

```json
{
  "schema": "kujo-ssg-site-index/v1",
  "generated_by": {
    "name": "kujo-ssg",
    "version": "1.0.0"
  },
  "site": {
    "title": "Kujo SSG Starter Site",
    "tagline": "A complete starter site.",
    "url": "https://example.com",
    "base_path": "/",
    "language": "en"
  },
  "navigation": [
    {"label": "Home", "url": "/"},
    {"label": "Blog", "url": "/blog/"},
    {"label": "About", "url": "/about/"}
  ],
  "content_types": [
    {
      "name": "pages",
      "title": "Pages",
      "count": 3,
      "taxonomies": []
    },
    {
      "name": "storefronts",
      "title": "Storefronts",
      "count": 3,
      "listing_url": "/storefronts/",
      "taxonomies": ["location"]
    }
  ],
  "items": [
    {
      "id": "storefronts:north-austin",
      "type": "storefronts",
      "slug": "north-austin",
      "url": "/storefronts/north-austin/",
      "title": "North Austin",
      "description": "Visit the North Austin storefront.",
      "summary": "Public bounded excerpt generated from the item body.",
      "language": "en",
      "searchable": true,
      "published": "2026-05-10",
      "updated": "2026-05-12",
      "taxonomies": {
        "location": ["Austin"],
        "tags": ["Retail"]
      }
    }
  ]
}
```

Implementation schema should additionally constrain lengths, patterns, arrays, and allowed nullable/omitted fields. Omit empty optional values rather than emitting many empty strings.

## Field semantics

| Field | Rule |
|---|---|
| `schema` | Exact contract identifier, required |
| `generated_by` | Generator identity/version, not timestamps |
| `site.url` | Normalized configured site URL or empty/omitted when unavailable |
| `base_path` | Deployment path derived from site URL/config; never assume `/` internally |
| `language` | Normalized BCP-47-like value already used by SSG; site default inferred deterministically |
| `navigation` | Ordered flat public navigation from existing source inputs; `nav_hide` removed |
| `content_types` | Deterministically sorted summaries, including automatically discovered collections |
| `id` | Stable `<type>:<slug>` identifier; duplicate is build error |
| `url` | Generated clean public route, root-relative to deployment base or absolute by documented policy |
| `description` | Explicit public description with a conservative max length |
| `summary` | Plain-text, whitespace-normalized bounded excerpt; no HTML |
| `searchable` | False only when `search_exclude` is true; eligible for exact retrieval/list regardless |
| `published`/`updated` | ISO dates only when existing valid frontmatter supports them |
| `taxonomies` | Normalized names and resolved display labels, stable-sorted |

Do not store “relevance”; it is query-dependent. Search computes a deterministic score at runtime.

## Determinism

- No generated timestamp in the contract. It breaks byte-for-byte rebuilds and caching without adding agent value.
- Sort object projections by explicit construction order and arrays by documented stable keys.
- Sort content types by name; items by `(type, url, id)`; taxonomy names and terms by normalized case-insensitive label.
- Serialize with the Kujo runtime JSON serializer and a trailing newline. Never manually concatenate content into JSON.
- Fail on duplicate IDs/URLs, invalid control characters, escaping routes, or unknown schema state.
- Full and parallel builds must produce byte-identical index/runtime artifacts.

## Search text

Index only a concise plain-text summary in v1. Candidate maximums:

- title: 160 characters;
- description: 320 characters;
- summary: 600 characters;
- taxonomy name: 64 characters;
- taxonomy term: 128 characters;
- at most 20 terms per record after deterministic truncation/error policy.

This is enough for useful client substring/token search without turning every call into full-site content transfer. Headings may be added later only if evals show a clear retrieval benefit; the docs index currently demonstrates their value, but they also increase size.

## Lazy loading

The bootstrap registers schemas without fetching item data. `get_site_info` may use a small embedded/generated header constant only if it remains content-free and avoids duplication; the simpler MVP is to lazy-fetch the same index on its first invocation. Cache one promise so concurrent tool calls share a request. Pass the execution cancellation signal to fetch, but do not let one cancelled consumer poison the global cache permanently.

Unsupported browsers return before any fetch. Supported browsers that never invoke a tool also do not download the index.

## Scaling evidence and policy

A synthetic compact record containing ID/type/slug/URL/title/description/summary/language/two taxonomies measured on this machine:

| Items | Raw JSON | gzip | local Python parse |
|---:|---:|---:|---:|
| 10 | 3.9 KB | 0.4 KB | 0.34 ms |
| 100 | 38.8 KB | 1.6 KB | 0.42 ms |
| 1,000 | 391.6 KB | 12.0 KB | 4.62 ms |
| 10,000 | 4.0 MB | 115.9 KB | 73.0 ms |
| 50,000 | 20.0 MB | 575.7 KB | 416.5 ms |

These are directional, not browser benchmarks: compression is highly favorable because records repeat keys, while uncompressed parse/memory becomes the limiting cost. Real text diversity will raise compressed size.

Recommended policy:

- 10–1,000 items: one file.
- 1,000–10,000: one file remains viable with lazy load, but measure target mobile browsers and real content.
- Beyond a configurable/measured raw-size threshold (candidate 2 MB) or 10,000 items: generate a small manifest plus deterministic shards by content type and stable hash prefix.
- 50,000: never force one 20 MB parse for a single query. Use manifest metadata and type shards; consider a separate compact term index only after benchmarks.

Do not overengineer sharding in the first vertical slice, but version the schema and runtime loader so a v1 manifest can gain `shards` without changing tool contracts.

Example manifest extension:

```json
{
  "schema": "kujo-ssg-site-index/v1",
  "site": {},
  "navigation": [],
  "content_types": [],
  "shards": [
    {"type": "pages", "url": "./site-index/pages.json", "count": 800},
    {"type": "posts", "url": "./site-index/posts-00.json", "count": 2500}
  ]
}
```

Search across many shards may need a smaller global search projection later. Do not create both a full `webmcp-index.json` and nearly identical `search-index.json` in v1.

## Caching and invalidation

Stable filenames are simple and work with default static-host validation. They require `Cache-Control: no-cache` or short revalidation for correctness, which many static hosts can configure but the SSG cannot guarantee.

Content-hashed shard filenames improve immutable caching but require a stable manifest whose cache must revalidate. Recommended eventual model:

- stable manifest URL;
- hashed data/runtime assets;
- relative URLs in manifest;
- manifest revalidation, immutable hashed children.

For MVP, deterministic stable names are acceptable. Document cache headers for hosts; do not embed a build timestamp as cache busting.

## Subpaths and offline/local use

- Resolve URLs relative to the bootstrap script or explicit generated `data-index-url`, not origin root.
- Preserve `site_url` subpaths when producing absolute URLs.
- Root-relative links are wrong for deployments at `https://host.example/project/` unless base path is applied.
- Same-origin relative fetch keeps offline/local-server and CSP behavior straightforward.
- Service workers are not required.

## Relationship to existing outputs

| Artifact | Role |
|---|---|
| `sitemap.xml` | crawler route discovery and crawl hints |
| `llms.txt` | text-oriented AI/crawler guidance and links |
| JSON-LD | page-level search/semantic-web structured metadata |
| RSS | recent-post syndication |
| docs search index | current docs-starter local UI search dataset |
| site index | structured build-time public content dataset for bounded runtime consumers |
| WebMCP adapter | interactive agent tool binding over the site index |

The index should not be advertised as secret or access-controlled. Anything in it is publicly downloadable. Privacy must be guaranteed before serialization.
