# Repository hardening audit: round 3

## Repository and scope

- Repository: `kujolang/ssg`
- Branch: `main`
- Starting SHA: `e227264bb962696a45e0fad7da44b78d239f509a`
- Implementation SHA: `d58d1e6`
- Audit date: 2026-10-02

This third pass reviewed content discovery, frontmatter-controlled template
selection, path containment, generated routes, and the regression contracts for
the canonical generator.

The source sweep excluded `output/**`, minified vendor assets, fonts, images,
`static/**`, `tmp/**`, `.git/**`, caches, and generated archives. Those surfaces
were checked through their builders and executable contracts.

The Codex Security Standard Scan launcher was requested but failed before
preflight because its workbench used a Python interpreter that could not parse
the `dict[str, Any] | None` annotation. No plugin-generated security report is
claimed. Direct source review and executable regression validation continued.

## Findings and dispositions

| ID | Priority | Finding | Disposition |
|---|---|---|---|
| SSG-R3-001 | P1 | Recursive Markdown discovery followed symbolic links, allowing a linked file or directory outside the configured content tree to be rendered and published. | Content discovery now rejects every symlink before checking file or directory type and emits a visible warning. Regression coverage proves an external Markdown file is not published. |
| SSG-R3-002 | P2 | The `template` frontmatter value was concatenated into a template path without a component-level allowlist, so slash-bearing values could resolve beyond the templates directory when matching intermediate paths existed. | Template overrides are limited to 80 ASCII letters, digits, underscores, or hyphens. Unsafe values are ignored with a source-specific warning and the default template remains active. Pages, posts, and custom collections share the same control. |

No public schema, default route, dependency, or generated output changed.

## Verification

Passed:

```text
bash scripts/test-bug-regressions.sh
KUJO_BIN=/Users/robertdevore/2026/Kujolang/kujo-repos/kujo/target/release/kujo bash scripts/run_ci_checks.sh
bash -n scripts/test-bug-regressions.sh
git diff --check
```

## Remaining work

- No unresolved repository finding remains from this pass.
- The failed Codex Security launcher is plugin-host infrastructure, not a source
  finding in this repository.
