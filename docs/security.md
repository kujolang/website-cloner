# Security boundary

[Documentation index](README.md)

Website Cloner is a single-user application bound to loopback. Do not expose the local server as a public service.

## Untrusted input

Treat submitted URLs, source documents, styles, assets and model responses as untrusted. The network layer accepts HTTP(S) URLs without credentials, checks all DNS answers and pins the validated address for each request. It rejects private, reserved, link-local, multicast and loopback destinations, including mapped IPv6 forms. Redirects repeat destination and robots checks.

`FIXTURE_ORIGINS` is an operator-only exception for exact `127.0.0.1` origins. Web requests cannot set it. Request deadlines, file limits, redirect limits and disk checks still apply. Normal local jobs do not use an aggregate page/request/time budget; lower-level network clients can impose one.

Browser capture may execute source scripts in an isolated context to recover rendered content. Traffic uses the checked transport, source mutations are blocked, and browser challenges require the user. The export does not inherit permission to run downloaded scripts. See [browser capture](export-guide.md#browser-assisted-capture).

## Local application and exports

The app checks Host headers and mutation request Origins. Each job has a random 192-bit ID and separate directory. Opaque IDs are not a substitute for authentication in a hosted service.

Preview uses a separate port, sandboxing and a restrictive CSP. Only selected trusted runtime hashes can execute. Export sanitization removes unsafe elements, attributes, URL schemes and template markers. CSS imports and resources pass through checked localization; SVG uses a static allowlist. Missing or rejected content remains reportable.

Static serving validates paths and their resolved filesystem destinations. Symlinks outside the serving root are rejected. This boundary does not protect against a hostile local user racing filesystem changes under the same account. ZIP packaging uses the controlled project directory and checks archive integrity.

## AI and publishing credentials

No-AI mode makes no model calls. Optional AI Chat review receives bounded text evidence and can return only validated CSS: no resource URLs, imports, generated text or executable code. The host rebuilds and checks proposals before accepting them. AI Chat owns provider credentials; exports never receive its app token.

Publishing uses the account token the user connects, with no ambient developer-account fallback. Tokens stay in memory until disconnect or restart and are omitted from exports and status responses. Publishing requires a separate destination confirmation. See [publishing permissions](deployment.md).

## Persistence and resources

Checkpoints use streamed JSON, exclusive temporary files and atomic replacement. Progress persistence coalesces snapshots without dropping event history. Worker callback failures reach normal job recovery instead of crashing the HTTP server. Downloads stream with backpressure.

Disk checks estimate headroom; they do not reserve storage or remove unrelated files. The application has no OS-enforced CPU, memory or egress sandbox. CSS and browser rendering can consume substantial resources despite validation.

A hosted service needs authenticated ownership, isolated disposable workers, enforced egress and resource limits, quotas, retention, abuse controls and isolated credentials. See [distribution](distribution.md).

## Verification limits

Tests cover address and redirect restrictions, robots rules, download limits, unsafe HTML/CSS/model output, file boundaries, cancellation, persistence and provider failures. They are not a penetration test or proof that every input is safe. The [hardening audit](audits/repository-hardening.md) records dated test and dependency results; re-run checks before release.

Authenticated imports remain separate work. Public capture does not grant access to private WordPress data. Fixture seeding is a separate, controlled test operation.
