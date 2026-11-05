# Experimental WebMCP implementation plan

> Historical research baseline (August 2026). SSG 1.1.0 enables experimental WebMCP by default; see [the amended ADR](../../architecture/adr-0001-experimental-webmcp-v1.md) and [current usage](../../webmcp.md).

This plan is authorized by the GO-with-reduced-scope research decision. It deliberately contains no implementation in this task.

## Delivery principle

Build the durable public-content model first, then attach the volatile browser adapter. Keep commits small and each phase independently verifiable.

## Phase 0: freeze and re-check

1. Re-check the official WebMCP draft, current Chrome overview, imperative API, security guidance, origin-trial state, and ChatGPT testing guidance on implementation day.
2. Freeze a disabled baseline from representative existing fixtures: file list plus hashes/bytes for normal, minified, no-aux, no-index, posts-at-root, and custom-template builds.
3. Add an architecture decision record that marks the feature experimental, default off, same-origin, read-only, and static-only.

Exit: baseline is reproducible and current API surface is recorded with date/version.

## Phase 1: normalized public records and v1 index

1. Add a narrow internal constructor for allowlisted public content records.
2. Generate records for pages, posts, and custom collection items from existing parsed data.
3. Resolve taxonomies with existing lookup functions.
4. Apply v1 eligibility: public route, never draft, `searchable = !search_exclude`.
5. Add structured site/navigation/content-type projections.
6. Sort deterministically, validate IDs/URLs/bounds, serialize `kujo-ssg-site-index/v1` once during finalize.
7. In sharded builds, extend private record fragments or add dedicated fragments; only finalize writes the public file.

Do not add browser code in this phase.

Tests:

- schema and example records;
- pages/posts/arbitrary collections and resolved taxonomies;
- drafts excluded with and without `--drafts`;
- `nav_hide` and `search_exclude` semantics;
- custom URL/posts-at-root/empty blog slug;
- no source paths/arbitrary metadata/canaries;
- duplicate ID/URL failure;
- full versus parallel byte identity;
- index absent while flag is off.

Exit: stable artifact passes independent JSON/schema validation.

## Phase 2: config and CLI opt-in

1. Add `webmcp: false` to defaults and boolean normalization.
2. Add `--webmcp` to explicit CLI parsing and help.
3. Add `webmcp: false` to generated starter config and canonical example only after behavior exists.
4. Preserve config precedence: defaults < first discovered config < CLI.
5. Keep `--no-aux` and `--no-index` independent; document the rationale.

Advanced nested configuration is out of MVP. A boolean is sufficient and best matches existing settings.

Tests:

- default off;
- YAML/YAML/JSON true/false and invalid bool;
- CLI overrides false config;
- unknown/unsupported forms fail as existing CLI conventions require;
- disabled baseline byte equality.

Exit: opt-in controls only the new artifact with no other output drift.

## Phase 3: fixed vanilla-JS runtime

1. Add a small generator-owned runtime template with no site content embedded.
2. Feature-detect current `document.modelContext`; any legacy fallback must be isolated, tested, and documented with an expiry condition.
3. Register `get_site_info`, `search_site`, `list_content`, and `get_content`.
4. Give every tool fixed positive descriptions, strict JSON Schemas, `readOnlyHint: true`, and `untrustedContentHint: true`.
5. Lazy-fetch/caches the same-origin index on first invocation.
6. Validate schema identifier and every input at runtime.
7. Implement deterministic search/ranking and bounded return objects.
8. Respect execution and registration cancellation using the then-current official callback/options shape.
9. Omit cross-origin exposure and all DOM/storage mutation.

Budget targets to confirm by measurement:

- unminified runtime under 12 KB;
- minified runtime under 6 KB;
- unsupported browser: no index request, no uncaught error, no DOM mutation;
- result maximum 10 and summary maximum 600 characters.

Exit: tool logic passes deterministic JS tests without Chrome and conformance smoke passes with current Chrome.

## Phase 4: central script inclusion

1. Emit runtime into an SSG-owned namespace under output assets after user asset copy.
2. Add one central final-HTML injection helper that inserts an external defer/module script before `</body>`, with documented fallbacks.
3. Compute a subpath-safe script and index URL; do not assume `/`.
4. Apply injection to built-in fallback and all custom layouts without requiring a placeholder.
5. Keep CSP compatible with `script-src 'self'` and `connect-src 'self'`.
6. Ensure the 404 policy is explicit. Recommended MVP: do not register content tools on 404 because its page context is exceptional; if injection is global, tools may still be useful, but test and document one decision.

