# Repository hardening — round 5

Date: 2026-10-10 (America/Detroit; verification continued October 11 UTC).

## Repository and scope

- Repository: `kujolang/ssg`; branch: `main`.
- Starting SHA: `323e5e53a42e1199f03676509a9f0ba495f8c4f6` (clean).
- Ending implementation SHA: `94f9077d77377a9af72768b1cc48ab70b2b1140a` (publishing fix: `a202603`; helper/orchestration fix: `94f9077`). The subsequent documentation commit records this receipt; its own hash is intentionally not embedded in its contents.
- Purpose: Kujo static-site builder with content collections, documentation generation, search, WebMCP metadata, and a callable Ability adapter.
- Dependencies/integrations: Kujo VM/native Markdown/layout functions; canonical `kujolang/ability` package pinned by Kennel; Python standard library; Bash; Node for browser-runtime contracts; DocGen payload/backend; optional curl-based remote image downloading. No dependencies were added or removed. Ability is pinned to `be093e62bc93e5ec01e99e7da16c5657507ac820`; checkout action is commit-pinned. CI intentionally checks the moving Kujo repository and a stable Rust toolchain/OS packages, so it is an integration gate rather than a fully hermetic build. No claim of a comprehensive third-party vulnerability/advisory audit is made.

Read the actual builder, Ability runtime/helper, parallel runner, DocGen bridge and reducer, both search indexers, update/package/benchmark scripts, validation/release/CI contracts, layouts, starter examples, schemas and configuration. Reviewed the nearby native layout encoder read-only to verify the dependency boundary. The security coverage artifact lists reviewed files. Excluded generated `output/**`, scratch `tmp/**`, `kennel_packages/**`, caches, minified vendor assets, fonts, bulk images and `static/**` from the source sweep. These were neither treated as examples nor manually edited. No sibling repository was modified.

Baseline ran against the unchanged checkout. Candidate changes and verification ran in an ignored archive of that exact commit under `tmp/hardening-20261010/candidate`; only verified first-party changes were then copied into the checkout. This preserves an uncontaminated before comparison.

## Baseline

Runtime: `/Users/robertdevore/.local/bin/kujo`, version 1.5.0; ordinary VM execution, no interpreter-mode substitution. Baseline `scripts/run_ci_checks.sh`: passed (exit 0; 42 HTML files validated in final starter build). New regression probes intentionally fail against the original code: the first seven helper/parallel tests fail; publication/DocGen boundary tests produce eight failures and one error across six test methods; the docs-search DOM test detects unsafe `innerHTML`. These are demonstrated pre-existing defects, not failures introduced by the patch.

Evidence logs remain locally in ignored `tmp/hardening-20261010/`: `baseline-ci.log`, `baseline-new-tests.log`, `baseline-content-tests.log`, `baseline-docs-runtime.log`, `final-release.log`, `candidate-content-tests.log`, `candidate-docgen.log`, and `candidate-ability.log`. Compact measurements are committed beside this report. Raw logs are not required to reproduce the checked-in contracts.

## Findings

| ID | Priority | Area | Finding and evidence | Action | Status |
|---|---|---|---|---|---|
| H5-01 | P1 | Published metadata | Native JSON-LD accepted closing-script markup and invalid JSON controls; generated HTML/JSON regression proves both. | Safe JSON serialization and script-context escaping through guarded existing interpreted renderer. | Fixed in SSG; upstream follow-up |
| H5-02 | P1 | Docs browser | Search results interpolated metadata into `innerHTML`; navigation allowed obfuscated active URL schemes. | DOM text nodes, HTTP(S) URL validation, navigation scheme guard. | Fixed |
| H5-03 | P1 | Source containment | Collection-root and lookup symlinks bypassed previous leaf-only checks; search indexers followed linked Markdown. | Reject those source links; exclude linked directory/file search entries. | Fixed |
| H5-04 | P1 | Generated state | DocGen stale manifests and output paths could traverse linked parents; incremental validation allowed earlier deletions before later rejection. | Validate every target and manifest before mutation in both backends. | Fixed |
| H5-05 | P1 | Dry-run | DocGen dry-run could still build/mutate site or generate absent payload. | Require existing payload and suppress build/validation. | Fixed |
| H5-06 | P1 | Ability bounds | Eager recursive enumeration preceded bounds; suffix filtering bypassed total file limits; diagnostics could be hidden behind routes and counts truncated. | Incremental bounded traversal, all-file counting, accurate issue counts, diagnostic-first bounded receipts. | Fixed |
| H5-07 | P1 | Artifact failures | Export created parent paths before containment validation and left partial archives after I/O errors. | Component validation before mkdir, exclusive creation, partial archive cleanup. | Fixed |
| H5-08 | P1 | Parallel state | Forwarded phase/shard arguments could override wrapper-owned stages; later batches launched after a failed batch. | Reject reserved arguments before setup; stop scheduling after reaping failed batch. | Fixed |
| H5-09 | P2 | Unnecessary I/O | Inspection/readiness/export hashed every output file despite not using hashes. | Request hashes only for comparison; preserve final artifact checksum. | Fixed, measured |
| H5-10 | P1 | Optional minification | Existing regex changes quoted whitespace and consumes JS line-comment newlines. Exact function reproduction below. | Preserve established behavior pending syntax-aware minifier design. | Open |
| H5-11 | P2 | Docs configuration | `update_docs.kujo` passes `--content` only to search; build uses configuration, validators hardcode `output`. | Record contract/precedence design follow-up. | Open, source-supported |

