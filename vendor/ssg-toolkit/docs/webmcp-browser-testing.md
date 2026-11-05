# WebMCP browser conformance evidence

Checked: 2026-08-26

## Deterministic adapter smoke

`scripts/test-webmcp-runtime.js` executes the generated unminified and minified
adapters in an isolated browser-like JavaScript context. It verifies the exact
four registrations, annotations, schemas, lazy index loading, in-memory cache,
all four handlers, bounds, invalid arguments, unknown records/types, taxonomy
filter validation, and unsupported/malformed schema behavior.

Status: passed in the implementation session.

## ChatGPT desktop built-in browser

A WebMCP-enabled static build was served from localhost and opened in the
available Codex/ChatGPT in-app browser. The page rendered normally, contained
exactly one generated runtime marker, and loaded the self-hosted adapter. The
browser reported no `document.modelContext` producer interface for this local
session/account, so the runtime correctly stopped and the server log confirmed
that `/.well-known/kujo-site-index.json` was not requested.

Status: progressive-enhancement fallback passed; live ChatGPT site-tool
registration and invocation were unavailable and are not claimed.

## Chrome

No connected Chrome browser family was available to the implementation agent,
so the required Chrome flag/origin-trial registration smoke could not be run.
This is not included in deterministic CI.

Status: not run; use the manual steps in `docs/webmcp.md` with a current Chrome
that has `chrome://flags/#enable-webmcp-testing` enabled and restarted.
