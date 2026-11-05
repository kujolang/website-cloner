# Whole-site capture and AI usage

[Documentation index](README.md)

New front-end and default CLI builds have no page-count cap. Public WordPress pages/posts are enumerated through every REST page, every same-origin sitemap index and recursively discovered same-site links. Visited URL deduplication stops cycles; repeated REST batches are explicitly reported. Known static WordPress query permalinks (`p`, `page_id`) and archive pagination receive distinct stable local routes under `/_migration/query/`. Search/filter/action queries are not blindly crawled. Private pages, robots-denied destinations and dynamic services cannot be converted by crawling; these are reported rather than represented as migrated content.

## Checkpoints and limits

Ordinary whole-site runs have no aggregate request, byte or elapsed-time restart budget. Per-request timeouts, file-size limits, source crawl delays and disk checks still apply. Lower-level clients can use bounded budgets; a recoverable interruption saves discovery cursors and downloaded assets so the same job can continue. Built-in retries stop after repeated failures without progress. They do not turn an unreachable source into a successful export.

Use a cached rebuild to regenerate an export from saved captures. Use a fresh migration when you need new source content. Previously downloaded ZIP files do not change. See [recovery](recovery.md) for stop, resume and disk behavior.

## Token receipts

`ai-usage.json` is persisted before each request and after each returned response, before parsing/acceptance or repair verification. It survives failed builds and resumes and is included in successful downloads. Each receipt has model/provider, migration stage/round, status, timestamps and token details. Pending/failed requests without a provider receipt remain unknown, not zero. A later rejected proposal still counts its returned usage. Old aggregate-only receipts cannot be retrospectively split into exact rounds.

The UI shows input, output, cached input and total, both per round and summed across the run. When a field is missing, the total is explicitly the sum of reported rounds plus an unreported-round count. Known zeros differ from unknown values. JSON additionally exposes uncached input, cache-write input, reasoning tokens and upstream round-coverage fields when available. Native Anthropic cache read/write categories are added to its noncached input; normalized OpenAI/ChatGPT cache hits are already part of input. Output reasoning is a subset, not an extra amount to add to total.

For providers whose input includes cached input, a comparison estimate is `(input - cached) × inputRate + cached × cachedRate + output × outputRate`, divided by one million for per-million rates. Separate cache-write pricing needs that provider's additional category. Use the model and current provider pricing yourself. Applying API prices to ChatGPT sign-in token receipts does not measure subscription charges or quota consumption. Unknown cache categories prevent an exact cache-adjusted estimate. No tokens are inferred from text length and no billing is invented. No additional model requests are made just to measure usage.

Verification covers >200 routes, >6 nested sitemaps, REST/page-frontier interruption and resumption, query routes, asset-cache continuation, rejected/failed attempts, missing versus zero cache counts, and UI receipt rendering. This does not prove that every public URL on an arbitrary site can be enumerated.
