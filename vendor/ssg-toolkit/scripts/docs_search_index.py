#!/usr/bin/env python3
"""Generate the docs search index for large local-first docs sites."""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path


def clean_slug(raw: object) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", str(raw).lower()).strip("-")
    return text or "untitled"


def parse_scalar(value: str) -> object:
    text = value.strip()
    if text.lower() in {"true", "yes"}:
        return True
    if text.lower() in {"false", "no"}:
        return False
    if len(text) >= 2 and text[0] == text[-1] == '"':
        return text[1:-1].replace('\\"', '"').replace("\\n", "\n")
    if len(text) >= 2 and text[0] == text[-1] == "'":
        return text[1:-1]
    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, list) else text
        except json.JSONDecodeError:
            return text
    return text


def parse_frontmatter(content: str) -> tuple[dict, str]:
    meta = {
        "title": "",
        "description": "",
        "custom_url": "",
        "section": "",
        "audience": "",
        "difficulty": "",
        "status": "",
        "version": "",
        "tags": [],
        "draft": False,
        "search_exclude": False,
    }
    lines = content.splitlines()
    if lines and lines[0].strip() == "---":
        for idx in range(1, len(lines)):
            if lines[idx].strip() == "---":
                for line in lines[1:idx]:
                    if ":" not in line:
                        continue
                    key, value = line.split(":", 1)
                    meta[key.strip()] = parse_scalar(value)
                return meta, "\n".join(lines[idx + 1 :]).strip()
    return meta, content.strip()


def to_string_array(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    text = str(value).strip()
    return [text] if text else []


def strip_markdown(markdown: str) -> str:
    text = re.sub(r"```[\s\S]*?```", " ", markdown)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"[#*_>\[\]()`]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def route_for(content_root: Path, file_path: Path, meta: dict) -> str:
    rel = file_path.relative_to(content_root)
    parts = rel.parts
    slug = clean_slug(rel.stem)
    if str(meta.get("custom_url", "")).strip():
        override = clean_slug(meta["custom_url"])
        if override != "untitled":
            slug = override
    if len(parts) >= 2 and parts[0] != "pages":
        return f"{clean_slug(parts[0])}/{slug}/"
    return f"{slug}/"


def first_headings(markdown: str) -> list[str]:
    headings = []
    for line in markdown.splitlines():
        clean = re.sub(r"^#+\s*", "", line.strip())
        if line.lstrip().startswith("#") and clean:
            headings.append(clean)
    return headings


def markdown_files(content_root: Path) -> list[Path]:
    files = []
    for directory, directories, names in os.walk(content_root, followlinks=False):
        parent = Path(directory)
        directories[:] = sorted(name for name in directories if not name.startswith(".") and not (parent / name).is_symlink())
        for name in names:
            path = parent / name
            if name.startswith(".") or path.suffix != ".md":
                continue
            if path.is_symlink():
                print(f"Warning: Skipped symlink while scanning docs content: {path}")
            elif path.is_file():
                files.append(path)
    return sorted(files)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--content", default="content")
    parser.add_argument("--output", default="assets/js/docs-search-index.json")
    parser.add_argument("--site-url", default="")
    parser.add_argument("--base-route", default="")
    args = parser.parse_args()

    content_root = Path(args.content)
    output_path = Path(args.output)
    site_url = args.site_url.rstrip("/")
    base_route = clean_slug(args.base_route) if args.base_route else ""
    if base_route == "untitled":
        base_route = ""

    entries = []
    for file_path in markdown_files(content_root):
        meta, body = parse_frontmatter(file_path.read_text(encoding="utf-8"))
        if bool(meta.get("draft")) or bool(meta.get("search_exclude")):
            continue
        title = str(meta.get("title") or "").strip() or file_path.stem
        route = route_for(content_root, file_path, meta)
        if base_route:
            route = f"{base_route}/{route}"
        url = f"/{route}" if not site_url else f"{site_url}/{route}"
        text = strip_markdown(body)[:360]
        entries.append(
            {
                "title": title,
                "description": str(meta.get("description") or "").strip(),
                "url": url,
                "route": route,
                "section": str(meta.get("section") or "").strip(),
                "audience": str(meta.get("audience") or "").strip(),
                "difficulty": str(meta.get("difficulty") or "").strip(),
                "status": str(meta.get("status") or "").strip(),
                "version": str(meta.get("version") or "").strip(),
                "tags": to_string_array(meta.get("tags", [])),
                "headings": first_headings(body),
                "text": text,
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps({"schema_version": "kujo-docs-search/v1", "items": entries}, indent=2) + "\n",
        encoding="utf-8",
    )
    print("Docs search index generated")
    print(f"  Output: {output_path}")
    print(f"  Items: {len(entries)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