Security findings are medium severity with contributor-controlled content/metadata or generated-state prerequisites. This is not a claim that arbitrary remote clients can execute build commands. The scan separately distinguishes product vulnerabilities from trusted-host helper correctness hardening.

## Changes implemented

### Publishing and browser boundaries

`build.kujo` now uses structured JSON serialization and escapes `<` inside script data. Ordinary metadata retains the native renderer; risky metadata uses the already-existing interpreted renderer because fixing only its encoder would leave the native call vulnerable. Site title/tagline substitutions are escaped. Docs previous/next links reject active schemes including embedded ASCII controls. Collection roots and lookup files skip symlinks with warnings, matching the existing leaf-source policy.

`starters/docs-site/assets/js/docs.js` creates result nodes and assigns `textContent`, retaining normal relative/HTTP(S) navigation without interpreting metadata as markup. Both search indexers skip linked descendants; Python walks without following links and prunes hidden directories relative to the selected root. Explicit operator-selected root paths remain supported.

Coverage: `scripts/test-content-boundaries.py` checks JSON parsing and HTML script boundaries, exact decoded control characters and Unicode, navigation schemes, external-content exclusion and the Kujo indexer; `scripts/test-docs-search-runtime.js` exercises DOM sinks, safe/unsafe result URLs and Escape behavior; Python index traversal is covered by the helper contract.

### DocGen writes and dry-run

`scripts/docgen_ssg_bridge.kujo` and `scripts/docgen_reduce.py` validate manifest and generated/stale paths, including every linked descendant, before deleting or writing anything. Existing manifest entries are validated as a complete set first. Dry-run requires an existing payload and performs no downstream build or validation. Tests run small-payload Kujo and large-payload Python dispatch paths, including linked generated files, manifest links, stale linked parents and absent-payload dry-runs. This protects stable filesystem boundaries; it does not promise protection against a malicious concurrent local filesystem owner swapping paths after checks.

### Ability inspection and export

`scripts/ability-inspect.py` enumerates incrementally with a 20,000-entry and 10,000-file bound; suffix filters no longer hide unrelated files from resource accounting. Existing invalid-artifact error codes are preserved for malformed and linked destinations, with regression assertions. Existing 64 MiB per-output-file and 512 MiB total limits remain. Inspection uses metadata rather than unused SHA-256 reads; comparison still hashes contents and exported tar receipts still contain an artifact checksum. Broken-link counts include every match while receipts retain at most 200 details, prioritized before routine routes. Missing directories and filesystem failures return compact structured failures. Export validates before creating directories, exclusively creates the destination and removes its partial archive after a mid-write failure.

`scripts/test-hardening-contract.py` has nine tests covering traversal bounds, 250 issues with 205 routes, hashing behavior, exports, error receipts, stale validation, Python indexing, and parallel scheduling. `docs/ability-integration.md` now describes controls per handler and explicitly preserves the requirement for caller-supplied canonical policy/services; this adapter is not an authentication boundary.

### Parallel execution and regression gate

`scripts/build-parallel.sh` owns `--phase`, `--shard` and `--shards` and rejects forwarded overrides before setup. A failed batch is fully reaped and no later batch or finalize is launched. A fake runtime contract proves exactly setup plus the first two shard calls occur when that batch fails. This changes failure scheduling without hiding errors or adding sleeps/timeouts.

