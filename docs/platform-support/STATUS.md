# Compatibility status

Updated 2026-10-25 after resumed acceptance work. The chronological ledger contains earlier limitations that later checkpoints supersede; use the latest evidence for each capability.

- 20 target plugin families.
- 19 have scoped installed-plugin fixture evidence, including Elementor free and the other free/community targets. This is not complete version or feature coverage.
- WP Rocket has shared lazy/deferred-asset handling but no installed-plugin acceptance evidence.
- 0 have passed every full-family release gate. Do not advertise universal or complete compatibility.
- No AI is required for the implemented migration or authoring paths.

| Family/group | Implemented and tested scope | Important remaining work |
|---|---|---|
| Elementor | Classic/nested tabs and accordions, responsive state, configured motion, native content edits | Pro widgets/forms/popups, wider layouts and independent configurations |
| WooCommerce | Native products/terms/archives, variations, galleries/zoom, editable prices/stock snapshots, catalog sorting and pagination | Connected cart/checkout/accounts/live inventory, wider stores/configurations |
| Contact Form 7, WPForms | Native editable fields, validation, uploads/response contracts, configured delivery; classic and independent block-theme fixtures | Conditional/multistep/paid features and owner-verified live delivery |
| Yoast, Rank Math, AIOSEO | Editable metadata/social/schema, identity/link rewriting, deduplication and local SEO output | Wider schema/business variants and independent configurations |
| ACF, CPT UI | Public typed fields, formatted numbers, links, scalar/list relationships; native collections/terms/shared templates | Media/repeaters, complex conditional layouts, initially empty fields and unavailable/private schema |
| LiteSpeed, Autoptimize | Installed lazy media and optimized/deferred/inline resource configurations | More optimizer configurations and independent fixtures |
| WP Rocket | Shared lazy/deferred resource handling | Installed licensed fixture and feature verification |
| Essential Addons | Tabs, filterable/masonry galleries, local gallery search/pagination | Other widgets, Pro and independent configurations |
| Ultimate Addons | Shared header/footer, editable nested navigation, flyout/full-width menus and breakpoint variants | Other widgets, Pro and independent configurations |
| Spectra | Installed legacy FAQ behavior, content editing and motion | Other blocks/newer architecture and independent configurations |
| Smart Slider 3 | Image slides, controls/keyboard/autoplay, slide content/order/add/remove | Layers, complex effects and independent configurations |
| Complianz, CookieYes | Banner/preferences, persistence, keyboard/focus, explicit service consent | Wider variants and external integration verification |
| Redirection | Observed/imported rules, native route edits, collision/unsupported reporting and static navigation | Hosting-provider semantics and independent configurations |
| The Events Calendar | Native events/venues/dates, local calendar views/search/navigation/pagination, subscription/ICS and authoring | Broader localization/recurrence/configurations and complete release verification |

Shared improvements live in the builder: native Markdown/frontmatter/templates, cached rebuilds, local links/assets, selective component runtimes, SEO/accessibility reporting, compatibility/form settings and deterministic no-AI tests. Passing sampled visual tests is not a universal 1:1 guarantee.

Next work should prioritize the remaining acceptance matrix and independent source/export configurations, then the missing features above. Paid/private capabilities must remain explicitly unverified without owner-provided access. Backend-dependent behavior needs a real configured service; static exports must not simulate successful transactions or delivery.

Latest fix: relationship arrays can add, reorder, remove and clear links through shared item templates. Installed ACF/CPT UI proof passed; source fixture restored. Details: the fixture report.

## Current WPForms acceptance evidence

The fresh independent Lite fixture completes its entire 13-page crawl. Its13 Markdown records share 5 content templates; template roundtrips and editable-content/form checks pass. All 18 sampled viewport comparisons pass configured thresholds; the generated 17-page audit reports 0 issues. Generated-runtime error-state keyboard/description checks, choices, masks, counters and reset are verified at desktop/mobile. Source-colour contrast findings remain reported in configured error states.

This is evidence for the installed fixture, not full-family completion. Conditional/multistep/Pro variants, broader configurations and owner-verified external delivery remain unverified. CAPTCHA remains deferred by user request. Detailed current receipts and limitations: `wpforms-acceptance.md`.

## FAQ flow and visual acceptance

Installed Yoast and Rank Math FAQ captures pass desktop/tablet/mobile pixel and layout comparisons at 1.0 with no quality failures, plus native Markdown answer edits, permalink/SEO edits and schema synchronization. The generic converter now separates adjacent standalone inline prose from block prose, preserving source paragraph boundaries while keeping adjacent paragraphs together. This fixes the extra paragraph/spacing reproduced in Yoast's FAQ layout without plugin-specific CSS. All 18 Markdown-first regression tests pass. The captures remain `needs-review`; these isolated FAQ checks do not complete a plugin-family release gate. Evidence: the fixture report, the fixture report.

## Rich FAQ text boundaries

The shared schema converter now preserves word boundaries between paragraphs, list items and line breaks when an authored FAQ answer updates structured data. A failing regression previously produced `guide.Call us.Email us`; the repaired output retains spaces without inserting spaces inside inline emphasis or links. Source schema remains unchanged in memory, and explicit schema overrides still take precedence. Presentation version40 refreshes bindings from saved HTML; the cache regression verifies no source requests. Installed Yoast and Rank Math native FAQ authoring checks pass again with no AI and verified temporary-page cleanup. This is a generic semantic-text fix, not new plugin-specific rendering code or full-family acceptance.
