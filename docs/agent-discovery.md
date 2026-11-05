# No-AI mode and public agent discovery

[Documentation index](README.md)

AI is disabled by default. The browser enables inference only when a model is selected. “Preserve source without AI” passes an explicit disabled policy: ambient AI_ENDPOINT/AI_MODEL credentials cannot enable design inference, and a supplied repair agent is discarded. Library callers opt in with `aiEnabled: true`; CLI callers use `--ai`. `--no-ai` wins if both CLI flags occur. Rebuilding exported projects never calls a model. A resumed run can retain historical token receipts and previously prepared content; disabling AI prevents new calls, not erasure of prior work.

Every newly generated export includes:

- `llms.txt`: Markdown index of public, indexable final page URLs using SITE_URL and BASE_PATH.
- `.well-known/kujo-site-index.json`: public text records with stable route IDs, rebuilt content and final routes. Pages marked noindex/none are omitted from both discovery indexes. This is indexing policy, not access control for an otherwise public page.
- Kujo's four read-only WebMCP tools: `get_site_info`, `search_site`, `list_content`, `get_content`. The vendored SSG runtime is adapted in engine/webmcp.mjs for final routes and preview prefixes. It performs same-origin static index reads; it does not call AI, submit forms, or execute imported scripts.

The runtime is embedded with an exact CSP hash; the route index discovery link is rewritten with the same prefix as other local assets. Root, nested, extensionless, GitHub project and preview URLs are supported. Unsupported browsers leave the page usable without registering tools. WebMCP remains a browser-dependent experimental interface, not a guarantee of agent adoption. `llms.txt` is a discovery aid, not a ranking guarantee.

`scripts/check-agent-export.mjs` validates artifacts and page coverage on every build, including editable project rebuilds. Migration verification additionally executes all four tools in a real browser with a document.modelContext API contract harness; it checks a returned route loads. This harness validates registration, CSP and functionality even when the browser lacks native WebMCP. Reports label it `passed-api-contract-harness`, not native-agent certification. Missing/broken discovery causes a quality failure. Regression tests cover deployment prefixes, preview prefixes, noindex exclusion, cross-origin rejection and missing llms entries.

Existing downloads do not change when the builder updates. Rebuild a saved job from its capture to generate an updated export, or start a fresh migration to recapture the source. Deploy with the correct SITE_URL/BASE_PATH so llms links and canonical URLs point to the destination.
