---
title: Use The Kujo Toolchain
description: Map everyday development tasks to the first-party Kujo CLI commands.
custom_url: update-generated-reference
template: docs
section: Guides
nav_title: Toolchain
order: 10
audience: developer
difficulty: beginner
status: stable
version: current
prerequisites:
  - Kujo CLI on PATH
previous: /tutorials/five-minute-quickstart/
next: /concepts/docs-pipeline/
tags: [cli, tooling]
---

# Use The Kujo Toolchain

Most daily work starts with the top-level `kujo` command.

## Run And Check Source

```bash
kujo run src/main.kujo
kujo check src/main.kujo
kujo run --interpreter src/main.kujo
```

## Format, Lint, And Test

```bash
kujo format src/main.kujo
kujo lint src/main.kujo
kujo test
kujo test-run
```

## Manage Packages

```bash
kujo init --name my-tool
kujo package-add package-name
kujo package-install
kujo package-install --frozen
```

## Generate Documentation

```bash
kujo docgen /path/to/repo \
  --format json \
  --search-index \
  --source-links \
  --out-dir docs/generated
```

The reusable docs starter wraps that DocGen payload with `scripts/update_docs.kujo`, converts symbols into Markdown, refreshes local search, builds the SSG output, and validates the static site.
