#!/usr/bin/env python3
"""Bounded, deterministic SSG Ability helper. It never executes user commands."""

from __future__ import annotations

import hashlib
import json
import os
import posixpath
import re
import sys
import tarfile
from pathlib import Path

MAX_FILES = 10_000
MAX_ENTRIES = 20_000
MAX_DETAILS = 200
MAX_SOURCE_BYTES = 2 * 1024 * 1024
MAX_OUTPUT_FILE_BYTES = 64 * 1024 * 1024
MAX_OUTPUT_TOTAL_BYTES = 512 * 1024 * 1024
HASH_CHUNK_BYTES = 1024 * 1024
LINK_RE = re.compile(r'''(?:href|src)=["']([^"'#?]+)''', re.IGNORECASE)


def fail(code: str, message: str, details: list[str] | None = None) -> None:
    print(json.dumps({"ok": False, "code": code, "message": message, "details": (details or [])[:MAX_DETAILS]}, separators=(",", ":")))
    raise SystemExit(1)


def safe_path(root: Path, raw: str, *, invalid_code: str = "invalid_relative_path", symlink_code: str = "symlink_not_allowed") -> Path:
    if not raw or len(raw) > 1024 or raw.startswith(("/", "\\")) or "\\" in raw or ":" in raw or any(part in ("", ".", "..") for part in raw.split("/")):
        fail(invalid_code, "Path must be a contained relative path")
    candidate = root
    for part in raw.split("/"):
        candidate = candidate / part
        if candidate.is_symlink():
            fail(symlink_code, "SSG Ability paths must not be symbolic links")
    try:
        candidate.resolve(strict=False).relative_to(root)
    except ValueError:
        fail("path_escape", "Path must remain inside the SSG repository")
    return candidate


def safe_dir(root: Path, raw: str) -> Path:
    candidate = safe_path(root, raw)
    if not candidate.is_dir():
        fail("invalid_directory", "Path must name a contained regular directory")
    return candidate


def files_under(directory: Path, suffixes: tuple[str, ...] | None = None) -> list[Path]:
    files: list[Path] = []
    pending = [directory]
    entries_seen = 0
    files_seen = 0
    while pending:
        with os.scandir(pending.pop()) as entries:
            for entry in entries:
                entries_seen += 1
                if entries_seen > MAX_ENTRIES:
                    fail("entry_limit_exceeded", "SSG Ability scan exceeded its directory-entry limit")
                path = Path(entry.path)
                if entry.is_symlink():
                    fail("symlink_not_allowed", "SSG Ability inputs must not contain symbolic links", [str(path.relative_to(directory))])
                if entry.is_dir(follow_symlinks=False):
                    pending.append(path)
                elif entry.is_file(follow_symlinks=False):
                    files_seen += 1
                    if files_seen > MAX_FILES:
                        fail("file_limit_exceeded", "SSG Ability scan exceeded its file limit")
                    if suffixes is None or path.suffix.lower() in suffixes:
                        files.append(path)
                else:
                    fail("invalid_file_type", "SSG Ability inputs must contain only regular files and directories", [str(path.relative_to(directory))])
    return sorted(files)


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(HASH_CHUNK_BYTES):
            digest.update(chunk)
    return digest.hexdigest()


