# Repository hardening — round 6

Date: 2026-10-12 (America/Detroit).

## Repository and scope

- Repository: `kujolang/ssg`; branch: `main`.
- Starting SHA: `fa1f29c222ca5497188cdf5a104567c6a9f8173c`, clean.
- Ending implementation SHA: `7e4edc8fc7048c9df5dd64957f4a742867e2fdf2`. The following audit commit records the result without embedding its own hash.
- Purpose: Kujo static-site generation, documentation generation/search, static WebMCP and an Ability adapter.
- Integrations: Kujo 1.5.0 VM and DocGen, Python standard library, Bash, Node contracts, pinned `kujolang/ability` Kennel package. No dependency, lockfile, network capability or sibling repository changes.

This continuation follows the broad round-5 audit and implements its open docs-root finding H5-11. Inspected actual configuration loading, CLI parsing, normalization/destructive-output validation, builder entrypoint, both documentation orchestration scripts, DocGen receipt and generated-file writes, search index dispatch, output validator, starter packaging, CI/release contracts and their documentation. Existing publishing, browser, Ability, parallel and filesystem regressions remain in the full gate. No new exhaustive security scan or dependency advisory audit is claimed.

Excluded generated `output/**`, ignored `tmp/**`, dependencies, caches, minified vendor CSS/JS, fonts, bulk images and `static/**` from readability searches. Candidate changes were made in an ignored archive of the starting commit at `tmp/hardening-20261012/`; the original checkout stayed unchanged during its baseline. No generated assets were hand-edited.

## Baseline and evidence

Runtime: `/Users/robertdevore/.local/bin/kujo` (1.5.0), standard VM.

- Existing full CI baseline: **passed, exit 0**, 42 HTML files validated.
- Eight new behavioral tests against the unchanged starting source: **seven failures, one error**. These demonstrate missing inspection, divergent configured pipeline roots, late missing-CI failure, inability to replace a saved DocGen receipt, and standalone pipeline defects. The error is the expected non-JSON output from the absent inspection API.
- Final new regression suite: **eight tests pass**. Real DocGen and builder processes exercise configured roots, explicit overrides, repeat updates, generated search contents and HTML validation. Only the repository-CI ordering test substitutes a small deterministic CI script; full repository CI runs independently in the release gate.

Verbose evidence remains locally under ignored `tmp/hardening-20261012/`: `baseline-ci.log`, `pipeline-before.log`, `pipeline-candidate-final.log`, `release-candidate.log`. The checked-in tests reproduce behavior without those logs.

## Findings

| ID | Priority | Area | Finding / evidence | Action | Status |
|---|---|---|---|---|---|
| H6-01 | P2 | Configuration / contracts | Docs update selected hardcoded content/assets destinations, passed content only to indexing, and validated literal `output`; custom configured roots fail end to end. | Obtain canonical validated paths from builder; use them consistently through generation, indexing, build and validation. | Fixed |
| H6-02 | P1 | Repeat execution | A second DocGen invocation fails writing existing `.docgen/output/docgen-cli.json` because `write_file` defaults to no overwrite. | Explicit overwrite of the owned receipt after rejecting symlink targets with existing path validator. | Fixed |
| H6-03 | P2 | Orchestration / final state | Standalone bridge ran full CI after the requested build; CI itself builds default URLs/output. | Run repository checks before the final requested build, then validate resolved output. | Fixed |
| H6-04 | P2 | Packaged workflow | Packaged sites intentionally omit repository CI, but standalone bridge requires it and fails after generation. | Fail before generation with an actionable message; explicit `--skip-repository-checks` retains HTML validation. | Fixed |
| H6-05 | P2 | Failure semantics | Update wrapper accepted success with truncated subprocess output. | Reject stdout/stderr truncation before consuming results. | Fixed, code-supported; no large-output fixture |

## Changes implemented

`build.kujo` adds `--inspect-config`, reusing existing load/CLI/normalization logic rather than introducing another configuration parser. It emits a single `kujo-ssg-config/v1` JSON receipt containing only five routing fields: content, output, templates, assets and site URL. Errors emit `ok: false`, `errors` and exit 1. Inspection does not build, create caches or scaffold files and rejects combinations with init/help/version. Banner and configuration messages remain unchanged for ordinary modes. Config precedence remains yml, yaml, JSON, with CLI overrides last. Arbitrary config keys are not exposed.

