# Post-build SEO and performance

[Documentation index](README.md)

The audit runs after content and style verification, before packaging. Its summary appears in the build view; the ZIP contains the reports. Blocking route errors affect the quality result. Advisories do not prevent download.

## What it checks

Every exported route is checked for titles, descriptions, language, canonical URLs, headings, robots and sitemap consistency, duplicate metadata, local links, JSON-LD, image descriptions and dimensions, and missing local files. External destinations are not fetched. Uncaptured source links cannot be certified as working local pages.

Up to three representative routes receive desktop and mobile browser checks for LCP, layout shifts, TTFB, long tasks, resource bytes and requests. These run locally without network or CPU throttling. They are lab observations, not field Core Web Vitals or a speed guarantee. The 5 MB resource advisory is a product threshold, not a web standard.

Pinned Lighthouse 13.5.0 provides an optional deeper check and retains its raw reports and environment details. See the [README commands](../README.md#development-checks).

## What it cannot establish

INP, rankings, traffic, production CDN behavior and AI citations need data the local export cannot supply. Reports mark these as unavailable. Technical checks do not establish editorial quality or authority.

Audits do not rewrite editorial claims, invent ratings or dates, infer author expertise, or change training-crawler policy. Generated WebPage metadata does not invent a publisher organization. Review structured data against the visible page before publishing.

Local previews deliberately send noindex. Check indexing and performance again at the intended production URL.
