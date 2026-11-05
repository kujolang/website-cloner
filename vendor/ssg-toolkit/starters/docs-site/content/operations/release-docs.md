---
title: Maintain The Docs
description: Rebuild generated reference and preview the static site before publishing.
custom_url: release-docs
template: docs
section: Operations
nav_title: Maintain Docs
order: 10
audience: maintainer
difficulty: intermediate
status: stable
version: current
previous: /concepts/docs-pipeline/
next: /examples/minimal-docs-site/
tags: [release, validation, docgen]
---

# Maintain The Docs

For Kujo, docs maintenance should be a repeatable loop rather than a manual rewrite.

## Refresh Generated Reference

```bash
kujo run scripts/update_docs.kujo -- \
  --target-repo /path/to/kujo \
  --site-url https://docs.kujo.dev \
  --source-link-template 'https://github.com/kujo-lang/kujo/blob/main/{path}#L{line}' \
  --strict
```

## Preview Locally

```bash
kujo serve output --port 4178
```

## Validate Before Publishing

```bash
bash scripts/run_ci_checks.sh
```

Generated reference should be reviewed as source diffs. Hand-authored pages should stay outside `content/reference/generated/` so automation can update symbols without overwriting the learning path.
