# Changelog

## Unreleased

- Rewrite the README with ecosystem badges, installation and quick-start
  guidance, included contract surfaces, the current CMS Ability catalog, and
  clear Agents SDK, MCP, Codex, and Cursor integration boundaries.

## 1.0.1 - 2026-09-01

- Return `approval_required` before requiring a keyed idempotency key when an
  approval-gated invocation has not yet received approval.
- Add tag/version verification, deterministic source archives, SPDX SBOMs,
  checksums, and keyless provenance attestations to the release workflow.
- Redact callback exception text from public failures and receipts.
- Completion-audit every post-policy terminal outcome and treat only the exact
  `open` audit mode as fail-open.
- Derive idempotency namespaces from canonical tenant and principal fields.

## 1.0.0 - 2026-09-01

- Stabilize the v1 package contract and publish compatibility, support,
  security, and production-readiness policies.
- Validate replayed receipts against the exact Ability, principal, surface,
  digest, and successful output contract before returning cached evidence.
- Make keyed replays occur before one-time approval consumption, commit
  cancellation and approval-store failures as terminal receipts, contain
  service callback exceptions, and retain post-execution results when receipt
  persistence is uncertain.
- Add a reproducible release verification script and pinned CI runtime.

## 0.4.0 - 2026-09-01

- Return normalized receipts for post-policy approval, input, and idempotency
  failures, including a reconciliable `commit_failed` state.
- Enforce commit-pinned canonical consumption in CMS, Agents SDK, and MCP.

## 0.3.0 - 2026-09-01

- Add structured `kujo.result/v1` binding results.

## 0.2.1 - 2026-09-01

- Add the Kennel root import shim.

## 0.2.0 - 2026-09-01

- Add canonical binding, exposure, invocation, policy, approval, receipt,
  registry, digest, and execution contracts.

## 0.1.0 - 2026-09-01

- Publish the portable `kujo.ability/v1` definition and schema.
