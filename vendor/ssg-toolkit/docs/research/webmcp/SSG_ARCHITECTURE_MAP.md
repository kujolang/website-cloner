# Kujo SSG architecture map for WebMCP

Repository state reviewed: 2026-08-26. This map is based on implementation and contracts, not only the README.

## Entry and configuration

`build.kujo` is the single canonical implementation and CLI surface.

```text
defaults
  -> first existing config: kujo-ssg.yml, .yaml, .json
  -> CLI overrides
  -> normalization/validation
  -> build_site(settings)
```

Config loading copies all top-level keys into settings; known fields are normalized later. CLI flags are parsed explicitly, accept separate or `--flag=value` values for value flags, reject unknown options, and override config. Boolean config validation accepts bool-like values. Output-path validation rejects the working directory, filesystem root, and overlaps with content/templates/assets before any setup deletion.

Relevant existing booleans: `minify`, `download_remote_images`, `drafts`, `posts_at_root`, `no_index`, `no_aux`, `no_aliases`. The proposed `webmcp` fits this normalization pattern and should default false.

## Generation lifecycle

```text
load/normalize settings
        |
        v
setup: delete safe output, copy assets, fonts, favicon, post manifest
        |
        v
load templates + lookup/taxonomy files
        |
        v
discover pages, posts, custom collections
        |
        v
parse pages into pages_data (draft-filtered)
        |
        +--------------------------+
        |                          |
        v                          v
render pages/finalize       render post stripe(s)
        |                          |
        |                    record + sitemap temp files
        |                          |
        +-------------+------------+
                      v
          finalize merged/sorted post records
                      |
                      v
       render custom collection items + listings
                      |
                      v
        render home/blog paginated listings
                      |
                      v
         feed, sitemap, robots, llms.txt
                      |
                      v
                 404 + cleanup
                      |
                      v
             minify copied assets
```

The full build performs all stages in one process. The parallel orchestrator runs `setup`, N `posts` shards, then `finalize`.

## Content discovery and frontmatter

- `markdown_files` recursively finds sorted non-hidden `.md` files.
- `content/pages/**` becomes pages.
- `content/posts/**` becomes posts.
- Every other non-hidden content subdirectory containing Markdown becomes a custom collection, automatically named, slugged, titled, and routed.
- YAML frontmatter is delimiter-aware. Known defaults include SEO, language, canonical, media, routing/template, draft/order/excerpt, navigation, docs metadata, `search_exclude`, tags/categories, and a `taxonomies` map. Unknown parsed keys remain in `meta` and may participate in lookup-backed taxonomy discovery.
- Drafts are excluded unless `--drafts` is enabled. The current build has no general “private content” primitive beyond not publishing source and the draft preview switch.
- `nav_hide` removes a page from generated primary navigation only. The page route still exists.
- `search_exclude` is parsed and retained on page records, but core rendering/sitemap/llms do not currently consume it. The docs-specific search generator excludes such items.

## Route model

- Page: `/<page-slug>/`.
- Post: `/<blog_slug>/<post-slug>/` or `/<post-slug>/` with `posts_at_root`/empty blog slug.
- Collection item: `/<collection-slug>/<item-slug>/`.
- Collection listing: `/<collection-slug>/`.
- Home pagination: `/page/N/`.
- Blog pagination: `/<blog_slug>/page/N/`.
- Clean routes write `route/index.html`; aliases additionally write `route.html` redirect files unless `--no-aliases`.
- `custom_url` is a safe single slug override, not an arbitrary path.
- Canonical frontmatter affects SEO canonical metadata but does not change the generated route.

The public content index should use generated canonical route URLs, never aliases or source paths. A user-supplied absolute canonical may be included only in a separate allowlisted `canonical_url` field if product research proves it useful; route identity should remain the generated URL.

## Rendering and template behavior

The builder loads `layout.html`, core item templates, listing templates, collection templates, custom template variants, and built-in fallbacks. Markdown is rendered through the native renderer; the layout goes through `render_layout_native`. Layout data includes relative asset paths, canonical/SEO/OpenGraph/Twitter fields, RSS autodiscovery, favicon, and JSON-LD.

JSON-LD is created per rendered page from normalized page metadata. It is primarily `WebSite`/article-oriented and includes publisher/author/date/image where applicable. It is HTML-embedded output, not a reusable general representation of `Service`, `Product`, `Person`, or custom collections. WebMCP should share normalized inputs rather than parse/reuse the generated JSON-LD string.

Current template overrides do not provide a generic “extra scripts” placeholder. Therefore requiring `{{webmcp_script}}` would break zero-config behavior for existing custom layouts. The natural implementation is a central post-render injection in `render_layout` or immediately after it returns, using an external self-hosted script. This applies to built-in and custom layouts without editing template files. It must preserve disabled bytes exactly.

## Navigation

`build_navigation` creates HTML, not structured navigation. It includes Home, Blog when configured, all non-`nav_hide` pages, and all custom collection listings. It is recomputed for the current route to mark active links.

WebMCP needs a compact structured projection from the same inputs, not HTML parsing. The MVP navigation may be a flat ordered list because the current generator has no nested navigation model. `nav_hide` should exclude an item from the navigation array but not from public content.

## Taxonomies

The builder supports:

- global `categories.yml`, `tags.yml`, and other `<taxonomy>.yml/.yaml` lookups;
- collection-specific `<content-type>-<taxonomy>.yml/.yaml` lookups;
- direct categories/tags/frontmatter arrays;
- inline `taxonomies: { name: [terms] }`;
- lookup-backed extra frontmatter keys.

