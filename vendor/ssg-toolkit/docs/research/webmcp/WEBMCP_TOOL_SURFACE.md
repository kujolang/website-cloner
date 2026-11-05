# Proposed universal WebMCP tool surface

> Historical research baseline (August 2026). SSG 1.1.0 enables experimental WebMCP by default; see [the amended ADR](../../architecture/adr-0001-experimental-webmcp-v1.md) and [current usage](../../webmcp.md).

Decision: four read-only imperative tools. The goal is minimum overlap, bounded output, and universal content-site value.

Common rules:

- Static registration on every eligible generated content page.
- Generator-owned names/descriptions/schemas.
- `readOnlyHint: true` and `untrustedContentHint: true` on every MVP tool.
- Strict input validation in the handler even when the browser validates JSON Schema.
- `additionalProperties: false`, bounded integers, normalized routes/types, and no arbitrary regex.
- Results are objects/arrays, not HTML or prose blobs.
- Default limit 5; hard maximum 10 for search/list; one item for get.
- Content text is a bounded summary/excerpt, never full rendered HTML.

## 1. `get_site_info`

| Property | Decision |
|---|---|
| Purpose | Orient the agent to the current public site and its discoverable content model |
| Inputs | None (`{type: "object", additionalProperties: false}`) |
| Outputs | schema version, site title/tagline/base URL/language, flat main navigation, content types with counts and taxonomy names |
| Classification | Read-only |
| Data source | Static index header derived from settings, structured navigation inputs, and eligible records |
| Universality | High |
| Token cost | Low; cap navigation/types and omit item data |
| Security | Only public site metadata; navigation labels are untrusted content; no filesystem/config internals |
| Recommended | Yes |

Example result:

```json
{
  "schema": "kujo-ssg-site-index/v1",
  "site": {
    "title": "Downriver Home Services",
    "tagline": "Trusted maintenance across southeast Michigan.",
    "url": "https://example.com",
    "language": "en"
  },
  "navigation": [
    {"label": "Home", "url": "/"},
    {"label": "Services", "url": "/services/"}
  ],
  "content_types": [
    {"name": "pages", "count": 4, "taxonomies": []},
    {"name": "services", "count": 12, "taxonomies": ["service-area"]}
  ]
}
```

Do not create a separate `get_navigation`; navigation alone is too small to justify another tool and increases overlap.

## 2. `search_site`

| Property | Decision |
|---|---|
| Purpose | Search public, search-eligible content across the site |
| Inputs | `query` required string (1–200 chars); optional `limit` 1–10; optional `content_type` enum/string validated against discovered types |
| Outputs | query, bounded result array, returned count, `has_more`; each result has id/title/description/url/type/score plus matched taxonomy labels when useful |
| Classification | Read-only |
| Data source | Lazy-loaded index records where `searchable: true` |
| Universality | Very high |
| Token cost | Low/medium; hard bounds and short strings |
| Security | Search text and results are untrusted; escape only for UI, serialize as data; reject pathological input; no body HTML |
| Recommended | Yes; foundational |

Ranking for v1 should be deterministic and explainable: normalized exact title match, title prefix/token match, title contains, taxonomy/tag contains, description/summary contains. Do not claim semantic/vector relevance. Return an integer score used only for ordering, with route as deterministic tie-breaker.

`search_exclude: true` sets `searchable: false`. It does not remove a public record from `list_content` or `get_content`.

## 3. `list_content`

| Property | Decision |
|---|---|
| Purpose | Browse pages, posts, or any discovered custom collection with simple structured filters |
| Inputs | required `type`; optional `taxonomy` object; optional `limit` 1–10; optional opaque/stable `cursor` after MVP if needed |
| Outputs | type, applied filters, bounded item summaries, returned count, total matching count/`has_more` |
| Classification | Read-only |
| Data source | Index records grouped by type |
| Universality | High, especially because Kujo auto-discovers collections |
| Token cost | Medium but bounded |
| Security | Type/taxonomy allowlist; no dynamic property traversal; public records only |
| Recommended | Yes |

Taxonomy v1:

```json
{
  "type": "locations",
  "taxonomy": {
    "state": ["Michigan"],
    "service": ["Roof Repair", "Gutter Repair"]
  },
  "limit": 5
}
```

