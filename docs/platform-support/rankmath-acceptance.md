# Rank Math acceptance review

Status: pending full-family acceptance. Verified scope below concerns installed free-plugin fixtures.

## Verified 2026-10-25

Rank Math1.0.280 on WordPress7.1.3 passed metadata/authoring checks in Twenty Twenty-One2.6 and a separate Twenty Twenty-Four1.6 fixture. The block-theme fixture uses the same metadata seed; it broadens theme coverage, not independent editorial content. Outbound HTTP and mail are disabled.

Both configurations passed distinct search/content titles, social/card preservation, linked-schema relocation, noindex and sitemap behavior, authored frontmatter, permalink/robots changes and article metadata bindings. Source WebPage schema in this fixture has no description: the export correctly avoids inventing one. No AI was used.

The fresh whole block-theme crawl completed11 pages with no discovery failures or remaining queue. It generated11 Markdown/frontmatter records using5 shared templates, with no snapshot fallback and passing roundtrips. All15 viewport checks passed thresholds (minimum pixels0.9967091779657224, layout0.9444444444444444); this does not prove literal1:1. The generated15-page audit passed with0 issues and4 performance samples. Wall time101896ms.

There are no blocking quality failures. `needs-review` reflects captured comment forms needing a replacement service. These forms do not silently submit to WordPress or pretend delivery. Evidence: the fixture report.

## Remaining scope

Independent content and schema variants, FAQ/HowTo blocks, local-business configurations, wider breadcrumbs/archives, premium modules and production deployment remain unverified. Do not mark full-family acceptance complete.

## Reproduce

```sh
python3 tests/fixtures/platform-setup.py --kind rankmath --runtime work/rm-heldout --port 9441 --theme twentytwentyfour
python3 tests/fixtures/serve.py --runtime work/rm-heldout
# With Kujo on PATH or KUJO_BIN configured:
node tests/fixtures/platform-yoast-check.mjs rankmath --origin=http://127.0.0.1:9441
node tests/fixtures/platform-migrate.mjs work/rm-heldout artifacts/platform/rankmath-block-acceptance --kind=rankmath --whole-site
```

## Installed free FAQ block — 2026-10-25

A temporary page rendered by the real Rank Math FAQ block passed native export checks: two visible questions and their answers remain in editable content without page-wrapper HTML; the hidden draft question is omitted from HTML and schema. Each schema question URL resolves to its rendered anchor after origin/subdirectory relocation and after an authored permalink change. An authored SEO title updates the FAQPage name. No AI was used. The local fixture page was removed in `finally` and absence verified.

The test uses the plugin's normal `rank-math/faq-block` attributes and rendering callback, not hand-built source JSON-LD. Evidence: the fixture report; reproducer: `node tests/fixtures/platform-rankmath-faq.mjs work/rm-heldout`. Scope is content/schema/route preservation; visual FAQ styles, all block configurations, and synchronization after editing answer text remain unverified. The broader FAQ/full-plugin gates stay open.

## FAQ answer authoring synchronization — 2026-10-25

A Markdown answer edit exposed stale FAQ schema. The builder now captures generic Question bindings only where a unique URL anchor and matching source text identify a question/answer element unambiguously. Native builds follow those captured child paths to update unchanged captured schema from visible authored content. Manually edited schema text stays authoritative; duplicate anchors, changed element types, missing bindings and unrelated routes are left alone. This is independent of Rank Math selectors or source domains. Presentation version39 upgrades bindings from saved source HTML.

The installed FAQ test now edits the answer in Markdown and verifies the visible answer and JSON-LD both change, including after a permalink edit. It passed with0AI. A cache regression verified binding recovery with0 source requests. Schema/cache/deferred/presentation checks passed (51-test focused set,31-test presentation/schema set, and final18-test schema set; these sets overlap). The generated export uses its existing DOM parser rather than adding a new dependency.

This supersedes the unverified answer-edit case above for the tested anchor-bound layout. Arbitrary FAQ layouts without a provable binding, visual variants, and all plugin configurations remain outside this evidence.

## Installed HowTo text steps — 2026-10-25

The installed free HowTo block exposed stale structured step titles/directions after native Markdown edits. The generic source-anchor/content matching now includes Schema.org HowToStep names, direct text and HowToDirection text. It uses unique anchors, source text and element paths; no Rank Math selectors or domain rules. Explicit schema overrides and missing/ambiguous targets remain untouched. Presentation41 refreshes bindings from saved HTML; a version40 cache regression verifies no source requests.

The real plugin fixture preserves two visible steps, excludes its hidden draft step, retains the source duration P0DT0H10M, relocates step anchors after origin/base-path and permalink changes, and synchronizes edited Markdown titles/directions. The initial test assumed PT10M; corrected to the installed source's equivalent duration representation before assessing export behavior. A fresh no-AI capture passed desktop/tablet/mobile pixel and layout comparisons at1.0, with0 blocking quality failures; mobile screenshots were also inspected. The native export uses1 Markdown record and1 content template. Run time66780ms. `needs-review` remains for4 unavailable links outside this one-page fixture sample. Temporary source page deletion was verified.

Schema/remediation/deferred/legacy checks passed53 tests. The subsequently extended cache suite passed18 tests (overlapping the earlier set), including the new no-network HowTo upgrade. Receipt: the fixture report. Reproduce: `node tests/fixtures/platform-rankmath-howto.mjs work/rm-heldout --capture` with KUJO_BIN configured.

This closes the tested text-step case only. Step images, nested sections, adding/removing/reordering whole steps, automatic synchronization of duration/description and other layouts still need evidence. Broader plugin-family acceptance remains pending.
