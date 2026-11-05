# Kujo SSG Roadmap

This roadmap is the single source of truth for feature parity, design rewrite work, config reliability, and CLI behavior.

Current validated release path:

- Kujo VM builds, contract tests, generated-output validation, CI checks, and the release gate are green.
- Interpreter mode is no longer required for repo-local release validation.

## Ground Rules

- No regressions allowed.
- Existing tests must stay passing.
- Any new tests must be added and passing.
- Avoid partial fixes that degrade other areas.
- Ship in small, verifiable increments.

## How To Use This

- Work top to bottom by phase.
- Do not mark a phase complete until all acceptance checks are done.
- Keep this file updated as work progresses.

## Feature Gap Matrix

| Area | Current | Target | Priority | Status |
|---|---|---|---|---|
| Core CLI parity flags | Present | Validated supported/reserved CLI surface | P0 | Validated |
| Pages, slugs, drafts, metadata | Partial | Full parity | P0 | Validated |
| Pagination and sorting | Partial | Full parity | P0 | Validated |
| robots/404/llms outputs | Present | Full parity | P0 | Validated |
| Init scaffolding command | Partial | Full parity | P1 | In progress |
| Config loading (YML/YAML/JSON) | Present | Fully validated | P0 | Validated |
| CLI override precedence | Present | Fully validated | P0 | Validated |
| README parity docs | Present | Complete parity docs | P1 | Validated |
| Security hardening | Complete | Contained local images, delimiter-aware frontmatter, bounded public-only remote fetches | P0 | Validated |
| Experimental WebMCP v1 | Default-on static adapter (experimental) | Four universal read-only tools over a versioned public index | P1 | Implemented |
| Design rewrite (new branding system) | Pending style input | Complete visual rewrite | P1 | [ ] |

## Phase 1: Baseline And Parity Definition

- [ ] Freeze baseline build outputs from a known good commit.
- [ ] Document current behavior for all existing CLI flags.
- [ ] Define exact parity target list for missing or incomplete features.
- [ ] Record known edge cases and expected outcomes.

Acceptance criteria:

- [ ] Baseline output snapshot is generated and archived.
- [ ] Feature matrix is complete and validated against real behavior.
- [ ] No ambiguity remains on what counts as parity.

## Phase 2: Core CLI Parity Flags

- [ ] Validate all supported flags parse correctly and fail clearly on invalid input.
- [ ] Ensure defaults are applied when flags are absent.
- [ ] Ensure flags override values from config files.
- [ ] Confirm help/version/init output consistency.

Initial parity list:

- [ ] --output
- [ ] --content
- [ ] --templates
- [ ] --assets
- [ ] --posts-per-page
- [ ] --sort-by
- [ ] --fonts
- [ ] --site-title
- [ ] --site-tagline
- [ ] --site-url
- [ ] --robots
- [ ] --llms
- [ ] --watch (reserved behavior documented)
- [ ] --minify
- [ ] --download-remote-images
- [ ] --blog-slug
- [ ] --init
- [ ] --version
- [ ] --help
- [ ] --no-index
- [ ] --no-aux

Acceptance criteria:

- [ ] Each flag has at least one positive-path validation.
- [ ] Critical flags have negative-path validation.
- [ ] Override precedence is validated in build output.

## Phase 3: Pages, Slugs, Drafts, Metadata

- [x] Validate page and post route generation by slug.
- [x] Validate custom content type route generation.
- [x] Validate draft exclusion behavior.
- [x] Validate metadata injection for SEO/Open Graph/Twitter.
- [x] Validate canonical and custom_url behavior.

Acceptance criteria:

- [x] Routes match expected URL structure.
- [x] Draft content is excluded from public outputs.
- [x] Metadata appears correctly in rendered HTML.

## Phase 4: Pagination And Sorting

- [x] Validate pagination boundaries and page counts.
- [x] Validate sort_by values (date, title, author, order).
- [x] Validate stable behavior for ties and missing fields.

Acceptance criteria:

- [x] Blog listing pages are correct at min and max ranges.
- [x] Sort results are deterministic and documented.

## Phase 5: Parity Outputs (robots/404/llms)

- [x] Validate robots.txt generation rules for public/private.
- [x] Validate 404 page generation and template usage.
- [x] Validate llms.txt generation rules for public/private.
- [x] Validate no_aux disables auxiliary outputs.

Acceptance criteria:

- [x] Output files exist or are skipped exactly as configured.
- [x] Content of generated files matches policy expectations.

## Phase 6: Init Scaffolding Command

