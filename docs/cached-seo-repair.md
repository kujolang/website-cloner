# Automatic cached SEO remediation

[Documentation index](README.md)

These changes apply to every migration and cached rebuild; they do not depend on a particular source domain.

- Same-origin links to PDFs and supported image formats are localized through the existing concurrent asset cache, including fragment identifiers. Cached downloads are reused. PDF MIME/signature checks reject HTML responses masquerading as files, and local previews serve the PDF MIME type. Missing linked files can be added without re-enumerating pages or fetching existing styles and images.
- Links to captured static destinations preserve non-content query parameters, such as contact-form prefills. Cache-buster and known tracking parameters are stripped. Search, feed, backend and content-pagination queries are not falsely treated as equivalent pages. Retaining a prefill URL does not recreate a server-side form submission service.
- Archives with inline-only content and no separately captured native records retain their editable source rows and source pagination. They appear in `archive-bindings.json` under `preserved`. Other ambiguous archives with captured records still receive native SSG listings. An empty native collection must not erase useful source content or disconnect captured query pages.
- Generated native archive pagination receives distinct titles and descriptions containing its real page number. Duplicate descriptions can be disambiguated with a unique captured H1; ambiguous cases remain for editorial review. `metadata-repairs.json` records original wording, revised wording and source evidence.

References consulted for this remediation:
- https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
- https://developers.google.com/search/docs/appearance/snippet

Local preview reports do not establish production rankings, field Core Web Vitals, rich-result eligibility, or form backend functionality.
