#!/usr/bin/env python3
"""Handle large DocGen JSON artifacts for the SSG bridge."""

from __future__ import annotations

import json
import hashlib
import sys
from pathlib import Path


def usage() -> int:
    print(
        "Usage:\n"
        "  docgen_reduce.py <project-json> <gaps-json> <reduced-project-json> <reduced-gaps-json>\n"
        "  docgen_reduce.py render <payload-json> <project-json> <gaps-json> <content-root> "
        "<source-link-template> <dry-run> <manifest-name> <manifest-schema> <docgen-schema> "
        "<allow-adapter-low-yield>",
        file=sys.stderr,
    )
    return 2


def symbol_for_bridge(symbol: dict) -> dict:
    return {
        "name": symbol.get("name", ""),
        "qualified_name": symbol.get("qualified_name", symbol.get("name", "")),
        "kind": symbol.get("kind", ""),
        "visibility": symbol.get("visibility", ""),
        "source_path": symbol.get("source_path", ""),
        "line": symbol.get("line", 0),
        "signature": symbol.get("signature"),
        "language": symbol.get("language", ""),
        "docs": symbol.get("docs", {"lines": [], "placeholder": True}),
        "examples": symbol.get("examples", []),
    }


def gap_for_bridge(gap: dict) -> dict:
    return {
        "symbol_name": gap.get("symbol_name", ""),
        "symbol_kind": gap.get("symbol_kind", ""),
        "source_path": gap.get("source_path", ""),
        "line": gap.get("line", 0),
        "missing_sections": gap.get("missing_sections", []),
    }


def bool_text(value: bool) -> str:
    return "true" if value else "false"


def yaml_quote(value: object) -> str:
    out = str(value).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    return f'"{out}"'


def fm_field(key: str, value: object) -> dict:
    return {"key": key, "value": value}


def frontmatter(fields: list[dict]) -> str:
    lines = ["---"]
    for field in fields:
        value = field["value"]
        if isinstance(value, bool):
            rendered = bool_text(value)
        elif isinstance(value, int):
            rendered = str(value)
        else:
            rendered = yaml_quote(value)
        lines.append(f"{field['key']}: {rendered}")
    lines.append("---")
    return "\n".join(lines) + "\n\n"


def repo_name(repo_path: object) -> str:
    base = Path(str(repo_path)).name
    return base or "repository"


def generated_fields(
    title: str,
    slug: str,
    description: str,
    payload: dict,
    docgen_schema: str,
    extra: list[dict],
) -> list[dict]:
    fields = [
        fm_field("title", title),
        fm_field("custom_url", slug),
        fm_field("description", description),
        fm_field("seo_title", title),
        fm_field("template", "docs"),
        fm_field("section", "Reference"),
        fm_field("audience", "developer"),
        fm_field("difficulty", "reference"),
        fm_field("status", "generated"),
        fm_field("version", "current"),
        fm_field("docgen_generated", True),
        fm_field("docgen_source_repo", repo_name(payload.get("file", ""))),
        fm_field("docgen_schema_version", docgen_schema),
    ]
    fields.extend(extra)
    return fields


def slug_preview(raw: object) -> str:
    text = "".join(ch.lower() if ch.isalnum() else "-" for ch in str(raw))
    while "--" in text:
        text = text.replace("--", "-")
    text = text.strip("-")
    return text or "item"


def stable_slug(raw: object, used: set[str]) -> str:
    base = slug_preview(raw)
    slug = base
    if slug in used:
        digest = hashlib.md5(str(raw).encode("utf-8")).hexdigest()[:8]
        slug = f"{base}-{digest}"
        counter = 2
        while slug in used:
            slug = f"{base}-{digest}-{counter}"
            counter += 1
    used.add(slug)
    return slug


def heading(title: object, level: int) -> str:
    return "#" * level + f" {title}\n\n"


def source_href(symbol: dict, template: str) -> str:
    if not template:
        return ""
    return template.replace("{path}", str(symbol.get("source_path", ""))).replace(
        "{line}", str(symbol.get("line", ""))
    )


def render_symbol(symbol: dict, source_link_template: str) -> str:
    title = str(symbol.get("qualified_name") or symbol.get("name") or "")
    docs = symbol.get("docs") or {"lines": [], "placeholder": True}
    out = heading(title, 3)
    out += f"- Kind: `{symbol.get('kind', '')}`\n"
    out += f"- Visibility: `{symbol.get('visibility', '')}`\n"
    out += f"- Source: `{symbol.get('source_path', '')}:{symbol.get('line', '')}`\n"
    href = source_href(symbol, source_link_template)
    if href:
        out += f"- Source link: [{href}]({href})\n"
    if symbol.get("signature") is not None:
        out += f"- Signature: `{symbol.get('signature')}`\n"
    out += "\n"

    doc_lines = docs.get("lines") or []
    if docs.get("placeholder") or not doc_lines:
        out += (
            "Documentation needed. This symbol was discovered from the source code, "
            "but no human-authored documentation was found.\n\n"
        )
    else:
        out += "\n".join(str(line) for line in doc_lines) + "\n\n"

    examples = symbol.get("examples") or []
    if examples:
        out += heading("Examples", 4)
        for example in examples:
            language = example.get("language") or symbol.get("language", "")
            out += f"```{language}\n{example.get('code', '')}\n```\n\n"
    return out


