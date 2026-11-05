# Completion of round-six remaining items

Date: 2026-10-12. Scope: the three follow-ups named at the end of round six:
parser-safe asset minification, repository-check deadlines, and the upstream
native JSON-LD encoder. The user's subsequent request to do the remaining items
also authorized the narrowly scoped Kujo runtime fix. No release or deployment
is part of this work.

## Repository and baseline

- SSG: `kujolang/ssg`, `main`, starting
  `5ac04da58c87c58cb11a7ec9d24a650d9955e546`. Ending implementation SHA:
  `efd9893e9e4606626b00bece335a81ab895539a4`; the following documentation-only
  receipt commit contains this report.
- Kujo: `kujolang/kujo`, isolated `fix/native-jsonld-hardening` worktree, starting
  `fbe4c11caafdcf5a97a30f0c1608e3916e3ed1f7`. Ending/pushed native fix:
  `6695bd9beac4787c9d2db768e9f61dfdb26a95a5` on `main`. An intervening upstream
  CI-pin-only commit `386df8f` was preserved; runtime/test source was unchanged.
- SSG builds and tests use `/Users/robertdevore/.local/bin/kujo` (1.5.0, VM).
  The native fix targets the 1.8.1 source tree; it does not replace the installed
  runtime. SSG's existing JSON-LD fallback remains for older runtimes.
- The full baseline CI and release gate recorded in the round-six report passed
  on the starting source. The new minifier tests were also run against an exact
  copy of starting `build.kujo`, before changing the encoder or baselines.
- The native baseline reproduces both new malicious-input failures while the
  ordinary-output test and 20 existing string-module tests pass. The broader
  existing library baseline passes 958 tests, with eight existing ignores.
- Main source sweeps exclude `output/`, `tmp/`, vendored CSS/JS, fonts, images,
  `static/`, `node_modules/`, and upstream `target/`/`vendor/`. Targeted generated
  asset comparisons and native tests are explicit exceptions.

## Findings and implementation

| ID | Priority | Area | Evidence / root cause | Action | Status |
|---|---|---|---|---|---|
| R7-1 | P1 | Minification | `minify_text` rewrote whitespace inside strings, regexes, templates, CSS values and JavaScript comment/ASI boundaries. | Replace text rewriting with pinned esbuild parser/whitespace printer; behavioral regression tests. | Fixed; verified |
| R7-2 | P1 | Orchestration | Repository CI shared a 300-second single-command deadline despite the measured multi-command gate exceeding it. Runtime stream sinks also truncate disk evidence at the output cap. | Independent configurable CI budget and complete OS-redirected logs; retain generic command deadline. | Fixed; verified |
| R7-3 | P1 | Native JSON-LD | Native `rl_json_escape` omitted JSON control escapes and HTML raw-script delimiters; every dynamic JSON-LD string flows through it. Later template passes could also reinterpret data placeholders. | Standard JSON serialization plus HTML delimiter escaping at the shared helper; direct dispatch tests for both dictionary representations. | Fixed; verified |

### Parser-based minification

`build.kujo` resolves `SSG_ESBUILD_BIN`, the local esbuild Node entry point, or
`esbuild` on PATH. It requires exactly 0.28.2 before destructive output cleanup.
`package.json` and the npm integrity lock pin that version; CI installs it with
`npm ci --ignore-scripts`. Packaged docs sites include both manifests, with a
package contract checking the exact lockfile. Kennel includes the manifests.

Each CSS/JS file is parsed with `--minify-whitespace --platform=neutral
--legal-comments=inline --charset=utf8`; no bundling, identifier renaming, or
syntax minimization is enabled. Input and output are absolute argv paths, not
shell fragments. Already minified files remain byte-identical. Destination
collisions still fail, filename stems retain interior extension-like segments,
and malformed-source failures remove a partial generated file and propagate a
nonzero exit. Warnings remain visible. Files are processed sequentially, with a
five-minute per-file deadline and 1 MiB diagnostic limit.