- [ ] Validate init generation for yml.
- [ ] Validate init generation for yaml.
- [ ] Validate init generation for json.
- [ ] Validate generated starter includes complete sample content and templates.

Acceptance criteria:

- [ ] Fresh scaffold builds successfully without manual fixes.
- [ ] Generated config format is syntactically valid.
- [ ] Starter docs match generated structure.

## Phase 7: Design Rewrite And Branding System

Goal:

- Apply a full visual rewrite once new style direction is provided.

Inputs required from style handoff:

- [ ] Brand palette (primary, secondary, neutral, semantic colors).
- [ ] Typography stack and scale.
- [ ] Spacing and layout system.
- [ ] UI component style references (buttons, cards, nav, footer, forms).
- [ ] Tone and brand personality notes.

Implementation plan:

- [ ] Introduce centralized design tokens in CSS variables.
- [ ] Rewrite base layout styles to align with brand system.
- [ ] Update templates to use consistent semantic class naming.
- [ ] Validate responsive behavior across key breakpoints.
- [ ] Validate accessibility contrast and focus states.

Acceptance criteria:

- [ ] Visual style is fully consistent across templates.
- [ ] No legacy color drift remains.
- [ ] Design tokens are documented and easy to override.

## Phase 8: Config Reliability (YML/YAML/JSON + Overrides)

Config sources and precedence:

1. kujo-ssg.yml
2. kujo-ssg.yaml
3. kujo-ssg.json
4. CLI flags override all config values

Validation matrix:

- [x] Build with yml only
- [x] Build with yaml only
- [x] Build with json only
- [x] Build with conflicting values and verify precedence order
- [x] Build with CLI overrides for each critical field
- [x] Build with invalid config and verify safe failure messages

Critical fields to override-test:

- [x] site_url
- [x] site_title
- [x] site_tagline
- [x] output
- [x] content
- [x] templates
- [x] assets
- [x] posts_per_page
- [x] sort_by
- [x] robots
- [x] llms
- [x] minify
- [x] download_remote_images
- [x] no_index
- [x] no_aux
- [x] blog_slug

Acceptance criteria:

- [x] Precedence behavior is deterministic and documented.
- [x] No config format causes behavior drift.

## Phase 9: Docs And Final Validation

- [x] Update README parity section to match actual behavior.
- [x] Add examples for config + CLI override usage.
- [x] Add troubleshooting section for common misconfigurations.
- [x] Run build and validate output using the project validation script.

Acceptance criteria:

- [x] Docs and behavior are aligned.
- [x] Validation checks pass on final candidate.
- [ ] Release candidate checklist is complete.

## Completion Checklist

- [ ] All phases complete.
- [x] No open P0 items.
- [x] No regression findings.
- [x] Build output validated.
- [ ] Roadmap marked complete with final date and commit hash.

## Progress Log

- 2026-05-12: Initial roadmap created and aligned to parity + design rewrite + config/override reliability goals.
- 2026-05-28: Redirect aliases, 404 output, strict CLI failures, malformed-config failures, generated-output contract tests, CI checks, and release gate validation landed on the interpreter-mode release path.
- 2026-05-28: Reworked Kujo loop-heavy build logic to avoid VM iterator lowering collisions, then moved the validated CI and release path back to plain `kujo run`.
- 2026-05-28: Added shared-behavior config contract coverage across `kujo-ssg.yml`, `kujo-ssg.yaml`, and `kujo-ssg.json`, and marked config-format parity validated.
- 2026-05-28: Added focused CLI override precedence coverage for alternate content/templates/assets, privacy and suppression flags, minification, and remote-image downloads, and marked override parity validated.
- 2026-05-28: Added generated-output coverage for slug routes, custom collection item routes, draft exclusion, and SEO/Open Graph/Twitter/canonical metadata, and marked content parity validated.
- 2026-05-28: Switched post sorting to a stable implementation and added generated-output coverage for pagination boundaries plus deterministic `date`, `title`, `author`, and `order` sorting, including tie and missing-order behavior.
- 2026-05-28: Rewrote the README into a forward-facing production guide, removed stale interpreter-era wording, and aligned the docs status with the now-closed P0 parity items.
- 2026-07-10: Reconciled historic parity status with current contract coverage. Local featured-image containment and delimiter-aware frontmatter are validated; remote-fetch destination policy remains the open P0 security item.
- 2026-10-02: Closed SSG-002 with bounded, DNS-pinned, redirect-free remote fetches that deny non-public destinations by default, plus explicit trusted-local image opt-in coverage.