The three new regression entrypoints run in `scripts/run_ci_checks.sh`, which is also used by the release gate and CI. Existing assertions and snapshots were retained. README documents the affected behavior. No speculative cache, broad rewrite, new abstraction layer or dependency replacement was introduced.

## Performance and efficiency

| Measurement | Before | After | Interpretation |
|---|---:|---:|---|
| Asset-heavy `output_inspect` median, five runs | 1.237398188 s | 0.000658429 s | Synthetic warm local fixture; not a site-build speed claim |
| Bytes hashed by one inspection | 268,435,480 | 0 | Four 64 MiB files plus a 24-byte HTML file; content comparison remains hashed |
| Helper enumeration | Unbounded eager list before checks | ≤20,000 entries, ≤10,000 files | Explicit resource bound, including nonmatching suffixes |
| Broken-link receipt/count fixture | Truncated count; errors hidden by routes | Accurate 250 count; bounded diagnostic-first sample | Preserves observability without expanding the 200-detail limit |
| Failed parallel batch fixture | Five calls including later shards | Three calls: setup and first batch | Avoids futile work after a known failure |

A generated ten-post/two-page fixture produced **36 files, 168,821 bytes, with identical per-file SHA-256 manifests** before and after. One wall-clock run each measured 91.042059468 s before and 87.875815247 s after. This is an equivalence check with timing observations, not evidence of a general throughput improvement. Assets were disabled; templates and command options were identical.

The normal frozen starter output also remains **82 files and 7,418,445 bytes**, with its original aggregate SHA-256 fingerprint.

An exploratory 100-post baseline build was stopped after more than six minutes without completion; no throughput claim is derived from it. Existing large-documentation build scaling is already tracked in SignalBox (`cap_61b680d6-c127-441d-ab7d-18e3269aded0`), so no duplicate was created. Measurements ran alongside verification on the same host; timing variability and concurrency prevent a clean general build-performance comparison. No RSS/CPU/token reduction is claimed. The repository is an SSG rather than a model executor; agent efficiency work focused on bounded receipts, explicit contracts, selective evidence and preserving concise CLI output. No prompt/schema format was changed.

## Security and architecture review

Reviewed content/config/metadata entering generated HTML, documentation browser rendering, linked filesystem sources and generated writes, artifact destinations, subprocess argv, remote-image controls, WebMCP static metadata and external Ability policy assumptions. Existing URL/DNS/private-address download controls, redirect denial and transfer limits were preserved. Templates and operator configuration remain trusted executable site inputs; content metadata should not create active browser script. No credential persistence or new networking was introduced.

The scan has nine reviewed surfaces and five validated vulnerability categories. Trusted-host races, total builder/search resource caps and third-party internals were not exhaustively proven. Local prechecks are not an OS sandbox. Build publication remains a destructive full rebuild rather than a transactional swap; no new rollback/atomic-publication guarantee is claimed. Existing independent shard boundaries were preserved. No abandoned code or dependency could be safely proven removable, so speculative dead-weight deletion was rejected.

## Compatibility

- Public Ability names/schemas, generated file formats, config keys, environment variables and package interfaces: unchanged.
- Ordinary valid generated output: equivalence checked below; malicious/control metadata intentionally differs.
- CLI behavior: reserved parallel-stage overrides now fail before mutation; DocGen dry-run requires existing payload and never performs a build; linked content is skipped and unsafe generated paths fail. Normal successful CLI wording remains intact.
- Ability receipts: accurate counts and diagnostic-first detail order; stronger entry/type limits and compact filesystem errors. Consumers must not depend on truncated counts or routine routes preceding errors.
- External consumers: native renderer users outside SSG need the upstream correction; no ecosystem-wide migration is required for this repository's mitigation.

## Cross-repository follow-up

`kujolang/kujo`, inspected SHA `eec1d17963549ab487516d77231fd2def1b7c1bf`: `src/interpreter/native_functions/strings.rs`, `rl_json_escape`/native layout JSON-LD. Escape all JSON controls and HTML script delimiters, with native tests preserving decoded values. Installed Kujo 1.5.0 is demonstrably affected. SSG's guarded interpreted path removes the immediate dependency on that change. Other consumers may remain affected; changing only SSG cannot fix them. No sibling files changed.

