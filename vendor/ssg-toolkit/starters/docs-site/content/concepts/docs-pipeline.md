---
title: Runtime And Docs Model
description: How Kujo execution, project tooling, generated reference, and the SSG work together.
custom_url: docs-pipeline
template: docs
section: Concepts
nav_title: Runtime + Docs
order: 10
audience: developer
difficulty: intermediate
status: stable
version: current
previous: /guides/update-generated-reference/
next: /operations/release-docs/
tags: [architecture, pipeline]
---

# Runtime And Docs Model

Kujo documentation should explain the language and stay synchronized with the implementation. This template does that by keeping tutorial content and generated reference content separate.

## Runtime Layers

- `kujo run` executes scripts on the VM by default.
- `kujo run --interpreter` uses the tree-walking interpreter for fallback and debugging.
- `kujo run --jit` opts into experimental JIT execution where supported.
- `kujo check` validates source without executing it.

## Documentation Layers

- Authored pages live under `content/`.
- Generated symbol reference lives under `content/reference/generated/`.
- Templates live under `templates/`.
- Search data is generated into `assets/js/search-index.json`.

## Update Loop

The docs workflow is designed to be rerun as Kujo changes. DocGen reads the source tree, the bridge turns changed symbols into Markdown, stale generated pages are removed by manifest, and the SSG rebuilds a static site from the current inputs.
