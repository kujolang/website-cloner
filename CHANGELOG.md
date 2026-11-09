# Changelog

Versions follow Semantic Versioning. During the 0.x preview period, read each release’s notes before updating. Git tags identify release source; `main` may include newer work.

## [Unreleased]

## [0.1.1] — 2026-11-09

### Fixed

- Keep hosted-site fonts, booking links and responsive navigation in exports.
- Preserve declared mobile typography and background asset URLs in previews.
- Export supported video as local, playable media. Remove failed source tags and report poster fallbacks. Remote players and protected streams still have limits.
- Move prose styling into template data so Markdown remains easier to edit.
- Handle pending HTTPS certificates when publishing to a GitHub Pages custom domain.
- Correct Cloudflare project pagination, deployment query sizes and Wrangler argument order.
- Wait for worker startup in the cancellation regression and update its deferred-style presentation fixture.

### Verified

- Full regression suite: 682 passed, zero failures or skips. Production dependency audit: zero known vulnerabilities.
- GitHub Pages and Cloudflare Pages live publishing, including verified destination URLs.
- See [v0.1.1 verification](docs/release-v0.1.1-verification.md) for regression results and remaining preview limits.

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

[Unreleased]: https://github.com/kujolang/website-cloner/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/kujolang/website-cloner/releases/tag/v0.1.1
[0.1.0]: https://github.com/kujolang/website-cloner/releases/tag/v0.1.0
