#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUJO_BIN="${KUJO_BIN:-kujo}"

source "$REPO_ROOT/scripts/test_helpers.sh"

write_fixture() {
	local fixture_dir="$1"

	cat > "$fixture_dir/project.json" <<'JSON'
{
  "name": "fixture-repo",
  "root": "/fixture/repo",
  "languages": ["kujo"],
  "modules": [
    {
      "name": "math",
      "language": "kujo",
      "path": "src/math.kujo",
      "symbols": ["kujo:src/math.kujo:add", "kujo:src/math.kujo:missing"]
    }
  ],
  "symbols": [
    {
      "id": "kujo:src/math.kujo:add",
      "language": "kujo",
      "kind": "Function",
      "name": "add",
      "qualified_name": "math::add",
      "signature": "pub func add(a, b)",
      "visibility": "Public",
      "source_path": "src/math.kujo",
      "line": 4,
      "docs": {
        "lines": ["Adds two numbers."],
        "summary": "Adds two numbers.",
        "placeholder": false
      },
      "examples": [{"language": "kujo", "code": "add(1, 2)"}],
      "gaps": [],
      "parent": null
    },
    {
      "id": "kujo:src/math.kujo:missing",
      "language": "kujo",
      "kind": "Function",
      "name": "missing",
      "qualified_name": "math::missing",
      "signature": "pub func missing(value)",
      "visibility": "Public",
      "source_path": "src/math.kujo",
      "line": 9,
      "docs": {
        "lines": [],
        "summary": null,
        "placeholder": true
      },
      "examples": [],
      "gaps": ["MissingDocs"],
      "parent": null
    }
  ],
  "gaps": [],
  "diagnostics": []
}
JSON

	cat > "$fixture_dir/gaps.json" <<'JSON'
[
  {
    "id": "gap-missing",
    "language": "kujo",
    "symbol_id": "kujo:src/math.kujo:missing",
    "symbol_name": "math::missing",
    "symbol_kind": "Function",
    "signature": "pub func missing(value)",
    "source_path": "src/math.kujo",
    "line": 9,
    "missing_sections": ["MissingDocs"],
    "existing_docs": [],
    "bounded_source_context": ["pub func missing(value)"],
    "known_call_sites": [],
    "suggested_ai_prompt": "Document math::missing using only the provided context."
  }
]
JSON

	cat > "$fixture_dir/payload.json" <<JSON
{
  "command": "docgen",
  "file": "/fixture/repo",
  "output_dir": "$fixture_dir",
  "module_doc_path": "$fixture_dir/index.html",
  "builtin_doc_path": null,
  "item_count": 2,
  "project_symbol_count": 2,
  "builtin_symbol_count": 0,
  "symbol_kind_counts": {"function": 2},
  "languages": ["kujo"],
  "project_json_path": "$fixture_dir/project.json",
  "gaps_json_path": "$fixture_dir/gaps.json",
  "capabilities_json_path": "$fixture_dir/docgen-capabilities.json",
  "ai_tasks_path": "$fixture_dir/docgen-ai-tasks.md",
  "diagnostics_count": 0,
  "undocumented_count": 1,
  "broken_link_count": 0,
  "warning_count": 0,
  "adapter_health": {
    "kujo": {
      "files_scanned": 1,
      "symbols_extracted": 2,
      "doc_blocks_attached": 1,
      "placeholders_emitted": 1
    }
  },
  "cache_stats": {"hits": 3, "misses": 1},
  "discovery_limits": {"max_file_size_bytes": 2097152, "max_depth": 64, "max_files": 20000},
  "discovery_skip_counts": {"invalid_encoding": 0, "max_depth": 0, "max_file_size": 0, "max_files": 0},
  "link_validation_skip_counts": {"max_external_checks": 0, "max_link_checks": 0, "max_total_time": 0},
  "gate_failures": [],
  "summary": {
    "schema_version": "docgen-summary/v1",
    "item_count": 2,
    "project_symbol_count": 2,
    "builtin_symbol_count": 0,
    "symbol_kind_counts": {"function": 2},
    "diagnostics_count": 0,
    "undocumented_count": 1,
    "broken_link_count": 0,
    "warning_count": 0,
    "adapter_health": {
      "kujo": {
        "files_scanned": 1,
        "symbols_extracted": 2,
        "doc_blocks_attached": 1,
        "placeholders_emitted": 1
      }
    },
    "cache_stats": {"hits": 3, "misses": 1},
    "discovery_limits": {"max_file_size_bytes": 2097152, "max_depth": 64, "max_files": 20000},
    "discovery_skip_counts": {"invalid_encoding": 0, "max_depth": 0, "max_file_size": 0, "max_files": 0},
    "link_validation_skip_counts": {"max_external_checks": 0, "max_link_checks": 0, "max_total_time": 0},
    "gate_failures_count": 0,
    "gate_failed": false,
    "languages": ["kujo"]
  }
}
JSON
}

