# WebMCP v1 performance evidence

Measured: 2026-08-26

Command:

```bash
python3 scripts/benchmark-webmcp.py --runtime <generated-kujo-webmcp.js>
```

This repeatable desktop benchmark constructs the finalized v1 schema with
representative bounded text and two taxonomy groups. It measures compact JSON
generation (the isolated index-build cost), raw/gzip size, local byte-copy time
as a network-free fetch floor, JSON parse time, deterministic search/list cost,
and peak Python allocation during parse. Results are medians where applicable.
They are directional CPython measurements, not claims about a constrained
browser or real network.

| Records | Raw | gzip | Index generation | Local copy | Parse | Search | List | Parse peak |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 43,522 B | 2,774 B | 1.257 ms | 0.000 ms | 0.329 ms | 0.074 ms | 0.009 ms | 186,462 B |
| 1,000 | 431,404 B | 19,957 B | 12.875 ms | 0.002 ms | 4.208 ms | 0.799 ms | 0.242 ms | 2,006,005 B |
| 10,000 | 4,337,188 B | 192,913 B | 126.928 ms | 0.002 ms | 71.854 ms | 10.554 ms | 2.829 ms | 20,252,519 B |

The generated adapter measured 5,883 bytes unminified and 5,867 bytes through
the existing Kujo asset minifier (2,381 bytes gzip), within the 12 KB/6 KB
budgets. Browsers without WebMCP pay only this deferred script plus the property
check; the JSON is not fetched until a tool runs.

The 10,000-record single file remains viable for an experimental lazy-loaded
desktop v1. It is not small enough to dismiss constrained-device validation:
roughly 4.3 MB raw and 20 MB peak allocation make parse memory the warning
signal. V1 therefore does not prematurely shard, while documenting a future
review around 10,000 records or about 2 MB raw. A representative constrained-
browser measurement was not available in the deterministic environment and is
not claimed here.