def count_undocumented(symbols: list[dict]) -> int:
    count = 0
    for symbol in symbols:
        docs = symbol.get("docs") or {}
        if docs.get("placeholder") or not docs.get("lines"):
            count += 1
    return count


def count_table(summary: dict) -> str:
    cache = summary.get("cache_stats") or {}
    return (
        "| Metric | Count |\n| --- | ---: |\n"
        f"| Items | {summary.get('item_count', 0)} |\n"
        f"| Project symbols | {summary.get('project_symbol_count', 0)} |\n"
        f"| Undocumented | {summary.get('undocumented_count', 0)} |\n"
        f"| Broken links | {summary.get('broken_link_count', 0)} |\n"
        f"| Warnings | {summary.get('warning_count', 0)} |\n"
        f"| Cache hits | {cache.get('hits', 0)} |\n"
        f"| Cache misses | {cache.get('misses', 0)} |\n\n"
    )


def generated_path(content_root: Path, entry: str) -> Path:
    if not isinstance(entry, str) or not entry or "\\" in entry or ":" in entry or any(part in ("", ".", "..") for part in entry.split("/")):
        raise SystemExit(f"manifest entry escapes generated root: {entry}")
    target = content_root
    for part in entry.split("/"):
        target = target / part
        if target.is_symlink():
            raise SystemExit(f"generated path must not be a symbolic link: {entry}")
    if not target.resolve().is_relative_to(content_root.resolve()):
        raise SystemExit(f"manifest entry escapes generated root: {entry}")
    return target


def write_markdown(file_path: Path, content: str, dry_run: bool) -> None:
    if dry_run:
        return
    if file_path.exists() and file_path.read_text(encoding="utf-8") == content:
        return
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")


def remove_stale(content_root: Path, manifest_name: str, new_files: list[str], dry_run: bool) -> None:
    manifest_path = generated_path(content_root, manifest_name)
    if not manifest_path.exists():
        return
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema_version") != "docgen-ssg-manifest/v1" or not isinstance(manifest.get("files", []), list):
        raise SystemExit("invalid DocGen SSG manifest")
    # Validate the whole previous manifest before deleting any file.
    targets = [(entry, generated_path(content_root, entry)) for entry in manifest.get("files", [])]
    for entry, target in targets:
        if entry not in new_files and target.exists() and not dry_run:
            target.unlink()


