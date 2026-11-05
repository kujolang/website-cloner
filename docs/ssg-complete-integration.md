# Maintainable SSG export integration

[Documentation index](README.md)

The export combines the static frontend with editable content, shared templates, assets, taxonomies and rebuild tools. The checklist records implemented integrations, not a guarantee of visual parity on every source. Review each build’s reports for missing content, layout differences and unsupported features.

- [x] Canonical Markdown/frontmatter with lossless source layout preservation and native Markdown rendering after edits.
- [x] Automatic discovery of new/deleted records, permalink changes, drafts, aliases and route validation.
- [x] Rebuild source archive/card templates and pagination from current collections/taxonomies; automatic native SSG listings for layouts that cannot be identified safely.
- [x] Full taxonomy relationships without public projection truncation.
- [x] Configurable native feeds, metadata, dates, social images, search, sitemap, robots, llms.txt and WebMCP.
- [x] Editable navigation, custom 404, favicon/static files, local fonts and assets; image conversion and optional minification.
- [x] Portable build, serve/watch, content scaffolding, validation and deterministic packaging commands.
- [x] SSG development tools: Ability pack, documentation bridge/starter, and validation interfaces with pinned provenance.
- [x] End-to-end exported-project tests: initial fidelity, editing, add/delete/draft, archives, taxonomy, prefix hosting and source-package rebuild.

Upstream planned features and protected data that cannot be publicly retrieved must be reported explicitly; integration cannot invent them.

## Historical integration verification

These results describe the original integration milestone. See the [hardening review](audits/repository-hardening.md) for later test evidence.

`npm test`: 65/65 passed. Additional focused export tests passed after the packaging/asset updates. `tests/maintainable.test.mjs` builds a real exported project repeatedly and verifies Markdown rendering in preserved wrappers, automatic add/delete/draft/permalink handling, redirect aliases, source archive grid/card and pagination refresh, all 26 taxonomy labels including a label longer than 128 characters, prefix hosting, validation, preview HTTP serving, minification, byte-identical repeated source/frontend archives, approved local Ability builds, native DocGen import, and a built standalone docs starter. Existing browser WebMCP, image, fidelity, no-AI, discovery and deployment-adapter tests remain in the full suite.

## Capability accounting

| Native SSG capability | Migration integration |
| --- | --- |
| Markdown/frontmatter, pages/posts/custom collections | Canonical authored Markdown; native Markdown rendering and batched native compilation; Markdown renders on every build; rich components and presentation data preserve non-prose layouts. Older v1 exports have a compatibility reader. |
| Drafts, permalinks, aliases, sorting, pagination | Automatic discovery; drafts excluded by default and noindex in preview; exact original URLs and redirect aliases; configurable listing sizes/sort. |
| Taxonomies | Native lookup files and full resolved relationships; public migration indexes no longer truncate native-projected labels. |
| Templates, navigation, assets | Source family/content wrappers remain editable; source card templates/filter bindings update recognized archives; navigation and static-file hooks are exported. |
| Featured images/fonts | Native featured-image processing supports contained local files and opt-in policy-checked remote images; localized responsive candidates are all retained; explicit native font configuration self-hosts fonts. |
| SEO/feed/auxiliary outputs | Dates/authors, canonical/social/Article metadata; native RSS items merged across batches with configurable feed length; route-aware search/sitemap/robots/llms/WebMCP. |
| Minification | Pinned native esbuild policy, optional and verified. |
| Parallelism | Bounded compilation workers combine complete indexes/feeds/archives; no page-count cap. |
| Watch/preview | Working portable Node watcher/HTTP preview; upstream's planned/no-op watch is not misrepresented as implemented. |
| Local Ability pack | All ten pinned definitions, offline pinned dependency and an adapter using the migration-aware build/validator; explicit approval/idempotency preserved. Verified actual approved builds. |
| DocGen bridge and docs starter | Pinned complete toolkit, import into canonical Markdown, packaged independent starter with scripts/dependencies; both exercised. |
| Validation/export | Portable validator, source-specific maintenance report, deterministic source+frontend archive, and upstream tool contracts. |

## Boundaries that are not hidden

- Public crawling cannot recover inaccessible/private/unexposed WordPress content. This is a source-access constraint, not an SSG capability to invent.
- Arbitrary editorial layouts cannot always be classified safely. Recognized cards retain their source templates. Ambiguous archives automatically receive responsive native SSG listings at their original URLs, with taxonomy filtering and pagination. No manual template binding is required. The surrounding shell and introductions are retained; card presentation may differ. `output/maintenance-report.json` records these fallbacks for visual review.
- Write/deploy authority is never embedded in the public frontend. Local Ability writes retain approval/idempotency. Hosting-account credentials and live deployment remain separate provider operations.
- The upstream toolkit retains its documented resource policies; basic whole-site exports do not inherit its optional inspection helper's file/byte limits.
- This integration is verified against fixtures and exported-project round trips. It is not a promise that every live website has zero missing assets, inaccessible pages or visual differences.
