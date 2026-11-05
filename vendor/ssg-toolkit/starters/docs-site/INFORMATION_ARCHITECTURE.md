# Kujo Documentation Information Architecture

**Status:** Launch draft for review

**Audience:** People discovering Kujo for the first time, developers building with it, and teams evaluating the ecosystem
**Goal:** Ship a small, useful documentation site that takes a reader from “What is Kujo?” to a working local toolchain without making the ecosystem feel like a catalog dump.

## The simple idea

The docs should feel like a path, not a warehouse.

Start with the language. Get Kujo installed. Run one small program. Then introduce the ecosystem in the order a developer naturally needs it: packages, AI and agent primitives, quality and evidence tools, and finally the larger showcases and operating collections.

Every ecosystem project gets a home in the docs, but every page does not need to be a giant manual at launch. A clear explanation, a verified first command, a small example, and an honest boundary are enough for the first release.

## Launch principles

- Keep the first path short: install, verify, run, then choose a direction.
- Use everyday language in the navigation: “Build with AI,” “Keep work reviewable,” and “See examples” are easier to enter than internal taxonomy labels.
- Give every page the same shape so readers can scan quickly.
- Prefer one good working example over a long feature list.
- Put maturity and scope beside the recommendation, not hidden in a roadmap.
- Treat local-first, preview, and hosted/production claims as different things.
- Link to generated reference when a page needs detail; keep authored pages focused on intent and workflow.
- End each page with a natural next step so readers do not have to decide where to go next.

## Recommended top-level navigation

```text
Home
├── Start here
│   ├── Install Kujo
│   ├── Five-minute quickstart
│   ├── Create your first project
│   └── Choose a path
├── Learn Kujo
│   ├── Language basics
│   ├── How the runtime works
│   ├── Capabilities and safe execution
│   ├── Packages with Kennel
│   └── Editor and CLI support
├── Build with Kujo
│   ├── AI and agents
│   ├── Workflows and approvals
│   ├── Knowledge and retrieval
│   └── Applications and publishing
├── Keep work reviewable
│   ├── Context and task contracts
│   ├── Tests and evaluation
│   ├── Evidence and run history
│   ├── Quality and release gates
│   └── Browser, architecture, and privacy checks
├── Tools
│   ├── Tool directory
│   ├── Tool page template
│   └── Generated reference
├── Showcases
│   ├── AI Chat
│   ├── CMS
│   ├── CRUD API
│   ├── SSG
│   ├── Intake
│   └── Security and network examples
└── Reference
    ├── CLI reference
    ├── Language specification
    ├── Standard library
    ├── Configuration
    ├── Security model
    └── Release and compatibility notes
```

The primary navigation should expose only the first six sections. Reference material can live in a secondary navigation or footer so the first-time path stays calm.

## The first-time reader path

### 1. Start here

**Route:** `/start-here/`

One short orientation page. Explain that Kujo is a programming language and a local-first ecosystem for building, checking, and operating AI-native software. Give the reader three choices:

- “I want to write Kujo” → install and quickstart.
- “I want to build an AI application” → AI SDK or AI Chat.
- “I want my agent work to be reviewable” → Spec, Scent, Eval, and RunLedger.

### 2. Install Kujo

**Route:** `/install/`

This is the practical entry point and should be easy to copy from.

Recommended page structure:

1. Requirements and supported platforms.
2. Recommended release install, once the final public artifacts exist.
3. Source install for the current release-candidate path.
4. Optional ecosystem install with profiles.
5. Add the user binary directory to `PATH`.
6. Verify with `kujo --version` and `kujo doctor --json`.
7. Troubleshooting: missing Rust, missing `PATH`, wrong binary, and platform notes.

The current source-backed path is:

```bash
git clone https://github.com/kujolang/kujo.git
cd kujo
cargo build --release
cargo install --path .
kujo --version
```

The ecosystem path should point to the existing installer and explain its profiles rather than duplicating the catalog:

```bash
curl -fsSL https://raw.githubusercontent.com/kujolang/kujo/main/install.sh | bash -s -- --source
export PATH="$HOME/.local/bin:$PATH"
kujo --version
kujo doctor --json
```

When the final release exists, place the pinned release command first and keep `--source` as the fallback. Until then, label the source path clearly as release-candidate onboarding. Do not imply that a public binary exists before the release artifacts and checksums are actually published.

### 3. Five-minute quickstart

**Route:** `/quickstart/`

Create `hello.kujo`, run it, then create a project with `kujo init`. Keep the example small enough that a reader can understand the whole file. End with `kujo check` and one sentence explaining the VM-first runtime.

### 4. Choose a path

**Route:** `/choose-a-path/`

