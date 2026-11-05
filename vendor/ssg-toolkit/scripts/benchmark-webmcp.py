#!/usr/bin/env python3
"""Measure the v1 single-file WebMCP index at representative record counts."""

from __future__ import annotations

import argparse
import gzip
import json
import statistics
import time
import tracemalloc
from pathlib import Path


def record(number: int) -> dict[str, object]:
    content_type = ("pages", "posts", "services", "locations")[number % 4]
    slug = f"record-{number:05d}"
    return {
        "id": f"{content_type}:{slug}",
        "type": content_type,
        "slug": slug,
        "url": f"/docs/{content_type}/{slug}/",
        "title": f"Public record {number}",
        "description": f"Deterministic public description for record {number} in the Kujo WebMCP scale fixture.",
        "summary": f"Bounded searchable summary for record {number}. Static content remains untrusted result data.",
        "language": "en",
        "searchable": number % 17 != 0,
        "taxonomies": {"region": [f"Region {number % 12}"], "tags": ["Public", f"Group {number % 20}"]},
    }


def document(count: int) -> dict[str, object]:
    items = [record(number) for number in range(count)]
    types = []
    for name in ("locations", "pages", "posts", "services"):
        types.append({
            "name": name,
            "title": name.title(),
            "count": sum(item["type"] == name for item in items),
            "taxonomies": ["region", "tags"],
            "listing_url": f"/docs/{name}/",
        })
    return {
        "schema": "kujo-ssg-site-index/v1",
        "generated_by": {"name": "kujo-ssg", "version": "1.0.0"},
        "site": {"title": "Scale Fixture", "tagline": "Static content for humans and agents.", "url": "https://example.test/docs", "base_path": "/docs/", "language": "en"},
        "navigation": [{"label": "Home", "url": "/docs/"}],
        "content_types": types,
        "items": items,
    }


def milliseconds(samples: list[float]) -> float:
    return round(statistics.median(samples) * 1000, 3)


def measure(count: int) -> dict[str, object]:
    start = time.perf_counter()
    data = document(count)
    payload = (json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n").encode()
    generation_ms = (time.perf_counter() - start) * 1000

    reads, parses, searches, lists = [], [], [], []
    iterations = 7 if count <= 1_000 else 3
    for _ in range(iterations):
        start = time.perf_counter()
        copied = bytes(payload)
        reads.append(time.perf_counter() - start)

        start = time.perf_counter()
        parsed = json.loads(copied)
        parses.append(time.perf_counter() - start)

        start = time.perf_counter()
        query = "record 999"
        ranked = []
        for item in parsed["items"]:
            if not item["searchable"]:
                continue
            title = item["title"].casefold()
            haystack = " ".join((title, item["description"].casefold(), item["summary"].casefold()))
            if query in haystack:
                ranked.append(item["url"])
        ranked.sort()
        _ = ranked[:10]
        searches.append(time.perf_counter() - start)

        start = time.perf_counter()
        listed = sorted((item["url"] for item in parsed["items"] if item["type"] == "services"))[:10]
        _ = listed
        lists.append(time.perf_counter() - start)

    tracemalloc.start()
    _ = json.loads(payload)
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    return {
        "records": count,
        "raw_bytes": len(payload),
        "gzip_bytes": len(gzip.compress(payload, compresslevel=9, mtime=0)),
        "index_generation_ms": round(generation_ms, 3),
        "local_fetch_copy_ms": milliseconds(reads),
        "parse_ms": milliseconds(parses),
        "search_ms": milliseconds(searches),
        "list_ms": milliseconds(lists),
        "parse_peak_bytes": peak,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runtime", type=Path)
    args = parser.parse_args()
    result: dict[str, object] = {
        "schema": "kujo-webmcp-benchmark/v1",
        "environment": "CPython local desktop synthetic benchmark; not a browser-network measurement",
        "results": [measure(count) for count in (100, 1_000, 10_000)],
    }
    if args.runtime:
        runtime = args.runtime.read_bytes()
        result["runtime"] = {"bytes": len(runtime), "gzip_bytes": len(gzip.compress(runtime, compresslevel=9, mtime=0))}
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
