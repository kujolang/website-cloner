# Repository hardening audit: round 2

## Repository and scope

- Repository: `kujolang/ssg`
- Branch: `main`
- Starting SHA: `d98ca9943b03f154432ee7daf0ac2bd81b0d452d`
- Implementation SHA: `9da39f2f1ca37357fbab162f4e949086c2c0ba3e`
- Audit date: 2026-10-02

This second pass reviewed the canonical generator, maintenance and release
scripts, executable Ability helpers, configuration normalization, sharded build
lifecycle, destructive filesystem operations, generated-output contracts, and
release documentation.

The source sweep excluded `output/**`, minified vendor assets, fonts, images,
`static/**`, `tmp/**`, `.git/**`, caches, and generated archives. Those surfaces
were checked through their builders, fingerprints, and executable contracts.

The Codex Security Standard Scan launcher was requested but failed before
preflight because its workbench used a Python interpreter that could not parse
the `dict[str, Any] | None` annotation. No plugin-generated security report is
claimed. Direct source review and executable regression validation continued.

## Findings and dispositions

| ID | Priority | Finding | Disposition |
|---|---|---|---|
| SSG-R2-001 | P1 | The parallel wrapper capped shards, but direct `build.kujo --shards` input remained unbounded. Interrupting the wrapper also removed its marker without terminating active Kujo workers. | Enforced `shards <= 256` in the generator and made signal handling terminate and reap every active worker. Added regression coverage for both boundaries. |
| SSG-R2-002 | P1 | `generate-benchmark-content.py` recursively deleted any caller-selected existing directory. | Added working-directory/ancestor refusal, a 100,000-post input ceiling, and a versioned ownership marker. Existing directories are replaced only when the marker is regular and exact. |
| SSG-R2-003 | P2 | CLI-contract cleanup substituted an absolute root-level fallback path when its temporary output variable was unset. | Cleanup now runs only when the actual temporary path is nonempty. |
| SSG-R2-004 | P1 | The frozen WebMCP-disabled baseline had drifted after intentional image optimization and was not part of the release gate. Its byte-count command was macOS-specific. | Re-established all six fingerprints, added the check to the release gate, preserved `KUJO_BIN`/`KUJO_RUNTIME_DIR` resolution, and made size/hash commands portable across macOS and Linux. |

No new dependencies, public schemas, default routes, or generated files were
introduced. The normal frozen output remains 82 files and 7,418,445 bytes; its
aggregate SHA-256 is
`561f8331b65cdcef5563935c788ca6044d59ecba4a77674fe8cb33bc1e2cf1c3`.

## Verification

Passed:

```text
KUJO_BIN=/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target/release/kujo bash scripts/test-bug-regressions.sh
KUJO_BIN=/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target/release/kujo bash scripts/test-cli-contract.sh
KUJO_BIN=/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target/release/kujo bash scripts/run_release_gate.sh
bash -n scripts/*.sh
python3 -m compileall -q scripts
ruff check scripts
ruff format --check scripts/generate-benchmark-content.py
node --check scripts/test-webmcp-runtime.js
bash scripts/test-docs-contract.sh
git diff --check
```

The full release gate, including six frozen WebMCP-disabled build variants,
completed successfully in 2,570.15 seconds. ShellCheck and Kennel were not
available on this host; the Ability catalog and executable integration contracts
passed through the release gate.

## Remaining work

- No unresolved P0 or P1 repository finding remains from this pass.
- Large-site performance conclusions still require an idle benchmark host before
  changing the documented optimization priorities.
- The failed Codex Security launcher is plugin-host infrastructure, not a source
  finding in this repository.
