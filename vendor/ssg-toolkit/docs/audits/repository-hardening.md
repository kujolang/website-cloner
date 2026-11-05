# Repository hardening audit

Latest pass: [round 5 — publication boundaries, bounded inspection and failure semantics](repository-hardening-round-5.md).

## Repository

- Repository: `kujolang/ssg`
- Branch: `main`
- Starting SHA: `a33489848209316c8e3ad68f0d89f3c8581256dd`
- Implementation SHA: `133beef666d23e3ec41772e713e82d41c42c847b`
- Audit date: 2026-10-02
- Purpose: deterministic static-site and documentation generation with optional
  public WebMCP output and a bounded local Ability pack
- Important integrations: Kujo VM, the commit-pinned Ability 1.0.1 package,
  `cwebp`, Google Fonts, DocGen, WebMCP, and Kennel metadata

The implementation SHA is the audited ending implementation state. This report
is committed separately so its own commit does not create a self-referential
hash.

## Scope and baseline

The review covered the canonical implementation, configuration, starter
content/templates, CLI and generated-output contracts, DocGen/docs starter,
WebMCP runtime, Ability pack, release automation, filesystem/process/network
boundaries, and current performance evidence.

The broad source sweep excluded generated or bulk paths: `output/**`,
`assets/css/tailwind.min.css`, `assets/js/alpine.min.js`, `assets/fonts/**`,
`assets/images/**`, `static/**`, `tmp/**`, `.git/**`, caches, and generated
distribution directories. Generated behavior was reviewed through builders,
contracts, validation, and deterministic output comparison instead of treating
generated files as source.

Baseline at the starting SHA:

- `KUJO_BIN=/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target/release/kujo bash scripts/run_ci_checks.sh` passed.
- The timed baseline completed in 1,849.16 seconds on a heavily loaded host.
- Existing contracts already covered CLI/config precedence, core generation,
  WebMCP, DocGen, docs packaging, Ability behavior, and output validation.
- `docs/current-capability-matrix.md` and `ROADMAP.md` identified remote-fetch
  destination policy (SSG-002) as the remaining P0 security gap.

The Codex Security deep-scan coordinator was also requested, but its workers did
not start because the host did not provide the managed filesystem permission
profile required by that service. The repository review therefore used direct
source/contract inspection and executable regression tests; no plugin-generated
security report is claimed.

## Findings

| ID | Priority | Area | Finding and evidence | Action | Status |
|---|---|---|---|---|---|
| SSG-H-001 | P0 | Network/SSRF | Remote images used unrestricted `http_get_binary`; Google Font metadata and binaries also lacked per-request destination controls and explicit response bounds. The capability matrix tracked this as SSG-002. | Switched to bounded requests/downloads with public-destination denial, DNS pinning, no redirects, and explicit time/byte limits. Added trusted-local image opt-in only. | Fixed and covered |
| SSG-H-002 | P0 | Filesystem deletion | `delete_tree` followed directory symlinks inside an existing output tree, and an output-root symlink could target an unrelated directory. Asset recursion could also follow directory symlinks outside the configured tree. | Reject output-root symlinks, unlink nested symlinks without traversal, fail on cleanup errors, and skip asset symlinks. | Fixed and covered |
| SSG-H-003 | P1 | Generated CSS/input | Arbitrary font-family strings were interpolated into generated CSS and a Google Fonts URL. | Validate every configured family against a bounded safe ASCII character set before build work. | Fixed and covered |
| SSG-H-004 | P1 | Packaging | `package-docs-template.sh` recursively deleted a path composed from caller-controlled output and package-name arguments. | Validate the package name and build in a private `mktemp` staging directory; publish the archive with rename and clean only the known staging directory. | Fixed and covered |
| SSG-H-005 | P1 | Resource use/reliability | The parallel orchestrator accepted unbounded shard/concurrency values, leaked its failure marker on interruption, ignored `--content=<dir>` for auto-sizing, and exited under `pipefail` for an empty posts directory. | Bound shards to 256 and concurrency to 64, normalize CPU fallback, clean signal/exit state, support both content syntaxes, and make empty auto-sizing deterministic. | Fixed and covered |
| SSG-H-006 | P2 | Output efficiency | Test helpers already follow execute/preserve-on-failure/concise-receipt behavior; no high-value output reduction was found without losing contract evidence. | Preserved current output contracts. | No change warranted |
| SSG-H-007 | P2 | Dependencies/supply chain | Runtime dependency surface is small and Ability is commit-pinned in both Kennel files. No removable or floating production dependency was found. | Preserved the pinned dependency contract. | No change warranted |