main() {
	local temp_dir
	temp_dir="$(mktemp -d)"
	trap "rm -rf '$temp_dir'" EXIT

	setup_temp_site "$REPO_ROOT" "$temp_dir"
	mkdir -p "$temp_dir/scripts"
	cp "$REPO_ROOT/scripts/docgen_reduce.py" "$temp_dir/scripts/docgen_reduce.py"
	write_fixture "$temp_dir"

	run_expect_success "$KUJO_BIN" run "$REPO_ROOT/scripts/docgen_ssg_bridge.kujo" -- \
		--ssg-root "$temp_dir" \
		--docgen-payload "$temp_dir/payload.json" \
		--content-out content/reference \
		--source-link-template 'https://example.com/blob/main/{path}#L{line}' \
		--max-undocumented 1 \
		--skip-build \
		--skip-validation

	assert_output_contains "DocGen SSG bridge complete"
	assert_output_contains "project_symbol_count: 2"
	assert_path_exists "$temp_dir/content/reference/api-reference.md"
	assert_path_exists "$temp_dir/content/reference/language-kujo.md"
	assert_path_exists "$temp_dir/content/reference/module-src-math-kujo.md"
	assert_path_exists "$temp_dir/content/reference/documentation-gaps.md"
	assert_path_exists "$temp_dir/content/reference/.docgen-ssg-manifest.json"
	assert_file_contains "$temp_dir/content/reference/api-reference.md" 'docgen_generated: true'
	assert_file_contains "$temp_dir/content/reference/api-reference.md" 'docgen_schema_version: "docgen-summary/v1"'
	assert_file_contains "$temp_dir/content/reference/module-src-math-kujo.md" '### math::add'
	assert_file_contains "$temp_dir/content/reference/module-src-math-kujo.md" 'Adds two numbers.'
	assert_file_contains "$temp_dir/content/reference/module-src-math-kujo.md" 'https://example.com/blob/main/src/math.kujo#L4'
	assert_file_contains "$temp_dir/content/reference/module-src-math-kujo.md" 'Documentation needed.'
	assert_file_contains "$temp_dir/content/reference/documentation-gaps.md" 'Document math::missing'

	run_expect_success "$KUJO_BIN" run "$REPO_ROOT/scripts/docgen_ssg_bridge.kujo" -- \
		--ssg-root "$temp_dir" \
		--docgen-payload "$temp_dir/payload.json" \
		--content-out content/reference \
		--include-private \
		--include-builtins \
		--max-undocumented 1 \
		--skip-build \
		--skip-validation
	assert_file_contains "$temp_dir/content/reference/api-reference.md" 'docgen_symbol_count: 2'

	python3 - "$temp_dir/project.json" "$temp_dir/gaps.json" <<'PY'
import json
import sys

project_path, gaps_path = sys.argv[1], sys.argv[2]
with open(project_path, "r", encoding="utf-8") as handle:
    project = json.load(handle)
project["symbols"][0]["internal_large_field"] = "x" * (9 * 1024 * 1024)
with open(project_path, "w", encoding="utf-8") as handle:
    json.dump(project, handle)
with open(gaps_path, "r", encoding="utf-8") as handle:
    gaps = json.load(handle)
gaps[0]["suggested_ai_prompt"] = "x" * (9 * 1024 * 1024)
with open(gaps_path, "w", encoding="utf-8") as handle:
    json.dump(gaps, handle)
PY
	run_expect_success "$KUJO_BIN" run "$REPO_ROOT/scripts/docgen_ssg_bridge.kujo" -- \
		--ssg-root "$temp_dir" \
		--docgen-payload "$temp_dir/payload.json" \
		--content-out content/reference \
		--source-link-template 'https://example.com/blob/main/{path}#L{line}' \
		--max-undocumented 1 \
		--skip-build \
		--skip-validation
	assert_file_contains "$temp_dir/content/reference/module-src-math-kujo.md" '### math::add'

	local first_hash
	local second_hash
	first_hash="$(find "$temp_dir/content/reference" -type f -print0 | sort -z | xargs -0 shasum)"
	run_expect_success "$KUJO_BIN" run "$REPO_ROOT/scripts/docgen_ssg_bridge.kujo" -- \
		--ssg-root "$temp_dir" \
		--docgen-payload "$temp_dir/payload.json" \
		--content-out content/reference \
		--source-link-template 'https://example.com/blob/main/{path}#L{line}' \
		--max-undocumented 1 \
		--skip-build \
		--skip-validation
	second_hash="$(find "$temp_dir/content/reference" -type f -print0 | sort -z | xargs -0 shasum)"
	if [[ "$first_hash" != "$second_hash" ]]; then
		echo "FAIL bridge output should be deterministic across identical runs"
		exit 1
	fi

	echo "stale" > "$temp_dir/content/reference/stale.md"
	cat > "$temp_dir/content/reference/.docgen-ssg-manifest.json" <<'JSON'
{
  "schema_version": "docgen-ssg-manifest/v1",
  "files": ["stale.md"]
}
JSON
	run_expect_success "$KUJO_BIN" run "$REPO_ROOT/scripts/docgen_ssg_bridge.kujo" -- \
		--ssg-root "$temp_dir" \
		--docgen-payload "$temp_dir/payload.json" \
		--content-out content/reference \
		--max-undocumented 1 \
		--skip-build \
		--skip-validation
	assert_path_missing "$temp_dir/content/reference/stale.md"

	run_expect_failure "$KUJO_BIN" run "$REPO_ROOT/scripts/docgen_ssg_bridge.kujo" -- \
		--ssg-root "$temp_dir" \
		--docgen-payload "$temp_dir/payload.json" \
		--content-out content/reference \
		--max-undocumented 0 \
		--skip-build \
		--skip-validation
	assert_output_contains "undocumented_count=1 exceeds 0"

	run_expect_failure "$KUJO_BIN" run "$REPO_ROOT/scripts/docgen_ssg_bridge.kujo" -- \
		--ssg-root "$temp_dir" \
		--docgen-payload "$temp_dir/payload.json" \
		--content-out ../escaped \
		--max-undocumented 1 \
		--skip-build \
		--skip-validation
	assert_output_contains "must stay under SSG root"

	cp "$temp_dir/payload.json" "$temp_dir/bad-payload.json"
	perl -0pi -e 's#docgen-summary/v1#wrong#' "$temp_dir/bad-payload.json"
	run_expect_failure "$KUJO_BIN" run "$REPO_ROOT/scripts/docgen_ssg_bridge.kujo" -- \
		--ssg-root "$temp_dir" \
		--docgen-payload "$temp_dir/bad-payload.json" \
		--content-out content/reference \
		--skip-build \
		--skip-validation
	assert_output_contains "DocGen summary schema mismatch"

	echo "DocGen SSG bridge contract passed"
}

main "$@"
