# Production Readiness

This checklist separates completed repository guarantees from controls every
deployment must supply. The package is production-stable at its library
boundary; an application is not production-ready merely because it imports it.

## Canonical Ability package

- [x] Versioned definition, binding, exposure, invocation, policy, approval,
  receipt, registry, and runtime contracts.
- [x] Exact version and surface resolution with collision rejection.
- [x] Deterministic SHA-256 definition identity.
- [x] Fail-closed policy, approval, input/output, audit, and idempotency paths.
- [x] Validated durable replay and callback-failure containment.
- [x] Terminal receipts for cancellation and post-policy failures.
- [x] Architecture fence, release verification, compatibility policy, support
  policy, security model, pinned CI runtime, SBOM generation, checksums, and
  keyless release provenance attestation.

## CMS producer and execution gateway

- [x] Canonical commit-pinned package with no copied validator or schema.
- [x] Core and plugin definitions registered through the shared exact registry.
- [x] REST and CLI execution through the shared runtime.
- [x] Server-resolved permission and tenant-aware principal.
- [x] Durable keyed idempotency receipts and conflict/replay behavior.
- [x] Durable, expiring, request-bound, one-time approvals for mutations.
- [x] Canonical receipt and digest returned in discovery/execution evidence.
- [x] Plugin namespace isolation, contract tests, migration test, and API smoke.

## Agents SDK adapter

- [x] Canonical Ability-to-Tool projection through the standard registry.
- [x] Full input/output validation and effect-derived conservative risk hint.
- [x] Local binding and remote gateway callback modes.
- [x] Gateway request correlation, approval/idempotency forwarding, exact receipt
  validation, and receipt preservation in Tool execution metadata.
- [x] Offline, no-network, export, runner, and adapter regression coverage.

## MCP adapter

- [x] Canonical enabled-`mcp` exposure projection.
- [x] Ability ID, version, digest, schema, and annotations preserved.
- [x] Read-only default, mutation effect gate, and tool-name collision rejection.
- [x] Full MCP repository regression suite.

## SSG and WebMCP boundary

- [x] WebMCP remains an explicit projection, not the canonical Ability model.
- [x] Public browser exposure is limited to bounded published read operations.
- [x] Protected mutations stay behind authenticated Ability execution.
- [x] SSG build operations remain build-time commands rather than runtime
  Abilities unless an application explicitly binds and governs them.

## Kujo core and package ownership

- [x] No new language syntax, process-global registry, provider framework,
  workflow engine, or transport server was added.
- [x] The canonical package owns semantics; products own bindings, policy,
  persistence, authentication, protocols, and execution isolation.

## Deployment acceptance checklist

The following controls are intentionally deployment-owned and must be checked
for each environment:

- [ ] Authentication keys, service credentials, and tenant resolution are
  production-managed and rotated.
- [ ] Authorization policy has tenant-isolation and deny-path tests.
- [ ] Approval and idempotency stores provide the required atomic operations,
  retention, backup, restore, and reconciliation procedures.
- [ ] Audit storage is durable, access-controlled, redacted, retained, and
  monitored.
- [ ] Consequential handlers have rollback/compensation plans and hard process
  isolation where duration limits must preempt work.
- [ ] Alerts cover `commit_failed`, audit failure, timeout, cancellation,
  collision, replay mismatch, and abnormal denial rates.
- [ ] Capacity, disaster recovery, dependency/SBOM, vulnerability response,
  branch protection, signed release, and staged rollback drills have passed.

Unchecked deployment controls are not missing package features; they require
environment-specific infrastructure and accountable operator sign-off.
