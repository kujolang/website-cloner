# v0.1.1 verification

[Documentation index](README.md)

This is a public preview of a local, single-user app. The release packages the publishing and export fixes made after v0.1.0. It does not promise a perfect copy of every site.

## Release checks

**Final clean run: `npm test` passed all 682 tests, with zero failures, skips or cancellations, in 23 minutes 18 seconds on November 9, 2026.**

The first complete sweep ran all 682 tests in 26 minutes 42 seconds: 675 passed and seven failed. The failures exposed a five-second startup assumption, stale presentation-version expectations, an obsolete expectation that video would not download, and incomplete cleanup/reporting when video localization failed.

The startup test now waits for fixture contact with a bounded deadline. Current presentation fixtures expect version 44. Failed video sources are removed and the retained poster is reported in the page advisories. All 39 tests across the five affected files passed together after these changes. The subsequent clean full-suite run passed, as recorded above.

- Production dependency audit: zero known vulnerabilities.
- Doctor: Node, Kujo, Chrome, ZIP/unzip and optional cwebp available; no AI credentials needed for core checks.
- ShipCheck 1.0.2: `kujo run shipcheck.kujo gate --dir <repository> --format json`, exit 0, 11/16 checks passed, zero errors and five warnings. The release gate passed; highest severity is warning. Review items are listed below.
- Changed-document local links and `git diff --check`: passed.
- Tracked-file review: no saved builds, runtime settings, customer media, ZIP exports or dependencies. `.env.example` remains as the public configuration template.

## Live acceptance

Both GitHub Pages and Cloudflare Pages completed live publishing on November 5, 2026. Their verified URLs served the homepage, inner pages, sitemap, llms.txt and local video. The public repository excludes the customer captures, downloaded assets, account settings and test-build evidence. See [publishing verification](publishing-verification.md).

The isolated macOS installer rehearsal downloaded Node, Kujo and Chromium into a fresh environment, cloned a fixture without AI, exported a ZIP, and passed restart, stop and update-preservation checks. See [installer verification](installer-verification.md) for the exact scope.

## Preview limits

- A real Debian/Ubuntu desktop install and a complete public-download install on another clean machine still need acceptance testing.
- GitHub CI is not active. The pinned, read-only core-check workflow is ready in `docs/ci/core-checks.yml`; the current GitHub credential lacks the `workflow` scope needed to install it. Local regression checks remain the release evidence.
- ShipCheck also flags missing lint/format commands and Kujo package/entry metadata. This repository is a Node app that invokes Kujo; the package/entry warnings do not indicate a missing app entry point. No formatter sweep or artificial commands were added merely to silence the report.
- Dynamic backend features, protected media and some responsive layouts need review or replacement services. A successful export is not a guarantee of visual or functional parity.
- Optional AI reviews are bounded CSS changes. They may accept no edits; they do not certify content or replace the quality reports.

## Promo evidence

The promotion combines real Brave app captures, an original-versus-clone scrolling comparison, an exported Markdown excerpt, and the GitHub Pages and Cloudflare Pages connection panels. The walkthrough uses edited still captures; continuous native screen recording was unavailable. Time cuts are labelled. A fresh nine-route local fixture clone completed in 5 minutes 9 seconds with zero AI calls, and its review notice remains visible. No new site was published for the filming.

The comparison is the November 5 GitHub demo, reviewed by Astra with no accepted CSS changes. That distinction remains visible. Narration uses ElevenLabs v4. Captures, voice receipts, editable production files and renders stay outside the public source archive under ignored local work files.

The 66-second 1080p/30 H.264/AAC export and smaller 480p copy passed full-file decoding. The composition passed runtime, layout, contrast and audio checks with no errors; one reading-time advisory remains for the illustrative Markdown excerpt. Sampled decoded frames and transition sheets were inspected. The final mix measured −16.5 LUFS with a −1.5 dB true peak; this is a measurement, not a subjective listening review.
