# Repository hardening audit: round 4

## Repository and scope

- Repository: `kujolang/ssg`
- Branch: `main`
- Starting SHA: `d58d1e6`
- Implementation SHA: `09a9675`
- Audit date: 2026-10-02

This fourth pass reviewed the executable Ability helper's generated-output
inspection, comparison, readiness, checksum, and deterministic export paths,
with emphasis on whether the documented bounded behavior is enforced at every
file-read boundary.

The source sweep excluded `output/**`, minified vendor assets, fonts, images,
`static/**`, `tmp/**`, `.git/**`, caches, and generated archives. Generated
trees and archives were exercised through disposable integration fixtures.

The Codex Security Standard Scan launcher failed before preflight as recorded in
round 3, so no plugin-generated security report is claimed for this pass.

## Findings and dispositions

| ID | Priority | Finding | Disposition |
|---|---|---|---|
| SSG-R4-001 | P2 | The helper capped file count but used `read_bytes()` for every generated file and the exported tar, allowing a caller-selected generated tree or large archive to cause unbounded peak memory use. | Added a 64 MiB per-file limit and 512 MiB aggregate generated-tree limit. Output and artifact SHA-256 digests now stream in 1 MiB chunks. The integration contract rejects an oversized sparse fixture before reading it. |

The documented Ability boundary now states the exact byte limits. Ability
schemas, operation IDs, receipts, approval behavior, and deterministic archive
bytes remain unchanged.

## Verification

Passed:

```text
KUJO_BIN=$(command -v kujo) bash scripts/test-ability-pack-integration.sh
KUJO_BIN=/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target/release/kujo bash scripts/run_ci_checks.sh
python3 -m py_compile scripts/ability-inspect.py
bash -n scripts/test-ability-pack-integration.sh
git diff --check
```

## Remaining work

- No unresolved repository finding remains from this pass.
- The failed Codex Security launcher is plugin-host infrastructure, not a source
  finding in this repository.
