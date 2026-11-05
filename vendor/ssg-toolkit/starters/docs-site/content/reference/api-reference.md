---
title: Generated Reference
description: Browse source-derived Kujo symbols produced by DocGen and bridged into the SSG.
custom_url: overview
template: docs
section: Reference
nav_title: Generated Reference
order: 10
audience: developer
difficulty: reference
status: generated-ready
version: current
search_exclude: true
previous: /examples/minimal-docs-site/
tags: [reference, generated, docgen]
---

# Generated Reference

The reusable docs setup is built to pair this overview with generated symbol pages under `content/reference/generated/`.

## Build The Reference

```bash
kujo run scripts/update_docs.kujo -- \
  --target-repo /path/to/kujo \
  --site-url https://docs.kujo.dev \
  --include-private \
  --include-builtins
```

Use `--strict` for publish checks when undocumented public symbols should fail the build.

## What Appears Here

- Symbol pages generated from source.
- Source links when a template is provided.
- Search records for quick navigation.
- A manifest that removes stale generated pages on later runs.
