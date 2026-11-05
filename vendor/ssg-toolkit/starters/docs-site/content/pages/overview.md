---
title: Overview
description: Learn what Kujo is, how it runs code, and where the built-in tooling fits.
custom_url: overview
template: docs
section: Start Here
nav_title: Overview
order: 20
audience: beginner
difficulty: beginner
status: stable
version: current
previous: /start-here/
next: /tutorials/five-minute-quickstart/
tags: [overview, runtime, tooling]
---

# Overview

Kujo is designed as a practical language and toolchain rather than a loose collection of scripts. The default execution path is the VM:

```bash
kujo run app.kujo
```

The interpreter remains available when you need a debugging or compatibility path:

```bash
kujo run --interpreter app.kujo
```

## Core Shape

- **Runtime:** VM-first execution, optional interpreter fallback, and experimental JIT support for compatible bytecode surfaces.
- **Projects:** `kujo init` creates `kujo.toml` plus `src/main.kujo`.
- **Quality loop:** `kujo check`, `kujo format`, `kujo lint`, and test commands keep source reviewable.
- **Packages:** `kujo package-add`, `kujo package-install`, and `kujo package-install --frozen` support deterministic dependency workflows.
- **Editor support:** LSP commands power completion, definition, references, hover, diagnostics, rename, and code actions.
- **Documentation:** `kujo docgen` scans source and emits structured docs that this SSG template can publish.

## Why This Site Exists

This docs site combines hand-authored learning paths with generated reference material. The hand-authored pages teach intent and workflow. The generated reference reflects the current source tree. Together, they make the docs useful for a new reader and maintainable for a fast-moving codebase.
