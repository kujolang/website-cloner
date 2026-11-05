# Release Process

## Current Validated Path

The validated release path for this repo is standard Kujo VM execution.

Use the release gate before shipping changes:

```bash
npm ci --ignore-scripts
bash scripts/run_release_gate.sh
```

This gate verifies:

- the version declared in `build.kujo`
- the presence of a matching changelog entry in `CHANGELOG.md`
- the full local CI gate in `scripts/run_ci_checks.sh`
- the deterministic WebMCP config, index, privacy, runtime, layout, and parallel-build contracts
- frozen WebMCP-disabled fingerprints for normal, minified, auxiliary-suppressed,
  index-suppressed, root-post, and parallel builds
- it does not deploy or publish the site for you

## Release Checklist

1. Align `build.kujo`, `kennel.toml`, the README badge, the Ability inspection result, and the CLI version contract. Record the release in `CHANGELOG.md`. Ability definition, handler, and pack versions remain independent.
2. Run `bash scripts/run_release_gate.sh`.
3. Review generated output changes if content, templates, or output contracts changed.
4. Push only after the release gate passes cleanly.

## Runtime Note

CI and release validation now execute `kujo run ./build.kujo` directly. If you are debugging a future Kujo regression, compare that VM path against interpreter mode manually, but the release gate no longer depends on `--interpreter`.

## Publish and synchronize

After the gate passes, commit and push the release, create its annotated `v<version>` tag, and publish a GitHub Release with the matching changelog notes. Tag pushes alone do not publish a Kennel package.

Update the SSG ecosystem page in `kujolang/kujolang.ai`, the showcase and release inventory in `kujolang/docs.kujolang.ai`, and the docs workflow's immutable SSG revision. Build and verify both sites, then deploy through their documented Pages flows. Refresh `kujolang/kujolang-mcp` from the committed website source, update its build-input pin, regenerate and validate the Worker, deploy, and verify live catalog parity. Dispatch the Kennel registry release reconciler for the published release and verify its exact-version metadata and archive.

Frozen fingerprints may be refreshed only after explaining intentional output
changes and comparing every unaffected file against the old baseline. Parser
minification coverage in `scripts/test-minification.py` also checks executable
JavaScript behavior, CSS token boundaries, and fail-closed tool/parse errors.
