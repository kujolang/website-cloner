# Reusable semantic templates

[Documentation index](README.md)

The builder emits named `templates/content/<role>.html` entry templates for
roles supported by the captured site: home, archive, category, tag, default-page,
single-post, content-type archives, custom taxonomies, and single content types
such as product, portfolio, work, book or event. Product archives use `shop`.
It does not invent a category or shop design when no such source page exists.

Role evidence comes from native WordPress records and classes, primary
Product/article structured metadata, the site root, and recognized listing
URLs with repeated editorial entries. A URL merely mentioning a product is
not sufficient to invent a product collection. Original public routes remain
unchanged; detected custom types use native SSG collections.

## How reuse works

The compiler unifies common ancestors within each role. Different, optional,
missing or reordered sections become ordered arrays of reusable partials;
there is no giant conditional page template and no whole-page HTML blob in
frontmatter. A single primary article stays in its role layout rather than
being disguised as a one-item repeated card. Actual rows/cards remain reusable
repeat templates.

Site headers and footers use shared `templates/partials/header.html` and
`footer.html` files when present. Other partial names describe their role or
section, with a structural suffix where necessary. Common attributes and text
are moved into readable shared HTML only when identical at every use. Variable
attributes/sections remain in per-record `templates/data/*.json`; titles and
other authored metadata remain dynamic.

Markdown and frontmatter stay authoritative. Rich forms, SVGs, tables and
other blocks that require HTML remain explicit components. `TEMPLATES.md` and
`template-catalog.json` explain the exported structure. The catalog also flags
captured canonical duplicates; those are not independently verified articles.

## Maintaining an export

Edit the Markdown record for prose and metadata, a named role template for its
shared structure, shared partials for site chrome/sections, and CSS for style.
Use `navigation.json` for supported navigation edits. Then run `npm run build`.

`node scripts/site.mjs new --type posts --slug my-post` inherits a captured
single-post design, with a separate presentation sidecar and editable Markdown
sections. Custom types use their native collection name, such as `wp-product`.
`--layout <role>` explicitly selects an existing role and `--permalink <path>`
selects the desired public URL. Drafts are not published until enabled.

## Verification contract

Every generated record must render the same DOM before and after structural
factoring. Moving invariant markup into HTML has an additional rendered-output
hash check. Generation fails with an explicit record path on mismatch;
`template-roundtrip-report.json` records the result. This proves the template
refactor preserves its input, not that an incomplete source capture contains
all original content or backend behavior.

Future capture plans sample every detected role at desktop, tablet and mobile
sizes, including sites with more than five custom content types. Existing
cached runs retain their original captures; missing historical source views
are not silently called verified. The existing route/content, asset,
navigation, accessibility, SEO and screenshot checks still run after export.

Tests cover different post structures sharing one layout, optional sidebars,
shared header edits propagating across roles, product/work collections,
ordinary-page false positives, inherited new content, invariant vs. variable
fields, large manifests, editable archives and responsive source markup.

Large exports render native Markdown in UTF-8 JSON batches below Kujo's 8 MiB
read limit. Identical Markdown sections render once, then map back to every
original route and slot. No pages are omitted to meet the batch size. A single
section larger than the 4 MiB batch fails explicitly with its source identifier
rather than being truncated.