This adds one direct build dependency (plus its platform-specific binary package)
to minified builds; it adds no Kujo runtime dependency. The repository's
starter configuration already enables minification. `minify: false` needs no
esbuild. Tools are never downloaded during a build. Documentation, starter
instructions, release setup, agent instructions and CI reflect this migration.
Standalone/`--init` sites without npm manifests use the documented
`npm install --prefix . --save-dev --save-exact --ignore-scripts esbuild@0.28.2`
command; the explicit prefix prevents npm from selecting an ancestor project.
The isolated offline setup check created an exact-version manifest and a working
0.28.2 CLI. The dependency is justified by language parsing correctness; this is not an
attempt to replace a parser with custom syntax heuristics. See the official
[esbuild minification contract](https://esbuild.github.io/api/#minify).

`test-minification.py` compares execution of source and generated JavaScript in
Node, including line comments, automatic semicolon insertion, regex quantifiers,
raw templates, Unicode and dynamic `process.env.NODE_ENV`. CSS checks preserve
quoted/custom-property spaces, descendant selectors and `calc` token boundaries.
Missing/wrong tool versions preserve existing output; parse errors fail closed.

### Repository checks

`docgen_ssg_bridge.kujo` adds `--repository-check-timeout` (integer seconds,
1–86400, default 3600). The full repository gate receives this distinct budget;
individual build/validation commands retain their 300-second deadline. This
models a multi-command gate separately instead of suppressing failures or
changing every subprocess timeout.

Complete stdout/stderr go to unique `<docgen-out>/ci-<uuid>/` evidence directories.
A fixed Bash redirection program receives log paths as positional argv values;
no input becomes shell code. In-memory diagnostics remain capped at 64 KiB.
Receipts name the logs and preserve exit-code/timeout distinctions. Failed checks
prevent the final build. Evidence remains until explicitly removed by the user or
artifact retention process; it is not silently truncated or deleted.

The regression emits 160,001 stdout bytes and diagnostic stderr, verifies exact
on-disk preservation and a receipt under 4 KiB, then exercises a one-second
CPU-bound timeout and rejects invalid timeout values. Existing pipeline tests
retain successful-check ordering and packaged-site validation coverage.

### Upstream native encoder

Attacker-influenced page metadata/site settings pass through
`render_layout_native` to `rl_json_escape`, then into an HTML
`<script type="application/ld+json">` body. JSON validity alone is insufficient:
a literal `<` permits case-insensitive closing-script and HTML comment tokens.
The invariant is valid JSON that round-trips input text, with no literal `<` in
any dynamic JSON string.

The narrow helper fix uses the existing `serde_json` dependency, removes only
its enclosing JSON quotes, and escapes `<` as `\u003c` and `{` as `\u007b`. No native API signature,
capability, dispatch, dictionary coercion or ordinary output format changes.
Tests cover all 32 JSON controls, mixed-case script closers, HTML comment syntax,
quotes/backslashes, literal escape sequences, Unicode, and every JSON-LD field
through both `Value::Dict` and `Value::FixedDict`. Ordinary WebSite output is
asserted byte-for-byte. SSG's compatibility fallback is deliberately retained.

The required independent review found a surviving post-encoding path: metadata
containing `{{lang}}`, `{{stylesheet_path}}` or `{{content}}` was reinterpreted by
later template passes. Parent source inspection confirmed it, and a real SSG
fixture reproduced invalid JSON while three neighboring publication tests passed.
Opening-brace escaping makes string data opaque to those passes without changing
the renderer's established substitution order. Both native dictionary forms have
a regression for malicious language substitution and literal placeholder values.
SSG applies the same escaping and routes `{{` metadata through its compatible
renderer on older runtimes. The added second publication fixture is also asserted
as an exact member of the search index, preserving external-file exclusion tests.

## Compatibility and efficiency

Public builder arguments/configuration/file formats and tool schemas remain;
`SSG_ESBUILD_BIN` and the bridge deadline option are additive. Minification now
requires the pinned tool and rejects parser errors instead of publishing corrupt
assets. For the canonical starter's ordinary metadata, only generated `.min.css`/`.min.js`
bytes change. Bridge CI output now uses receipts and retained log files. Native
unsafe/control/brace-containing JSON strings gain correct escapes; data placeholders
remain literal JSON string values instead of executing later substitutions; decoded values and
ordinary output remain unchanged.

The frozen comparison builds the old normal site, verifies its existing frozen
fingerprint, and builds all six candidate variants. For each candidate it replaces
only changed generated minified assets with old asset bytes **in the comparison
map**, then requires the exact old aggregate fingerprint. This proves every other
file and filename unchanged before accepting new fingerprints. The normal site
remains 82 files; total bytes change from 7,418,445 to 7,418,339 (106 fewer bytes).
This small size change is incidental to correctness, not a performance claim.

Minification adds one version check per full build and one process per generated
asset. No speedup, memory reduction or token percentage is claimed. Parser
processing avoids the old whole-file Kujo string/regex rewrite chain, but no peak
memory benchmark was performed. Timings taken alongside native compilation and
other gate builds are observational, not controlled before/after speed evidence.

## Verification receipt

The first concurrent release-gate/fingerprint attempt failed with explicit
`No space left on device` errors. An earlier debug Rust attempt was also
interrupted for storage pressure; only new artifacts from that attempt were
removed. Native compilation and the SSG gate are subsequently serialized. These
interrupted runs are not passes, and assertions/timeouts are not weakened.
A later gate reached the CLI override fixture and rejected its old regex-printer
byte expectation. An isolated esbuild run proved the same two CSS declarations
print as `body{background:#123456;color:#fefefe}`; the optional final semicolon is
omitted. The test retains its exact declaration/closing-brace assertion with that
pinned output. This intentional formatting change is consistent with the reviewed
frozen-asset changes, not a behavioral assertion removed to pass CI.

Exact commands (SSG checkout unless a working directory is stated):

| Command | Result / evidence |
|---|---|
| `npm ci --ignore-scripts` | Pass; esbuild CLI reports 0.28.2. `npm-ci.log`. |
| `npm audit --json` | Pass; zero reported vulnerabilities. `npm-audit.json`. |
| `npm install --prefix . --offline --save-dev --save-exact --ignore-scripts esbuild@0.28.2` (empty scratch site), then `node node_modules/esbuild/bin/esbuild --version` | Pass; exact-version manifest and 0.28.2 CLI. `standalone-install-scoped.log`. |
| `SSG_TEST_SOURCE_ROOT="$PWD/tmp/hardening-remaining-20261012/baseline" SSG_ESBUILD_BIN="$PWD/node_modules/.bin/esbuild" KUJO_BIN=/Users/robertdevore/.local/bin/kujo python3 scripts/test-minification.py` | Starting builder: four failures, including changed JS execution. `minification-before.log`. |
| `KUJO_BIN=/Users/robertdevore/.local/bin/kujo python3 scripts/test-minification.py` | Pass, four tests, including local Node entry-point resolution. `minification.log`. |
| `KUJO_BIN=/Users/robertdevore/.local/bin/kujo python3 scripts/test-docs-pipeline.py` | Pass, nine tests. `pipeline.log`. |
| `KUJO_BIN=/Users/robertdevore/.local/bin/kujo python3 scripts/test-content-boundaries.py Publication` | Before brace fix: one JSON parse error, three passes. `template-boundary-before.log`. |
| `KUJO_BIN=/Users/robertdevore/.local/bin/kujo python3 scripts/test-content-boundaries.py` | After brace fix: seven passes. `template-boundary-after.log`. |
| `python3 tmp/hardening-remaining-20261012/refresh_baselines.py` | Pass, all six comparisons; detailed old/new fingerprints in the companion measurements JSON. |
| `KUJO_BIN=/Users/robertdevore/.local/bin/kujo /usr/bin/time -p bash scripts/run_release_gate.sh` | Pass: full CI and all six frozen variants; 2540.39 seconds wall time (observational). `release-gate.log`. |
| `python3 -m py_compile scripts/test-minification.py scripts/test-content-boundaries.py scripts/test-docs-pipeline.py` | Pass. |
| `bash -n scripts/run_ci_checks.sh scripts/test_helpers.sh scripts/test-docs-template.sh scripts/package-docs-template.sh` | Pass. |
| `git diff --check` | Pass in both repositories. |

Native worktree commands use
`CARGO_TARGET_DIR=/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target CARGO_BUILD_JOBS=2`:

| Command | Result / evidence |
|---|---|
| `cargo test --release --lib interpreter::native_functions::strings::tests` | Before encoder fix: 21 pass, two malicious-input tests fail. `native-baseline-release.log`. |
| `cargo test --release --lib -- --skip native_json_ld` | Existing baseline: 958 pass, eight pre-existing ignores; excludes only the three newly added JSON-LD tests already run above. `native-library-baseline.log`. |
| `cargo fmt --check` | Pass. `native-format.log`. |
| `cargo test --release --lib` | Pass: 962 tests, zero failures, eight pre-existing ignores, including the post-review regression. `native-library-candidate.log`. |

No tests or assertions are disabled in the final candidate. The native test build
also compiles/type-checks the default-feature library. Full native CLI/release and
cross-platform integration suites are outside this narrow pure-string-helper
patch; no CLI, VM dispatch, feature configuration or platform-specific runtime
implementation changed. Existing vendor `tiny_http` warnings are unchanged.

Scratch logs are under `tmp/hardening-remaining-20261012/`. The initial native
candidate's 961-pass run is retained separately: it did not cover the later
review-discovered placeholder issue and is not the final verification result.

## Remaining work / cross-repository status

Native review and source verification and the full SSG release gate are complete.
No unresolved P0–P2 item remains within these three follow-ups. Publishing a new Kujo binary is outside
this source-fix request; existing SSG protection is not dependent on publication.
Historical large-site scaling work remains separately tracked and was not one of
these three selected follow-ups. No new SignalBox capture is warranted for
completed work or an already-recorded finding.
