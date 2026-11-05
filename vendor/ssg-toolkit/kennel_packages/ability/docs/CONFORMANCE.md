# Ability v1 Conformance

The canonical definition contract is `schema/ability.schema.json` plus the
stricter runtime checks in `src/contract.kujo`. Shared execution contracts and
their validators live in `src/contracts.kujo`.

## Execution conformance

A conforming execution consumer must:

1. resolve the exact Ability ID and version;
2. preserve and verify the canonical definition digest;
3. select only an explicitly enabled surface exposure;
4. evaluate policy using server-resolved principal and tenant identity;
5. bind approval to the exact invocation and consume it once;
6. enforce keyed idempotency before invoking a handler;
7. validate stored replay receipts before returning them;
8. validate both input and output;
9. preserve request and trace correlation in the receipt;
10. contain application callback failures; and
11. return a normalized receipt for terminal execution outcomes.

Protocol adapters may rename a projected tool, but they must preserve the
Ability ID, version, and definition digest in metadata. They may make exposure
more restrictive, never less restrictive.

| Consumer | Role | Conformance evidence |
|---|---|---|
| CMS | Producer, binding, policy, REST/CLI/MCP compatibility | Canonical definition discovery, shared runtime execution, durable request-bound one-time approvals, keyed idempotency receipts, tenant-aware principals, plugin namespace isolation |
| Agents SDK | Agent Tool adapter | Commit-pinned canonical package, identity/schema/digest preservation, full invocation validation, effect-derived risk hint, standard Tool registry integration |
| MCP | Protocol adapter | Commit-pinned canonical package, canonical registry projection, identity/schema/digest preservation, read-only default, effect-gated mutation, tool-name collision rejection |

`tests/check_consumers.sh` is a workspace-level gate. When sibling
repositories are present, it proves that CMS, Agents SDK, and MCP import a
commit-pinned Kennel package instead of maintaining schema or validator copies,
and runs each consumer's targeted
compatibility suite. Product-local bindings and projections remain in their
owning repositories so this package stays independent of protocols,
authorization systems, and execution substrates. `tests/runtime_contract_tests.kujo`
proves the transport-independent registry, policy, approval, idempotency,
output-validation, and receipt boundary.

Host packages may add client-specific configuration, prompts, skills, roots,
elicitation, and approval UI. These additions must not alter the Ability ID,
version, definition digest, schemas, declared effects, idempotency mode, policy
decision meaning, or receipt status. A host approval is additive and must not
be treated as server authorization or as a canonical request-bound approval.