Use a small set of cards instead of asking a new reader to browse 30 repositories:

| If you want to… | Start with… |
| --- | --- |
| Learn the language | Language basics, Standard Library, and Kennel |
| Call models or build agents | AI SDK, Agents SDK, and AI Chat |
| Turn requests into bounded work | Spec, Scent, PackWrite, and Dispatch |
| Check changes before they ship | Eval, Concord, ShipCheck, Fence, Lens, and Redact |
| Capture proof and handoffs | CaseFile, RunLedger, PatchBrief, and ChangeBucket |
| Build an application | CRUD API, CMS, SSG, or Intake |
| Build a guarded integration | MCP, RAG, Relay, Tribunal, or Workcell |

## Learn Kujo

These pages teach the language before the reader meets the larger ecosystem.

| Page | What it answers |
| --- | --- |
| `/learn/language-basics/` | How `.kujo` files, functions, values, modules, and errors work |
| `/learn/runtime/` | Why `kujo run` is VM-first and when the interpreter is useful |
| `/learn/capabilities/` | What trusted and untrusted execution mean, and how to grant only what is needed |
| `/learn/packages/` | How `kujo.toml`, `kujo.lock`, and Kennel fit together |
| `/learn/editor-support/` | How to use the CLI, LSP, and editor adapters |
| `/learn/ai-runtime/` | Core AI helpers, replay, budgets, secrets, and egress controls |

Keep these pages task-oriented. The language specification and standard-library reference belong in Reference, not in the first-time learning path.

## Build with Kujo

### AI, agents, and orchestration

Lead readers through increasing responsibility:

1. **AI SDK** — make a provider-gated chat or embedding call.
2. **Agents SDK** — give an agent tools, approvals, handoffs, and local state.
3. **Dispatch** — turn a sequence of steps into a resumable, auditable workflow.
4. **Watchdog** — see requests, costs, latency, errors, and audit records.
5. **MCP** — expose guarded tools and resources through a server boundary.
6. **RAG** — ingest local knowledge and answer with citations.
7. **Relay** — pause, resume, and hand off workflow state.

### Applications and publishing

Use the showcases as copyable examples, not as promises of hosted services:

- **AI Chat** for a local multi-provider application.
- **CRUD API** for a conventional API and frontend pattern.
- **CMS** for a server-first content system.
- **SSG** for deterministic static publishing and documentation sites.
- **Intake** for inbound requests, routing, approvals, and audit history.

## Keep work reviewable

This section is the ecosystem’s practical differentiator. Introduce the tools in the order of a normal work loop:

```text
Define the work → Spec
Focus the context → Scout + Scent
Prepare the execution → PackWrite + Muzzle
Run the work → Kujo + Dispatch
Check the result → Eval + repository tests
Inspect the change → PatchBrief + ChangeBucket + Concord
Capture the proof → RunLedger + CaseFile
Gate the release → ShipCheck + Fence + Lens + Redact
```

Each page should show the smallest useful command and the artifact it leaves behind.

## Primary tool page inventory

These are the 30 primary tool pages for the initial ecosystem directory. Each gets a real page, even when the first version is short.

### Foundations

| Route | Source | Page promise | Launch label |
| --- | --- | --- | --- |
| `/tools/kujo/` | `kujo` | Write and run local-first Kujo programs. | Release-candidate scope until final artifacts exist |
| `/tools/kennel/` | `kennel` | Manage deterministic manifests, dependencies, lockfiles, and trust policy. | Launch-safe local/source scope |

### AI and workflow primitives

| Route | Source | Page promise | Launch label |
| --- | --- | --- | --- |
| `/tools/ai-sdk/` | `ai-sdk` | Use normalized chat and embedding contracts with fixtures, retries, and redaction. | Launch scope; provider-specific proof still belongs to the integrator |
| `/tools/agents-sdk/` | `agents-sdk` | Build agents with tools, approvals, handoffs, tracing, stores, and budgets. | Launch scope; hosted adapters remain integrator-owned |
| `/tools/spec/` | `spec` | Turn a request into a structured, checkable task contract. | Launch scope |
| `/tools/eval/` | `eval` | Run deterministic acceptance checks locally or in CI. | Launch scope; not a general sandbox |
| `/tools/dispatch/` | `dispatch` | Orchestrate resumable, approved, and auditable workflows. | Launch scope; live integrations need separate proof |
| `/tools/watchdog/` | `watchdog` | Observe AI requests, tools, costs, latency, errors, and audit events. | Launch scope; not a managed service |
| `/tools/mcp/` | `mcp` | Generate guarded MCP servers with roots, limits, auth, and safety tiers. | Launch scope; not managed enterprise infrastructure |
| `/tools/rag/` | `rag` | Build local retrieval flows with namespaces, citations, and offline fallbacks. | Launch scope; not a hosted retrieval service |