`scripts/update_docs.kujo` resolves and validates configuration before generating content. Shared build argv carries content/output/assets/templates overrides. Generated reference defaults to `<content>/reference/generated`; search defaults to `<assets>/js/docs-search-index.json`; the final validator receives resolved output. Explicit `--content-out` and `--search-index` remain supported. The existing script-specific `https://example.com` site URL default is preserved.

`scripts/docgen_ssg_bridge.kujo` uses the same receipt for builds, honors configured output and new `--output`, and defaults generated Markdown to `<content>/reference` when building. Conversion-only skip-build/dry-run retains `content/reference` and does not acquire a dependency on a builder/config. It checks missing repository CI before writes, supports explicit repository-check skipping separately from output validation, orders CI before the final requested build, and safely replaces its existing DocGen receipt. Supplied payload conversion and manifest formats are unchanged.

`scripts/test-docs-pipeline.py` adds eight standard-VM behavioral tests, wired into `scripts/run_ci_checks.sh`. Tests cover config precedence, schema/minimum disclosure, read-only behavior, invalid config/options and incompatible modes; real repeated docs updates under configured and CLI-overridden spaced paths; CI/final-build ordering and URL; missing CI before mutation; packaged operation with continued HTML validation; repeat receipt writes and symlink refusal; unsafe config failure before DocGen. README and packaged starter guidance document the contracts and flag distinctions.

## Performance, resources and agent efficiency

This round fixes reliability and state consistency, not build throughput. It adds one read-only builder preflight to each building docs pipeline and performs no speculative caching, minifier rewrite or dependency replacement.

| Measurement | Before | After |
|---|---|---|
| New behavioral suite | 7 failures, 1 error / 8 tests | 8 passes |
| Repeat owned DocGen receipt | Second write fails | Replaced successfully; symlinks rejected |
| Read-only canonical configuration receipt | No API | 180 stdout bytes, 0 stderr bytes for starter configuration |
| Inspection latency, five local runs | No comparable operation | Median 0.589719549 s; range 0.581105305–0.593146912 s |
| Dependencies / config parsers added | — | 0 / 0 |

Inspection timings ran alongside verification on the same host and are capability overhead observations, not a before/after speed claim. Exact samples and receipt are in `repository-hardening-round-6-measurements.json`. No RSS, token-count or general build-speed claim is made. The compact, typed receipt lets automation obtain sufficient configuration without loading or duplicating the implementation. Verbose test output is preserved in files, not discarded.

All six frozen WebMCP-disabled output fingerprints match their unchanged baselines.
The normal site remains 82 files and 7,418,445 bytes, aggregate SHA-256
`561f8331b65cdcef5563935c788ca6044d59ecba4a77674fe8cb33bc1e2cf1c3`.

## Security, failures and state

Reviewed config/CLI precedence before destructive builds, configured path handoff through subprocess argv, receipt data disclosure, output truncation, generated-file ownership, symlink receipt writes and CI-induced output replacement. Paths with spaces remain argv elements; no shell interpolation or new network access is introduced. Existing output-overlap validation runs before docs generation. Saved receipt overwrite is confined to the existing generated path check. Local checks do not eliminate hostile concurrent filesystem swaps; publication remains a full destructive rebuild without a new atomic-swap guarantee.

Subprocess failures continue to propagate nonzero status; validation is retained by default. The new packaged-site flag skips only repository tests, deliberately leaving final HTML validation active. The tests prove invalid HTML still fails under that flag. No validation assertions, timeouts, retry rules or existing output snapshots were weakened.

## Compatibility

