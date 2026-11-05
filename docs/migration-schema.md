# website-return/v1

[Documentation index](README.md)

The importer-independent JSON model is written to `site-model.json`. Version changes require a new schema identifier.

- `identity`: source site title and WordPress likelihood evidence.
- `source`, `createdAt`: origin and extraction provenance.
- `pages[]`: URL, preserved route, title/description/language/canonical/robots, layout family, semantic main-content blocks, header/footer, class evidence, navigation, styles, links and dynamic limitations.
- `pages[].provenance`: HTML SHA-256, capture time, extraction method. REST records aid discovery; HTML supplies presented content.
- `blocks[]`: currently `{type: "html", html: sanitizedFragment}`; future importers can add paragraphs/media/cards without changing the SSG boundary.
- `routes[]`: source URL, output route and internal SSG slug.
- `media[]`: source URL, local path, MIME, byte count and SHA-256; failures remain warnings.
- `captures[]`: family, route, viewport, screenshot filename and computed layout measurements.
- `design`: color tokens, width, spacing, navigation recipe, deterministic/AI method, bounded attempt receipts.
- `warnings`, `discovery`: limits, excluded/failed sources and crawl scope.
- `metrics`: measured time, requests/bytes, pages, template reuse, model calls/reported tokens, costs or null when unknown, repairs.

`migration-report/v1` separates pages/checks, visual comparisons, unsupported features, warnings, metrics and overall `needs-review` or `verified-within-scope`. The latter never means exact equivalence or production certification. Visual evidence includes sampled viewport and full-page captures where available. Pixel similarity measures RGB differences; layout similarity compares the geometry of matched semantic anchors. Read the thresholds and capture coverage in the run’s report. A high score on sampled images does not establish whole-site parity. Content coverage counts selected sanitized main-content tokens represented in the rebuilt main; it is not whole-site completeness.

## WordPress content graph

`model.wordpress` holds the public REST catalog, paginated term dictionaries, cursors and allowlisted records keyed by normalized source URL. Each captured page gets `contentType` (`pages`, `posts`, or a stable `wp-*` custom collection), WordPress identity/dates/excerpt, and taxonomy ID arrays. `model.contentMapping` reports REST/fallback counts and unresolved terms. Native SSG lookup files resolve IDs; the final public agent index takes resolved taxonomy labels from Kujo's generated index. The `collection` field in routes.json selects editable content and compiled intermediate paths; `route` remains the original public destination. See content-mapping.md for fallback and archive behavior.
