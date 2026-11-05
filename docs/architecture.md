# Architecture and contracts

[Documentation index](README.md)

Website Cloner is a single-user Node application with a plain HTML, CSS and JavaScript interface. It runs Kujo SSG to render editable exports. Node handles HTTP, DOM parsing, browser capture and the local server. The repository includes pinned SSG sources and SiteKit CSS.

## Migration flow

`POST /api/jobs` creates a private job directory and starts an isolated worker:

1. Discover public pages through WordPress REST, sitemaps and same-site links.
2. Capture source content and representative browser views.
3. Download and localize assets.
4. Generate Markdown, metadata, shared templates and presentation data.
5. Build with Kujo SSG and restore the original public routes.
6. Check content, links, components, accessibility and sampled appearance.
7. Run the SEO/performance audit and package the editable project and output.

AI is disabled by default. When selected, AI Chat can propose bounded CSS repairs between build and verification. A separate CLI path supports design-token proposals. Neither path can execute model-written programs or replace post text. See [AI policy and discovery](agent-discovery.md).

Only one migration runs through the UI at a time. CLI operators manage their own concurrency. Job events record actual work; refreshing the page only resumes observation. Checkpoints let the same job continue after recoverable interruptions. See [recovery](recovery.md).

## Source capture and network boundary

HTML supplies the source presentation; public REST records supply types, terms and metadata. Capture can render source scripts to recover content and component state. Requests remain subject to the checked network transport, and source mutation requests are blocked. Source scripts are not copied into the export as trusted executable code.

The default transport uses pinned-address HTTP. Browser-assisted capture uses an isolated browser session and a checked local proxy. Users handle browser challenges themselves. Neither mode bypasses robots rules or access denials. Missing resources and unsupported behavior remain in the reports.

Capture selects layout roles and component variants at desktop, tablet and mobile sizes. Missing source views remain missing evidence. A captured sample cannot establish visual parity for every page. See [capture readiness](capture-readiness.md) and [security](security.md).

## Editable SSG output

New exports use Markdown/frontmatter, shared role templates and explicit presentation data. Semantic prose becomes Markdown. Rich structures that Markdown cannot preserve use HTML components and JSON bindings. A record may contain little or no Markdown prose; `content-source-report.json` identifies these cases. Older exports retain their compatibility reader.

The portable adapter discovers records, handles drafts and aliases, updates archives and compiles in bounded batches. Native SSG supplies Markdown rendering, templates, taxonomy resolution, featured-image processing, RSS items and archive cards. The adapter combines batch output and maps it to the original routes, including supported query-derived static routes.

Final routes also drive search, sitemap, robots, `llms.txt` and WebMCP. `SITE_URL` and `BASE_PATH` select deployment URLs. Ambiguous source archives receive native listings with visual advisories; inaccessible content is not invented. See [content mapping](content-mapping.md), [templates](semantic-templates.md) and the [export guide](export-guide.md).

Source CSS retains its order, media conditions and localized asset references. Trusted component runtimes restore supported interactions. Copying a widget's CSS does not recreate its backend.

## Assets, persistence and recovery

Asset collection shares concurrent downloads across page workers. Requests for the same in-flight asset share a promise. Completed page transformations, CSS and media are checkpointed so resume can reuse them. Network policy and disk checks still apply.

Large checkpoints use streamed JSON and atomic replacement. Each write has its own exclusive temporary file. Progress persistence coalesces pending full-state snapshots while retaining the complete event history. Worker errors reach the job supervisor rather than escaping through an event callback.

A cached rebuild uses the prepared model and saved source HTML. It can retry missing assets and apply supported cache upgrades without rediscovering the whole site. It does not refresh every source page. Keep manual content edits in the downloaded project: a builder rebuild regenerates its own project. See [recovery](recovery.md).

The ZIP contains compiled output and editable source. It excludes internal full-site snapshots and temporary SSG staging files. Downloads stream instead of loading the whole archive into memory.

## Preview and publishing

The local preview runs on a separate port, rewrites local references under the job prefix and applies a restrictive CSP. File serving checks both lexical paths and resolved filesystem paths. Imported scripts do not gain permission to execute.

Publishing requires an explicit account connection and destination confirmation. The builder copies the editable project, rebuilds for the destination and uploads compiled output. GitHub uses a managed publishing branch; Cloudflare uses pinned Wrangler with a Direct Upload project. Provider completion and a matching live marker must both pass before a URL is marked verified. See [publishing](deployment.md).

Tokens stay in server memory. The app is not a multi-user service; public hosting needs separate authentication, worker isolation, quotas and credential storage. See [distribution](distribution.md).
