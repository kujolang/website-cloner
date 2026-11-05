# Resume and rebuild from saved work

[Documentation index](README.md)

Use **Resume saved migration** after a recoverable interruption. Resume keeps the same job ID, source URL, page scope and AI selection. The CLI equivalent is:

```sh
npm run migrate -- https://example.com /absolute/job-directory --resume
```

A completed job cannot be resumed. Use **REBUILD** to regenerate it from saved captures, or start a fresh migration to recapture the source.

## What is saved

The builder checkpoints discovery cursors, captured pages, browser evidence, completed page transformations and downloaded assets. It also saves `captured-model.json` and `prepared-model.json` at stage boundaries. Resume selects the furthest usable checkpoint and rejects a different source URL.

Prepared work can skip discovery and reuse downloaded assets. Captured work may need localization under fresh network and robots checks. Interrupted browser capture reuses valid saved pages and frames. A browser session itself is not persisted; a new session may need user review.

A cached rebuild applies supported upgrades to saved source HTML and can retry missing assets. It does not refresh every source page. Its `repair-report.json` records reuse, attempted repairs and unresolved checks. Keep manual maintenance edits in a downloaded project; the builder regenerates its own copy.

## Automatic continuation

New and manually resumed jobs enable automatic continuation. Normal local migrations have no aggregate 20-minute, 4,000-request or 512 MB restart budget. Lower-level bounded runs can still raise `CRAWL_BUDGET`; the supervisor resumes those from checkpoints after five seconds.

Three consecutive budget pauses without saved progress stop with `AUTO_RESUME_STALLED`. Source timeouts and HTTP 429/503 use backoff that respects `Retry-After`; exhausted source retries stop for review. Permission, authentication and invalid-input failures are not blindly retried. A third-party resource failure does not count as a source-site outage. See [external resources](external-resource-failures.md).

Disk pressure enters a waiting state and checks every 30 seconds. Startup requires 256 MB free. Later checks reserve 128 MB and estimate space from content, assets, output and packaging. An actual disk-full error raises the required headroom. The builder does not delete assets to free space. These checks are estimates, not quotas or reservations.

The local server must remain running. On restart, eligible saved jobs resume one at a time. **Stop migration** terminates the job's worker, preserves checkpoints and disables automatic continuation. Stopped jobs stay stopped.

## ZIP and status recovery

At the **Preparing download** checkpoint, matching reports and verified output allow packaging without another crawl. Packaging creates a fresh `website.partial.zip`, checks its integrity and atomically replaces the final ZIP. A partial archive is never offered as a completed download. The previous final ZIP remains until replacement succeeds.

Startup marks a job complete only when its final ZIP passes integrity checks and contains the matching migration report. Recovery retains `failed-quality-checks` or `needs-review`; packaging cannot improve the site's quality status.

Progress-write failures remain visible through the job supervisor. If the disk cannot accept a status file, the active server retains the failure in memory. Restart recovery can only use records that reached disk.

## Scope and checks

This is checkpoint recovery for a local application, not a distributed queue, byte-range download resume or live-source refresh. Tests cover budget continuation, cache reuse, disk recovery, no-progress termination, cancellation, startup eligibility and ZIP/report consistency.
