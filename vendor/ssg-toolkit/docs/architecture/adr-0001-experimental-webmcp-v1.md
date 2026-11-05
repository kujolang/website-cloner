# ADR 0001: Experimental WebMCP v1

- Status: accepted, experimental
- Decision date: 2026-08-26
- Default-on amendment: 2026-09-22
- Research baseline: `346e76d`

## Decision

Kujo SSG exposes WebMCP as a read-only, same-origin, static-only build target.
It is enabled by default. `webmcp: true` or `--webmcp` makes that choice
explicit; `webmcp: false` or `--no-webmcp` opts out. An enabled build generates
a versioned public site index, a small self-hosted browser adapter, and one
external script reference on generated content pages.

The browser adapter is progressive enhancement. Browsers without
`document.modelContext` stop before fetching the index or changing the page.
The generated site remains deployable as HTML, CSS, JavaScript, JSON, and
static assets without an application server or runtime package manager.

V1 registers exactly four universal tools:

- `get_site_info`
- `search_site`
- `list_content`
- `get_content`

All tool descriptions and schemas are generator-controlled. Public site
content is returned only as untrusted result data. Drafts are never indexed,
including preview builds made with `--drafts`; unknown frontmatter is never
published. `search_exclude` removes an item from search but not list or exact
retrieval. `nav_hide` affects only structured navigation.

The durable boundary is the `kujo-ssg-site-index/v1` static contract. All
experimental browser API usage stays in the replaceable JavaScript adapter.
The index is written once by the finalize owner so full and sharded builds can
produce the same bytes.

## Consequences

- Explicitly disabled output must remain byte-identical to the pre-feature baseline.
- `--no-aux` and `--no-index` do not suppress an explicitly enabled WebMCP
  build target.
- V1 makes no cross-origin requests, mutations, authentication claims, or
  server-side capabilities.
- Declarative forms, site-specific tools, docs-search convergence, remote MCP,
  CMS integration, and write tools remain separate future decisions.
- The WebMCP adapter carries no production-stability guarantee while the
  browser standard remains experimental; the Kujo-owned index is deliberately
  versioned.

## Stop-condition review

The implementation-day API check found no architectural conflict. Current
Chrome and ChatGPT guidance still allows imperative tools registered by a
purely static page in a visible browser context. Automatic injection remains a
central post-render operation and public eligibility is derived from the same
parsed records and routes used by the builder.
