# Yoast acceptance review

Status: pending full-family acceptance. The available classic and block-theme fixtures pass the checks below; they do not establish support for every Yoast configuration or premium module.

## Verified 2026-10-25

Yoast28.7 on WordPress7.1.3 was checked with Twenty Twenty-One2.6 and a separate Twenty Twenty-Four1.6 installation. The second fixture uses the same metadata seed: it adds a rendering configuration, not independent editorial content. Both sources disable outbound HTTP and mail.

Both metadata-to-native-export checks passed distinct content/search titles, social/card metadata, relocated schema identities, noindex preservation and sitemap exclusion, authored SEO/frontmatter changes, renamed permalinks, robots changes, article title bindings, and removal of source comment-service actions. Four source pages were checked per configuration; no AI was used.

A fresh whole crawl of the block-theme fixture completed11 discovered pages, with0 queued URLs or discovery failures. It produced11 Markdown records and5 shared templates, no snapshot fallback, and passing template roundtrips. All15 viewport comparisons passed thresholds (minimum pixel0.9967091779657224); this is not literal1:1. The generated15-page audit passed with0 issues and4 performance samples. Wall time99318ms.

The export has no blocking quality failures. Its `needs-review` status reflects two source comment forms requiring replacement delivery, not a failing Yoast metadata gate. Real delivery is not simulated. Evidence: the fixture report.

## Remaining scope

Independent content/schema configurations, person-versus-organization variants, broader breadcrumbs and archive schema, premium modules and production deployment checks remain unverified. The full-family status stays pending until the applicable checks pass.

## Reproduce

```sh
python3 tests/fixtures/platform-setup.py --kind yoast --runtime work/yoast-heldout --port 9440 --theme twentytwentyfour
python3 tests/fixtures/serve.py --runtime work/yoast-heldout
# With Kujo installed on PATH or KUJO_BIN set:
node tests/fixtures/platform-yoast-check.mjs yoast --origin=http://127.0.0.1:9440
node tests/fixtures/platform-migrate.mjs work/yoast-heldout artifacts/platform/yoast-block-acceptance --kind=yoast --whole-site
```

The alternate-origin check accepts only a loopback origin. It performs no source edits or submissions. Generated fixture packages/databases stay untracked.

## Person identity and annotated references — 2026-10-25

An installed person-based Yoast configuration exposed a general schema bug: an Article's `{name, @id}` author reference claimed the ID before the full Person definition, so deduplication discarded the later typed record. The shared converter now preserves untyped contributions and deduplicates explicit typed definitions. Existing conflicting typed definitions still produce warnings; reference labels remain intact in either graph order. This applies to linked schema from any source plugin.

All16 schema preservation regressions passed. The real installed fixture passed home/article native export at a new origin and subdirectory: full person identity, its source multi-type array, publisher and article-author links survived, with no source-origin references. Yoast28.7 emits a Person/Organization multi-type identity in this configuration; the test preserves that fact instead of assuming a scalar Person type. The temporary source option changes were restored exactly and verified. No AI was used. Evidence: the fixture report; reproducer: `node tests/fixtures/platform-yoast-person.mjs work/yoast-heldout`.

This closes the tested person-identity conversion case, not every person profile, schema variant or full-family gate.

Typed partial identities are now covered too. A regression reproduced loss of a later biography/social profile when an earlier typed Person record contained only name and ID. The shared converter adds compatible missing fields to the first emitted definition, preserves references in either input order, and reports conflicts without merging facts from the conflicting record. It does not infer nested equivalence or overwrite existing contradictory fields. All22 schema/cache regressions passed with Kujo configured, and the installed person-identity check passed again with exact source-option restoration. An initial cache-test invocation lacked KUJO_BIN; rerunning with the installed executable passed.

## Installed FAQ block authoring — 2026-10-25

The shared FAQ runner now supports Yoast's actual `yoast/faq-block` attributes and saved markup shape (section divs, strong question text, paragraph answers, as emitted by the installed save component). Yoast itself emits the linked FAQPage/Question JSON-LD. Two visible questions preserve their anchors, editable content, relocated URLs and linked references through native export. Editing the Markdown answer updates its structured answer, and permalink/SEO-title edits update the graph. No plugin-specific builder fix was needed after the generic binding change.

Both installed Yoast and Rank Math checks passed with0AI, and their temporary fixture pages were removed and absence verified. Yoast's hidden-question behavior is not claimed by this test. Evidence: the fixture report; reproduce with `node tests/fixtures/platform-rankmath-faq.mjs work/yoast-heldout --kind=yoast`. FAQ visual variants and broader configurations remain open.
