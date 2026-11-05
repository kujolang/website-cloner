# WebMCP feasibility for Kujo SSG

> Historical research baseline (August 2026). SSG 1.1.0 enables experimental WebMCP by default; see [the amended ADR](../../architecture/adr-0001-experimental-webmcp-v1.md) and [current usage](../../webmcp.md).

Checked: 2026-08-26

## Decision

**EXPERIMENTAL — implement behind an explicitly experimental, opt-in flag.**

Confidence: **high** that the baseline is technically feasible and fits the SSG; **medium** that the current browser API will remain source-compatible through stabilization.

Kujo SSG should make WebMCP an experimental first-class build capability, not a default and not a production-stability promise. The strongest architecture is a build-time public-content model, one versioned static index, and a small generated browser adapter. The baseline is read-only. It needs no application server, database, remote MCP server, Node, Python, client framework, or runtime package.

The one-line experience should be:

```yaml
webmcp: true
```

with an equivalent one-build override:

```bash
kujo run ./build.kujo -- --webmcp
```

Absence and `webmcp: false` preserve existing output. A future `--no-webmcp` is unnecessary for the first slice because CLI flags currently only enable booleans; add it only if nested config or inherited environments create a real need.

## Why the answer is not an unconditional YES

WebMCP is a proposed Community Group API and a Chrome origin-trial/flag feature, not a broadly shipped web baseline. Chrome changed the producer surface from deprecated `navigator.modelContext` to `document.modelContext`, and lifecycle details continue to evolve. The current official imperative API, however, is sufficiently concrete to isolate behind a small adapter: `registerTool`, JSON Schema inputs, annotations, AbortSignal-based registration lifetime, and cancellation signals for execution. ChatGPT's in-app browser supports WebMCP for challenge testing, while Chrome requires the experimental flag or origin trial ([Chrome overview](https://developer.chrome.com/docs/ai/webmcp), [imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [OpenAI challenge](https://openai.com/webmcp-challenge/)).

This volatility argues for an experimental label, not for postponing the data architecture. A stable Kujo-owned site-index contract can outlive browser adapter changes.

## Static-only feasibility proof

The baseline execution chain is:

```text
Kujo build
  -> output/assets/kujo-webmcp.js
  -> output/.well-known/kujo-site-index.json (or a versioned equivalent)
  -> ordinary static hosting
  -> browser loads HTML and small same-origin bootstrap
  -> bootstrap exits if document.modelContext is absent
  -> tools register
  -> first data-bearing call fetches static JSON and caches it in memory
```

Every operation required by the proposed baseline exists in browser JavaScript: feature detection, same-origin `fetch`, JSON parsing, array filtering/ranking, bounded object serialization, and WebMCP tool registration. The WebMCP `execute` callback is page JavaScript and may return an asynchronously computed value; it does not require a server endpoint. Static hosts already serve `.js` and `.json`. Therefore:

- No Node, Python, Kujo, database, remote MCP, or application API is required after build.
- GitHub Pages, Cloudflare Pages, Netlify, static Vercel, object storage, and ordinary static web servers can preserve the baseline, subject to serving over a secure origin and normal MIME/CSP configuration.
- A visible browser document is required. WebMCP tools are page-bound and are not an always-available background MCP service.
- `file://` is not the supported deployment model; use `kujo serve output` or another HTTP server locally because same-origin fetch and secure-context behavior matter.

The feature is progressive enhancement: unsupported browsers execute a property check and return before fetching the index. Human-visible HTML, navigation, local search, SEO, RSS, sitemap, and `llms.txt` remain independent.

## Product value

The useful improvement over DOM guessing is not merely “more metadata.” It is a bounded, deterministic capability contract over the complete public site, including content not present in the current DOM. An agent can reliably discover collections, filter taxonomies, search public summaries, and retrieve one known record without crawling routes or inferring site-specific markup.

This strengthens Kujo's Clarity / Context / Control positioning:

- **Clarity:** a small documented universal tool set and versioned result contracts.
- **Context:** a build-derived public site model shared by HTML-adjacent outputs.
- **Control:** explicit opt-in, public-only inclusion policy, bounded responses, deterministic artifacts, and isolated experimental adapter.

