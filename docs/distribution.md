# Downloadable product and future hosted service

[Documentation index](README.md)

## Available now

The repository contains the execution logic for discovery, migration, motion, SEO checks, browser performance measurements and reporting. Users do not install Codex, skills, AI Chat, Strata or Howl. Skill documents informed development; the application does not read them. No external account or API key is required for builds without AI or for audits.

Download/extract the source and double-click `Install.command` on macOS, or run `bash install.sh` on macOS/Linux. The installer supplies a private Node runtime when needed, installs npm dependencies and Kujo runtime 1.9.0, uses Chrome when available or downloads Playwright Chromium, runs doctor, starts the local server and opens the browser. Debian/Ubuntu system packages may require administrator approval. Bash, curl and tar must already be available. This is a source installer, not a signed desktop package. See [verification](installer-verification.md) for tested scope.

Installation keeps user settings and saved builds on rerun and refuses to overwrite a running managed installation. Source import excludes developer settings, credentials, jobs and node_modules. The source is available from the public GitHub repository. Installation runs locally; it does not publish a cloned site. The manual Node/Kujo/Chrome workflow remains available in the README.

Every new migration runs built-in SEO and local lab checks after reconstruction and bounded repair. CSV, JSON and standalone HTML evidence are included under the downloaded project's audit/. Run `npm run audit:site -- PROJECT REPORT_DIRECTORY` to repeat them without migrating. `npm run audit:lighthouse -- PROJECT REPORT_DIRECTORY` runs pinned Lighthouse desktop/mobile homepage audits and saves raw JSON/HTML. It requires only the same local Chrome installation, not an API key or a global Lighthouse installation. Lighthouse is an explicit deeper check; the lightweight built-in audit runs automatically.

Howl is optional presentation: `HOWL_BIN=/path/to/howl npm run audit:showcase -- AUDIT_DIRECTORY`. It reads the measured audit summary and renders deterministic cards. It neither measures SEO/performance nor gates migration. Without Howl installed, all migrations and ordinary reports still work.

Optional AI: the CLI can use an explicitly selected compatible endpoint, model and key for design-token reconstruction. The AI Chat repair bridge is optional and local; it is not a mandatory dependency or a hosted credential store. The tool does not require users to have the developer's AI Chat profiles.

## Hosted service: not implemented

The core audit accepts a project directory and explicit options, writes per-job artifacts and requires no ambient skill installation. It can run unchanged in an isolated worker. This is the reusable execution layer for a future web service; the current HTTP server remains loopback-only and single-user.

A hosted service needs, before accepting users:

1. Account authentication, tenant-owned jobs/artifacts and authorization on every preview/download/mutation. Opaque job IDs alone are not authorization.
2. Isolated disposable workers with enforced egress, CPU/memory/time/disk budgets, a durable queue, cancellation and tenant quotas.
3. A server-side credential broker: encrypt each user's provider key, return only credential IDs, inject short-lived credentials into that user's worker, redact logs/traces, revoke/delete keys, and never include keys in models, exports, browser storage or prompts. AI Chat's local app token must not become a shared tenant key.
4. A provider adapter receiving an explicit tenant-scoped credential handle and model selection; no fallback to the operator's account. Per-user spend caps, usage receipts, retention/deletion and clear failure reporting.
5. Separate cookie-less preview origin, hash-only runtime CSP, durable signed artifact access, abuse/ownership controls and hosting/deployment-specific verification.

Do not expose the existing local server publicly or describe this architecture as implemented accounts/BYOK. Hosted auth/key custody requires its own threat model and integration tests. Installing the cloner does not create user accounts, billing, DNS or hosted infrastructure.
