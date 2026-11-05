# Current WebMCP state

Evidence checked: 2026-08-26. WebMCP is volatile; re-check every linked primary source immediately before implementation.

## Status

WebMCP is an experimental proposed web standard incubated in the W3C Web Machine Learning Community Group. It lets a document expose structured, page-bound tools to a browser agent. It is not server-side MCP, is not a replacement for MCP, and does not make tools discoverable without visiting the site. Chrome describes it as progressive enhancement and currently offers an origin trial plus a local testing flag. ChatGPT's in-app browser supports it for WebMCP Challenge testing.

Primary sources:

- [WebMCP draft specification](https://webmachinelearning.github.io/webmcp/)
- [WebMCP specification source](https://github.com/webmachinelearning/webmcp/blob/main/index.bs)
- [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api)
- [Chrome best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)
- [Chrome tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Chrome agent security considerations](https://developer.chrome.com/docs/agents/security)
- [Chrome WebMCP evals](https://developer.chrome.com/docs/ai/webmcp/evals)
- [Chrome WebMCP vs MCP](https://developer.chrome.com/docs/ai/webmcp/compare-mcp)
- [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/)
- [Challenge requirements and judging](https://webmcp.devpost.com/)

## Current imperative producer API

The current producer surface is `document.modelContext`. Chrome explicitly deprecates `navigator.modelContext` in Chrome 150; new Kujo code should not make the deprecated name its contract. A temporary fallback may be justified only as a tested compatibility branch and should have an expiry note.

```js
await document.modelContext.registerTool({
  name: "search_site",
  title: "Search this site",
  description: "Search public content on this website.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1 },
      limit: { type: "integer", minimum: 1, maximum: 10 }
    },
    required: ["query"],
    additionalProperties: false
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: true
  },
  execute: async (input, { signal }) => {
    // Validate again, lazy-fetch same-origin static JSON, return bounded data.
  }
}, { signal: registrationController.signal });
```

Current concepts:

| Surface | Meaning |
|---|---|
| `registerTool(tool, options)` | Registers one document-owned tool; rejects invalid/duplicate definitions |
| `name` | Stable unique tool identifier |
| `title` | Optional user-facing label in the current draft |
| `description` | Generator-owned positive explanation of what/when |
| `inputSchema` | JSON Schema object for arguments |
| `execute(input, { signal })` | Async callback; current Chrome docs pass a cancellation signal as the second argument |
| `annotations.readOnlyHint` | Advisory signal that execution does not change state |
| `annotations.untrustedContentHint` | Advisory signal that returned content needs heightened scrutiny |
| registration `AbortSignal` | Aborting unregisters the tool; Chrome 153 documents removal without cancelling in-flight executions |
| execution `AbortSignal` | Lets fetch/search/other work stop when a user or agent cancels |
| `getTools()` / `executeTool()` | Discovery/execution methods for authorized in-page/testing consumers; browser agents use their own internal retrieval path |
| `toolchange` | Event when the accessible tool set changes |
| `exposedTo` / `fromOrigins` | Explicit secure-origin gates for cross-origin iframe access; same-origin is the safe default |

Kujo's static tools do not need dynamic registration by page state. Official best practices say static registration is the default for most applications and warn that overlapping/excess tools consume context and make selection harder. Four distinct universal tools are preferable to many aliases.

## Declarative API

Declarative WebMCP transforms an existing semantic HTML `<form>` by adding:

- `toolname` on the form;
- `tooldescription` on the form;
- optional `toolparamdescription` on form controls;
- optional `toolautosubmit` when agent invocation may submit rather than only populate.

The browser synthesizes a JSON Schema from named controls, types, required state, labels, options, and descriptions. Removing `toolname` or `tooldescription` unregisters the tool. Agent-populated forms remain visible. The current API exposes `SubmitEvent.agentInvoked` and `SubmitEvent.respondWith(Promise)` for distinguishing agent submission and returning a result; `toolactivated` and `toolcancel` signal lifecycle.

For Kujo, declarative support is appropriate only for site-authored forms that explicitly opt in. Automatic annotation would require the generator to invent action semantics and consent policy it cannot safely infer. `toolautosubmit` should never be generated by default.

## Security and origin behavior

- The API is a secure-context feature on origin-isolated documents.
- Enabling `document.domain` disables WebMCP because the origin would not remain stable.
- The `tools` Permissions Policy defaults to `self`; cross-origin iframes need `allow="tools"` plus explicit origin exposure/request.
- Registering a tool does not itself grant arbitrary cross-origin access.
- Read-only does not mean harmless: it may expose private user data. Kujo's baseline must contain public build artifacts only.
- Website content and tool output can carry indirect prompt injection. Chrome recommends `untrustedContentHint`, token limits, cross-origin restriction, user confirmation for mutation, and defense in depth.
- Input schemas are a contract, not a reason to omit handler validation while browser implementations remain experimental.

## Browser and ChatGPT support

As checked:

- Chrome exposes local testing at `chrome://flags/#enable-webmcp-testing` and an origin trial beginning with Chrome 149.
- Official Chrome docs call the feature experimental/Intent to Experiment rather than broadly shipped baseline support.
- `document.modelContext` is the current name; `navigator.modelContext` is deprecated in Chrome 150.
- ChatGPT's in-app browser supports WebMCP out of the box for Challenge testing, according to OpenAI.
- No official evidence reviewed establishes interoperable stable support in Firefox, Safari, or Edge. Treat them as unsupported/unknown and require a silent fallback.
- WebMCP requires a visible browsing context; it is not a headless background service/discovery protocol.

Testing workflow:

1. Build with `webmcp: true`.
2. Serve over localhost HTTP, not `file://`.
3. In Chrome, enable `chrome://flags/#enable-webmcp-testing` and relaunch, or use a valid origin-trial deployment.
4. Inspect registration with current DevTools/Lighthouse/Model Context Tool Inspector and `document.modelContext.getTools()` where available.
5. Execute deterministic tool tests with `document.modelContext.executeTool()`.
6. Test real prompts in ChatGPT's in-app browser.
7. Run evals for tool selection and argument quality; keep data/logic/schema validation deterministic.

## Volatility boundary

The adapter must contain every reference to:

- `document.modelContext`;
- registration options and cancellation callback shape;
- annotations;
- returned value conventions;
- cross-origin exposure;
- declarative event extensions.

The generated site-index schema must not mention browser-specific API names. This permits an adapter update without rebuilding the core content model or changing downstream static consumers.

Known volatility signals include the recent producer-name migration, changing unregistration semantics, and active draft work on outputs and security. Do not adopt examples using removed `provideContext`, `clearContext`, a standalone `unregisterTool`, or deprecated `navigator.modelContext` without verifying the exact target Chrome.

## Current limitations relevant to Kujo

- Tool discovery happens only after a browser visits and runs the page.
- A tool exists only for the lifetime/context of its document.
- The page's JavaScript executes the callback; WebMCP does not supply hosting, storage, authentication, or a backend.
- Experimental access can require origin-trial token operations outside the SSG's normal content build.
- Large tool lists and responses cost agent context and selection accuracy.
- An annotation is a hint, not proof that content is safe or execution is read-only.
- The current standard does not make arbitrary static JSON an agent resource; Kujo must expose it through bounded tools.

## Implications for the product decision

WebMCP is mature enough for an experimental Kujo adapter and challenge showcase. It is not mature enough for a default-on feature or a promise that every browser agent can use the output. The build-derived content artifact is the durable investment; the WebMCP binding is replaceable.