## Recommended MVP

Register four read-only imperative tools on every generated content page:

1. `get_site_info`
2. `search_site`
3. `list_content`
4. `get_content`

Do not add `find_page`, `list_pages`, `get_page`, `get_navigation`, `get_services`, or `navigate_to` in the MVP. Their useful behavior is covered by the four tools with less tool-selection overlap. Site information should include compact navigation and collection summaries. `list_content(type: "services")` is the universal services solution.

All four tools should carry:

```js
annotations: {
  readOnlyHint: true,
  untrustedContentHint: true
}
```

The latter is required because Markdown/frontmatter-derived text can contain prompt injection even when it is first-party content. Tool descriptions and schemas must remain generator-controlled; content is returned only as data.

## Main architectural choices

- Generate one `kujo-ssg-site-index/v1` public-content artifact as the canonical WebMCP dataset.
- Derive it from the same normalized public records that should eventually feed sitemap, `llms.txt`, local search, and parts of RSS; do not parse those generated files back.
- Keep RSS's post/date/feed-specific projection separate and keep sitemap's route-only projection separate.
- Reuse concepts from the docs search index, but not its generator or schema. The existing index is docs-starter-specific, duplicates parsing/routing, includes Python and Kujo implementations, truncates body text to 360 characters, and knows docs fields but not core collection taxonomies.
- Emit and assemble records in finalize so parallel post shards never race on the final index.
- Load the static index only on the first data-bearing tool invocation.
- Inject the external runtime at layout-render time, after the selected custom layout has rendered. This avoids requiring a template placeholder and makes custom layouts work. Insert before `</body>` when present, otherwise before `</html>`, otherwise append. Treat a missing safe insertion point as a clear build warning/error in WebMCP mode.
- Use a relative runtime URL calculated from route depth and have the runtime resolve the index with `new URL(indexPath, document.baseURI)` or a script `data-*` URL. Do not assume root deployment.

## Key risks and controls

| Risk | Control |
|---|---|
| Browser API churn | One tiny adapter, schema contract independent of WebMCP, explicit experimental status, conformance tests against current Chrome |
| Draft/preview leakage | Central public-record eligibility function; exclude drafts unconditionally from WebMCP v1, even when `--drafts` renders them |
| “Hidden” metadata leakage | Field allowlist; never serialize source paths, arbitrary frontmatter, env/config, internal lookup IDs, or build state |
| Prompt injection | `untrustedContentHint: true`, bounded outputs, generator-owned descriptions, content-as-data, hostile-content tests |
| XSS/JSON/script injection | External JSON only, standards serializer, no content interpolation into executable JS, `application/json`, strict URL validation |
| Human performance regression | tiny feature-detection bootstrap; lazy index fetch; no work in unsupported browsers |
| Large index memory/latency | compact fields, response limits, manifest plus shards above a measured threshold, no body HTML |
| Custom template omission | post-render deterministic script injection, not a new placeholder users must add |
| Duplicate search artifacts | migrate docs search to the shared core index only after parity tests; do not block MVP on that migration |

## Go/no-go gates

Implementation may move from experimental toward supported only when:

- the then-current WebMCP surface is confirmed from official sources;
- Chrome flag/origin-trial and ChatGPT in-app-browser smoke tests pass;
- disabled output is byte-for-byte unchanged apart from deliberately excluded docs/version files;
- draft, preview, hostile-content, custom-layout, subpath, no-aux, no-index, minify, and parallel-build contracts pass;
- generated index URLs all map to generated canonical routes and contain no source paths;
- performance budgets are measured on at least 100, 1,000, and 10,000 records.

## Direct answers to the 30 required questions

