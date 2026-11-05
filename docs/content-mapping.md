# Native WordPress content mapping

[Documentation index](README.md)

New migrations discover public WordPress REST types and taxonomies. Core pages/posts and each public REST-enabled custom post type are enumerated with pagination. Categories/tags and exposed custom taxonomies are paginated independently. Public term archive links join the ordinary page crawl. Checkpoints preserve both the content frontier and term cursors. Private/draft REST records and attachments are not imported as published content.

The source HTML remains authoritative for appearance. REST metadata supplies type, WordPress ID, slug, dates, excerpt and term relationships. It does not replace rendered post content. If REST is unavailable, captured HTML remains exportable, explicit single-post markup can identify a post, and missing structured metadata is reported rather than invented. Custom post types not exposed publicly cannot be recovered reliably from a public URL alone.

Editable records live under `content/pages`, `content/posts`, and `content/wp-<custom-type>`. The custom prefix avoids collisions with SSG reserved types. Each record has editable Markdown and frontmatter. New exports render Markdown on every build; they do not fall back to an unchanged HTML body snapshot. Rich components and presentation data preserve layouts that prose alone cannot express. The portable build discovers records automatically and compiles shared native templates. Older v1 exports retain a compatibility reader. Categories/tags use native lookup files and ID relationships. Custom taxonomies use collision-safe global keys without hyphens (for example `wpgenre`); the native SSG interprets hyphenated lookup filenames as collection-specific. Term labels, slugs, hierarchy and original archive URLs are retained in lookup files and `wordpress-mapping.json` for editing/provenance.

Kujo compiles the native types and resolves taxonomy labels. The route adapter maps those compiled records to original public permalinks, including nested, extensionless and query-derived static routes. Original captured category/tag archive designs remain in place; native default listings do not overwrite them or introduce duplicate public routes. Adding/deleting Markdown records requires no route-manifest edit. Recognized source archive templates and pagination regenerate after content changes; ambiguous originals automatically receive native SSG listings, recorded as visual advisories in the maintenance report. Supplemental native listings always regenerate. See `ssg-complete-integration.md` and `export-guide.md`. Native RSS items are now retained at `/feed/index.xml`, with original public URLs and the configured number of latest public posts across all compilation batches (default 20; feed_limit: 0 exports all).

WebMCP content types and taxonomies are projected from the native SSG record index. `list_content` can filter posts/custom content by category/tag labels. `llms.txt`, local search and sitemap continue to use final routes, not compiler intermediate slugs. Unresolved taxonomy IDs are reported under `contentMapping.unresolvedTerms` and prevent an unqualified verified result. `contentMapping` also reports REST-mapped and HTML-fallback counts.

Regression coverage includes REST checkpoint resumption, custom REST bases, draft omission, native post/custom collection compilation, decoded category labels, original permalink/CSS preservation, prefixed WebMCP taxonomy queries and blocked-REST fallback. No AI is needed. Embedded public REST authors and featured media are captured alongside dates/excerpts. See `image-optimization.md` for conversion, fallbacks and native featured-image processing.

## Compiler execution

The export adapter compiles every record in bounded batches (20 by default), combines native indexes and feeds, and copies bulk assets with Node. This is a working-set boundary, not a page cap. `SSG_WORKERS` selects 1–4 workers (default 2); `SSG_BATCH_SIZE` selects 1–20 records. Kujo interpreter mode is the default after a local Kujo 1.5.0 comparison exposed a major VM slowdown; set `SSG_RUNTIME=vm` to explicitly test the VM. Each batch has a 10-minute timeout and reports its page count/time. The outer migration retains its existing build timeout and checkpoints.

Core editor/storage REST types (navigation, reusable blocks, templates, global
styles and font records) are not public page collections. Discovery excludes
these known core types and their internal taxonomies while retaining their
rendered contributions in captured HTML. An unsupported endpoint definition is
reported and skipped individually, so later public custom types remain
available. This prevents the core navigation record from adding a fictitious
`/navigation/` page and prevents nested font endpoints from aborting catalog
processing. Public custom post types and taxonomies retain their existing
mapping behavior.
