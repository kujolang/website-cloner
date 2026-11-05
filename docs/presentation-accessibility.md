# Static presentation and accessibility

[Documentation index](README.md)

The builder preserves safe inline gradients, individual corner radii, borders and shadows. Original HTML is retained in capture checkpoints for future sanitizer upgrades. Older checkpoints recover only matching style declarations from saved HTML or a bounded HTML-only refresh; cached content, images, CSS, URLs and crawl scope are retained. Failed refreshes remain explicit in `repair-report.json`. This operation does not run source JavaScript.

Exported builds normalize additional H1 elements into level-two headings, keeping their original CSS selector specificity and presentation. Paginated metadata gains its existing page number. Portable validation rejects multiple primary headings. Link names come from captured destination titles or nearby headings; hidden decorative overlays are removed from keyboard tab order. Unknown image descriptions still require editorial review.

A hash-authorized local runtime implements WordPress block navigation disclosures and responsive dialogs: click/keyboard toggle, expanded state, Escape, outside-click dismissal, and dialog focus containment/return. It uses ordinary navigation links, not ARIA menu roles. An opt-in accessibility routine adjusts measurable solid-color text contrast with a minimal shade change; gradients, images, transparency and blending are excluded rather than guessed. Scrollable content without interactive descendants becomes keyboard focusable. Automated checks are not a substitute for assistive-technology testing.

Sources consulted 2026-10-21:
- https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/
- https://developers.google.com/search/docs/appearance/title-link

Regression coverage: `tests/navigation-presentation.test.mjs`, `tests/quality.test.mjs`. SiteCare before/after evidence is retained locally under `work/sitecare-seo-accessibility/`; generated artifacts and customer captures are excluded from Git.

## Deferred styles and Elementor menus

The extractor recognizes stylesheet URLs stored in `data-pmdelayedstyle` and `data-href`, retaining document order and media queries. Empty and unsafe URLs are ignored. Cached repairs upgrade saved source HTML, reuse existing localized CSS by source descriptor, and download only newly discovered styles/resources. No page discovery or AI is required.

The navigation runtime supports Elementor nested mega-menus (source hover setting, click, Escape, responsive toggle) and legacy mobile menus, including viewport stretching and separate submenu buttons that retain parent links. Navigation verification exercises both adapters.

Search forms retain submit-button styling while the local search runtime prevents remote submission. Obsolete Elementor search loaders/results are removed. Select/textarea names, option values and checkbox/radio values survive sanitization; personal text prefills and hidden submission state do not. Contact and signup forms still require a replacement backend and remain disabled with an explicit notice.

Native HTML `<search>` landmarks are preserved, including their CSS classes. Cached repairs restore previously unwrapped landmarks around the existing localized form, and remove the Elementor initialization-only hidden class. The repair keeps raw HTML in the capture checkpoint rather than duplicating it in the prepared export. Subprocess `ENOSPC` failures reach the automatic disk-space resume handler just like in-process filesystem failures.
