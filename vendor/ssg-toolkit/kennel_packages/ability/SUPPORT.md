# Support Policy

Kujo Ability `1.x` supports Kujo `1.2.0` and later compatible `1.x` runtimes.
The supported public surface is the set of exports in `ability.kujo` and
`src/index.kujo`, the `kujo.ability/v1` definition schema, and the versioned
execution contracts documented in `docs/COMPATIBILITY.md`.

Bug reports should include the Ability package commit, Kujo version, minimal
definition/invocation with sensitive values removed, receipt or error code, and
a deterministic reproduction. Deployment-specific authentication, policy,
storage, transport, handler side effects, and hard process preemption are owned
by the integrating application.

Unsupported uses include importing unexported helpers, relying on registry
object internals, treating descriptive effects as authorization, accepting a
receipt without validation, embedding secrets in definitions, and assuming a
synchronous timeout reverses an external side effect.