- Public API: additive CLI inspection receipt, schema `kujo-ssg-config/v1`; Ability APIs unchanged.
- CLI: additive `--inspect-config`, bridge `--output` and `--skip-repository-checks`; update root overrides now consistently affect every pipeline stage. Ordinary builder output preserved.
- Config keys, environment variables, generated site/DocGen/search/manifest formats and dependency interfaces: unchanged.
- Custom-root docs consumers intentionally change from divergent/failing behavior to coherent configured roots. Explicit individual destinations and script site-URL defaults are preserved.
- Standalone bridge repository checks run before the requested final build. Missing checks fail before content mutation and explain the packaged-site option.
- Existing consumers can adopt the new scripts and builder together; no sibling change is required.

## Remaining work / cross-repository follow-ups

- **P0:** none admitted.
- **P1, existing:** regex CSS/JS minification can change strings/comment semantics (round-5 reproduction). The repository starter has `minify: true`; this is not assumed disabled. A syntax-aware implementation requires a parser/dependency and compatibility decision.
- **P1, cross-repository:** `kujolang/kujo` native JSON-LD encoder fix from round 5 remains needed for other native consumers. SSG already has a guarded safe rendering path. Existing provenance: sibling SHA `eec1d17963549ab487516d77231fd2def1b7c1bf`, `src/interpreter/native_functions/strings.rs`, `rl_json_escape`. No sibling changes were made; this round does not depend on that fix.
- **P2 / needs more evidence:** bridge full repository CI retains its pre-existing 300-second subprocess deadline, while the independently executed full gate exceeds it on this host. Packaged users can explicitly skip repository checks and still validate output; repository maintainers should run the full gate directly. A bounded long-running gate/progress policy needs separate treatment, not an unexplained timeout increase.
- **Needs more evidence:** large-site build scaling and transactional publication, already recorded in earlier audits.
- **P3 / not worth changing:** cosmetic formatting, established contracts, generated/vendor assets, dependency removal without evidence.

The round-5 docs-root follow-up H5-11 is resolved here. Existing SignalBox items for minification, upstream native encoding and large-docs scaling remain the authoritative follow-ups; resolved work is not submitted as new captures. New timeout-policy Capture
`cap_c1188272-f3aa-4199-a5e0-301f0c8b3ba7` (project `ssg`) was stored after
deduplication; no Signal was created. Exact-ID retrieval and the concept query
`five-minute budget` passed. Completed fixes and routine verification were
rejected for SignalBox.

## Verification receipt

Commands use `KUJO_BIN=/Users/robertdevore/.local/bin/kujo` where applicable.

| Command / context | Result |
|---|---|
| `bash scripts/run_ci_checks.sh` on unchanged starting checkout | PASS, exit 0; 42 HTML files validated |
| `SSG_TEST_SOURCE_ROOT="$PWD" python3 tmp/hardening-20261012/scripts/test-docs-pipeline.py` on starting checkout | Expected FAIL: 7 failures, 1 error / 8 |
| `python3 tmp/hardening-20261012/scripts/test-docs-pipeline.py` | PASS: 8 tests |
| `bash scripts/run_release_gate.sh` in candidate archive | PASS, exit 0; full CI and all six frozen variants |
| `python3 -m compileall -q tmp/hardening-20261012/scripts` | PASS |
| `ruff check tmp/hardening-20261012/scripts` | PASS |
| `bash -n tmp/hardening-20261012/scripts/run_ci_checks.sh` | PASS |
| `kujo run build.kujo -- --inspect-config` in candidate, five timed invocations | PASS; samples in measurements JSON |
| `ruff check scripts`, `python3 -m compileall -q scripts`, `bash -n scripts/run_ci_checks.sh` after copy | PASS |
| `git diff --check` on final checkout | PASS |
| `python3 scripts/test-docs-pipeline.py` after copying verified bytes into checkout | PASS: 8 tests |
| `python3 scripts/test-content-boundaries.py` on final bridge candidate | PASS: 6 tests |

The release gate includes all existing CLI, generated output, bug, WebMCP, DocGen, docs packaging, docs, Ability and executable pack contracts, final HTML validation and six frozen output variants. Candidate implementation files were compared byte-for-byte with copied checkout files before commit. Final bridge refinements and the template-override assertion were covered by the focused tests again after the gate started; the gate subsequently exercises the final bridge in existing DocGen/package contracts. The full gate passed. The following audit commit contains only this report and measurement data; final publication is reported separately.
