# WebMCP implementation-day re-check

> Historical research baseline (August 2026). SSG 1.1.0 enables experimental WebMCP by default; see [the amended ADR](../../architecture/adr-0001-experimental-webmcp-v1.md) and [current usage](../../webmcp.md).

Checked: 2026-08-26

This is the required brief re-check for implementation, not a new architecture
study. The approved experimental, opt-in design remains valid.

## Current producer surface

- Producer interface: `document.modelContext`.
- Register one tool with `await document.modelContext.registerTool(tool,
  options?)`.
- A tool supplies `name`, `description`, `inputSchema`, `execute`, and optional
  `annotations`.
- Read-only public-content tools use `readOnlyHint: true` and
  `untrustedContentHint: true`.
- Registration lifetime is controlled with an `AbortSignal` passed as
  `{ signal }` in the second `registerTool` argument.
- The execution callback receives `{ signal }` as its second argument. Fetches
  should use that signal. Chrome 153 no longer cancels an already running tool
  merely because its registration signal is aborted.
- Same-origin tools are the default. Kujo does not set `exposedTo` or request
  cross-origin tools.

No deprecated `navigator.modelContext`, `provideContext`, `clearContext`, or
standalone `unregisterTool` shape is used.

## Current testing requirements

- Chrome local testing requires
  `chrome://flags/#enable-webmcp-testing` and a browser restart, or a current
  origin-trial deployment (documented as beginning with Chrome 149).
- Test from localhost or another secure/origin-appropriate served page, not
  `file://`.
- Inspect registered tools in the Chrome DevTools Application > WebMCP panel or
  with `document.modelContext.getTools()`.
- Manually invoke tools through DevTools or
  `document.modelContext.executeTool()`; cancellation can be supplied with an
  `AbortSignal`.
- ChatGPT site tools are currently tested in the ChatGPT desktop app's built-in
  browser when the account and model have access. They are page-scoped and
  require the page to remain open. The Help Center explicitly says this
  ChatGPT surface is not provided through ordinary Chrome.

## Security confirmation

The official guidance still treats returned site content as a possible prompt-
injection carrier, recommends untrusted/read-only annotations, concise outputs,
same-origin exposure, and defense in depth. Chrome's current suggested maximum
is 1,500 characters per tool output. Kujo v1 therefore returns bounded
structured projections rather than Markdown or HTML documents and never turns
content into tool descriptions.

## Primary sources

- [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Chrome DevTools WebMCP testing](https://developer.chrome.com/docs/devtools/application/webmcp)
- [ChatGPT desktop site tools](https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app)
