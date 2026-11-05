# SSG

[![Version](https://img.shields.io/badge/version-1.2.0-black)](https://github.com/kujolang/ssg)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)
[![built with Kujo](https://img.shields.io/badge/built%20with-Kujo-white.svg)](https://github.com/kujolang/kujo)

Local static-site generation showcase for Kujo projects, built around a single entrypoint: [build.kujo](build.kujo).

`SSG` is designed for teams that want deterministic builds, straightforward template overrides, and a transparent content pipeline. Content, templates, assets, metadata, feeds, and validation stay visible in the repository instead of disappearing behind framework abstractions.

It fits the Clarity / Context / Control story by keeping content models, routes, feeds, and validation predictable, surfacing generated artifacts and metadata as context, and making builds and release checks local and reviewable.

## Release 1.2.0

[SSG 1.2.0](https://github.com/kujolang/ssg/releases/tag/v1.2.0) hardens filesystem,
network, JSON-LD, and Ability boundaries; replaces unsafe text minification with
pinned esbuild parsing; and makes DocGen configuration and CI evidence reliable.

**Upgrade setup:** run `npm ci --ignore-scripts` before minified builds. Existing
standalone sites can install esbuild 0.28.2 as described under
[Minifier dependency](#minifier-dependency). Private image destinations now require
`--allow-private-remote-images` alongside `--download-remote-images`.

Experimental public read-only WebMCP remains enabled by default. The local
Ability pack remains independently versioned at 1.0.0 and includes no deploy
operation. See [CHANGELOG.md](CHANGELOG.md) for the complete release changes.

## Highlights

- Builds Markdown pages, blog posts, and custom content collections (with per-type taxonomies)
- Renders full SEO metadata from frontmatter: canonical, Open Graph, Twitter Card, JSON-LD, absolute social images, and `article:*` tags
- Parses and formats dates, with RFC-822 RSS `pubDate`/`lastBuildDate` and sitemap `lastmod`
- Generates paginated home/blog listings with configurable sort order
- Produces `sitemap.xml`, `robots.txt`,
  `feed/index.xml`, `llms.txt`, `404.html`, and `favicon.svg`
- Downloads and self-hosts any Google Font as cached `woff2`, with an offline bundled fallback
- Supports local and remote featured-image processing with deterministic output names
- Includes a reusable docs-site starter with docs templates, local search, DocGen update automation, and package generation
- Validates CLI behavior, config precedence, generated output, and release-gate checks with dedicated project scripts
- Ships with starter content, templates, assets, and lookup files for a real first-run build

## Why SSG

- Deterministic content routing for pages, posts, and custom collections
- Config-file support for `yml`, `yaml`, and `json` with tested CLI override precedence
- Simple override model based on files you can inspect and replace directly
- Release workflow backed by contract tests and generated-output validation
- Suitable for teams that want an auditable static-site pipeline rather than a black-box generator

## How It Fits

- CMS demonstrates a server-first content application.
- CRUD API Showcase demonstrates a smaller API pattern.
- SSG demonstrates static publishing and docs-site generation.
- Lens and ShipCheck can help review and gate generated results.

### Kujo Ability

The repository includes an executable local Ability pack for project inspection,
generated-output validation, and an approval-gated, idempotent build. Its
canonical Ability 1.0.1 dependency is commit-pinned in `kennel.toml` and
`kennel.lock`. Agent and MCP hosts can register `abilities/runtime.kujo` inside a
trusted local process or authenticated application gateway; generated static
pages never receive write or deploy authority. See
[`docs/ability-integration.md`](docs/ability-integration.md).

## What This Repo Is Not

- Not a production-certified docs platform
- Not an automatic deployment or hosted publishing service
- Not a guarantee of SEO, accessibility, or performance outcomes
- Not a replacement for manual review
- Not a hosted-service or paid-API dependency by default

## Requirements

- Kujo CLI available on your `PATH`
- esbuild 0.28.2 when minification is enabled (as in the bundled config);
  install the pinned package using Node.js 18+ and `npm ci --ignore-scripts`,
  or supply its native executable through `SSG_ESBUILD_BIN`
- `cwebp` available on your `PATH` for size-optimized featured-image conversion

## Runtime Capabilities

Kujo gates host effects (filesystem, network, processes) behind explicit runtime
capabilities. The default `kujo run ./build.kujo` runs in **trusted mode**, where
every capability — including outbound network for font and remote-image downloads
— is granted. No extra flags are needed for normal builds.

If you build in hardened **`--untrusted`** mode, capabilities are denied by
default and you opt in per effect. A full build needs at least:

```bash
kujo run --untrusted \
  --allow-fs-read --allow-fs-write --allow-fs-delete \
  --allow-clock --allow-net-client --allow-process-exec \
  ./build.kujo -- --site-url https://example.com --fonts "Roboto,Lato"
```

(`--allow-net-client` is only needed when the build downloads Google Fonts or
remote images; `--allow-process-exec` enables the optional `cwebp` optimized
image path and is required for minification; `--allow-fs-*` and `--allow-clock` are needed for every build.)

Note: passing any single `--allow-*` flag switches the runtime out of trusted
mode, so you must then enumerate every capability the build uses (filesystem
included). For most users the default trusted path is the right choice.

## Quick Start

Build the bundled starter site from the project root:

```bash
npm ci --ignore-scripts
kujo run ./build.kujo -- --site-url https://example.com
```

Expected final lines include:

```text
Build complete
  Output directory: output
```

Preview the generated site locally on `127.0.0.1`:

```bash
kujo serve output --port 8080
```

### Parallel builds for large sites

For large sites, render post shards across CPU cores with the parallel
orchestrator (mirrors how multiprocessing SSGs scale). Output is byte-identical
to the single-process build (sitemap URL order aside):

```bash
# bash scripts/build-parallel.sh <shards|auto> <concurrency|auto> [build args...]
# `auto` sizes shards (~120 posts each) and concurrency (= CPU cores) for you:
bash scripts/build-parallel.sh auto auto \
  --content content --output output --site-url https://example.com --posts-per-page 25
```

Use many small shards (~120–300 posts each) and a concurrency near your core
count. The wrapper owns `--phase`, `--shard`, and `--shards`; do not supply those
flags in build arguments. A failed worker batch stops subsequent batches and
prevents finalization. Internally this drives `build.kujo`'s `--phase setup|posts|finalize` and
`--shard i --shards N` flags; the default `kujo run ./build.kujo` remains a normal
single-process build. (The per-page render cost is interpreter-bound, so the
speedup is real but memory-bandwidth-limited — see
[docs/performance-findings.md](docs/performance-findings.md).)

Scaffold a starter config file when bootstrapping a new project:

```bash
kujo run ./build.kujo -- --init yml
```

For a typical release workflow:

```bash
kujo run ./build.kujo -- --site-url https://example.com
bash scripts/validate-generated-output.sh output
bash scripts/run_ci_checks.sh
```

The validated execution path for development, CI, and release checks is the standard Kujo VM path: `kujo run ./build.kujo -- ...`

## Validation And Release

Validate generated output after a build:

```bash
bash scripts/validate-generated-output.sh output
```

Run the local CI gate:

```bash
bash scripts/run_ci_checks.sh
```

Run the release gate:

```bash
bash scripts/run_release_gate.sh
```

The release gate checks changelog/version alignment first, then runs the full CI gate on the same standard Kujo VM path used for normal builds.

If Kujo is not on your `PATH`, set a non-default runtime before running the gates:

- `KUJO_RUNTIME_DIR=/path/to/local-kujo-source-checkout`

## DocGen Documentation Bridge

Use `scripts/docgen_ssg_bridge.kujo` to turn Kujo DocGen output into normal
reviewable SSG Markdown content. The bridge can run `kujo docgen`, read the
stable `docgen-summary/v1` JSON payload, generate frontmatter-backed Markdown
under a configured content root, remove stale generated files from its manifest,
then build and validate the site.

Typical strict CI/update command:

```bash
kujo run scripts/docgen_ssg_bridge.kujo -- \
	--target-repo /path/to/repo \
	--content-out content/reference \
	--docgen-out .docgen/output \
	--cache-dir .docgen/cache \
	--site-url https://docs.example.com \
	--source-link-template 'https://github.com/org/repo/blob/main/{path}#L{line}' \
	--strict
```

The generated content includes an overview page, per-language pages, per-module
pages, and a documentation-gaps page. Frontmatter is emitted in stable key order
with `docgen_generated: true`, `docgen_schema_version: "docgen-summary/v1"`,
source metadata, and count fields. Re-running the same DocGen output should not
change the generated Markdown.

Gate controls:

- `--strict`: fail when DocGen reports gate failures and default undocumented
  threshold to zero.
- `--max-undocumented <n>`, `--max-broken-links <n>`, `--max-warnings <n>`:
  configure count thresholds.
- `--max-discovery-skips <n>`: fail when any discovery skip counter exceeds the
  threshold.
- `--allow-adapter-low-yield`: permit `DOCGEN_ADAPTER_LOW_YIELD` diagnostics.
- `--skip-build`: generate Markdown without building or validating the site.
- `--skip-validation`: skip repository CI and generated-output validation.
- `--skip-repository-checks`: skip repository CI while retaining generated-output
  validation; use this for packaged sites, which do not include repository tests.
- `--repository-check-timeout <seconds>`: repository CI deadline, 1–86400 seconds
  (default 3600). Individual build commands retain their five-minute deadline.
- `--output <path>`: override the configured build output directory.

When enabled, repository checks run before the final requested build so their
fixture builds cannot replace the requested site URL or output. Complete CI stdout
and stderr are saved under `<docgen-out>/ci-<unique-id>/`; the bridge prints the
location and fails on a nonzero exit or expired deadline. These evidence files
remain until you remove them; include that directory in your artifact retention
policy. Output validation
uses the builder’s resolved output directory. When building, the default generated
Markdown destination follows the configured content root (`<content>/reference`).
Conversion-only `--skip-build` and `--dry-run` keep the `content/reference` default
and do not require a builder configuration. Explicit `--content-out` is preserved.

The bridge only deletes files listed in
`<content-out>/.docgen-ssg-manifest.json`, and it refuses content, DocGen output,
or cache paths that escape the SSG root. Both rendering backends reject symlinked
generated files and manifest descendants before modifying content. `--dry-run`
requires an existing `--docgen-payload` and never starts DocGen, builds the site,
or runs validation; it checks and renders the supplied artifacts in memory.

## Reusable Docs Template

The reusable documentation template lives under `starters/docs-site/`. It packages
the universal documentation features that are useful across projects without
requiring a hosted service:

- Docs-specific page and reference templates
- Structured page frontmatter for section, audience, difficulty, status, version,
  prerequisites, previous/next links, nav labels, and search exclusion
- Local search index generation through `scripts/docs_search_index.kujo`
- One-command generated-reference refresh through `scripts/update_docs.kujo`
- Deterministic generated Markdown and manifest-scoped stale cleanup through the
  DocGen bridge
- Local assets and JavaScript for search and code-copy controls

Create a downloadable starter packet with:

```bash
bash scripts/package-docs-template.sh
```

That writes `dist/kujo-ssg-docs-template.tar.gz` with the starter content,
templates, assets, `build.kujo`, and the docs automation scripts.

For a docs-site update loop, run this from a docs starter checkout:

```bash
kujo run scripts/update_docs.kujo -- \
	--target-repo /path/to/repo \
	--site-url https://docs.example.com \
	--source-link-template 'https://github.com/org/repo/blob/main/{path}#L{line}' \
	--strict
```

For an exploratory language-site preview that includes internal/example symbols
and builtin/native APIs, opt in explicitly:

```bash
kujo run scripts/update_docs.kujo -- \
	--target-repo /path/to/repo \
	--languages kujo \
	--include-private \
	--include-builtins \
	--site-url http://127.0.0.1:4178
```

The update script runs DocGen with an incremental cache, bridges only generated
reference content into `<content>/reference/generated`, refreshes the local search
index at `<assets>/js/docs-search-index.json`, builds the site, and validates the
resolved output directory. It uses the builder’s configuration precedence and
path validation. `--content`, `--output`, `--assets`, and `--templates` override
those roots for the entire update; `--content-out` and `--search-index` remain
explicit destination overrides. The existing default site URL is
`https://example.com`; pass `--site-url` for the published site.

## Project Layout

Core directories in a standard project:

- `content/`: Markdown source content and taxonomy lookup files
- `templates/`: page, listing, and item template overrides
- `assets/`: static assets copied or processed into output
- `output/`: generated site artifacts; do not edit by hand
- `scripts/`: validation and release automation

## Configuration

`build.kujo` loads config from the first file found in this order:

1. `kujo-ssg.yml`
2. `kujo-ssg.yaml`
3. `kujo-ssg.json`

CLI flags always override config values.

Example `kujo-ssg.yml`:

```yaml
site_url: https://example.com
site_title: My Site
site_tagline: Built with Kujo SSG

output: output
content: content
templates: templates
assets: assets

blog_slug: blog
posts_at_root: false
posts_per_page: 5
sort_by: date

robots: public
llms: public
watch: false
minify: false
webmcp: true
download_remote_images: false
allow_private_remote_images: false
no_index: false
no_aux: false
```

Example one-off override build:

```bash
kujo run ./build.kujo -- \
	--site-url https://staging.example.com \
	--output preview-output \
	--blog-slug updates \
	--posts-per-page 1 \
	--sort-by date
```

That keeps file-based defaults in place while applying the CLI values for the current run only.

## CLI Flags

- `--output <dir>`: output directory. Existing output is deleted before a full/setup build, so paths that overlap the working directory or source content/templates/assets are rejected.
- `--content <dir>`: content directory
- `--templates <dir>`: templates directory
- `--assets <dir>`: assets directory
- `--posts-per-page <n>`: listing pagination size
- `--sort-by <date|title|author|order>`: blog listing sort mode
- `--fonts <comma,list>`: heading/body font families (first = headings, second = body). Bundled families (`Bree Serif`, `Inter`, `Quicksand`, `Open Sans`) render offline; any other family is downloaded from Google Fonts as `woff2` and cached under `.cache/fonts/`. See [Fonts](#fonts).
- `--site-title <text>`
- `--site-tagline <text>`
- `--site-url <url>`
- `--robots <public|private>`
- `--llms <public|private>`
- `--watch`: reserved, currently not implemented
- `--minify`: emit parser-minified CSS/JS assets (requires esbuild 0.28.2)
- `--download-remote-images`: mirror remote `featured_image` URLs into output (needs outbound network — see [Runtime Capabilities](#runtime-capabilities))
- `--allow-private-remote-images`: explicitly permit loopback/private remote image sources; ignored unless remote-image mirroring is enabled
- `--drafts`: include `draft: true` content in the build (preview/staging workflow); omitted by default
- `--webmcp`: enable the experimental static WebMCP v1 index and browser tools (the default)
- `--no-webmcp`: disable WebMCP generation for a build
- `--blog-slug <slug>`: blog route base. Set `blog_slug: ""` in config to omit the blog route and publish posts at the site root.
- `--posts-at-root`: keep post permalinks at `/<slug>/` while retaining the blog listing under `/<blog_slug>/`
- `--init <yml|yaml|json>`: scaffold starter config
- `--no-index`: skip index and blog listing pages
- `--no-aux`: skip feed, sitemap, robots, and llms outputs
- `--no-aliases`: skip flat `.html` redirect aliases (emit clean `dir/index.html` only); halves per-page write I/O on large sites
- `--inspect-config`: validate and print resolved content/output/templates/assets paths and site URL as JSON without building or writing files
- `--version`
- `--help`

Unknown flags, missing option values, malformed YAML/JSON config, invalid booleans, and invalid enum values fail fast with a nonzero exit.
Internal parallel-build shard values are also validated
(`0 <= shard < shards <= 256`). The benchmark-content generator only replaces
directories bearing its `.kujo-ssg-benchmark-content` ownership marker.

Automation can run `kujo run build.kujo -- --inspect-config` with the same path
overrides as a build. Success emits only a `kujo-ssg-config/v1` JSON object with
`ok: true` and `settings`; invalid configuration emits `ok: false` and `errors`
with exit code 1. It does not expose arbitrary configuration keys. Inspection
cannot be combined with `--init`, `--help`, or `--version`.

## Content Model

- `content/pages/*.md`: standalone pages
- `content/posts/*.md`: blog posts
- `content/<type>/*.md`: custom content collection items

Routes are generated like this:

- Pages: `/<slug>/`
- Posts: `/<blog_slug>/<slug>/` by default, or `/<slug>/` with `posts_at_root: true`
- Custom collections: `/<type>/<slug>/`
- Collection listing pages: `/<type>/`

Frontmatter keys supported across pages, posts, and custom types:

- `title`
- `description`
- `keywords`
- `seo_title`
- `seo_description`
- `author`
- `lang`
- `canonical`
- `featured_image`
- `custom_url`
- `template`
- `draft`
- `order`
- `excerpt`
- `nav_hide`
- `nav_title`
- `section`
- `audience`
- `difficulty`
- `status`
- `version`
- `prerequisites`
- `previous`
- `next`
- `last_updated`
- `search_exclude`
- `tags`
- `categories`
- `taxonomies`

Content discovery skips symbolic links, including collection roots and lookup
files. Both docs search generators also skip linked files and directories.
Metadata stays text in JSON-LD and docs search results; docs previous/next links
accept relative routes and HTTP(S) URLs.

Frontmatter opens and closes only with a line containing `---`. Literal `---`
text in a quoted value or Markdown body is preserved. An unclosed or malformed
frontmatter block is left out of metadata processing and produces a warning with
the source file and delimiter line.

`draft: true` excludes content from generated public outputs. Pass `--drafts` to
include draft content in a build for preview/staging without publishing it by
default.

## Experimental WebMCP

Kujo compiles public content for browser agents as an experimental static build
target by default. Keep or add the explicit setting:

```yaml
webmcp: true
```

The equivalent explicit CLI flag is:

```bash
kujo run ./build.kujo -- --webmcp
```

Use `webmcp: false` or `--no-webmcp` when a site must omit the public index and
browser adapter.

The build adds a versioned public JSON index and a small same-origin JavaScript
adapter. It registers exactly `get_site_info`, `search_site`, `list_content`,
and `get_content` through the current `document.modelContext` imperative API.
No Kujo, Node, Python, database, application API, or remote MCP server is needed
after deployment.

These static browser tools are intentionally separate from Kujo Ability. They
have no authenticated principal, approval, durable idempotency, or server-side
execution boundary. Authenticated reads and all mutations belong behind a
canonical Ability binding in an application gateway; enabling WebMCP never
exposes or widens those operations.

WebMCP is progressive enhancement: unsupported browsers stop before requesting
the index and the human-facing site behaves normally. The adapter is currently
experimental in Chrome and available as site tools to eligible accounts/models
in the ChatGPT desktop app's built-in browser. Drafts are never included in the
agent index, even with `--drafts`; `search_exclude: true` removes an item from
search while preserving list/exact retrieval, and `nav_hide` affects only the
navigation summary. Unknown frontmatter is not exposed.

`--no-aux` does not suppress WebMCP because the index is required by the
explicitly enabled build target. `--no-index` controls human-facing listing
HTML, not the WebMCP data index. See [Experimental WebMCP v1](docs/webmcp.md)
for schemas, security boundaries, hosting notes, and current testing steps.

## Taxonomies And Lookups

Lookup files live in `content/`.

- Global lookup: `content/<taxonomy>.yml`
- Content-type-specific lookup: `content/<content_type>-<taxonomy>.yml`

Resolution precedence:

1. Content-type-specific lookup
2. Global lookup

That lets you reuse shared taxonomies globally while still overriding them for a single content type when needed.

Example:

```yaml
# content/storefronts-location.yml
1:
	name: Austin
2:
	name: Denver
```

```yaml
---
title: Main Street Storefront
location: [1, 2]
taxonomies:
	district: downtown
tags: [flagship, retail]
---
```

Top-level shorthand such as `location: [1, 2]` is lookup-aware. `taxonomies:` is the right place for free-text custom taxonomy values.

## Starter Project

The repository starter content is meant to be immediately useful, not empty.

- Pages: `about`, `contact`, `getting-started`
- Posts: multiple sample blog entries
- Custom content types: storefronts, tshirts, pants, shorts
- Lookup files: authors, categories, tags, color, and a type-specific storefront location lookup
- Template overrides: dedicated home, blog, storefront listing, storefront item, and custom post templates

Recommended first customization points:

- `kujo-ssg.yml`
- `templates/`
- `content/`

For most teams, the fastest path to a working site is:

1. Set `site_url`, `site_title`, and `site_tagline`
2. Replace starter content in `content/`
3. Override the templates you actually need in `templates/`
4. Run the validation and release gates before publishing changes

## Featured Images

`featured_image` supports both local and remote sources.

- Local paths are resolved relative to the content file, `content/`, and `assets/`
- Each existing local candidate is canonicalized and must remain under the
  content root, assets root, or the content file's directory; traversal and
  symlink escapes are rejected with a source-file warning
- Processed assets are written to `output/images/` with deterministic names
- Raster images are encoded as lossy WebP at quality 82 through `cwebp` when it
  is available. Install the standard `webp` package (`brew install webp` on
  macOS or `apt install webp` on Debian/Ubuntu) for the optimized path.
- A generated WebP is accepted only when it is smaller than its source. If the
  optimized encoder is unavailable or conversion does not reduce bytes, Kujo
  SSG safely falls back to the original extension instead of publishing a
  larger lossless WebP.
- Remote images are only downloaded when `download_remote_images: true` or `--download-remote-images` is enabled
- Mirroring denies loopback, private, link-local, multicast, and otherwise
  non-public destinations by default, pins DNS for the request, refuses redirects,
  and caps each image at 25 MiB. Use `allow_private_remote_images: true` or
  `--allow-private-remote-images` only for a deliberately trusted local source.

For deterministic CI and release builds, install `cwebp` and leave remote
downloads disabled unless the build explicitly needs mirrored remote assets.

An unresolved or rejected local image is omitted rather than emitted as a raw
path in generated HTML.

## Fonts

`--fonts "Headings,Body"` (or `fonts:` in config) selects the heading and body
type families. There are two provisioning paths:

- **Bundled families** — `Bree Serif`, `Inter`, `Quicksand`, `Open Sans` ship as
  local `woff2` and render fully offline with zero network access. These are the
  defaults (`Bree Serif` headings, `Inter` body), so a stock build is always
  deterministic and offline.
- **Any Google Font** — request any family by name (e.g. `--fonts "Roboto,Lato"`)
  and Kujo SSG fetches the `latin` `woff2` files for weights 400/700 directly
  from Google Fonts, writes them to `output/assets/fonts/`, generates the
  matching `@font-face` rules in `output/assets/css/fonts.css`, and caches the
  downloads under `.cache/fonts/` (git-ignored). Subsequent builds reuse the
  cache and stay offline.

Google Font downloads need outbound network access. The default
`kujo run ./build.kujo` path runs in trusted mode (all runtime capabilities
granted), so downloads work with no extra flags. Only if you run the build in
hardened `--untrusted` mode do you need to opt in — see
[Runtime Capabilities](#runtime-capabilities).

Font metadata responses are capped at 1 MiB and font files at 8 MiB. Both
requests deny non-public destinations, pin DNS, and refuse redirects. Font
family names are limited to the safe ASCII characters accepted by the generated
CSS and Google Fonts request path.

If a requested Google Font cannot be provisioned (no network, missing capability
in `--untrusted` mode, or an unknown family name), the build prints a warning and
falls back to the bundled default without failing — so CI never breaks on a font
typo.

This keeps the project decentralized: you are never locked into a small curated
font list, but the default path remains fully self-contained.

## SEO And Social Metadata

Every generated page includes, derived from frontmatter and config:

- `<title>`, `description`, `keywords`, `author`, and `lang`
- Canonical URL (explicit `canonical:` or computed from `site_url` + route)
- Open Graph: `og:title`, `og:description`, `og:url`, `og:type`
  (`article` for posts/items, `website` otherwise), `og:site_name`, `og:locale`,
  and an **absolute** `og:image`
- Twitter Card: `summary_large_image` with title, description, and an
  **absolute** `twitter:image`
- `article:published_time` / `article:author` for posts and collection items
- JSON-LD structured data (`BlogPosting` for articles, `WebSite` otherwise)
- An SVG favicon (`/favicon.svg`) and RSS autodiscovery `<link>`

Social image URLs are emitted as absolute URLs (using `site_url`) so link
unfurlers on Facebook, X/Twitter, LinkedIn, and Slack resolve them correctly.

Post and collection-item `date:` frontmatter is parsed (ISO `YYYY-MM-DD`,
`YYYY/MM/DD`, `MM/DD/YYYY`, `Month DD, YYYY`, and `DD Month YYYY` are all
accepted), rendered for display as `Month DD, YYYY`, used for stable date
sorting, and emitted as RFC-822 `pubDate`/`lastBuildDate` in the RSS feed and
`YYYY-MM-DD` `lastmod` in the sitemap.

## Template Overrides

Built-in override points include:

- `templates/page-home.html`: home listing (`/`, `/page/N/`)
- `templates/page-blog.html`: blog listing (`/blog/`, `/blog/page/N/`)
- `templates/page-<blog_slug>.html`: listing override when blog slug is not `blog`
- `templates/page-<content_type>.html`: custom collection listing override
- `templates/post-<template>.html`: per-post or per-item template override

Listing templates receive placeholders including:

- `{{title}}`, `{{description}}`
- `{{cards}}`, `{{items}}`, `{{posts}}`, `{{posts_html}}`
- `{{pagination}}`
- `{{page_number}}`, `{{total_pages}}`
- `{{blog_slug}}`, `{{content_type}}`

## Build Output

Primary outputs include:

- `output/index.html`
- `output/page/N/index.html`
- `output/blog/index.html`
- `output/blog/page/N/index.html`
- `output/feed/index.xml`
- `output/sitemap.xml`
- `output/robots.txt`
- `output/llms.txt`
- `output/404.html`
- `output/favicon.svg`

With WebMCP enabled, the build additionally emits:

- `output/.well-known/kujo-site-index.json`
- `output/assets/js/kujo-webmcp.js`
- `output/assets/js/kujo-webmcp.min.js` when minification is enabled

`sitemap.xml` uses the sitemaps.org schema with absolute URLs, per-route
`changefreq`/`priority`, and `lastmod` from post dates. The RSS feed carries
`pubDate`/`lastBuildDate`. Generated HTML includes canonical, Open Graph,
Twitter Card, JSON-LD, and standard metadata derived from frontmatter and config
(see [SEO And Social Metadata](#seo-and-social-metadata)).

Public `llms.txt` output includes Posts and Pages sections followed by one
section per built custom collection. Each collection section links to its index
and every non-draft item using absolute URLs; collection sections are ordered by
content directory name, and items follow the configured `sort_by` order.

## Troubleshooting

- If Kujo is not on your `PATH`, set `KUJO_BIN` or `KUJO_RUNTIME_DIR` before running builds or gates.
- If a build succeeds but output validation fails, rerun `bash scripts/run_ci_checks.sh` to recheck CLI contracts, generated-output contracts, the VM build, and HTML validation in one path.
- If you only need content pages and item routes, use `--no-aux` to skip feed/sitemap/robots/llms generation.
- If you want item routes without listing pages, use `--no-index`.

## Engineering Workflow

- Main pipeline entrypoint: [build.kujo](build.kujo)
- Agent/contributor guide: [AGENTS.md](AGENTS.md)
- Main contract tests: `scripts/test-cli-contract.sh`, `scripts/test-generated-contract.sh`
- Primary validation path: `bash scripts/run_ci_checks.sh`
- Release gate: `bash scripts/run_release_gate.sh`

### Minifier dependency

Minification uses esbuild 0.28.2 with whitespace minimization only: JavaScript
identifiers and syntax are retained, assets are not bundled, and legal comments
stay inline. Strings, regular expressions, template literals, and CSS token
boundaries are parsed instead of rewritten with regular expressions. Invalid
JavaScript or CSS that esbuild rejects fails the build; warnings remain visible.

Run `npm ci --ignore-scripts` in the repository or packaged site. Resolution uses
`SSG_ESBUILD_BIN`, then the local `node_modules/esbuild/bin/esbuild` Node entry point, then
`esbuild` on `PATH`. A missing or mismatched version fails before output cleanup.
The builder does not download tools. Sites with `minify: false` need no minifier.
For a standalone builder or `--init` site without these npm manifests, install
locally with:

```bash
npm install --prefix . --save-dev --save-exact --ignore-scripts esbuild@0.28.2
```

`--prefix .` keeps this install in the site even when an ancestor has a package
manifest. Keep the generated lockfile for subsequent `npm ci --ignore-scripts`
installs.
Existing `.min.*` assets are copied unchanged; generated `.min.css` and `.min.js`
bytes intentionally differ from earlier regex-based output.