1. **Zero runtime server?** Yes, for read-only discovery/search/retrieval. A visible secure browser page is still required.
2. **Generated static JS/data only?** Yes.
3. **One-line/flag experience?** `webmcp: true` or `--webmcp`; default off.
4. **Universal tools?** `get_site_info`, `search_site`, `list_content`, `get_content`.
5. **`get_services`?** No. Use `list_content(type: "services")` and expose discovered types through `get_site_info`.
6. **Artifact?** A deterministic, allowlisted, versioned `kujo-ssg-site-index/v1` JSON artifact; final filename should be stable and non-WebMCP-specific.
7. **Reuse current search?** Reuse its lessons and later its consumer, not its docs-specific generator/schema as the core.
8. **Shared model?** Yes: one internal public-content model, separate projections for site index, sitemap, RSS, and `llms.txt`.
9. **Collections?** Auto-discover existing `content/<type>/` collections and emit type metadata/items.
10. **Taxonomies?** Emit resolved public term labels by taxonomy name; support one simple `taxonomy` object filter using AND across names and OR within a term list.
11. **Automatic forms?** No.
12. **Form API?** Declarative WebMCP for explicitly annotated ordinary forms; imperative only when a site's interaction cannot be expressed as a form.
13. **Custom templates?** Inject an external bootstrap into final rendered HTML centrally, with deterministic placement and validation.
14. **`--minify`?** Minify generated JS through the existing asset minifier; JSON is compact in both modes because it is a data-transfer artifact, not a readability surface.
15. **`--no-aux`?** WebMCP remains independently enabled. `--no-aux` currently means feed/sitemap/robots/llms, and explicit `--webmcp` should not be silently defeated.
16. **`--no-index`?** No effect. It means HTML home/blog listing pages, not data indexes.
17. **Parallel builds?** Post shards write deterministic private record fragments; finalize merges, sorts, validates, and writes the single public artifact/runtime references.
18. **Draft/private prevention?** A central allowlist and publish eligibility gate; drafts are never in WebMCP v1, including preview builds. No arbitrary metadata.
19. **`search_exclude`?** Exclude from search matching/results but keep retrievable/listable if the route is public. It is not privacy.
20. **Unsupported browsers?** Silent early return; normal site behavior.
21. **Human runtime cost?** One small same-origin JS response and a property check; zero index fetch/parsing unless WebMCP exists and a data tool is invoked.
22. **Lazy loading?** Yes; required for the MVP.
23. **Large sites?** Single compact file through a measured threshold; manifest plus deterministic type/hash shards for larger builds. Bound every result.
24. **Security?** Main risks are data leakage, prompt injection, unsafe serialization/URLs, XSS, oversized payloads, cross-origin exposure, and accidental form submission; controls are specified in `WEBMCP_SECURITY.md`.
25. **Tests?** Disabled parity, config/CLI, artifact/schema, visibility/privacy, routes, tool unit/integration, browser smoke/evals, custom template, subpath, minify, no-aux/no-index, parallel determinism, CSP, and performance.
26. **Differentiated?** Some third-party Astro work already offers build-time static manifests and one-line integration, so absolute novelty is not defensible. First-party Kujo integration with native content/taxonomy inference and no Node dependency remains meaningfully differentiated among the surveyed SSG cores.
27. **Kujo positioning?** Yes, directly through build-visible data contracts, inferred context, and opt-in deterministic control.
28. **Challenge strength?** Yes, if delivered as a polished static demo with meaningful collection/taxonomy interaction. Merely registering four trivial tools is not enough.
29. **First implementation?** The public-content record model and deterministic v1 index, with no browser code.
30. **Build it?** Yes, experimentally and with the reduced read-only scope above.

## Challenge recommendation

The concept matches the challenge's usefulness, execution, impact, and creativity criteria, and the required live URL may use any ordinary host ([official challenge requirements](https://webmcp.devpost.com/)). The demo should prove more than “search works”: use a normal multi-collection business or regional-services site, ask cross-cutting questions that require collection discovery and taxonomy filtering, show the tool calls in ChatGPT's in-app browser, then reveal that the deployment is only static files.

Best accurate positioning: **“Kujo compiles your content for humans and agents.”** “WebMCP as a build target” is the strongest technical subtitle. Avoid “agent-native by default,” because the capability is intentionally opt-in and browser support is experimental.

## Research boundary

No production code, templates, assets, config, tests, CI, or release scripts were changed for this investigation. Main repository sweep exclusions: `output/**`, minified vendor assets, fonts, images, `static/**`, and `tmp/**`, except where generated-output behavior was examined through contracts.
