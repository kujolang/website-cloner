# Experimental WebMCP v1

Kujo compiles your content for humans and agents. WebMCP v1 is an experimental
static build target enabled by default.

## Configure it

Add one boolean to `kujo-ssg.yml`, `.yaml`, or `.json`:

```yaml
webmcp: true
```

Or enable it explicitly for one build:

```bash
kujo run ./build.kujo -- --webmcp
```

Disable it for a site with `webmcp: false`, or for one build with:

```bash
kujo run ./build.kujo -- --no-webmcp
```

CLI values retain normal precedence over the first discovered config. No
template placeholder or manual script tag is required. `--no-aux` and
`--no-index` remain independent from WebMCP.

## Static architecture

```text
Markdown + frontmatter + routes + resolved taxonomies
                         |
                         v
              allowlisted public records
                         |
                         v
              kujo-ssg-site-index/v1
                         |
                         v
            self-hosted WebMCP adapter
                         |
                         v
          document.modelContext browser tools
```

Full builds stream normalized records to one private fragment. Parallel post
workers write private per-shard fragments; only finalize merges, sorts,
validates, and writes the public index. Full and sharded builds therefore emit
the same index bytes.

Generated structure:

```text
output/
|-- .well-known/
|   `-- kujo-site-index.json
|-- assets/
|   `-- js/
|       |-- kujo-webmcp.js
|       `-- kujo-webmcp.min.js  # with minify enabled
`-- ... generated HTML
```

The external script is inserted once before `</body>` (before `</html>` or at
the end for minimal valid layouts). It works with built-in and custom layouts,
uses route-relative URLs for nested pages and subpath deployments, and is not
inserted on `404.html`. It is compatible with `script-src 'self'` and
`connect-src 'self'`.

## Four tools

Every tool uses fixed generator-owned descriptions, strict root schemas with
`additionalProperties: false`, and these annotations:

```json
{"readOnlyHint":true,"untrustedContentHint":true}
```

### `get_site_info`

Input: an empty object. Returns the schema identity, concise site metadata,
flat public navigation, and discovered content types with counts and taxonomy
names.

### `search_site`

```json
{
  "query": "required string, 1-200 characters",
  "limit": "optional integer, 1-10; default 5",
  "content_type": "optional discovered type"
}
```

Search is deterministic substring/token-style ranking over searchable public
titles, resolved taxonomy labels, descriptions, and bounded summaries. Results
contain concise records and an integer score; it is not semantic/vector search.

### `list_content`

```json
{
  "type": "required discovered type",
  "taxonomy": {
    "optional-taxonomy-name": ["one to five exact public labels"]
  },
  "limit": "optional integer, 1-10; default 5"
}
```

At most three taxonomy names are accepted. Filters use AND across names and OR
within each label array, with case-insensitive exact label matching.

### `get_content`

```json
{"id":"exact type:slug"}
```

or:

```json
{"url":"exact same-origin public URL"}
```

Exactly one selector is required. The result contains one allowlisted record
with bounded plain text and resolved taxonomies, never raw Markdown or HTML.

## Data and security boundary

V1 is read-only and indexes only generated public routes. Drafts are never
included, even when `--drafts` renders preview HTML. `search_exclude: true`
sets `searchable: false` but does not make a public route private; `nav_hide`
removes only its structured navigation entry.

The allowlist contains IDs, type, slug, deployment-aware URL, title,
description, summary, language, searchable state, optional valid dates, and
resolved taxonomy labels. It excludes source/build paths, arbitrary metadata,
lookup IDs, environment/configuration state, credentials, raw Markdown, HTML,
and alias routes. Duplicate IDs or URLs and unsafe route identities fail the
enabled build.

Website text is untrusted content. It is serialized only as JSON result data
and never interpolated into JavaScript, tool instructions, descriptions, or
schemas. The runtime makes one same-origin fetch on first tool use, caches the
validated index in memory, honors current execution/registration abort signals,
and makes no cross-origin request, DOM mutation, storage write, or server call.

## Relationship to Kujo Ability

WebMCP is a protocol-local projection over a static public index, not an
Ability registry or execution gateway. The four generator-owned tools do not
carry application identity, tenant policy, approvals, idempotency receipts, or
server-side handlers, so they must not be presented as
`kujo.ability/v1` definitions.

An application that needs authenticated reads or any write, delete, external,
publishing, or deployment operation must define and bind that operation through
the canonical Ability package and expose it through an authenticated server
adapter such as CMS, Agents SDK gateway, or MCP. A site may display both
surfaces, but WebMCP cannot widen an Ability exposure or bypass its policy,
approval, audit, and receipt boundary.

## Browser support and testing

API state was rechecked on 2026-08-26. The current producer interface is
`document.modelContext.registerTool`. Chrome local testing requires
`chrome://flags/#enable-webmcp-testing` plus a restart, or a current origin-trial
deployment. Serve output through localhost HTTP or HTTPS; do not use `file://`.
Use Chrome DevTools Application > WebMCP, `document.modelContext.getTools()`,
and `document.modelContext.executeTool()` to inspect and invoke tools.

ChatGPT site tools currently run in the ChatGPT desktop app's built-in browser
for eligible accounts and models. Open the deployed/locally served page there
and use the address-bar tool indicator. This is separate from ordinary Chrome
support. Browsers without the API silently retain the ordinary site.

Deterministic CI exercises configuration, privacy, serialization, schemas,
runtime logic, lazy loading, custom layouts, subpaths, flag interactions,
generated-output validation, and full/sharded equivalence. Browser evidence is
recorded separately because experimental browser availability is not a stable
CI dependency. See [browser conformance evidence](webmcp-browser-testing.md)
for the latest recorded run and explicit environment limitations.

## Hosting and scale

The index has a stable URL. Configure it for revalidation (`Cache-Control:
no-cache`) or a short cache lifetime so deploys are observed promptly; the SSG
cannot set host headers. The runtime may use a longer cache lifetime when the
HTML deployment invalidates assets consistently.

V1 intentionally uses one compact index. Measurements through 10,000 records
remain reasonable with lazy loading; raw parse memory, not transfer size, is the
eventual constraint. Consider a versioned manifest/shards in a later release
around 10,000 records or roughly 2 MB raw when representative constrained-
browser measurements justify the complexity. See [WebMCP performance](webmcp-performance.md).

## Deliberately deferred

- docs-search convergence
- declarative forms and automatic form exposure
- custom/site-specific tool extensions
- CMS integration and write/mutation tools
- authentication or server-side capabilities
- remote MCP, Kujo MCP bridges, Workcell, and custom agent orchestration
