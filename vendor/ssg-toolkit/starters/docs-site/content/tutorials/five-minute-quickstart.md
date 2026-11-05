---
title: Five-minute Quickstart
description: Create a Kujo project, run it, and check the source with the core CLI.
custom_url: five-minute-quickstart
template: docs
section: Tutorials
order: 10
audience: beginner
difficulty: beginner
estimated_time: 5 minutes
status: stable
version: current
prerequisites:
  - Kujo CLI on PATH
  - Terminal in a writable workspace
previous: /overview/
next: /guides/update-generated-reference/
tags: [quickstart, cli]
---

# Five-minute Quickstart

Start with the CLI and one generated project.

## Check The CLI

```bash
kujo --version
kujo --help
```

## Create A Project

```bash
mkdir hello-kujo
cd hello-kujo
kujo init --name hello-kujo
```

The project now has a package manifest and an entry point:

```text
kujo.toml
src/main.kujo
```

## Run The Program

```bash
kujo run src/main.kujo
```

## Validate While You Work

```bash
kujo check src/main.kujo
kujo format src/main.kujo
kujo lint src/main.kujo
```

## Next Step

Use the toolchain guide when you want to run tests, add packages, preview a static output directory, or generate source reference docs.
