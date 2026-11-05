# Portable logos, fonts, images and links

The importer preserves inert SVG exporter declarations by removing their XML/DTD headers before sanitization. Text/tspan logos retain allowlisted typography and fill properties. Entity definitions, internal DTD subsets, scripts, external SVG references and active CSS remain blocked; no DTD is fetched. Legacy TrueType/OpenType/WOFF font MIME aliases and UTF-8 SVG data URLs are localized alongside normal media. Inline image `object-fit` and `object-position` survive sanitization, preserving source crops without forcing every image to cover.

Discovery prioritizes classic and WordPress block-theme post titles/featured images before utility navigation, while whole-site discovery continues until its frontier is exhausted. Existing crawl/network/robots boundaries still apply.

Captured same-site links become local paths, including checked submission/redirect origin aliases, slash variants and fragments. Tracking-only parameters are dropped. Links to already localized media use the local media path. Editorial links to unrelated external sites remain external.

Uncaptured or dynamic same-site destinations never silently fall back to the original WordPress site: their anchors retain their text, lose the active href, and carry an accessible disabled state and explanatory title. `link-coverage.json` lists their source/destination paths; the audit raises `uncaptured-internal-destination` P1 recommendations. This is not a claim that omitted pages were migrated. There is no product page-count cap. Review discovery failures or resume a resource pause for missing content; login, search and account workflows still need replacements. Canonical metadata retains the source identity until deployment sets `SITE_URL`; it is not a live runtime dependency.

Start a new build to apply extraction fixes. Resuming a saved prepared snapshot intentionally reuses earlier extraction. Existing job artifacts are not modified.

Regression coverage: SVG text logos plus hostile entities/styles; legacy font MIME/data URLs; crop/focal-point preservation; block-theme discovery order; local links, missing destinations, fragments, tracking queries, media and external links; audit visibility of disabled destinations. A separate live-source check uses the Repository homepage and two leading posts at desktop/mobile sizes without mutating the user's saved job.