Semantics: AND across taxonomy names; OR within a taxonomy's term list; case-insensitive exact normalized label match. Cap at three taxonomy names and five terms per name. Avoid an expression language.

Services are handled as `list_content(type: "services")`. Do not generate collection-specific aliases: every extra tool consumes agent context and makes tool selection depend on arbitrary folder names.

## 4. `get_content`

| Property | Decision |
|---|---|
| Purpose | Retrieve one known public record after search/list discovery |
| Inputs | required `id` **or** `url`; not both; exact match only |
| Outputs | id, type, title, description, summary, URL, language, resolved taxonomies, selected public metadata |
| Classification | Read-only |
| Data source | Index item map |
| Universality | High |
| Token cost | Medium; cap summary and arrays |
| Security | Exact public lookup; no arbitrary fetch; never return source path, raw frontmatter, full HTML, scripts, or secrets |
| Recommended | Yes |

Use stable IDs such as `pages:about` or `services:roof-repair`, while URL is the collision-proof public identity. If IDs collide after normalization, fail the build rather than silently choosing one.

## Rejected or deferred candidates

| Candidate | Decision | Reason |
|---|---|---|
| `find_page` | Reject | `search_site` with `content_type: "pages"` covers title/slug/topic discovery |
| `get_page` | Reject | `get_content` covers pages without a duplicate schema |
| `list_pages` | Reject | `list_content(type: "pages")` covers it |
| `get_navigation` | Reject for MVP | Compact navigation belongs in `get_site_info` |
| `get_services` | Reject | Site-specific collection alias; generic type discovery is stronger |
| `navigate_to` | Reject | Browser agents already navigate; returning canonical URLs is enough; navigation changes state/page lifetime |
| one tool per collection | Reject | Unbounded context growth and arbitrary naming; makes universal behavior less universal |
| full-page/body tool | Reject for MVP | Large untrusted payloads increase context and prompt-injection risk; bounded summary plus canonical URL is sufficient |
| `list_taxonomies` | Defer | Taxonomy names are discoverable in site info; filters live in `list_content` |
| form submission tools | Defer/explicit opt-in | Cannot infer user intent, mutation, endpoint safety, or confirmation semantics from arbitrary HTML safely |
| admin/publish/update/delete/deploy | Out of scope | Requires authenticated stateful backend and belongs to CMS/MCP integrations, not static baseline |

## Why imperative for content tools

Search, discovery, and record retrieval are pure JavaScript operations over static data, not form submissions. The imperative API gives explicit schemas, bounded returned objects, lazy fetching, cancellation, and lifecycle isolation. Declarative WebMCP is the correct future mechanism for explicitly opted-in human-visible forms.

## Form policy

Kujo must not scan arbitrary output and automatically turn every form into a tool. A future site author may opt in by writing current standard attributes directly in a template, or Kujo may later offer a minimal structured helper that emits them. Default behavior:

- no generated annotations;
- no `toolautosubmit`;
- preserve native labels, required/type constraints, autocomplete, and visible user interaction;
- treat search/filter forms as lower-risk read interactions but still explicit;
- require intentional confirmation for contact, quote, newsletter, purchase, or other writes;
- never expose hidden anti-CSRF values, credentials, or unrelated controls as agent parameters.

## Extension boundary

Site-specific tools such as `calculate_mortgage`, `configure_product`, or `build_quote` should not be represented in the core index. The architecture should leave room for a user-owned external JS file loaded after the Kujo adapter. Do not implement a config-driven extension API until lifecycle, collision, CSP, versioning, and support responsibility are designed. In particular, the SSG should not concatenate untrusted content into executable extension code.

## Tool-selection eval prompts

The implementation plan should include direct and ambiguous prompt sets:

- “What does this organization offer?” -> `get_site_info`, then `list_content` or `search_site`.
- “Find maintenance services.” -> `search_site`.
- “List all service areas in Michigan.” -> `list_content` with taxonomy.
- “Tell me about Roof Repair.” -> search then `get_content`.
- “Open the contact page.” -> search returns URL; the browser navigates without a dedicated tool.
- Adversarial content containing “ignore previous instructions” -> returned only as untrusted data and never changes tool choice/description.
