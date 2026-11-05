# Ability Runtime

The Ability runtime is an application-embedded gateway. It does not open a
port, authenticate credentials, or persist data. REST, MCP, Agents SDK, CLI,
and WebMCP adapters call the same `execute_ability` function after their
transport boundary has produced a canonical invocation.

## Separation of concerns

An Ability definition describes the semantic operation. An `AbilityBinding`
connects one exact definition version to a handler. An `AbilityExposure`
allows that exact version on one named surface. An `AbilityInvocation` carries
the server-resolved principal, tenant, input, and correlation identifiers.
Application policy produces an `AbilityPolicyDecision`. Consequential calls
may carry an `AbilityApproval` bound to the definition digest, input,
principal, tenant, and invocation. Every terminal execution produces an
`AbilityReceipt`.

A binding uses `result_mode = "raw"` by default. Applications whose handlers
already return `{ok, result}` / `{ok, code, message, status, details}` may use
`result_mode = "kujo.result/v1"`. The runtime unwraps success and preserves a
structured failure in the receipt instead of collapsing it into an invalid
output error.

## Runtime services

`execute_ability(registry, invocation, services)` accepts these functions:

| Service | Required when | Contract |
|---|---|---|
| `policy` | Always | `(definition, invocation, exposure) -> policy decision` |
| `audit` | By default | `(phase, invocation, payload) -> {ok: true, ...}` |
| `consume_approval` | Policy requires approval | `(approval, invocation) -> {ok: true}` exactly once |
| `begin_idempotency` | Definition uses `keyed` | `(key_digest, request_digest, invocation) -> {state}` |
| `complete_idempotency` | Definition uses `keyed` | `(key_digest, request_digest, receipt) -> {ok: true}` |
| `cancelled` | Optional | `(invocation) -> boolean` |
| `clock_ms` | Optional | `() -> integer milliseconds` |
| `id_factory` | Optional | `(kind, invocation) -> bounded unique text` |

The idempotency begin state is `started`, `replay`, `in_progress`, or
`conflict`. A replay response must contain the previously committed receipt.
The runtime validates that receipt and requires the exact Ability ID, version,
definition digest, principal, and surface; successful replay output must still
satisfy the current output schema. Key digests are scoped to tenant and
principal before they reach the store. The key digest uses canonical JSON over
named tenant, principal type, principal ID, and idempotency-key fields so
delimiter characters cannot merge distinct identities into one namespace.

## Approval binding

`approval_binding_digest(invocation)` covers:

- Ability ID and exact version;
- canonical definition digest;
- canonical input digest;
- canonical principal digest;
- tenant ID; and
- invocation ID.

An approval has an issuance time, expiration time, nonce, approver identity,
and evidence object. Static validation is not enough: the application must
atomically consume the approval through `consume_approval` to prevent replay.
For keyed calls, the runtime checks a durable replay before consuming the
one-time approval. A new idempotency claim is finalized even when approval
consumption or cancellation produces a terminal failure, preventing abandoned
in-progress records.

After policy has produced a valid decision, rejected input, missing or
conflicting idempotency state, invalid/replayed approval, and idempotency
commit failure all return a normalized receipt and a completion audit event.
Failures before a trustworthy
definition and policy decision exist remain transport-level errors. A commit
failure receipt uses `idempotency.state = commit_failed`, retains the executed
result and prior status, and identifies the attempted receipt so operators can
reconcile an execution whose durable replay record is uncertain.

Exceptions or malformed responses from approval, idempotency, cancellation,
policy, handler, and audit callbacks are contained at the runtime boundary and
become deterministic failures. Raw callback exception text is never copied
into public failures or receipts. Invalid custom clocks and ID factories fall
back to runtime-generated values so receipt construction remains available.

## Timeout and cancellation boundary

Cancellation is checked before handler entry and is available to the handler
through the execution context. The runtime measures synchronous handler
duration and marks an over-budget result as timed out. A process or Workcell
adapter is responsible for hard preemption when a handler must be forcibly
terminated; post-execution timeout detection cannot undo an external side
effect.

## Audit failure policy

Preflight audit is fail-closed when audit is required. Completion audit also
defaults to `closed`; if persistence fails after handler execution, the receipt
reports `ability_audit_failed_after_execution` and retains the execution result
for controlled reconciliation. Only the exact string `open` enables fail-open
behavior; missing, null, malformed, and unknown values remain fail-closed.
Applications may set `audit_failure_mode` to `open` only after explicitly
accepting that operational tradeoff. Likewise, audit is optional only when
`audit_required` is the exact boolean `false`.
