# Changelog

## 1.2.0 - 2026-10-12

### Upgrade notes
- Minified builds require esbuild 0.28.2. Run `npm ci --ignore-scripts` in the
  repository or packaged docs site; standalone setup is documented in README.
- Remote image requests reject non-public destinations unless both image
  mirroring and `--allow-private-remote-images` are explicitly enabled.
- Ability definitions and pack versions remain independent and unchanged.

### Added
- Expose resolved build settings through `--inspect-config` for deterministic
  integration with the DocGen pipeline.
- Add `--repository-check-timeout` to give multi-command repository CI its own
  explicit budget (default 3600 seconds).

### Fixed
- Contain custom template, content, asset, and generated-doc paths; reject
  symlink escapes and avoid publishing private or external metadata.
- Bound Ability inspection memory and output traversal, defer unnecessary
  hashing, and stop failed parallel build batches with worker cleanup.
- Keep DocGen paths aligned with the builder's configuration precedence,
  preserve repeat-run receipts, and run repository checks before the final
  requested build so fixture settings cannot replace the user's output.
- Keep JSON-LD metadata opaque to later template substitutions, including on
  older runtimes using the compatible renderer.
- Replace regex CSS/JS rewriting with pinned esbuild 0.28.2 parser-based
  minification. Minified builds now require `npm ci --ignore-scripts`.
- Give DocGen repository checks a separate configurable deadline and preserve
  complete stdout/stderr evidence behind concise success/failure receipts.
- Deny non-public remote image and Google Font destinations by default, pin DNS,
  refuse redirects, and cap response sizes; private image mirroring now requires
  an explicit trusted-local opt-in.
- Reject unsafe font-family input before it reaches generated CSS or a remote
  request.
- Refuse symlink output roots, remove nested output symlinks without following
  them, and skip asset symlinks during publication.
- Build docs-template archives in private staging directories instead of
  recursively deleting a caller-composed path.
- Bound parallel-build shard and concurrency inputs, support `--content=<dir>`
  during auto-sizing, and handle empty post directories deterministically.
- Apply the shard ceiling inside `build.kujo`, terminate active shard workers
  when the parallel orchestrator is interrupted, and require an ownership
  marker before replacing generated benchmark content.
- Avoid a root-level fallback target in CLI-contract cleanup.
- Refresh the frozen WebMCP-disabled fingerprints after intentional image
  optimization changes and enforce them in the release gate.
- Make frozen-output byte counting and SHA-256 hashing portable across macOS
  and Linux release hosts.

## 1.1.0 - 2026-09-29

### Added
- Enabled static WebMCP generation by default for new and unconfigured sites,
  with `webmcp: false` and `--no-webmcp` as explicit opt-outs.
- Added a launch-readiness Spec and deterministic Eval suite for the local SSG release review.
- Added an executable, commit-pinned Kujo Ability pack with local bindings for
  ten bounded project, source, build, output-inspection, readiness, comparison,
  and deterministic artifact-export workflows.
- Added experimental static WebMCP v1 generation with a versioned public
  content index, four universal read-only tools, automatic custom-layout
  injection, subpath support, and deterministic full/sharded output.

### Fixed
- Create the Ability integration test workspace on fresh checkouts so CI does not depend on an ignored `tmp/` directory.
- Emit plain sitemap XML without a stylesheet dependency.
- Hardened Ability path, URL, approval, bounded-process, and artifact-export boundaries; added approved draft previews.
- Replaced oversized lossless featured-image WebP output with quality-82
  `cwebp` encoding, rejecting any conversion that is not smaller than its
  source.
- Guarded destructive output cleanup against the filesystem root, working directory, and overlapping source trees.
- Corrected calendar-date validation, repeated trailing slashes in `site_url`, empty blog slugs, and invalid shard indexes.
- Replaced delimiter-fragile post index fields with escaped payloads so tabs, newlines, and comma-bearing tags remain intact.
- Corrected numeric ordering for negative `order` values.
- Escaped plain frontmatter template values and normalized `lang` metadata before HTML rendering.

### Documentation
- Aligned the README version badge with the current documented SSG version.
- Defined the hard boundary between static public WebMCP tools and
  authenticated canonical Ability execution.

## 1.0.0 - 2026-08-08

### Added
- `--drafts` flag (and `drafts:` config key) to include `draft: true` content in a
  build for preview/staging workflows. Drafts remain excluded by default.

### Fixed
- Absolute `--output` (and other directory) paths are now built from the
  filesystem root instead of being silently rewritten relative to the working
  directory (`ensure_dir` preserved-root fix).
- `.DS_Store` / `Thumbs.db` OS junk files are no longer copied into the generated
  site by `copy_tree`.
- Google Font download warning no longer gives misleading capability advice; it
  now reflects that the default build runs in trusted mode with network access.

### Documentation
- Corrected the config-file precedence in `README.md` (`kujo-ssg.yml/.yaml/.json`,
  not `SSG.*`) and removed agent-guide text that had leaked into the README.
- Documented the Kujo runtime capability model and the `--untrusted` invocation.