Tests:

- default/custom/malformed-minimal layout placement;
- every intended content page has exactly one reference;
- no disabled reference;
- nested route and site subpath URLs;
- CSP fixture;
- no visible HTML semantic changes.

Exit: zero manual template edits for existing projects.

## Phase 5: minification, caching, and scale

1. Reuse existing JS asset minification; do not add Node/npm.
2. Emit compact JSON in every mode.
3. Benchmark 100/1,000/10,000 real records on desktop and a representative constrained browser.
4. Add build size reporting/warnings only if consistent with existing quiet output contracts.
5. Define a measured sharding trigger; implement manifest/shards only if 10,000-record evidence breaches agreed budgets.
6. Document recommended cache headers for stable manifest/data and subpath hosting.

Exit: budgets and the initial single-file ceiling are evidence-backed.

## Phase 6: contracts and regression gates

Add focused tests rather than bloating unrelated fixtures:

- CLI/config contract;
- generated artifact contract;
- hostile content/serialization/security contract;
- tool runtime unit tests;
- custom layout and subpath integration;
- full/parallel determinism;
- minify/no-aux/no-index/no-aliases/drafts/root-post matrix;
- generated-output validator consistency checks;
- Chrome flag/origin-trial smoke;
- ChatGPT in-app browser prompt evals.

Required disabled invariant:

```text
BUILD(existing project, webmcp=false)
==
frozen pre-feature public output
```

Exit: `bash scripts/run_ci_checks.sh` and release gate pass, plus browser smoke evidence.

## Phase 7: docs-search convergence

Only after the core index is stable:

1. Add a docs search consumer that reads the generic site index.
2. Preserve current docs search fields/ranking/UI through a compatibility projection if necessary.
3. Compare docs index and route behavior across the packaged starter.
4. Remove duplicate docs parsing/generation only when parity and performance are proven.

This prevents the WebMCP feature from coupling to `scripts/docs_search_index.*` while still avoiding permanent duplicate indexes.

Exit: one underlying public model; docs starter remains deterministic and local-first.

## Phase 8: explicit declarative forms experiment

Forms are not MVP. Later:

1. Re-check the declarative spec and Chrome behavior.
2. Test existing semantic search/filter forms with author-supplied `toolname`/`tooldescription`.
3. Define explicit opt-in conventions, never automatic scanning.
4. Default to populate-without-autosubmit.
5. Add user-intent/security review for any mutation.

Exit: a separate decision approves or rejects a supported form convention.

## Phase 9: challenge/demo polish

1. Build two distinct static sites using the same flag and zero custom WebMCP code.
2. Primary demo: services, locations, team/projects, and resolved geographic/service taxonomies.
3. Record prompts showing site orientation, discovery, search, taxonomy filtering, and exact retrieval.
4. Show static network traffic and deployed file tree to prove no application server.
5. Test in ChatGPT's in-app browser and current Chrome.
6. Produce a sub-three-minute public demo video and repository instructions matching [challenge requirements](https://webmcp.devpost.com/).

Exit: the submission demonstrates human-agent value, not just API registration.

## Suggested commit sequence

1. `docs: record experimental WebMCP architecture decision`
2. `feat: generate versioned public site index behind webmcp setting`
3. `test: cover site index privacy and deterministic output`
4. `feat: add static WebMCP runtime and universal read tools`
5. `feat: inject WebMCP runtime across custom layouts`
6. `test: cover browser adapter, subpaths, and parallel builds`
7. `docs: document WebMCP configuration and testing`
8. Later, separately: docs-search convergence and declarative forms experiment.

## Stop conditions

Pause implementation and reassess if:

- the official producer API materially changes again during the work;
- current ChatGPT/Chrome cannot register tools from a pure static page;
- safe custom-layout injection cannot be achieved without altering disabled output;
- public/private eligibility cannot be centralized without leaking preview content;
- real 1,000-item sites exceed agreed human-visitor budgets despite lazy load;
- browser security guidance conflicts with returning public content through universal tools.

## Definition of done for experimental v1

- One boolean/flag produces a pure-static agent interface.
- Four universal tools work in the current official test environments.
- No server/runtime dependency is added.
- Existing disabled builds remain unchanged.
- Draft/private/internal data does not leak.
- Results are bounded and marked read-only/untrusted.
- Full and parallel artifacts are deterministic.
- Custom templates require no manual edits.
- Standard CI/release gates plus WebMCP-specific contracts pass.
- Documentation says experimental and accurately describes browser/origin-trial limitations.
