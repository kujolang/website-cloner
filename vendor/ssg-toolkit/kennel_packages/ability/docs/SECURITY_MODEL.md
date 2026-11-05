# Security and Threat Model

## Assets and trust boundaries

Abilities may cross authenticated transports and invoke handlers with access to
tenant content, external systems, and irreversible side effects. The trusted
computing boundary is the application that resolves identity, constructs the
canonical invocation, supplies policy and durable stores, and binds the exact
handler. Definitions and protocol discovery documents are descriptive input;
they are never authority by themselves.

## Required security properties

- The principal and tenant come from authenticated server state, never from an
  untrusted request body.
- Authorization is evaluated for the exact Ability ID, version, digest,
  exposure surface, input, principal, tenant, and declared effects.
- Consequential execution uses a short-lived approval bound to the exact
  invocation and consumed atomically once.
- Keyed operations claim and commit a tenant/principal-scoped idempotency record
  in durable storage. Canonical named fields prevent ambiguous cross-identity
  key derivation, and replayed receipts are validated before use.
- Input and output are validated at execution time, not only at discovery.
- Every post-policy terminal outcome is completion-audited. Audit persistence
  is fail-closed unless an operator selects the exact `open` mode; secrets and
  sensitive payload fields are redacted before durable logging.
- Handler credentials remain outside definitions, receipts, discovery, and
  client-visible metadata.
- Raw callback exception text remains outside public failures and receipts.
- Hard timeout or isolation requirements use a process, container, or Workcell
  adapter; synchronous duration measurement cannot roll back an external effect.

## Primary threats and controls

| Threat | Required control |
|---|---|
| Definition substitution or downgrade | Exact version resolution plus canonical digest verification |
| Cross-tenant confused deputy | Server-resolved principal/tenant and policy evaluation |
| Approval replay or input swapping | Invocation-bound digest, expiration, nonce, and atomic consume |
| Duplicate write on retry | Durable keyed idempotency and validated receipt replay |
| Poisoned idempotency store | Receipt schema, identity, principal, surface, digest, and output validation |
| Protocol adapter privilege expansion | Explicit enabled exposure; adapters may restrict but never widen policy |
| Handler/schema drift | Input/output validation and handler version evidence in every receipt |
| Audit suppression | Preflight and completion audit with fail-closed default |
| Callback crash or malformed response | Runtime exception containment and deterministic terminal failures |
| Timeout mistaken for rollback | Explicit post-execution timeout semantics and external hard-preemption boundary |

## Residual risks

The runtime cannot prove that a handler accurately declared its effects, that a
policy is correct, that a durable store is linearizable, or that a remote side
effect was rolled back. Integrators must test those properties and monitor
`commit_failed`, audit failures, timeouts, and repeated policy denials.
