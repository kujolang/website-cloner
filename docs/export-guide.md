# Your editable website

[Website Cloner documentation](https://github.com/kujolang/website-cloner/blob/main/docs/README.md)

This download contains the working static frontend in `output/` and its complete source project. Upload **only `output/`** to a static host. Keep the rest to edit and rebuild your site. No WordPress runtime or AI account is required.

## Quick start

Install Node 22.19+ and a compatible Kujo runtime. The cloner installer pins Kujo 1.9.0; see the [installation check](https://github.com/kujolang/website-cloner/blob/main/docs/installer-verification.md) for tested versions. Basic builds use bundled dependencies and work without npm installation. cwebp is optional; install it for native featured-image optimization.

```sh
npm run build
npm run serve -- --port 8080
npm run check
```

`npm run dev` builds a local draft preview and watches content, templates, assets, static files, navigation and configuration. Drafts are noindex and excluded from feeds/search/WebMCP/llms.txt. Build again without `--drafts` before publishing.

## Source of truth

- `content/<collection>/*.md`: editable Markdown and YAML frontmatter. Filenames derive from original URL paths (for example `about.md`); `permalink` preserves the published URL. Posts, pages and custom collections remain distinct. New Markdown files are discovered automatically; deleting one removes its output. No routes.json edits are required.
- `content/*.yml`: native category/tag/custom-taxonomy lookup data. Relationships retain their full labels and membership.
- Markdown is rendered on **every build**. New exports have no HTML/JSON body snapshots and no unchanged-body fallback. Older v1 exports remain readable through their compatibility path.
- `templates/content/`: shared source layouts. Content values live in frontmatter (`title`, `author`, `date`), while `content_template` chooses the shared layout. Simple article prose remains ordinary Markdown. Complex landing pages use readable named sections such as `<!-- content-slot:our-story -->` (older `bodyN` markers remain supported); retain those section markers when editing; their names stay stable when you edit the prose. Missing/duplicate sections fail instead of silently dropping text.
- `layout_data` in frontmatter points to an editable JSON file in `templates/data/`. It holds presentation values, source attributes, component references and section mappings so author-facing Markdown stays concise. Repeated presentation data is stored once in `templates/data/shared.json`; `$shared` references resolve before rendering. Edit a shared definition to update its uses. Missing or circular references stop the build. Inline legacy bindings remain supported. Copy a migrated Markdown file to start another item with its existing layout; change its permalink and content. New plain Markdown uses the native default template.
- `templates/components/`: explicit rich HTML components for forms, tables, SVG, responsive pictures and other structures that Markdown cannot express faithfully. The presentation data’s `components` map binds them to the layout. These are editable HTML, not disguised Markdown. `content-source-report.json` describes each record and any exceptions; `output/content-source-report.json` records the source files used by the latest build.
- `templates/`: native layout and shared page/post bridge. The native SSG receives real Markdown bodies; the portable adapter restores layout sections, presentation attributes and explicit components after native rendering. It does not create a content-filled template for every post.
- `assets/`: local images, fonts, CSS and scripts. Original styling is retained per imported page. AI repair CSS, if any, remains in `assets/css/agent.css`.
- `static/`: extra files copied to the frontend. Put a custom `404.html`, `favicon.svg` or `favicon.ico` here. Reserved generated indexes cannot be overwritten accidentally.
- `navigation.json`: editable navigation; changes update imported header links and navigation placeholders in new templates.
- `archive-bindings.json`: editable source listing/card templates, filters and pagination. Recognized archive layouts regenerate after content changes while retaining their grid/card markup. Ambiguous layouts automatically use responsive native SSG cards at the same archive URLs, with current taxonomy membership and pagination. No manual binding is required. `output/maintenance-report.json` lists these fallbacks for visual review because their card presentation may differ. Supplemental native archives remain complete regardless.
- `routes.json`, `wordpress-mapping.json`, `content-layout.json`: import provenance and fidelity mappings. Routine authoring does not require editing them.
- `build.kujo`, `scripts/`, `abilities/`, `kennel_packages/`, `tools/ssg/`: pinned native generator, portable adapters, approved local Ability workflows and full SSG toolkit.

## Add, edit and publish content

```sh
npm run new -- --type posts --slug my-story --title "My story"
```

This creates a draft Markdown file. Set `draft: false` when ready. For captured plain-text headings, `title` controls the visible heading and `seo_title` controls the browser/search title. Styled headings remain in Markdown. Supported frontmatter includes `title`, `seo_title`, `description`, `permalink`, `date`, `last_updated`, `author`, `featured_image`, `categories`, `tags`, `taxonomies`, `template`, `aliases` and `robots`.

```yaml
---
title: My story
permalink: /news/my-story/
draft: false
date: 2026-10-20
author: Example Author
categories: [1]
tags: []
aliases: [/old-story/]
featured_image: assets/media/my-photo.png
---

Write **Markdown** here.
```

Changing an imported permalink creates a redirect from its original URL. Explicit `aliases` are also supported. Route collisions and escaping paths fail the build. Removed/draft content is removed from maintained source cards, search, feeds and discovery indexes. Existing links to removed records lose their destination rather than publishing a broken link.

## Configuration and hosting

The native precedence is `kujo-ssg.yml`, then `.yaml`, then `.json`. Do not keep multiple formats unintentionally. Important options include `site_url`, `site_title`, `posts_per_page`, `feed_limit` (0 = all posts), `sort_by`, `fonts`, `minify`, `download_remote_images` and `output`.

```sh
SITE_URL=https://example.com npm run build
SITE_URL=https://owner.github.io/repository BASE_PATH=/repository npm run build
npm run build -- --site-url https://example.com --posts-per-page 12 --feed-limit 0
```

The migration-aware build preserves exact source URLs and complete public taxonomies while using native compilation, Markdown, featured images, RSS items and card rendering. Supplemental collection/taxonomy archives participate in sitemap, local search, WebMCP and llms.txt. Static output has no server dependency.

To minify, install the pinned optional esbuild dependency with `npm install`, then run `npm run build -- --minify`. Alternatively set `SSG_ESBUILD_BIN` to an esbuild 0.28.2 executable. Configured native fonts are self-hosted; leave `fonts: []` to retain imported typography. Remote featured images require `download_remote_images: true` and the native destination policy still applies.

## Validate, package and use the toolkit

```sh
npm run check
npm run package -- --destination website.tar
npm run ssg:check
npm run docs:import -- --target-repo /path/to/code
npm run docs:starter -- my-docs-site
```

Python 3 is required for packaging and the inspection/DocGen helpers; the advanced native toolkit also uses Bash. Basic build/preview do not require them.

Packaging includes both source and frontend, uses deterministic archive metadata, refuses to overwrite an existing archive and excludes secrets/caches. `ssg:check` exercises the local Ability contract, including approved builds; it does not deploy. The docs importer produces editable reference Markdown through the native DocGen bridge. The docs starter is a separate complete native SSG site. See `TOOLKIT.md` and `tools/ssg/docs/` for upstream capabilities and their contracts.

Validation fails on missing primary headings and on additional H1 headings introduced beyond the captured source. Inherited multiple H1 headings are reported as SEO warnings; newly authored pages still require exactly one. These warnings are not a claim that source SEO is clean.

Read `migration-report.json`, `validation-report.json` and `output/maintenance-report.json` before publishing. Public crawling cannot recover private/unexposed content. Forms requiring a backend, inaccessible assets and ambiguous original layouts remain explicit source-specific issues; a passing build is not a guarantee of visual equivalence for every website.

Shared layout matching ignores per-record attribute values and attribute presence.
`templates/repeats/` contains reusable row/card HTML; `layout_repeats` arrays in the
presentation sidecar supply each row's values and attributes. Editing a repeated
layout changes every item using it. These arrays contain bindings, not saved page
HTML. The content-source report includes template usage counts so reuse is visible.

Article prose keeps simple image figures in Markdown and restores their original
figure wrapper from presentation data. A rich article block can be placed with
`{{component:component1}}` on its own line; edit the referenced HTML component or
move the shortcode to change its position. This avoids section markers between
ordinary paragraphs, images, and tables while preserving the original markup.
Styled inline spans/marks remain explicit inline HTML inside Markdown when plain
Markdown cannot express their presentation. The build preserves them without
splitting the paragraph; fenced and inline code examples remain literal.

### Source colours and accessibility

Exports preserve source text colours by default, including active navigation links and footer links. Accessibility verification still reports contrast problems; passing visual parity does not mean the source design meets accessibility requirements. To deliberately repair measurable solid-colour contrast, add `data-migration-contrast="repair"` to the exported shared HTML document's `<html>` element. This changes the design and should be visually reviewed. Images, gradients and transparent backgrounds are not guessed.

## Redirect rules

Place an owner-supplied Redirection JSON export in `redirects.import.json` at the project root, then rebuild. The build also reads recorded HTTP hops from `observed-redirects.json` and creates rules for frontmatter aliases and changed permalinks. These files remain local authoring inputs; a fresh crawl cannot discover private plugin rules.

Supported imported rules are enabled, literal URL matches with URL redirect actions, status 301/302/303/307/308, and `match_data.source.flag_query: "ignore"`. Regex, case-insensitive/trailing-slash matching, exact query matching and visitor conditions require server support and are reported rather than approximated. Disabled groups/rules are skipped. Internal targets must resolve to exported routes or a valid redirect chain. Cycles, conflicts, unsafe paths and missing targets are reported in `redirect-report.json`.

Cloudflare Pages receives `output/_redirects` with supported HTTP rules within its documented limits. GitHub Pages and other plain static hosts receive HTML navigation fallback pages for eligible 301/302/303 document paths. A fallback returns the host's normal page status, not the source redirect status; it does not preserve request methods or query-string behavior. Status 307/308 and non-HTML resource redirects require HTTP hosting support. Existing captured pages and reserved routes are never overwritten. Observed hops prove only the captured request, not every query/visitor condition. Review the report before publishing; generated files are not proof of live hosting behavior.

## Product catalogs

When the source exposes WooCommerce public product data, native `content/wp-product/*.md` records include `product` frontmatter and taxonomy relationships. Product descriptions remain editable Markdown. `product_bindings` lists verified text bindings such as a unique SKU; other captured fields are available as data but are not automatically bound to every visual element. Gallery paths are local, with `asset_issues` for missing downloads. Prices retain their source minor-unit strings and currency precision.

Review `commerce-report.json` and `commerce-runtime-report.json`. Inventory/prices are snapshots. Recognized purchase controls remain disconnected, and configuring a generic form endpoint does not enable a cart or checkout. Where public variation snapshots were captured, local option selection displays their price, stock label, SKU and image. Snapshot display prices use major currency units, unlike the Store API minor-unit strings. Main product price markup and other configurations are not universally bound; review the generated reports.

### Editing product galleries

Edit `product.gallery` in the product Markdown file, then run `node scripts/build.mjs`. Array order controls image order; removing an entry removes that image. `src`, `thumbnail`, `alt` and optional `caption` update the static HTML, not just the browser runtime. Put new image files in `assets/media/` and use paths such as `/assets/media/new-product.jpg`.

The generated `sources` list contains responsive candidates. `captured_src` records which master those candidates and dimensions belong to. Changing the master `src` automatically stops using stale captured candidates and dimensions; the viewer can read the new local image dimensions. To supply a new responsive set yourself, update the master identity, candidate URLs and `full_width`/`full_height` together. Keep alt text descriptive; captions are separate visible text.

Supported captured WooCommerce galleries have local thumbnail selection and variation-image changes. Captured PhotoSwipe4 markup also enables a local fullscreen viewer. Hover zoom, other gallery markup and additional configurations require separate verification; their presence in source does not prove support.

## Optional services and privacy preferences

Configure optional export services in a project-root `consent.json`. The file is retained across native rebuilds. Example:

```json
{
  "services": [
    {"id":"newsletter","type":"form","formId":"FORM_ID_FROM_FORMS_JSON","category":"marketing","label":"Newsletter"},
    {"id":"map","type":"iframe","route":"/contact/","targetId":"map","url":"https://your-embed.example/map","category":"preferences","label":"Map"}
  ]
}
```

Configure form delivery first. For an embed, use the captured `migration-frame` with that ID, or author a placeholder such as `<div id="map" data-cloner-embed></div>` in a shared template. Optional categories are `preferences`, `analytics`, and `marketing`; these classify the two supported service types, not arbitrary scripts. Unlisted forms retain their normal explicit delivery behavior. Invalid declarations, missing exported routes and unmatched service targets fail the build with `consent-report.json` evidence.

Configured services start denied. Preferences can be saved, reopened, or revoked; service-definition changes invalidate previous choices. Existing Complianz/CookieYes banner controls connect to the exported settings; the preferences dialog describes the actual configured services. Without optional services, obsolete source banners/vendor lists are hidden and no consent runtime is included. Source tracking scripts, source consent cookies, and source vendor databases are not restored.

Revocation removes managed frames, prevents later optional form submissions, and attempts to abort an in-flight managed submission. It cannot retract data already received by a service or delete third-party storage. Storage denial applies choices only for the current page and shows that limitation. These controls do not implement TCF/vendor frameworks, regional policy, source preference expiration, or arbitrary analytics script loading.

### Public events and calendar downloads

Captured The Events Calendar single-event pages with a public record ID are enriched through the public event API. The builder keeps dates, source UTC instants, time zone, venue and categories in `event` frontmatter under the native custom collection. `events-discovery.json` reports inaccessible records. This is enrichment of discovered pages, not proof that a source exposed its entire historical calendar.

Native rebuilds generate local `.ics` files and rewrite recognized iCalendar buttons. Timed events accept local `event.start`/`event.end` values with a timezone, or explicit UTC edits. Conflicting edits and ambiguous daylight-saving times require resolution. All-day events use inclusive authored dates; the calendar file converts the end to iCalendar’s exclusive end.

Supported visible date markup rebuilds from these fields. `event_bindings` records the fields bound to the page; unknown formats remain review items. Local calendar controls and list pagination operate on captured or authored records within their tested scope. Recurrence, booking and ticket delivery are not inferred or connected. See [event authoring](https://github.com/kujolang/website-cloner/blob/main/docs/platform-support/event-authoring.md) and [plugin status](https://github.com/kujolang/website-cloner/blob/main/docs/platform-support/STATUS.md) for supported edits and remaining gaps.

`events-report.json` lists generated calendars and invalid dates. A working calendar export does not prove that discovery found every source event.

Event JSON-LD uses authored dates, title and venue on native rebuild. Matching uses the current event URL; unrelated events remain untouched. Unknown identities and source ticket offers produce SEO advisories. All-day schema end dates retain their inclusive source meaning, while `.ics` uses an exclusive end.


## Schema action destinations

Native builds preserve factual structured data and relocate captured read links. Captured non-read actions pointing to the source site (such as WordPress comments or checkout) are omitted and listed as `source-service-action-removed` in `seo-preservation-report.json`. They are not rewritten into a claim that a static endpoint works. Source search actions retain their separate removal advisory. External-provider actions remain in authored schema; preserving them does not verify that the service is connected or working. Review these advisories when configuring replacement services.

### Import redirect rules in the builder

Open a completed build's **Plugin compatibility & forms** panel and choose a Redirection JSON export under **Redirect export**. **Import redirect rules** replaces the previously imported rule file. The builder marks the settings as pending; use **Rebuild** to apply them from saved captures without retrying downloaded assets. The resulting ZIP contains `redirects.import.json`, generated host rules and `redirect-report.json`.

The import accepts rule-only and group-inclusive exports, up to 8 MiB per request. Stale settings are rejected rather than overwriting a more recent import. Importing does not publish anything or validate every rule as supported: regex, exact-query and conditional rules remain explicit advisories. Cloudflare HTTP rules and GitHub Pages HTML navigation fallbacks have different capabilities; HTML fallbacks cannot preserve 307/308 request methods.

### Captured slider content

Where supported, `component_media` in a page's Markdown frontmatter contains the image URL, alternative text and responsive source attributes for rich picture components. Change these values and rebuild; the shared component template retains the original layout.

Captured Smart Slider image tracks can also expose `slider_sequences`. Each key identifies a slider, and its array lists the captured slide IDs in display order:

```yaml
slider_sequences:
  n2-ss-2: ['3', '1']
```

Use the actual slider ID and slide IDs from your export. This example displays captured slide 3 followed by slide 1 and omits slide 2. The builder keeps slide backgrounds paired with their content. An empty array removes that slider. Removing a slide from this sequence does not delete its editable source content or media, so you can restore its ID later. Slide labels remain in the page's Markdown sections.

Duplicate or unknown IDs fail the build instead of silently dropping content. For a captured image-only slide, you can add a new item that reuses its structure:

```yaml
slider_sequences:
  n2-ss-2:
    - '3'
    - id: new-scene
      template: '2'
      title: A new scene
      image:
        src: /assets/media/new-scene.webp
        alt: Description of the new image
    - '1'
```

The `template` value references an existing captured slide, not a new template file. Put the new image in the exported project's assets. If that slide has responsive image candidates, supply an explicit `image.srcset` and/or a `sources` array matching the captured picture structure so browsers cannot accidentally select the original image. Image dimensions and layout styling otherwise inherit from the captured structure. A title provides the slide's accessible label; it does not create a visible text layer.

New slides with existing layers or embedded HTML IDs currently fail with an explanation; they need additional authoring support. This contract does not infer new layer layouts or prove every slider effect. Those cases remain subject to the compatibility report.


## Nested menus

The first native build writes `menus.json` for recognized list-based navigation. Identical menu trees share one definition across layouts and pages. Each item has a stable `id`, `label`, `url`, and optional `children`. Edit those fields or reorder items in their arrays; repeated destinations can have different labels. These edits preserve the captured list structure and icons. No additional visitor JavaScript is needed for authoring.

To add an item, give it a new unique `id` and a `template` naming a captured item in that menu. A new parent needs a captured parent template. Set its label, URL and children. Remove items from their arrays to delete them; use an empty array to remove all items. Existing item ids select captured markup, so retain them when changing labels or destinations. Executable URLs, duplicate ids and unknown templates fail the build.

Menus with multiple root lists, missing anchor destinations or no editable label text remain preserved markup and do not yet receive this data model. Mega-menu columns and arbitrary custom controls need separate support. The flat `navigation.json` remains available for fallback navigation; edited `menus.json` definitions take priority for their captured menus. Template changes that alter a menu tree create a new definition on the next build.

Edited menus refresh standard WordPress current-page and ancestor states for the page being built. Moving a known content route also refreshes these states and retains fragment/query suffixes in links. External links and query-filter links are not treated as the current local page. Untouched captured menus retain their source state.


## Configured form service validation

A delivery service confirms acceptance with a successful HTTP response and JSON `{"ok":true}`. To reject individual fields, return HTTP422 with `{"ok":false,"errors":{"email":"Use another email address."}}`. Error keys match the **current authored field names**, including brackets in repeated names. Messages render as text beside matching enabled controls, with accessible description/invalid state and focus on the first affected field. Editing a field clears its server error; reset or another submission clears prior errors. Unknown, disabled and hidden fields are ignored. An unmatched or malformed response remains a generic unconfirmed-delivery error.

This contract applies only to the explicitly configured owner service. It does not call the original WordPress form endpoint, prove email delivery, or reimplement server-side spam protection. Services must validate submissions themselves. Do not embed service secrets in exports.

## Browser-assisted capture

Choose **Browser-assisted capture** on the builder homepage, or **Resume with browser capture** on a failed job. Standard capture remains the default. The CLI equivalent is `npm run migrate -- https://example.com output-directory --no-ai --browser` (add `--resume` for an existing output directory).

The builder opens a separate Chrome window with an isolated session. Review the public source and handle any interactive prompts yourself, then click **Continue browser capture** in the builder. This confirmation does not override robots rules. It does not enable AI. The saved job retains its transport choice on resume/rebuild. Review time is counted as waiting time. Stop terminates the worker and browser while keeping migration checkpoints.

Browser traffic uses the browser's normal TLS/session behavior through a local proxy that validates and pins public destinations. Requests and redirects retain robots checks; source writes, WebSockets and unexpected popup windows are blocked. Downloads are bounded, concurrency is conservative, and explicit access challenges/denials stop capture rather than triggering circumvention retries. There are no stealth flags, agent impersonation, challenge solvers, imported authentication cookies or transfers of challenge tokens to the standard downloader. Browser cookies and temporary downloads stay outside exported projects and are removed on normal shutdown.

This mode requires a local graphical Chrome installation. It cannot promise access to every protected site: challenges that require blocked write requests, login flows or owner authorization can still stop it. It does not automate CAPTCHA or age confirmation. Browser access to one page is not proof that all catalog pages/assets are accessible. Session credentials are not persisted across worker restarts; a new session needs review again. Capture still reports missing resources and unsupported functionality rather than claiming a complete clone.