def render_bridge(argv: list[str]) -> int:
    if len(argv) != 12:
        return usage()
    _, _, payload_path, project_path, gaps_path, content_root_raw, source_link_template, dry_run_raw, manifest_name, manifest_schema, docgen_schema, allow_low_yield_raw = argv
    dry_run = dry_run_raw == "true"
    allow_low_yield = allow_low_yield_raw == "true"
    content_root = Path(content_root_raw)

    payload = json.loads(Path(payload_path).read_text(encoding="utf-8"))
    project = json.loads(Path(project_path).read_text(encoding="utf-8"))
    gaps = json.loads(Path(gaps_path).read_text(encoding="utf-8"))
    if not allow_low_yield:
        for diagnostic in project.get("diagnostics", []):
            if diagnostic.get("code") == "DOCGEN_ADAPTER_LOW_YIELD":
                raise SystemExit("DocGen emitted DOCGEN_ADAPTER_LOW_YIELD")

    summary = payload["summary"]
    symbols = [symbol_for_bridge(symbol) for symbol in project.get("symbols", [])]
    languages = sorted(project.get("languages", []))
    used: set[str] = set()
    pages: dict[str, str] = {}

    overview_slug = stable_slug("api-reference", used)
    overview = frontmatter(
        generated_fields(
            "API Reference",
            overview_slug,
            "Generated API documentation from Kujo DocGen.",
            payload,
            docgen_schema,
            [
                fm_field("docgen_symbol_count", summary.get("project_symbol_count", 0)),
                fm_field("docgen_undocumented_count", summary.get("undocumented_count", 0)),
            ],
        )
    )
    overview += heading("API Reference", 1)
    overview += "Generated from Kujo DocGen output.\n\n"
    overview += count_table(summary)
    overview += heading("Languages", 2)
    for language in languages:
        overview += f"- [{language}](./language-{slug_preview(language)}/)\n"
    pages[f"{overview_slug}.md"] = overview + "\n"

    for language in languages:
        language_symbols = [symbol for symbol in symbols if symbol.get("language") == language]
        slug = stable_slug(f"language-{language}", used)
        body = frontmatter(
            generated_fields(
                f"{language} API",
                slug,
                f"Generated {language} API documentation.",
                payload,
                docgen_schema,
                [
                    fm_field("docgen_language", language),
                    fm_field("docgen_symbol_count", len(language_symbols)),
                ],
            )
        )
        body += heading(f"{language} API", 1)
        body += f"Symbols: {len(language_symbols)}\n\n"
        for symbol in language_symbols:
            body += render_symbol(symbol, source_link_template)
        pages[f"{slug}.md"] = body

    by_module: dict[str, list[dict]] = {}
    for symbol in symbols:
        by_module.setdefault(str(symbol.get("source_path", "")), []).append(symbol)
    for module_path in sorted(by_module):
        module_symbols = by_module[module_path]
        slug = stable_slug(f"module-{module_path}", used)
        body = frontmatter(
            generated_fields(
                module_path,
                slug,
                f"Generated API documentation for {module_path}.",
                payload,
                docgen_schema,
                [
                    fm_field("docgen_source_path", module_path),
                    fm_field("docgen_symbol_count", len(module_symbols)),
                    fm_field("docgen_undocumented_count", count_undocumented(module_symbols)),
                ],
            )
        )
        body += heading(module_path, 1)
        body += f"Symbols: {len(module_symbols)}\n\n"
        for symbol in module_symbols:
            body += render_symbol(symbol, source_link_template)
        pages[f"{slug}.md"] = body

    gaps_slug = stable_slug("documentation-gaps", used)
    gap_body = frontmatter(
        generated_fields(
            "Documentation Gaps",
            gaps_slug,
            "Generated documentation gaps from Kujo DocGen.",
            payload,
            docgen_schema,
            [fm_field("docgen_undocumented_count", summary.get("undocumented_count", 0))],
        )
    )
    gap_body += heading("Documentation Gaps", 1)
    if not gaps:
        gap_body += "No documentation gaps were reported.\n"
    else:
        for gap in gaps:
            reduced_gap = gap_for_bridge(gap)
            gap_body += heading(reduced_gap["symbol_name"], 2)
            gap_body += f"- Kind: `{reduced_gap['symbol_kind']}`\n"
            gap_body += f"- Source: `{reduced_gap['source_path']}:{reduced_gap['line']}`\n"
            gap_body += f"- Missing: `{', '.join(reduced_gap['missing_sections'])}`\n\n"
    pages[f"{gaps_slug}.md"] = gap_body

    files = sorted(pages)
    manifest_path = generated_path(content_root, manifest_name)
    targets = {filename: generated_path(content_root, filename) for filename in files}
    remove_stale(content_root, manifest_name, files, dry_run)
    for filename in files:
        write_markdown(targets[filename], pages[filename], dry_run)

    manifest = {
        "schema_version": manifest_schema,
        "docgen_schema_version": docgen_schema,
        "source_repo": payload.get("file", ""),
        "files": files,
        "summary": {
            "item_count": summary.get("item_count", 0),
            "project_symbol_count": summary.get("project_symbol_count", 0),
            "undocumented_count": summary.get("undocumented_count", 0),
            "broken_link_count": summary.get("broken_link_count", 0),
            "warning_count": summary.get("warning_count", 0),
            "languages": summary.get("languages", []),
        },
    }
    if not dry_run:
        content_root.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=True) + "\n",
            encoding="utf-8",
        )
    print(json.dumps({"files": files}, separators=(",", ":")))
    return 0


def reduce_only(argv: list[str]) -> int:
    if len(argv) != 5:
        return usage()
    project_path = Path(argv[1])
    gaps_path = Path(argv[2])
    reduced_project_path = Path(argv[3])
    reduced_gaps_path = Path(argv[4])

    with project_path.open("r", encoding="utf-8") as handle:
        project = json.load(handle)
    with gaps_path.open("r", encoding="utf-8") as handle:
        gaps = json.load(handle)

    reduced_project = {
        "name": project.get("name", ""),
        "root": project.get("root", ""),
        "languages": project.get("languages", []),
        "symbols": [symbol_for_bridge(symbol) for symbol in project.get("symbols", [])],
        "diagnostics": project.get("diagnostics", []),
    }
    reduced_gaps = [gap_for_bridge(gap) for gap in gaps]

    reduced_project_path.parent.mkdir(parents=True, exist_ok=True)
    reduced_gaps_path.parent.mkdir(parents=True, exist_ok=True)
    with reduced_project_path.open("w", encoding="utf-8") as handle:
        json.dump(reduced_project, handle, ensure_ascii=True, separators=(",", ":"))
        handle.write("\n")
    with reduced_gaps_path.open("w", encoding="utf-8") as handle:
        json.dump(reduced_gaps, handle, ensure_ascii=True, separators=(",", ":"))
        handle.write("\n")

    return 0


def main(argv: list[str]) -> int:
    if len(argv) > 1 and argv[1] == "render":
        return render_bridge(argv)
    return reduce_only(argv)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