### Quality, context, and evidence tools

| Route | Source | Page promise | Launch label |
| --- | --- | --- | --- |
| `/tools/kujo-doctor/` | `kujo/tools/kujo-doctor` | Check the local Kujo environment and explain what needs attention. | Follows Kujo artifact availability |
| `/tools/scout/` | `scout` | Build a structured map of an unfamiliar repository. | Launch scope |
| `/tools/scent/` | `scent` | Package focused, bounded, and redacted context for a task. | Launch scope |
| `/tools/packwrite/` | `packwrite` | Compile repeatable agent execution packs from context and prompts. | Launch scope; local/team workflow |
| `/tools/muzzle/` | `muzzle` | Run noisy workflows quietly while preserving complete logs and summaries. | Launch scope; trusted scripts only |
| `/tools/casefile/` | `casefile` | Capture a failure as a reproducible evidence bundle. | Launch scope |
| `/tools/runledger/` | `runledger` | Record run metadata, usage, cost, verdicts, and follow-ups. | Launch scope; not automatic billing capture |
| `/tools/patchbrief/` | `patchbrief` | Turn a diff into a reviewable summary and handoff. | Preview / dogfood |
| `/tools/changebucket/` | `changebucket` | Measure change footprint, categories, and blast radius. | Launch scope |
| `/tools/concord/` | `concord` | Find drift across code, docs, examples, specs, and generated artifacts. | Preview / dogfood |
| `/tools/shipcheck/` | `shipcheck` | Scan release readiness and produce a gate report. | Preview / experimental wording must stay visible |
| `/tools/fence/` | `fence` | Check architecture boundaries and import rules. | Launch scope; not a runtime sandbox |
| `/tools/lens/` | `lens` | Review browser behavior with screenshots, accessibility, links, and flows. | Preview / stabilizing |
| `/tools/redact/` | `redact` | Remove or transform sensitive values before context leaves the workspace. | Preview / supported input policy must stay visible |
| `/tools/howl/` | `howl` | Render verified examples into Markdown, HTML, SVG, gallery, and caption assets. | Launch scope |
| `/tools/intake/` | `intake` | Normalize inbound requests, route them for review, and preserve an audit trail. | Preview / integration evidence still required |
| `/tools/relay/` | `relay` | Persist and hand off workflow state with integrity-checked receipts. | Preview; local persistence scope |
| `/tools/tribunal/` | `tribunal` | Produce an advisory decision receipt for a review gate. | Preview; advisory and unsigned |
| `/tools/workcell/` | `workcell` | Execute a bounded local package with completion evidence. | Preview; trusted Docker/Podman boundary |
| `/tools/stego-cipher/` | `stego-cipher-kujo` | Demonstrate a controlled Kujo-native data transformation workflow. | Example / security review required before public promotion |

### Directory page requirements

The directory should filter by intent rather than repository type:

- Build
- Orchestrate
- Understand
- Verify
- Protect
- Publish

Every tool card should show one sentence, maturity label, local/hosted scope, and a “Read the guide” link. Avoid showing every feature on the card.

## Supporting ecosystem pages

These are important pages, but they are better presented as collections, showcases, or ecosystem surfaces than as command-line tools.

### Showcases

| Route | Source | What the page should show |
| --- | --- | --- |
| `/showcases/ai-chat/` | `ai-chat` | Local multi-provider chat, encrypted profiles, streaming, and fixture mode |
| `/showcases/cms/` | `cms` | Content models, delivery routes, auth boundaries, jobs, and operational checks |
| `/showcases/crud-api/` | `crud-api` | SQLite APIs, frontend playground, auth strategies, and recovery patterns |
| `/showcases/ssg/` | `ssg` | Markdown-to-site publishing, templates, feeds, sitemap, and `llms.txt` |
| `/showcases/intake/` | `intake` | Inbound request normalization, routing, approvals, and audit history |
| `/showcases/security-network/` | `kujo/showcases` | Authorized-use examples with inert fixtures and explicit safety boundaries |

### Operating collections

| Route | Source | What the page should show |
| --- | --- | --- |
| `/collections/skills/` | `kujo-skills` | How Kujo-specific Agent Skills are installed, selected, and validated |
| `/collections/workflows/` | `kujo-workflows` | The runnable workflow catalog and the artifact each workflow leaves behind |
| `/collections/agents/` | `kujo-agents` | Reusable role contracts, chain of command, and evidence expectations |
| `/collections/benchmarks/` | `kujo-benchmarks` | Benchmark methodology, fixtures, scorecards, and reproducibility limits |
| `/collections/frontier-skills/` | `frontier-skills` | High-rigor operating guidance and its model/provider portability boundary |

