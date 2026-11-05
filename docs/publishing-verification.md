# Publishing verification — 2026-10-22

[Documentation index](README.md)

Implemented local account connections using user-supplied API tokens, account/site discovery, site creation, isolated destination rebuilds, public publish confirmation, asynchronous progress/history, and exact-deployment plus live-marker verification. Tokens are memory-only. OAuth is not implemented.

## Evidence

- Full suite: `node --env-file=.env --test --test-concurrency=2 tests/*.test.mjs` — 167 passed, zero failures. One initial run exposed a selector that assumed a single progress bar. It now targets migration progress and also verifies publishing animation/reduced-motion behavior.
- Final provider/API subset after adding Cloudflare's documented 50-account page size and pagination test: 11 passed. Includes both provider transaction fixtures, explicit confirmation, Origin rejection, secret handling, branch ownership, stale deployment rejection, provider/live mismatch, interruption, and temporary-file cleanup.
- Browser fixture flow at 1440px and 390px: connect, select/create, confirmation, progress, verified URL, disconnect, no horizontal overflow, no browser errors or token storage. Mobile result screenshot inspected. Evidence: ignored `work/publishing/ui-check.mjs` and provider screenshots. An account-loading race found during the first check was fixed by disabling controls until connection state is loaded; the rerun passed without artificial delays.
Verify each provider with a site you own before relying on its publishing flow. Mock transactions do not prove live account acceptance.
- Pinned Wrangler 4.152.0 installed and its CLI flags checked locally. `npm audit --omit=dev --audit-level=high` reported zero vulnerabilities.
- Syntax, whitespace, and README/deployment-guide local links checked.

## Live acceptance

Verify each provider with a site you own before relying on its publishing flow. Mock transactions do not prove live account acceptance.

Provider references checked during implementation: GitHub Pages REST API; Cloudflare Direct Upload, Pages REST permissions, account pagination and project/deployment metadata. See [deployment setup](deployment.md) for links and token permissions.