def source_list(root: Path) -> dict:
    content = safe_dir(root, "content")
    records = []
    for path in files_under(content, (".md", ".markdown"))[:MAX_DETAILS]:
        records.append({"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size})
    return {"operation": "source_list", "count": len(records), "details": records}


def source_validate(root: Path) -> dict:
    content = safe_dir(root, "content")
    errors: list[str] = []
    scanned = 0
    for path in files_under(content, (".md", ".markdown")):
        scanned += 1
        relative = path.relative_to(root).as_posix()
        size = path.stat().st_size
        if size > MAX_SOURCE_BYTES:
            errors.append(f"{relative}: exceeds {MAX_SOURCE_BYTES} bytes")
            continue
        text = path.read_text(encoding="utf-8")
        if text.startswith("---\n") and "\n---\n" not in text[4:]:
            errors.append(f"{relative}: unterminated frontmatter")
        if "\x00" in text:
            errors.append(f"{relative}: contains a NUL byte")
        if len(errors) >= MAX_DETAILS:
            break
    if errors:
        fail("source_content_invalid", "Source content validation failed", errors)
    return {"operation": "source_validate", "scanned": scanned, "error_count": 0, "details": []}


def output_manifest(root: Path, raw: str, *, include_hashes: bool = True) -> tuple[Path, list[dict]]:
    output = safe_dir(root, raw)
    records = []
    total_bytes = 0
    for path in files_under(output):
        relative = path.relative_to(output).as_posix()
        size = path.stat().st_size
        if size > MAX_OUTPUT_FILE_BYTES:
            fail("file_size_limit_exceeded", f"Generated output file exceeds {MAX_OUTPUT_FILE_BYTES} bytes", [relative])
        total_bytes += size
        if total_bytes > MAX_OUTPUT_TOTAL_BYTES:
            fail("total_size_limit_exceeded", f"Generated output exceeds {MAX_OUTPUT_TOTAL_BYTES} bytes", [relative])
        record = {"path": relative, "bytes": size}
        if include_hashes:
            record["sha256"] = hash_file(path)
        records.append(record)
    return output, records


def output_inspect(root: Path, raw: str) -> dict:
    output, records = output_manifest(root, raw, include_hashes=False)
    paths = {record["path"] for record in records}
    html_paths = sorted(path for path in paths if path.endswith(".html"))
    routes = []
    broken = []
    broken_count = 0
    metadata_errors = []
    for relative in html_paths:
        route = "/" if relative == "index.html" else "/" + relative.removesuffix("index.html")
        routes.append(route)
        text = (output / relative).read_text(encoding="utf-8", errors="replace")
        if (relative == "index.html" or relative == "404.html" or relative.endswith("/index.html")) and "<title>" not in text.lower():
            metadata_errors.append(f"{relative}: missing title")
        for match in LINK_RE.finditer(text):
            link = match.group(1)
            if link.startswith(("http://", "https://", "//", "mailto:", "tel:", "data:")):
                continue
            directory_link = link.endswith("/")
            target = link.lstrip("/") if link.startswith("/") else posixpath.normpath(posixpath.join(posixpath.dirname(relative), link))
            if not target:
                target = "index.html"
            elif directory_link:
                target = target.rstrip("/") + "/index.html"
            if target not in paths:
                broken_count += 1
                if len(broken) < MAX_DETAILS:
                    broken.append(f"{relative} -> {link}")
    aux = {name: name in paths for name in ("sitemap.xml", "feed/index.xml", "robots.txt", "llms.txt")}
    details = ([f"broken:{item}" for item in broken] + [f"metadata:{item}" for item in metadata_errors] + [f"route:{route}" for route in routes])[:MAX_DETAILS]
    return {"operation": "output_inspect", "file_count": len(records), "route_count": len(routes), "broken_link_count": broken_count, "metadata_error_count": len(metadata_errors), "aux": aux, "details": details}


def output_compare(root: Path, left_raw: str, right_raw: str) -> dict:
    _, left = output_manifest(root, left_raw)
    _, right = output_manifest(root, right_raw)
    left_map = {item["path"]: item["sha256"] for item in left}
    right_map = {item["path"]: item["sha256"] for item in right}
    changed = sorted(path for path in left_map.keys() | right_map.keys() if left_map.get(path) != right_map.get(path))
    return {"operation": "output_compare", "identical": not changed, "left_count": len(left), "right_count": len(right), "changed_count": len(changed), "details": changed[:MAX_DETAILS]}


def readiness(root: Path, raw: str) -> dict:
    report = output_inspect(root, raw)
    missing = [name for name, exists in report["aux"].items() if not exists]
    details = ([item for item in report["details"] if item.startswith(("broken:", "metadata:"))] + [f"missing:{name}" for name in missing])[:MAX_DETAILS]
    ready = report["broken_link_count"] == 0 and report["metadata_error_count"] == 0 and not missing
    return {"operation": "deployment_readiness", "ready": ready, "file_count": report["file_count"], "route_count": report["route_count"], "issue_count": report["broken_link_count"] + report["metadata_error_count"] + len(missing), "details": details}


def export_artifact(root: Path, output_raw: str, artifact_raw: str) -> dict:
    output, records = output_manifest(root, output_raw, include_hashes=False)
    if not artifact_raw.endswith(".tar"):
        fail("invalid_artifact_path", "Artifact path must end in .tar")
    artifact = safe_path(root, artifact_raw, invalid_code="invalid_artifact_path", symlink_code="invalid_artifact_path")
    try:
        artifact.relative_to(output)
        fail("invalid_artifact_path", "Artifact destination must be outside the exported output tree")
    except ValueError:
        pass
    if artifact.exists():
        fail("artifact_exists", "Artifact destination must not already exist")
    artifact.parent.mkdir(parents=True, exist_ok=True)
    # Opening exclusively keeps pre-existing files and hardlinks untouched.
    # Remove only the archive we created if a source/read/write fails midway.
    with artifact.open("xb") as destination:
        try:
            with tarfile.open(fileobj=destination, mode="w", format=tarfile.PAX_FORMAT) as archive:
                for record in records:
                    path = output / record["path"]
                    info = archive.gettarinfo(str(path), arcname=record["path"])
                    info.mtime = 0
                    info.uid = info.gid = 0
                    info.uname = info.gname = ""
                    with path.open("rb") as handle:
                        archive.addfile(info, handle)
        except (OSError, tarfile.TarError):
            artifact.unlink()
            raise
    artifact_size = artifact.stat().st_size
    return {"operation": "artifact_export", "artifact": artifact.relative_to(root).as_posix(), "file_count": len(records), "bytes": artifact_size, "sha256": hash_file(artifact), "details": []}


def main() -> None:
    if len(sys.argv) < 2:
        fail("missing_operation", "An SSG Ability helper operation is required")
    root = Path.cwd().resolve()
    operation = sys.argv[1]
    if operation == "source-list" and len(sys.argv) == 2:
        result = source_list(root)
    elif operation == "source-validate" and len(sys.argv) == 2:
        result = source_validate(root)
    elif operation == "output-inspect" and len(sys.argv) == 3:
        result = output_inspect(root, sys.argv[2])
    elif operation == "output-compare" and len(sys.argv) == 4:
        result = output_compare(root, sys.argv[2], sys.argv[3])
    elif operation == "readiness" and len(sys.argv) == 3:
        result = readiness(root, sys.argv[2])
    elif operation == "export" and len(sys.argv) == 4:
        result = export_artifact(root, sys.argv[2], sys.argv[3])
    else:
        fail("invalid_operation", "SSG Ability helper arguments are invalid")
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, UnicodeError) as error:
        fail("filesystem_error", "SSG Ability filesystem operation failed", [type(error).__name__])