### Ecosystem surfaces

| Route | Source | Positioning |
| --- | --- | --- |
| `/ecosystem/site-kit/` | `site-kit` | The shared design and component source kit behind Kujo surfaces |
| `/ecosystem/cinch/` | `cinch` | The human control surface for local repositories, diffs, commands, and proof |
| `/ecosystem/hyperframes/` | `kujo-hyperframes` | Launch-story and campaign assets, not a developer runtime |
| `/ecosystem/command/` | `kujo-command` | A visual command-center concept and role map |

## The standard page shape

Every tool, showcase, and collection page should use this compact structure:

1. **One-line description** — what it does in plain language.
2. **Use it when…** — the moment that should make a reader choose it.
3. **Five-minute example** — one copyable command or short code sample.
4. **What you get** — the output, report, artifact, or running surface.
5. **How it fits** — one small diagram or sentence linking to adjacent tools.
6. **Boundaries** — local-first, preview, hosted, credential, security, or platform limits.
7. **Next step** — one related page, not a list of twenty links.
8. **Reference** — README, CLI reference, generated docs, schema, or repository link.

Suggested frontmatter:

```yaml
title: Scout
description: Build a structured map of an unfamiliar repository.
custom_url: tools/scout
template: docs
section: Tools
nav_title: Scout
audience: developer
difficulty: beginner
status: stable
version: current
tags: [tool, context, repository]
source_repo: scout
scope: local-first
```

For preview projects, use `status: preview` and add a visible “What this means” note. Do not hide an alpha, beta, experimental, or release-candidate label behind a generic “current” badge.

## Initial content depth

The first launch does not need a book for every project.

### Must be complete before launch

- Start Here
- Install Kujo
- Five-minute quickstart
- Choose a path
- Language basics
- Capabilities and safe execution
- Packages with Kennel
- The 30 primary tool pages at the standard page shape
- One working showcase page for AI Chat, CRUD API, CMS, and SSG
- Tool directory and generated reference entry point
- Security, support, and release-boundary pages

### Can start short and grow after launch

- Deep tutorials for every primitive
- Full API reference for every tool
- Benchmarks and comparative performance pages
- Campaign/product surfaces
- Advanced workflow recipes
- Provider-specific deployment guides

“Complete” here means useful and honest, not exhaustive: a reader should be able to understand the tool, run the smallest supported example, and know what it does not promise.

## Readiness and wording rules

The readiness analysis distinguishes “release-ready within documented scope” from “pre-launch / dogfood.” The docs should preserve that distinction.

- Say **local-first**, **showcase**, **preview**, or **technical preview** when that is the verified scope.
- Do not turn a `1.0.0` badge into a blanket enterprise-readiness claim.
- Do not describe local tools as hosted services unless hosted deployment is separately documented and verified.
- Keep Kujo’s final public artifact status visible on the install page until tag, checksums, and clean-machine download smoke are complete.
- Keep security/network showcases clearly limited to authorized use and controlled fixtures.
- Add a small “Last verified” note to pages whose commands or release status are likely to move.

The current readiness reports are useful source material for page labels, but they should be rechecked before publication because they are dated snapshots.

## Implementation notes for the SSG starter

The current starter already has the right shape for this IA:

- authored Markdown under `content/` for learning pages;
- docs templates with section, order, audience, difficulty, status, and next-page metadata;
- generated reference under `content/reference/generated/`;
- local search and copy buttons;
- a DocGen bridge for source-backed reference updates.

Suggested first file set:

```text
content/pages/start-here.md
content/pages/install.md
content/pages/quickstart.md
content/pages/choose-a-path.md
content/pages/language-basics.md
content/pages/runtime-and-capabilities.md
content/pages/packages.md
content/pages/tool-directory.md
content/pages/reference.md

content/tools/<tool-slug>.md
content/showcases/<showcase-slug>.md
content/collections/<collection-slug>.md
content/ecosystem/<surface-slug>.md
```

Use one shared tool-page template as soon as the first three tool pages exist. That keeps the site consistent and makes it inexpensive to add the remaining pages.

## Review questions

Before turning this draft into the public site, confirm:

1. Does “Keep work reviewable” sound like a natural section name for the evidence and quality tools?
2. Should the site lead with the language, or with the broader human-plus-agent workflow story?
3. Should Relay, Tribunal, and Workcell be promoted into the primary tool directory at launch, or remain under workflow pages until their preview labels are clearer?
4. Is “Showcases” the right name for the application examples, or would “Build something” feel more natural?
5. Which release status should be treated as the source of truth for the public badges and page labels once the final Kujo artifacts are published?
