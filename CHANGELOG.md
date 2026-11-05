# Changelog

Versions follow Semantic Versioning. During the 0.x preview period, read each release’s notes before updating. Git tags identify release source; `main` may include newer work.

## [Unreleased]

## [0.1.0] — 2026-11-05

First public preview of Website Cloner.

### Included

- Local macOS/Linux source installer and start, restart and stop commands.
- Public WordPress capture through HTTP or a user-reviewed browser session.
- No-AI migration by default, with optional constrained CSS review and token receipts.
- Editable Kujo SSG exports with Markdown, frontmatter, shared templates, taxonomies, localized assets, search, feeds, sitemaps, llms.txt and read-only WebMCP discovery.
- Saved builds, progress, cancellation, checkpoints, cached rebuilds and disk recovery.
- Content, visual, navigation, SEO, accessibility and local performance checks.
- GitHub Pages and Cloudflare Pages token-based publishing flows with deployment verification.
- A small reproducible WordPress demo, contribution guidance and private security reporting.

### Preview limits

- A fresh macOS install has been exercised; real Debian/Ubuntu desktop acceptance is pending.
- Publishing has automated fixture coverage; live account acceptance remains pending.
- Plugin support is scoped to tested configurations, not every version or feature.
- Backend features such as comments, checkout and accounts need replacement services. Optional AI does not guarantee fidelity or fact-check all content.
- The server is local and single-user. Publicly hosting the builder is unsupported.

[Unreleased]: https://github.com/kujolang/website-cloner/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kujolang/website-cloner/releases/tag/v0.1.0
