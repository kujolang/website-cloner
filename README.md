# Website Cloner

[![Version](https://img.shields.io/badge/version-0.1.1-black)](https://github.com/kujolang/website-cloner)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)
[![built with Kujo](https://img.shields.io/badge/built%20with-Kujo-white.svg)](https://github.com/kujolang/kujo)
[![Status](https://img.shields.io/badge/status-local%20preview-black)](docs/distribution.md)

**Your website. Your next move.**

Website Cloner turns a public WordPress site into an editable [Kujo SSG](https://github.com/kujolang/ssg) project. Paste a URL, review the clone, and download the website and its source files. The export runs without WordPress, so you can edit your content and move to a static host.

**AI is off by default.** You do not need an API key, AI Chat, Codex, or agent skills. Kujo runs as part of the build; it does not need a separate server.

This is a local preview release. See [versioned releases](https://github.com/kujolang/website-cloner/releases) and the [changelog](CHANGELOG.md) to track updates. Some sites need repairs. A completed migration does not mean every quality check passed.

## Install and open

1. Download and extract this repository. On macOS, double-click **Install.command**. On Linux, run `bash install.sh` in the extracted folder.
2. Let setup finish. It installs Node when needed, Kujo, app dependencies and a browser, then opens the app.
3. Paste a website URL and select **CLONE**. Leave **Preserve Source Without AI** selected for a run with no model calls.

Download the [source ZIP](https://github.com/kujolang/website-cloner/archive/refs/heads/main.zip), or install from Terminal without Git:

```sh
curl -fsSL https://raw.githubusercontent.com/kujolang/website-cloner/main/install.sh | bash
```

Setup requires Bash, curl and tar, plus at least 900 MB of free working space. Larger clones need more. Debian/Ubuntu may ask for an administrator password to install ZIP tools or browser libraries; other Linux distributions need those libraries installed manually. If macOS blocks the launcher, run `bash install.sh` from Terminal in the extracted folder.

The installer uses a private Node 22.23.4 installation when needed and pins Kujo 1.9.0. It does not replace system Node. It uses Chrome when available; `BROWSER_CHANNEL=chromium` selects a private browser. See [installation checks and tested platforms](docs/installer-verification.md).

### Open, restart and stop

The default installation folder is `~/.local/share/website-cloner`. On macOS, open `Website Cloner.command` there. On Linux, run `~/.local/share/website-cloner/website-cloner.sh`.

```sh
~/.local/share/website-cloner/bin/website-cloner restart
~/.local/share/website-cloner/bin/website-cloner stop
```

The app runs in the background at [localhost:4310](http://127.0.0.1:4310); previews use port 4311. If a port is occupied, startup stops without killing the other app.

Stop the app before reinstalling. Setup preserves `.env` and saved builds. To choose another folder, use `CLONER_HOME=/your/path bash install.sh`.

### Run from source

With Node 22.19+, a compatible Kujo runtime, Chrome and ZIP tools installed:

```sh
git clone https://github.com/kujolang/website-cloner.git
cd website-cloner
npm ci --ignore-scripts
npm run doctor
npm start
```

Use `npm restart` and `npm stop` in that folder. `npm run serve` runs in the foreground. Copy `.env.example` to `.env` to change settings; `npm start` loads it. Logs live in `.data/server.log`, and builds in `.data/jobs` unless `MIGRATION_DATA_DIR` overrides the location. Optional `cwebp` enables image optimization; without it, original images remain.

## Clone and review

Use a site you own or have permission to copy. The builder discovers pages through public WordPress APIs, sitemaps and same-site links. There is no default page cap; the API accepts `maxPages` for a smaller sample.

The progress page shows the stage and work time. **Stop migration** keeps the checkpoint and stops automatic continuation. Recoverable interruptions can resume the same job without discarding downloaded assets. Disk checks use captured size and estimated output space, starting at 256 MB free with a 128 MB checkpoint reserve. See [recovery and cached rebuilds](docs/recovery.md).

When the run finishes, review the preview, comparison images and findings. **Complete** means the pipeline finished. **Quality checks failed** means the export still needs work. Saved builds show status, time, size, preview and download controls. Deleting an inactive build removes its local files and cache, never the source site.

## What you get

The ZIP contains the static frontend and an editable project:

- Markdown and frontmatter for posts, pages and detected custom content types.
- Native categories and tags, with original URLs preserved.
- Shared templates for home, archives, posts, pages and detected custom layouts.
- Local images, fonts and styles, plus shared headers, footers and cards.
- Local search, feeds, sitemaps, `llms.txt` and read-only WebMCP discovery.
- Build, preview, validation and packaging commands.
- Content, asset, SEO, accessibility, performance and sampled visual reports.

Prose becomes Markdown where practical. Complex layouts also use HTML components and presentation data in `templates/data/`. Those files remain editable; the tool does not claim every layout can be plain Markdown. See the [export guide](docs/export-guide.md) and [template guide](docs/semantic-templates.md).

A static export cannot replace every backend. Forms, checkout, accounts and comments need a replacement service. Unsupported forms retain their layout with disabled controls and a notice. Supported motion uses reviewed local runtimes; unknown effects, missing assets and inaccessible pages remain review items. Robots restrictions still apply. **A universal 1:1 clone is not promised.** Check [plugin coverage](docs/platform-support/STATUS.md) and [known limits](docs/limitations.md).

## Publish to your own account

The build view supports **GitHub Pages** and **Cloudflare Pages**. Connect your API token, choose or create a destination, confirm it, then select **Publish website**. Publishing replaces the site at that destination.

Progress and deployment history survive refreshes. A verified live link requires both provider completion and the public homepage serving this deployment’s unique marker. An upload alone is not enough.

Tokens stay in server memory until disconnect or restart. They do not enter exports or browser storage. These connections use tokens, not OAuth. GitHub uses a dedicated publishing branch; Cloudflare uses Direct Upload through pinned Wrangler. Both providers have passed live account acceptance, including verified deployment URLs. See [permissions and publishing](docs/deployment.md).

The builder is a local, single-user app. Public hosting needs authentication, worker isolation, quotas and separate user credentials. See [security](docs/security.md) and [distribution](docs/distribution.md).

## Optional AI review

A local AI Chat connection can supply saved models. AI Chat keeps provider keys and ChatGPT sessions; the builder does not copy them. ChatGPT access depends on that connection’s configured account and models, not a public sign-in flow built into the cloner.

The review agent proposes limited CSS repairs. The builder checks them and rolls back changes that worsen the result. The agent cannot run shell commands or rewrite post text. Failures are reported without silently switching accounts.

The UI and `ai-usage.json` show reported input, output, cached-input and total tokens per request and per run. Missing counts remain unknown. Cached input is already part of input tokens; API-price estimates do not measure ChatGPT subscription charges.

The CLI also accepts an OpenAI-compatible endpoint with explicit `--ai`. `--no-ai` takes precedence; configured credentials alone never enable AI. Read the [no-AI contract](docs/agent-discovery.md) and [usage details](docs/whole-site-and-usage.md).

## Development checks

```sh
npm run migrate -- https://your-authorized-site.example/ .data/my-website
npm test
npm audit --omit=dev
npm run audit:site -- PROJECT REPORT_DIRECTORY
npm run audit:lighthouse -- PROJECT REPORT_DIRECTORY
```

SEO and lightweight browser checks run after each build. `LIGHTHOUSE_AUDIT=1` adds Lighthouse. Howl can present reports but is optional.

Tests cover network and file boundaries, cancellation, recovery, content, templates, real SSG output and publishing fixtures. Test files run with concurrency two to limit browser and subprocess load. Run one suite with `node --test tests/<name>.test.mjs`.

See the [fixture guide](tests/fixtures/README.md) and [documentation index](docs/README.md). For a small authorized example, follow the [launch demo](docs/launch-demo.md). Report issues through the [contribution guide](CONTRIBUTING.md).

## License

[MIT](LICENSE). Bundled fonts, icons and SSG assets retain their own licenses and provenance. Website owners retain rights to their content; the tool does not grant permission to copy it.
