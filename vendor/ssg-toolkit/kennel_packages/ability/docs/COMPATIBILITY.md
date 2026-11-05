# Compatibility Policy

## Versioned surfaces

| Surface | Stable version | Change rule |
|---|---:|---|
| Kennel package API | `1.x` | Breaking export or behavior changes require package `2.0.0` |
| Ability definition | `kujo.ability/v1` | Removing or redefining a field requires `v2` |
| Binding, exposure, invocation, policy, approval, receipt | `kujo.ability.*/v1` | Breaking shape or semantic changes require a new schema ID |
| Individual Ability | Definition `version` | Breaking input, output, effect, or retry semantics require a major version |

Canonical definition digests use deterministic JSON key ordering and SHA-256.
Changing canonicalization or the digest algorithm is a breaking contract change.
Consumers must resolve exact Ability versions and should pin this package to an
exact reviewed commit.

Additive optional fields may ship in a package minor release only when old
consumers remain correct and validators continue to reject ambiguous meaning.
Deprecations remain documented for at least two minor releases or 90 days,
whichever is longer. An actively exploitable security issue may require a
faster fail-closed change with explicit migration guidance.

The package does not promise compatibility for internal registry layout,
unexported functions, error prose, or application-owned metadata. Stable error
codes, schema IDs, canonical identity fields, and receipt status values are
contractual.