## Remaining work and dispositions

- **P0:** none admitted.
- **P1:** optional regex asset minification changes semantics; native renderer fix for consumers outside SSG. Syntax-aware minification needs an explicit parser/dependency and compatibility decision, not another regex patch.
- **P2:** consistent docs-update/bridge CLI/config root selection and validation. Source-supported; custom-root end-to-end behavior still needs a dedicated fixture before redesign.
- **P3:** none worth cosmetic churn.
- **Needs more evidence:** whole-site scaling, total source limits, hostile concurrent filesystem mutation and atomic publishing. Existing performance capture retained.
- **Not worth changing:** established public contracts, readable explicit test fixtures, pinned dependencies, and bulk/generated assets without a demonstrated defect.

Minifier reproduction: extract the unchanged `minify_text` function and evaluate `const label = "a  b"; // comment\nconsole.log(label);`. Kujo 1.5.0 returns `const label = "a b";// comment console.log(label);`: both string contents and executed statements change. The function is used for optional CSS/JS minification. This is an existing defect, not introduced by this pass.

## Verification receipt

| Command (runtime pinned with `KUJO_BIN=/Users/robertdevore/.local/bin/kujo` where applicable) | Result |
|---|---|
| `bash scripts/run_ci_checks.sh` on untouched starting SHA | PASS, exit 0 |
| `bash tmp/hardening-20261010/candidate/scripts/run_release_gate.sh` | PASS, exit 0; all six frozen variants match |
| `python3 scripts/test-content-boundaries.py` | PASS: six tests, both DocGen backends, repeated after final URL compatibility refinement and after copying into checkout |
| `python3 scripts/test-hardening-contract.py` | PASS: nine tests |
| `node scripts/test-docs-search-runtime.js` | PASS |
| `bash scripts/test-docgen-ssg-bridge.sh` in candidate | PASS |
| `bash scripts/test-ability-pack-integration.sh` in candidate | PASS |
| `python3 -m compileall -q scripts` | PASS |
| `ruff check scripts` | PASS |
| `bash -n scripts/build-parallel.sh scripts/run_ci_checks.sh` | PASS |
| `node --check starters/docs-site/assets/js/docs.js` and `node --check scripts/test-docs-search-runtime.js` | PASS |
| `git diff --check` | PASS |
| `python3 tmp/hardening-20261010/benchmark-helper.py .` and same with candidate directory | PASS; five observations per variant, measurements in JSON |
| `python3 tmp/hardening-20261010/benchmark-build.py` | PASS: ten-post fixture, all 36 file hashes identical |
| `kujo run tmp/hardening-20261010/minifier-repro.kujo` | Existing minifier defect reproduced; not a passing semantic contract |

The release gate includes CLI, generated output, bug regressions, WebMCP/runtime, DocGen, docs packaging, documentation, Ability catalog and executable pack, final starter build/HTML validation, plus the frozen WebMCP-disabled baseline. No tests were disabled, assertions weakened, sleeps added, or existing timeouts increased. The final URL refinement only narrows the scheme check to preserve colon-containing relative routes; its six-test focused contract was rerun on the final source. A final helper refinement preserves prior artifact error codes and its nine-test contract was rerun. The copied implementation files were checked byte-for-byte against the candidate before commit. No new source change followed verification.

Security report: scan `71fd7585-0a3c-45e1-bb7c-df05c951d6b5`, source baseline `323e5e5`; persisted separately in the local Codex Security store. It describes baseline findings; this repository report and regression tests describe the verified remediation.

## Durable follow-up register

SignalBox captures (exact-ID and concept retrieval passed):

- `cap_f7f3d9a7-f82c-4614-8752-fd165ec38465` — upstream native JSON-LD; project `kujo`; signal `sig_8504e0c0-5c31-4b8e-b868-4834e2431c8f`.
- `cap_54125faf-b9bf-4684-889c-7aadb13976e9` — docs root/config mismatch; project `ssg`; no signal.
- `cap_3f93aa35-3814-487d-8ce1-2cf9484d1a82` — optional minifier semantics; project `ssg`; signal `sig_773a04c1-344d-4642-8c1d-fe64d4ebc2a8`.

No duplicate new records; the existing large-docs performance item was reused by reference. Completed fixes, routine verification, transient progress and implementation recaps were rejected for SignalBox. Strata records the final state and session handoff after commits and push; its IDs are reported in the final receipt.
