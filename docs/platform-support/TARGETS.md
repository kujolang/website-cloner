# WordPress compatibility targets

Target twenty plugin families by migration impact. This is a coverage shortlist, not a claim that these are the exact twenty largest installations or already supported. WordPress.org's [popular directory](https://wordpress.org/plugins/browse/popular/) supports prioritizing Elementor, Yoast, Contact Form 7, WooCommerce and WPForms. Premium plugins and specialist targets are included to cover important failure modes. Reviewed 2026-10-23.

| Target | Capture and authoring | Behavior to verify |
|---|---|---|
| Elementor / Pro | Global styles, breakpoints, shared headers/footers and layout sections | Menus, tabs, accordions, popups, motion, sliders and configured forms |
| WooCommerce | Products, categories, attributes, variations, galleries, prices and stock snapshots | Product selection and galleries; checkout/accounts require an explicit commerce connection |
| Contact Form 7 | Editable fields, labels, constraints and uploads | Validation, delivery, pending/success/error states; no captured tokens |
| WPForms | Same form contract, conditional rules and multistep definitions where available | Branching, step navigation, uploads and configured delivery; paid features separately tested |
| Yoast SEO | Titles, descriptions, canonicals, robots, social metadata and linked schema | Correct local identities, breadcrumbs, sitemaps; no duplicate graph records |
| Rank Math | Same shared SEO model | Schema variants, breadcrumbs, changed routes and duplicate metadata |
| All in One SEO | Same shared SEO model, local business fields | Factual business/schema data and canonical consistency |
| Advanced Custom Fields | Public typed fields, media, links, repeaters and relationships where exposed | Frontmatter edits control output; unavailable private schema reported |
| Custom Post Type UI | Public types, taxonomies and relationships | Native collections, shared detail/archive templates and original routes |
| LiteSpeed Cache | Lazy media, critical/deferred CSS, optimized resource paths | Correct first paint, responsive images, no missing deferred resources |
| WP Rocket | Lazy media, delayed assets and interaction-loaded presentation | Required interactions survive without recreating optimizer delays |
| Autoptimize | Combined/inline/deferred CSS and asset dependencies | Fonts, icons and styles remain local without duplicate bundles |
| Essential Addons for Elementor | Common widget data and layout variants | Tabs, grids, filtering, galleries and carousels |
| Ultimate Addons for Elementor | Header/footer layouts and responsive widgets | Navigation, dropdowns and reusable widget behavior |
| Spectra | Block sections, icons, responsive settings and content | Accordion/tab behavior and editable blocks |
| Smart Slider 3 | Slides, overlays, dimensions and available transitions | Navigation, keyboard, touch and timing; unsupported effects reported |
| Complianz | Banner and available preference presentation | Default-denied configured services, persistence, reopen, focus and revocation |
| CookieYes | Same consent contract across its markup variants | Consent actually controls exported integrations |
| Redirection | Observed chains and owner-supplied rule imports | Destination-host behavior; collisions, cycles and unsupported rules reported |
| The Events Calendar | Events, venues, timezone and available recurrence data | Listings/detail templates, date boundaries, calendar links and supported filters |

## Shared implementation order

1. Preserve source document attributes, CSS, fonts, icons and responsive media. Verify WordPress core menus, blocks, search, galleries and pagination before plugin adapters.
2. Build shared forms, disclosure/tab/accordion/carousel and consent contracts. Keep vendor-specific code limited to recognizing verified markup/data.
3. Map SEO, custom fields, products and events into editable native SSG data with reusable role templates.
4. Add explicit service connections for capabilities that require a backend. Never present disconnected forms, checkout or booking as working.
5. Test pinned installed versions, multiple configurations and a separate held-out fixture for each target. Record premium-feature licensing blockers explicitly.

## Definition of done

- Desktop and mobile source/export comparisons include open menus, active slides, expanded panels and form states.
- Markdown/frontmatter edits and adding content rebuild correctly through shared templates.
- Local links, assets, metadata, keyboard behavior and accessibility are checked. Preserve source colours and report source contrast failures.
- No AI is required. Cached rebuilds avoid repeated downloads.
- Measure processing time, request counts and output bytes. Unused adapters add no visitor JavaScript.
- Report observed plugin, preserved presentation, verified behavior, required connection and unsupported features separately.

Do not copy WordPress admin/security/backup capabilities into a static export. Popularity alone does not make Akismet, Wordfence, UpdraftPlus, Classic Editor or SMTP plugins a frontend migration adapter. Their relevant public output or external-service needs should be handled by shared contracts.

Track implementation evidence and remaining gates in [current status](STATUS.md). None of the twenty complete-plugin acceptance gates is closed yet.
