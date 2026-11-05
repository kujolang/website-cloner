# Kujo Ability integration

SSG 1.1.0 ships Ability pack 1.0.0 (independently versioned) and publishes ten canonical domain definitions and an executable local adapter under `abilities/`. The pack covers project inspection, bounded source listing and validation, generated-output validation, full, draft-preview, and sharded builds, combined route/link/metadata/auxiliary-artifact inspection, output comparison, deployment readiness, and deterministic artifact export. The adapter is not an embedded network server.

`abilities/runtime.kujo` registers the exact definitions with the commit-pinned Kujo Ability 1.0.1 runtime and supplies direct-argv local handlers. All handlers reject lexically escaping and absolute paths, and limit subprocess time and captured output. The build handlers additionally apply the generator's output/source overlap checks and permit HTTP site URLs only for an exact localhost or `127.0.0.1` host. `site.validate` invokes the generated-output shell validator; it does not apply the Python helper's scan limits.

The Python inspection/export helper rejects symlinks in selected paths and scanned descendants, generated files larger than 64 MiB, generated trees larger than 512 MiB, more than 10,000 regular files (including non-Markdown source files), and more than 20,000 directory entries. Enumeration stops at those limits before sorting. Inspection and readiness check file sizes and links without hashing unrelated assets; comparison hashes file contents in bounded chunks. Artifact export retains its deterministic tar format and streaming checksum, validates its destination before creating directories, preserves existing destinations, and removes a partial archive on I/O failure. Inspection counts every broken link while retaining at most 200 details, with diagnostics before routes. Read-only inspection never returns content bodies.

Full and sharded builds declare project-read, generated-output-write, and possible network effects. Artifact export declares a separate file-write effect. Hosts must supply the canonical policy and approval/idempotency services when calling `execute_ssg_ability`: the local policy requests explicit approval for every write, and keyed idempotency prevents a retry from silently becoming a second unrelated operation. The adapter itself does not authenticate a remote caller.

Install the dependency with Kennel, then run the offline pack contract:

```bash
kennel validate
kennel install
kujo run tests/ability_pack_tests.kujo --interpreter
KUJO_BIN="$(command -v kujo)" bash scripts/test-ability-pack-integration.sh
```

The fast test initializes all ten bindings, executes bounded project and source reads, rejects escaping and drive-qualified paths plus malformed or spoofed loopback URLs, verifies that full and draft-preview builds pause for approval, and checks canonical approval, receipt, and idempotency evidence. The integration wrapper also builds the repository's deterministic starter fixture through the approved Ability binding, validates and inspects the generated output, checks deployment readiness, proves deterministic exclusive artifact creation, rejects hardlink overwrite, and removes its fixtures on exit. CI checks out the exact Ability commit recorded in both `kennel.toml` and `kennel.lock`, so it does not float with the upstream default branch.

The generated static site must not execute these operations. Public WebMCP stays same-origin and read-only. Codex, Cursor, VS Code, Kujo Pi, Agents SDK, and other MCP hosts should connect to a trusted local process or authenticated application gateway that owns identity, authorization, hard timeout and cancellation, receipts, and audit storage.

No publish or deploy Ability is included because this repository does not own a hosting provider. Deterministic artifact export ends the SSG-owned boundary. The build handler may fetch configured remote fonts or images, but it receives no deployment credentials. A separately versioned provider-owned deployment pack must consume the exported checksum, declare its external effect and target environment, hold credentials outside the definition, require request-bound approval and keyed idempotency, and return provider and rollback evidence before adding publication.