Terms are resolved from IDs to display labels before rendering. The site index should serialize resolved labels and normalized taxonomy names, deterministically sorted. It should not expose internal numeric lookup IDs.

## Auxiliary outputs

`--no-aux` currently skips exactly feed, sitemap, robots, and `llms.txt` generation. RSS and sitemap require `site_url`; robots is still generated without it. `llms.txt` also requires public mode and `site_url`.

- **Sitemap:** streamed route entries plus last-modified metadata; post shards write fragments and finalize merges them.
- **RSS:** latest 20 sorted posts with title, URL, excerpt, and dates.
- **`llms.txt`:** links for posts, built pages, collection listings/items, and sitemap; no body text.
- **robots:** public/private crawl policy.

WebMCP is explicitly enabled behavior, so it should be independent of `--no-aux`. Its data file is implementation-critical to the selected feature, not an incidental feed. Document this because “index” and “auxiliary” are otherwise ambiguous.

`--no-index` skips home/blog listing HTML only. It must not disable a WebMCP data index.

## Asset pipeline and minification

Setup copies the configured assets tree (or static fallback) to `output/assets`, generates font CSS and a favicon, and later `minify_assets_recursive` writes `.min.css`/`.min.js` siblings for files under output assets. HTML references the normal stylesheet name; minification is an additional artifact behavior.

Recommended WebMCP behavior:

- Generate the adapter directly under an SSG-owned output asset namespace after user assets are copied, so a source asset cannot replace it silently.
- Use the existing minifier for JS in `--minify` builds and make the injected reference choose the minified file only if existing conventions do the same at implementation time. Avoid a second minifier.
- Emit compact JSON regardless of `--minify`; JSON transfer artifacts should be deterministic and compact in all modes.
- No inline executable content or CDN dependency; compatible with `script-src 'self'`.

## Existing docs local search

The reusable docs starter owns `scripts/docs_search_index.kujo` plus a Python fallback/large-site implementation. It writes `assets/js/docs-search-index.json`, copied into output as a static file. The schema is `kujo-docs-search/v1` with:

- `title`, `description`, `url`, `route`;
- `section`, `audience`, `difficulty`, `status`, `version`;
- `tags`, `headings`;
- Markdown-stripped `text` truncated to 360 characters.

It recursively scans content independently, parses a smaller frontmatter subset independently, independently reconstructs routes, and excludes drafts plus `search_exclude`. The docs browser script fetches the JSON eagerly when its search input exists and performs case-insensitive substring matching over all fields, returning at most eight results.

Assessment:

- Build-time static JSON and client-side search prove the general deployment pattern.
- The schema is docs-specific and useful below roughly 1,000 pages, not a complete core public-content model.
- Reusing it directly would couple core SSG behavior to the docs starter, retain duplicate route/frontmatter logic, omit custom taxonomies, and risk semantic drift.
- The right long-term direction is a generic core public site index consumed by WebMCP and optionally by docs search. Migration requires a docs-search parity contract and should follow, not block, the first WebMCP vertical slice.

## Parallel build integration point

The only safe owner of the final public index is **finalize**:

- setup already creates the output and a stable post manifest;
- each post worker owns a disjoint stripe and already writes private record/sitemap fragments;
- finalize merges all post fragments, sorts them, rebuilds pages and collections, and owns auxiliary outputs/cleanup.

Add an index record format rich enough for WebMCP/search or add a dedicated private agent-record fragment per shard. Finalize combines page, post, collection-item, and navigation/site records, sorts by stable `(type, route, id)`, validates duplicates and route safety, writes the index once, then removes private fragments. Never let every shard write the public index or runtime.

## Validation and release gates

- `scripts/test-cli-contract.sh`: config discovery/precedence, flags, invalid values, privacy/suppression, minification, drafts, and overrides.
- `scripts/test-generated-contract.sh`: routes, aliases, metadata, drafts, collections, taxonomies, pagination/sorting, images, feeds/sitemap/llms, and template behavior.
- `scripts/test-bug-regressions.sh`: focused past failures including shards, routes, dates, and escaping.
- docs/DocGen/template contracts: reusable docs and local search.
- `scripts/validate-generated-output.sh`: HTML fundamentals plus basic sitemap/RSS structure.
- `scripts/run_ci_checks.sh`: all contracts, normal build, generated-output validator.
- `scripts/run_release_gate.sh`: changelog/version alignment then CI.

Proposed ownership:

- CLI contract: enable/default/precedence/invalid bool and disabled absence.
- Generated contract: schema, records, visibility, URLs, script references, custom template, no-index/no-aux/minify.
- Focused WebMCP contract: JS syntax/tool definitions/search/filter bounds and hostile fixtures.
- Parallel contract: byte-identical public index between full and sharded builds.
- Validator: optional artifact consistency when a WebMCP marker/script is present.
- Browser/eval suite: current Chrome and ChatGPT integration, advisory outside deterministic CI if environment is unavailable.

## Proposed internal seam

The current code has several partial record shapes (`pages_data`, encoded post records, collection item maps, sitemap strings). Do not begin with a broad refactor. Introduce the smallest normalized **public content record** constructor and projection helpers alongside the existing paths. Prove it against generated routes. Once stable, migrate sitemap/llms/docs-search consumers incrementally.

That seam is Kujo-native because the builder already owns every needed fact before HTML serialization. Parsing output HTML, sitemap, `llms.txt`, or JSON-LD in the browser would create a disconnected and less accurate second pipeline.

## Sweep exclusions

The repository investigation excluded generated `output/**`, minified vendor CSS/JS, fonts, images, `static/**`, and `tmp/**` from broad readability/search sweeps. Generated behavior was inspected through source and contract assertions rather than treating output as canonical.
