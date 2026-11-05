# WebMCP competitor and ecosystem research

> Historical research baseline (August 2026). SSG 1.1.0 enables experimental WebMCP by default; see [the amended ADR](../../architecture/adr-0001-experimental-webmcp-v1.md) and [current usage](../../webmcp.md).

Checked: 2026-08-26. Evidence categories are explicit because absence is hard to prove and WebMCP is moving quickly.

## Method

Searched first-party framework repositories/documentation and public GitHub results for `WebMCP`, `document.modelContext`, `navigator.modelContext`, `toolname`, and related integrations across Next.js, Astro, Hugo, Jekyll, Eleventy, Gatsby, Nuxt, Remix, VitePress, Docusaurus, and WordPress. “Not found” means no first-party native support was found in the reviewed public evidence; it is not a claim that no issue, fork, plugin, or unretrieved branch exists.

## Verified comparable work

### Third-party Astro integration

[`astro-webmcp`](https://github.com/fabricioctelles/astro-webmcp) is the closest verified prior art. It advertises one-line Astro integration, injects a client script on every page, generates a static `/_webmcp/manifest.json` at build completion by extracting built HTML metadata, registers four tools, uses client-side search, and requires no server for small/medium static sites. It explicitly supports feature detection and follows current/legacy producer names.

Implications:

- Kujo cannot claim to be the first SSG ecosystem integration to generate a static manifest and universal WebMCP tools.
- The static-only architecture is independently validated as practical.
- Kujo can differentiate by using its native pre-render content/taxonomy/route model rather than scraping built HTML; supporting custom collections and resolved taxonomies; requiring no Node/npm/Astro/Vite stack; and making the feature first-party rather than a community plugin.
- Some claims in that project about future browser versions are project-authored and were not treated as official browser evidence.

### Static data-driven site example

[`soney/spot-web`](https://github.com/soney/spot-web) is a verified static academic-site example with imperative tools backed by generated JSON and one declarative form. It demonstrates that a static generator/site can expose multiple collection-shaped capabilities without a backend, and that unsupported browsers can exit before fetching data.

This is implementation prior art, not native SSG product support.

### WordPress experiments

The official [`WordPress/ai` WebMCP experiment issue](https://github.com/WordPress/ai/issues/448) verifies active investigation in the WordPress AI plugin and highlights rapid API churn. Third-party WordPress WebMCP ability bridges also exist, but they depend on WordPress/REST/backend abilities and are not static-only SSG generation.

### MCP-adjacent framework work

- Astro has an official [Docs MCP server](https://github.com/withastro/docs-mcp), which is remote server-side MCP, not WebMCP or static-site inference.
- Nuxt has a community/organization module [MCP Toolkit](https://github.com/nuxt-modules/mcp-toolkit) for server endpoints, not the page-bound static WebMCP build primitive proposed here.
- Docusaurus has a public [MCP server plugin discussion](https://github.com/facebook/docusaurus/discussions/11106), again server-side MCP rather than verified native WebMCP.
- WordPress has official MCP adapter work and abilities, but its architecture is a dynamic authenticated application, not a serverless static output.

These validate ecosystem demand for structured agent interfaces while underscoring the WebMCP/MCP distinction in [Chrome's official comparison](https://developer.chrome.com/docs/ai/webmcp/compare-mcp).

## First-party native support matrix

| Product | Result of reviewed evidence | Classification |
|---|---|---|
| Next.js | No first-party native build-time content-inferred WebMCP support found | Not found |
| Astro core | No first-party native WebMCP feature found; third-party `astro-webmcp` exists | Verified third-party / core not found |
| Hugo | No first-party native WebMCP support found | Not found |
| Jekyll | No first-party native WebMCP support found | Not found |
| Eleventy | No first-party native WebMCP support found | Not found |
| Gatsby | No first-party native WebMCP support found | Not found |
| Nuxt core | No first-party WebMCP build primitive found; MCP server toolkit is adjacent | Not found / adjacent verified |
| Remix | No first-party native WebMCP support found | Not found |
| VitePress | No first-party native WebMCP support found | Not found |
| Docusaurus | No first-party WebMCP support found; MCP discussion exists | Not found / adjacent verified |
| WordPress | Official experiment under discussion; dynamic ability/backend model | Verified experimental discussion |
| WordPress static generators | No first-party generic static build-time WebMCP capability found | Unknown/not found |

## Inferred conclusions

- Because WebMCP producer code is ordinary browser JS, every framework can support it manually today. That is not equivalent to first-class inferred support.
- Plugin ecosystems will likely move faster than core frameworks while the API is experimental.
- Content-oriented SSGs have a natural advantage: their build graphs already know public routes and metadata. A first-party feature can be more accurate and lower-configuration than post-build HTML scraping.
- A universal four-tool layer is more product-like than asking every site author to learn the API, but it must avoid pretending site-specific interactions are inferable.

## Claims that are defensible

Defensible:

> Kujo can make WebMCP an opt-in build target derived from its native public content model.

> Kujo can compile pages, posts, custom collections, resolved taxonomies, and navigation into a static agent interface without a runtime server or Node dependency.

> Among the first-party SSG cores reviewed, equivalent native content-inferred support was not found as of 2026-08-26.

Not defensible:

> Kujo is the first SSG to support WebMCP.

> No other SSG generates a WebMCP manifest.

> Kujo makes static sites agent-native by default.

The third-party Astro integration directly contradicts the first two broad novelty claims, and Kujo's required default is off.

## Differentiation score

| Dimension | Assessment |
|---|---|
| Static-only baseline | Valuable but no longer unique |
| One flag | Strong product experience; matched by at least one third-party integration |
| Native content model instead of output scraping | Strong technical differentiation |
| Automatic arbitrary collections/taxonomies | Strong if implemented and demonstrated |
| No Node/npm/runtime framework | Strong for Kujo's local-first audience |
| First-party SSG contract and regression gates | Stronger than ad hoc/manual integration |
| Declarative forms | Not differentiated; part of the standard |
| Search/list/get tools | Useful but individually conventional |

Overall: **meaningfully differentiated, not unprecedented**.

## Challenge value

The [official challenge](https://webmcp.devpost.com/) judges WebMCP leverage, execution, impact, and creativity. A plain static search demo risks looking similar to existing prior art. The submission becomes compelling when it visibly demonstrates:

- zero WebMCP code in the site project beyond `webmcp: true`;
- automatic discovery of multiple arbitrary collections;
- taxonomy-aware questions across collections;
- a downloaded static artifact and no backend/network API calls beyond static files;
- disabled/unsupported-browser progressive enhancement;
- generator-owned safety and deterministic validation;
- a second substantially different starter site using the same universal tools without custom code.

The strongest story is not “we added four tools.” It is “the build system converts one content source into coordinated human and agent interfaces.”

## Unknowns to re-check

- Framework releases or first-party announcements after the research date.
- Private/beta integrations not visible in public repositories.
- Whether any challenge submission ships an equivalent SSG build primitive before Kujo's submission.
- Stable support plans for browsers beyond Chrome and ChatGPT's in-app browser.
- Whether current origin-trial requirements change before implementation.
