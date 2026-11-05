# Kujo SSG current capability matrix

This is the current implementation-status reference. Historical audits and
roadmaps retain their original findings, but must point here when their status
has been superseded.

| Capability | Current status | Contract coverage |
|---|---|---|
| CLI parsing, config precedence, and supported flags | Validated | `scripts/test-cli-contract.sh` |
| Pages, posts, collections, drafts, pagination, metadata, and auxiliary outputs | Validated | `scripts/test-generated-contract.sh` and `scripts/validate-generated-output.sh` |
| Local featured-image containment | Supported | `scripts/test-generated-contract.sh` rejects an escaping path and retains normal local-image processing |
| Size-optimized featured-image WebP conversion | Supported | `scripts/test-generated-contract.sh` verifies RIFF/WebP bytes and requires the generated fixture image to be smaller than its JPEG source |
| Plain sitemap XML | Supported | Generated-output and CLI contracts require XML without a stylesheet dependency |
| Experimental WebMCP v1 | Enabled by default; explicit opt-out | `scripts/test-webmcp-contract.sh` and `scripts/test-webmcp-runtime.js` |
| Local Ability pack 1.0.0 | Ten bounded workflows; no deployment authority | `scripts/test-ability-contract.sh` and `scripts/test-ability-pack-integration.sh` |
| Delimiter-aware frontmatter | Supported | `scripts/test-generated-contract.sh` covers quoted/body literal dashes and unclosed-delimiter diagnostics |
| Taxonomy lookup/rendering | Supported | `scripts/test-generated-contract.sh` asserts rendered custom taxonomy labels |
| DocGen-to-SSG Markdown bridge | Supported | `scripts/test-docgen-ssg-bridge.sh` covers deterministic Markdown conversion, frontmatter, gates, stale cleanup, and path containment |
| Reusable docs-site starter package | Supported | `scripts/test-docs-template.sh` packages `starters/docs-site`, builds it, generates local search, runs the update automation against a fixture repo, and validates output |
| Remote featured-image/font destination policy | Supported | Remote fetches are size-bounded, DNS-pinned, redirect-free, and deny non-public destinations by default; `scripts/test-cli-contract.sh` covers denial plus explicit trusted-local image opt-in |
| `--watch` rebuild loop | Planned (P1) | Current CLI contract verifies the documented no-op warning |

Run the supported checks with:

```bash
KUJO_BIN=kujo bash scripts/run_ci_checks.sh
```

The CI script runs the CLI, generated-output, documentation, starter-build, and
generated-output validation contracts. Do not infer release approval from a
green local check; use `scripts/run_release_gate.sh` for the release checklist.
