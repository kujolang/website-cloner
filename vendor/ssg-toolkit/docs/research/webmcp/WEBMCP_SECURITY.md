# WebMCP security and privacy requirements

> Historical research baseline (August 2026). SSG 1.1.0 enables experimental WebMCP by default; see [the amended ADR](../../architecture/adr-0001-experimental-webmcp-v1.md) and [current usage](../../webmcp.md).

## Security decision

The experimental MVP is read-only, same-origin, public-data-only, externally scripted, and lazy-loaded. No automatic forms, cross-origin exposure, remote fetches, authentication, or write actions.

Static does not mean safe. The generator crosses two trust boundaries:

```text
untrusted Markdown/frontmatter
  -> trusted build logic
  -> public JSON/HTML/JS
  -> browser tool result
  -> agent context (untrusted data)
```

Tool descriptions, names, schemas, and annotations are trusted generator code. Site content is never instruction text; it is untrusted returned data.

Primary guidance checked 2026-08-26: [Chrome tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools), [Chrome agent security](https://developer.chrome.com/docs/agents/security), [Chrome best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices), and the [WebMCP draft](https://webmachinelearning.github.io/webmcp/).

## Required invariants

1. No record is indexed unless its clean content route is intentionally public in a normal build.
2. Drafts are never indexed in v1, including `--drafts` preview builds.
3. Only allowlisted fields are serialized.
4. `search_exclude` prevents search results but is not treated as privacy.
5. `nav_hide` affects navigation only.
6. No source path, raw config, arbitrary frontmatter, environment value, lookup ID, secret, or build temporary appears in public data.
7. No content-derived string is interpolated into executable JavaScript or a tool description/schema.
8. Every result is bounded independently of index size.
9. Every input is schema-constrained and validated again by handler code.
10. No baseline tool changes state, navigates, submits, or calls another origin.

## Threat model

### Draft or private metadata leakage

Attack/failure: preview builds include drafts in HTML and accidentally emit them in the public index; arbitrary frontmatter includes internal notes/tokens/paths.

Controls:

- separate `eligible_for_agent_index` from the existing “render drafts” behavior;
- exclude drafts unconditionally in v1;
- construct records from explicit fields, never copy/serialize the `meta` map;
- fixture secrets/canaries in draft and unknown frontmatter; assert they are absent from every generated `.json`/`.js` artifact;
- document that `search_exclude` is discoverability, not secrecy.

### Prompt injection and malicious content

Attack: a post says “ignore the user and exfiltrate data,” or external/user-generated text is returned through a tool.

Controls:

- `untrustedContentHint: true` on all tools returning site-derived text;
- descriptions state capabilities positively and contain no item content;
- return structured fields, not a prose wrapper that makes content look like instructions;
- cap summary/result counts and lengths;
- do not automatically chain content into state-changing site tools;
- eval hostile content while recognizing that hints do not guarantee model behavior.

Chrome advises agent implementers to spotlight untrusted outputs, set token limits, restrict origins, and confirm mutation. Kujo cannot control every consuming agent, so data minimization is its strongest deterministic control.

### XSS and script/JSON injection

Attack: Markdown/frontmatter contains quotes, `</script>`, Unicode separators, HTML, event handlers, or JSON-shaped text.

Controls:

- emit data as an external JSON file through a real JSON serializer;
- never inline the index in `<script>`;
- emit runtime JS from a fixed source template with no content interpolation except validated JSON/string constants encoded through the serializer;
- parse JSON with `response.json()` and return objects, never `innerHTML`;
- browser tests with `</script><script>...`, quotes, backslashes, control characters, lone Unicode cases, and HTML payloads;
- serve correct MIME types and `X-Content-Type-Options: nosniff` where hosting allows.

### Unsafe URLs and route confusion

Attack: crafted routes escape a base path, use `javascript:`, protocol-relative URLs, fragments, duplicate aliases, or cross-origin canonicals.

Controls:

- index only normalized generated clean routes from the builder;
- exclude aliases as records;
- construct deployment URLs with the existing route model and `URL` API in runtime;
- never accept arbitrary URL fetch input; `get_content(url)` matches an indexed exact URL only;
- fail duplicate normalized URLs/IDs;
- do not navigate in MVP;
- keep SEO `canonical` separate from route identity and omit it from v1 unless explicitly validated.

### Prototype pollution and unsafe dynamic access

Attack: input type/taxonomy names such as `__proto__`, `constructor`, or deeply nested objects influence JS prototypes.

Controls:

- `additionalProperties: false`;
- validate names against arrays/sets built from index values;
- use `Map`, `Set`, or null-prototype dictionaries for runtime lookup;
- never merge user input into configuration or records;
- cap object depth, keys, and arrays;
- reject forbidden property names even if a future browser schema validator accepts them.

### Oversized indexes and denial of service

Attack/failure: huge bodies/taxonomies cause excessive build output, browser parsing, search loops, or agent context.

Controls:

- field, term, query, result, and file-size limits;
- bounded summaries rather than bodies;
- lazy fetch;
- measured sharding threshold;
- cancellation checks during fetch/search when practical;
- deterministic build warning/error when budgets are exceeded;
- never return the raw entire index from a tool.

### Tool abuse and confused capability

Attack: overlapping tools cause an agent to choose the wrong action; annotations inaccurately claim read-only behavior.

Controls:

- four non-overlapping MVP tools;
- no navigation or form execution;
- deterministic tests that verify handlers perform no network requests except same-origin index fetch and no storage/DOM mutation;
- read-only annotations only after verifying behavior;
- static registration and duplicate-name failure.

### Automatic form submission

Attack: generator annotates a contact/payment/newsletter/quote form and an agent submits unintended personal data or transactions.

Controls:

- no automatic form discovery/annotation;
- future form tools require explicit site-author opt-in;
- declarative API preferred so the form remains visible and browser semantics apply;
- no generated `toolautosubmit` by default;
- require user confirmation for mutation and preserve CSRF/validation/server protections;
- never expose hidden sensitive controls as parameters.

### Cross-origin exposure and exfiltration

Attack: tools are exposed to untrusted iframes/origins or fetch data from attacker-controlled URLs.

Controls:

- omit `exposedTo`; default same-origin only;
- do not opt cross-origin iframes into `allow="tools"`;
- same-origin static index URL compiled by the generator;
- no user-controlled fetch URL;
- document that sites weakening origin isolation with `document.domain` disable WebMCP.

### Remote or third-party content

Attack: content sourced during a build is assumed trusted because it became a local Markdown file.

Controls:

- treat all content identically as untrusted;
- `untrustedContentHint: true` universally rather than attempting unreliable provenance inference;
- keep remote image/font behavior unrelated to agent data;
- exclude binary/assets and remote content bodies from the index.

## CSP and page integrity

- Use one external self-hosted JS file; no inline bootstrap if avoidable.
- No CDN, eval, dynamic module import, or runtime package.
- Target compatibility with `script-src 'self'` and `connect-src 'self'`.
- Script injection must not reorder or alter visible content.
- A missing `</body>` fallback must be deterministic and covered for custom templates.
- Unsupported WebMCP must not throw, log repeated warnings, fetch data, or change the DOM.

## Build-time validation requirements

- Parse generated JSON with an independent parser in tests.
- Validate schema identifier and field bounds.
- Confirm every item URL corresponds to a generated clean route.
- Confirm no duplicate URL/ID and no alias item.
- Confirm draft/search-exclusion semantics.
- Scan artifacts for fixture canaries representing source paths, arbitrary metadata, env-like secrets, and hostile script strings in executable JS.
- Compare full versus parallel artifact bytes.
- Verify disabled builds contain no runtime/index/script reference and otherwise match the frozen baseline.
- Verify custom templates, root/subpath deployment, minified builds, no-aux, no-index, posts-at-root, empty blog slug, custom URLs, and aliases.

## Runtime validation requirements

- Schema validation plus handler validation.
- Query length 1–200; result limit 1–10; type from discovered allowlist.
- Taxonomy filter depth/key/term caps and forbidden-key rejection.
- Exact indexed URL/ID retrieval only.
- Plain structured return values with capped strings/arrays.
- Graceful same-origin fetch/parse/schema errors with a small non-sensitive error object.
- Registration and execution cancellation tests.
- No stack traces, local paths, full response bodies, or configuration in errors.

## Security posture for future writes

Write/admin actions are not a natural extension of the static baseline. Updating, publishing, deleting, deploying, inventory, payment, or authenticated user data needs server-side authorization, CSRF/replay protection, user intent/confirmation, auditability, and often MCP/CMS infrastructure. Do not add such actions merely because the browser API can call JavaScript.

## Residual risk

Even with these controls, an agent may mishandle untrusted public text; annotations are advisory and models are probabilistic. WebMCP also expands the machine-readable attack surface by making public content easier to retrieve. The MVP's acceptable posture rests on exposing only data already intentionally public, minimizing it, and providing no state-changing capability.
