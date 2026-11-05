# Kujo Ability

[![Version](https://img.shields.io/badge/version-1.0.1-black)](https://github.com/kujolang/ability/releases/tag/v1.0.1)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)
[![built with Kujo](https://img.shields.io/badge/built%20with-Kujo-white.svg)](https://github.com/kujolang/kujo)

Portable, versioned operation contracts for the Kujo ecosystem.

An Ability says what an operation means: its stable identity, input and output
schemas, effects, and retry semantics. Products keep handlers, credentials,
permissions, approvals, storage, and transport configuration outside the
portable definition.

## Install

Kujo Ability requires Kujo 1.2.0 or newer.

```bash
kujo run /path/to/kennel/kennel.kujo \
  --interpreter \
  -- add github:kujolang/ability@v1.0.1 \
  --alias ability
kujo run /path/to/kennel/kennel.kujo --interpreter -- install
```

Import the public package surface from `ability`:

```kujo
from ability import validate_ability_definition, ability_definition_digest
```

Keep the generated Kennel lockfile in source control. Production consumers
should resolve the package to an exact reviewed commit.

## 30-second quick start

```kujo
from ability import validate_ability_definition, ability_definition_digest

definition := {
    "schema": "kujo.ability/v1",
    "id": "kujo.docs.content.find",
    "version": "1.0.0",
    "description": "Find a bounded set of documentation records.",
    "input_schema": {
        "type": "object",
        "required": ["query"],
        "properties": {"query": {"type": "string", "minLength": 1}},
        "additionalProperties": false,
    },
    "output_schema": {
        "type": "object",
        "required": ["count"],
        "properties": {"count": {"type": "integer", "minimum": 0}},
        "additionalProperties": false,
    },
    "effects": [{"kind": "read", "resource": "kujo.docs.content"}],
    "idempotency": {"mode": "intrinsic"},
}

validation := validate_ability_definition(definition)
assert(validation["ok"], to_json(validation))

digest := ability_definition_digest(definition)
assert(digest["ok"], to_json(digest))
print(digest["digest"])
```

See [`examples/content_find.json`](examples/content_find.json) for the complete
example and [`docs/RUNTIME.md`](docs/RUNTIME.md) for registration and
execution.

## What the package includes

| Surface | Purpose |
|---|---|
| Definition contract | Validates `kujo.ability/v1` identity, schemas, effects, and idempotency. |
| Supporting contracts | Validates bindings, exposures, invocations, policy decisions, approvals, and receipts. |
| Canonical digest | Produces a deterministic SHA-256 identity for an exact definition. |
| Exact registry | Registers and resolves an Ability by ID, version, and exposure surface. |
| Runtime | Runs a fail-closed policy, approval, idempotency, audit, handler, and receipt pipeline. |
| JSON Schema | Provides the executable definition schema at [`schema/ability.schema.json`](schema/ability.schema.json). |

Effect kinds are `read`, `write`, `delete`, and `external`. Idempotency modes
are `intrinsic`, `keyed`, and `none`.

The package does not provide a network server, global registry, identity
provider, authorization rules, durable storage, workflow engine, or provider
framework. Applications supply those services through explicit bindings and
adapters.

## Abilities included today

This package does not ship a production catalog of domain operations. It ships
the contract and runtime used to define them. The
`kujo.docs.content.find` definition is a documentation example and test
fixture, not a built-in service.

Products own their domain catalog. Kujo CMS currently defines these six core
Abilities:

| Canonical Ability | Operation | Effect |
|---|---|---|
| `kujo.cms.site.inspect` | Inspect CMS identity, version, site URL, and resource counts. | Read |
| `kujo.cms.content.list` | Search a bounded page of CMS content. | Read |
| `kujo.cms.seo.audit` | Return SEO coverage and priority items. | Read |
| `kujo.cms.seo.update-entry` | Update SEO metadata for one entry. | Write; approval and idempotency key required |
| `kujo.cms.seo.bulk-update` | Update SEO metadata for up to 200 entries. | Write; approval and idempotency key required |
| `kujo.cms.integrations.inspect` | Inspect configured AI integration surfaces without exposing secrets. | Read |

CMS plugins may also declare their own Ability descriptors. CMS validates and
namespaces each plugin definition, retains the plugin handler and permission
policy, and requires confirmation for non-read operations. Ability itself does
not contain a plugin marketplace or grant a plugin permission to run.

## Integrations and agent hosts

Ability is the shared semantic layer. Each consumer adds a specific projection
or execution boundary:

| Consumer | What is implemented |
|---|---|
| [Kujo CMS](https://github.com/kujolang/cms) | Produces core and plugin definitions, binds handlers, enforces identity and policy, stores approvals and idempotency records, and exposes REST, CLI, and MCP-ready descriptors. |
| [Kujo Agents SDK](https://github.com/kujolang/agents-sdk) | Projects an Ability into the SDK Tool registry. It supports local handlers and server-owned gateway execution, validates input/output and receipts, preserves canonical identity and digest, and derives conservative risk hints from effects. |
| [Kujo MCP](https://github.com/kujolang/mcp) | Projects explicitly enabled Abilities into MCP tools. It defaults to read-only effects, requires explicit opt-in for write/delete/external effects, preserves canonical metadata, and rejects tool-name collisions. |
| Codex | Uses the portable Codex plugin and STDIO bridge maintained in Kujo MCP, including an Ability-aware skill and server-owned approval flow. |
| Cursor | Uses the same STDIO bridge through a Cursor MCP configuration while preserving the canonical Ability contract. |
| VS Code | Uses the portable bridge through an MCP server configuration with secret input support. |
| Kujo Pi | Provides opt-in native Ability discovery and execution tools with an independent host approval before server authorization. |
| Other MCP hosts | Use the generic STDIO configuration when the application gateway, authentication, policy, and approval boundaries are configured for that host. |
| Kujo SSG | Publishes canonical inspect, validate, and approval-gated build definitions; execution remains in a trusted local process or authenticated application gateway. |

Codex, Cursor, VS Code, and Kujo Pi do not receive special Ability definitions.
The same canonical definition is projected into each host while the application
gateway keeps execution policy and credentials under its control. Host-specific
skills, prompts, secret inputs, and approval UI are additive installation and
experience layers, not competing operation contracts.

Agents SDK and MCP consume the canonical package directly and pin it through
Kennel. They do not maintain copied schemas. See
[`docs/CONFORMANCE.md`](docs/CONFORMANCE.md) for producer and adapter
requirements.

## Execution and safety

The runtime resolves an exact definition, binding, and exposure; verifies the
definition digest; audits preflight; evaluates application policy; validates
input and any request-bound approval; applies keyed idempotency; invokes the
handler; validates output; audits completion; and returns a normalized receipt.

Execution denies by default when required policy, approval, idempotency, or
audit services are missing. Applications remain responsible for authenticating
identity, enforcing authorization, persisting evidence, and hard-preempting
handlers that can produce external effects. Read the
[`production-readiness guide`](docs/PRODUCTION_READINESS.md) before deploying a
new adapter.

## Development

Run the contract and runtime tests:

```bash
bash tests/run_tests.sh
```

Run the complete release gate, including consumer conformance and Fence
architecture checks:

```bash
bash scripts/verify-release.sh
```

## Versioning and support

The package API and `kujo.ability/v1` definition contract are stable. Breaking
changes to an Ability's required input, output meaning, effects, or retry
semantics require a new Ability major version.

- [Changelog](CHANGELOG.md)
- [Compatibility policy](docs/COMPATIBILITY.md)
- [Production-readiness guide](docs/PRODUCTION_READINESS.md)
- [Security policy](SECURITY.md)
- [Support policy](SUPPORT.md)

## License

Kujo Ability is released under the [MIT License](LICENSE).
