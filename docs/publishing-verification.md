# Publishing verification

[Documentation index](README.md)

Implemented local account connections using user-supplied API tokens, account/site discovery, site creation, isolated destination rebuilds, public publish confirmation, asynchronous progress/history, and exact-deployment plus live-marker verification. Tokens are memory-only. OAuth is not implemented.

## Original fixture evidence — 2026-10-22

- Full suite: `node --env-file=.env --test --test-concurrency=2 tests/*.test.mjs` — 167 passed, zero failures. One initial run exposed a selector that assumed a single progress bar. It now targets migration progress and also verifies publishing animation/reduced-motion behavior.
- Final provider/API subset after adding Cloudflare's documented 50-account page size and pagination test: 11 passed. Includes both provider transaction fixtures, explicit confirmation, Origin rejection, secret handling, branch ownership, stale deployment rejection, provider/live mismatch, interruption, and temporary-file cleanup.
- Browser fixture flow at 1440px and 390px: connect, select/create, confirmation, progress, verified URL, disconnect, no horizontal overflow, no browser errors or token storage. Mobile result screenshot inspected. Evidence: ignored `work/publishing/ui-check.mjs` and provider screenshots. An account-loading race found during the first check was fixed by disabling controls until connection state is loaded; the rerun passed without artificial delays.
Verify each provider with a site you own before relying on its publishing flow. Mock transactions do not prove live account acceptance.
- Pinned Wrangler 4.152.0 installed and its CLI flags checked locally. `npm audit --omit=dev --audit-level=high` reported zero vulnerabilities.
- Syntax, whitespace, and README/deployment-guide local links checked.

## Live acceptance — 2026-11-05

Both providers passed live account testing. GitHub Pages published to a custom domain; Cloudflare Pages used Direct Upload. Each flow completed deployment verification and returned a working public URL. The final GitHub run used the current builder changes; the Cloudflare run exercised local video playback. Homepage, inner routes, sitemap, llms.txt and the local MP4 returned HTTP 200.

This testing found and fixed pending-certificate handling, Cloudflare pagination and Wrangler argument ordering. Wrangler is now pinned to 4.158.0. Tokens remain in server memory and are excluded from exports.

Account permissions and DNS vary. Test your own destination before relying on it for a client handoff. Live acceptance does not promise that every cloned feature works without a backend.

See [v0.1.1 verification](release-v0.1.1-verification.md) for the release regression results.

Provider references checked during implementation: GitHub Pages REST API; Cloudflare Direct Upload, Pages REST permissions, account pagination and project/deployment metadata. See [deployment setup](deployment.md) for links and token permissions.
