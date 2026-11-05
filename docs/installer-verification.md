# Installer verification — 2026-11-05

[Documentation index](README.md)

The isolated macOS installation test passed after disk space was freed. It used an empty HOME and installation directory, system-only PATH, real dependency downloads and a private Chromium browser. Linux desktop acceptance remains pending.json).

## Passed

- Fourteen automated installer and lifecycle tests: isolated install workflow, settings/build preservation, active-install refusal, missing-Chrome fallback, Linux package handling, failed dependency download, literal shell paths, destination validation, Node bootstrap without system Node, checksum rejection, HTTP readiness/browser opening, and start/restart/stop ownership.
- Dependency downloads and system package installation are stubbed in installer workflow tests. The Node bootstrap tests use a local archive and verify checksum behavior. They do not prove clean-machine network installation or Linux shared-library compatibility.
- Real registry installation of `@kujolang/kujo-runtime@1.9.0` into an isolated temporary prefix, with a separate npm cache.
- Doctor passed using that downloaded runtime and this machine's existing Node, Chrome, ZIP tools and app dependencies.
- All 22 Markdown-first tests passed with the downloaded runtime, including native Markdown rendering, shared templates and frontmatter roundtrips.
- Launcher test started isolated HTTP listeners, verified readiness, recorded the configured browser URL through a test opener, then stopped both listeners.
- Shell syntax, JavaScript syntax and git whitespace checks passed.

## Fresh-install acceptance

The first attempt exposed a real compatibility issue: Node 22.19.0 was older than Kujo runtime 1.9.0 supports. The installer now downloads Node 22.23.4 when the available Node version is outside that runtime's supported ranges. Explicit `BROWSER_CHANNEL=chromium` now installs and uses a private browser. Expected missing-browser probes no longer dump a stack trace during setup.

The repeated test used an empty HOME, system-only PATH and an empty installation directory. It downloaded and checked Node 22.23.4, installed locked app dependencies and Kujo 1.9.0 from npm, and downloaded Playwright Chromium 141.0.7390.37. Doctor passed and the installed server returned HTTP 200 on isolated ports 4320/4321. No developer settings, existing node_modules or browser/package cache was used.

A one-page local fixture completed the installed pipeline with zero AI calls, readable Markdown/frontmatter and a valid ZIP. Desktop, tablet and mobile visual comparisons each measured 1.0 pixel/layout similarity. Its overall status was `needs-review`; this non-WordPress fixture lacks WordPress metadata endpoints. The receipt retains the actual quality failures rather than presenting this as a general migration-quality guarantee.

Restart and stop passed. Reinstallation retained `.env` and the exact SHA-256 of the saved fixture ZIP, and the restarted server returned HTTP 200. The launcher invoked macOS's browser opener. Native browser-window inspection timed out, so foreground visual confirmation is not claimed. All temporary test files, packages and browser downloads were removed after verification; the user's migration was preserved.

## Still unverified

- A supported Debian/Ubuntu desktop installation, including administrator-assisted system libraries.
- Public remote source download: the GitHub repository remains private and requires an owner visibility/release action. No release or visibility changes were made.