## Changes implemented

### Remote fetch boundary

Remote featured images now use `http_download_file` with a 25 MiB cap, 30-second
timeout, DNS pinning, and redirects disabled. Public destinations are mandatory
unless `allow_private_remote_images: true` or
`--allow-private-remote-images` is explicitly selected for a trusted local
source. Failures retain the original remote URL and emit a concise warning.

Google Fonts metadata is capped at 1 MiB and font files at 8 MiB; both always
deny non-public destinations, pin DNS, and refuse redirects. Existing bundled
fonts remain offline. Font-family validation prevents CSS/request injection.

### Filesystem and packaging boundary

Output validation now refuses a symbolic-link output root. Recursive cleanup
unlinks nested symlinks and propagates deletion failures instead of publishing
over stale output. Asset publication skips symlinks with a source-path warning.

Docs-template packaging no longer recursively deletes a caller-composed package
directory. It stages under a private temporary directory and atomically replaces
only the requested archive.

### Parallel build reliability

Auto-sizing now handles empty post directories and both `--content value` and
`--content=value`. Worker fan-out is explicitly bounded, invalid resource inputs
fail before setup, and the failure marker is removed on normal exit or signals.

## Performance and efficiency

- Default generated output is byte-identical to the starting SHA: 85 files and
  7,440,613 bytes on both sides, with identical SHA-1 manifests.
- The former empty-post auto-sizing path exited 1 under `pipefail`; the hardened
  path completed successfully in 0.29 seconds with a no-op runtime fixture.
- The final release gate completed in 1,335.06 seconds versus 1,849.16 seconds
  for the baseline. The host was concurrently loaded and the final suite
  contains additional checks, so this timing is recorded only as a receipt and
  is not claimed as a runtime improvement.
- No dependency, binary, token-context, or default generated-output growth was
  introduced. The new warnings are emitted only for rejected boundary cases.

## Security

Reviewed trust boundaries included CLI/config input, output deletion, source and
asset paths, symlinks, subprocess argv, remote image/font fetches, generated
public metadata, draft exclusion, WebMCP public indexing, DocGen stale cleanup,
and Ability approval/idempotency/export behavior.

Regression coverage now proves private remote destinations are denied by
default and require explicit opt-in, unsafe font input fails before build work,
output and asset symlinks cannot escape their roots, package-name traversal
cannot delete an adjacent sentinel, and parallel fan-out is bounded.

## Compatibility

- Public API/schema/file-format changes: none.
- Generated output changes for the default configuration: none; byte-identical
  comparison passed.
- CLI: added `--allow-private-remote-images`.
- Config: added `allow_private_remote_images` with a default of `false`.
- Intentional hardening change: loopback/private remote images that previously
  downloaded under `--download-remote-images` are now left remote unless the
  trusted-local opt-in is present. Public remote images remain supported.
- Environment variables and Ability definitions: unchanged.

## Cross-repository follow-ups

None required. The Kujo runtime already provides the bounded download,
destination-policy, DNS-pinning, and no-redirect primitives used here.

## Remaining work

- P0: none found.
- P1: none left from this audit.
- P2: none justified without broader design or runtime changes.
- P3: cosmetic churn intentionally skipped.
- Needs more evidence: repeat large-site performance benchmarks on an otherwise
  idle host before changing the existing performance conclusions. Native
  frontmatter/finalization work remains documented in
  `docs/performance-findings.md` and was not reimplemented without new evidence.
- Not worth changing: the large `build.kujo` module was not split solely to
  reduce line count; its public behavior and phase coupling make that a high-risk
  cosmetic refactor without a demonstrated payoff.

## Verification receipt

Passed commands:

```text
KUJO_BIN=/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target/release/kujo bash scripts/run_ci_checks.sh
KUJO_BIN=/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target/release/kujo bash scripts/test-bug-regressions.sh
KUJO_BIN=/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target/release/kujo bash scripts/test-cli-contract.sh
KUJO_BIN=/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target/release/kujo bash scripts/test-docs-template.sh
bash scripts/test-docs-contract.sh
KUJO_BIN=/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target/release/kujo bash scripts/run_release_gate.sh
/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target/release/kujo run tests/ability_pack_tests.kujo --interpreter
bash -n scripts/*.sh
python3 -m compileall -q scripts
node --check scripts/test-webmcp-runtime.js
git diff --check
```

`kennel validate` and ShellCheck were unavailable on this host. Kennel metadata
was still exercised by the repository's Ability catalog/integration contracts.
