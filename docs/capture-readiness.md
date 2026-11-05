# Capture readiness and progress

[Documentation index](README.md)

Source capture and rebuilt verification now bound FontFaceSet readiness to ten seconds. A permanently pending font response produces an explicit incomplete-evidence error instead of holding the job forever. A source timeout leaves that viewport without a trusted baseline; rebuilt verification records an error. This is not a visual pass or permission to grade fallback typography as equivalent.

Design capture now reports the route and viewport through the existing job event channel. Structured captureProgress includes the current candidate index, total candidate pages and whether this page is a role/component sample. Candidates can be skipped when rendered capture is unnecessary; these counts are not a duration estimate or overall percentage. This does not change crawl limits, request concurrency or protection handling.

Tests exercise normal/delayed/permanently pending font readiness in Chrome, retained supplemental evidence, form-page selection, background polling, per-viewport progress, source hydration and rejection of unavailable styles. A stale test expected one document load despite the existing responsive viewport reload behavior; corrected it to require three, one per viewport.

## Per-page recovery — 2026-10-25

Capture now atomically saves one page record after each processed route, including its rendered page, completed screenshot metadata and hydration decision. Source outages stop after that checkpoint instead of continuing the remaining pages against a failing source. A capture-session checkpoint lets resume bypass completed discovery. Resume validates source/URL/route, reuses existing valid frames, skips rendered extra pages, and retries missing frames. Download totals survive capture retries; retry fingerprints count durable rendered pages/frames rather than attempted requests. Temporary capture checkpoints are removed only after the complete capture model is atomically saved.
