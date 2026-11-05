---
title: Minimal Kujo Project
description: The smallest useful project shape for learning and documenting Kujo.
custom_url: minimal-docs-site
template: docs
section: Examples
nav_title: Minimal Project
order: 10
audience: beginner
difficulty: beginner
status: stable
version: current
previous: /operations/release-docs/
tags: [example, project]
---

# Minimal Kujo Project

A small project still gives you the same CLI loop as a larger one.

## Files

```text
kujo.toml
src/main.kujo
tests/
docs/
```

## Commands

```bash
kujo run src/main.kujo
kujo check src/main.kujo
kujo test
kujo docgen . --format json --search-index
```

## Rule Of Thumb

Keep source, tests, and generated docs easy to inspect. The more the repo can explain itself locally, the easier it is for both humans and agents to maintain it.
