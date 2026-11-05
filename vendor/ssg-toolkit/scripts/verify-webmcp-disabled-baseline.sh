#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUJO_BIN="${KUJO_BIN:-kujo}"
BASELINE="$REPO_ROOT/tests/fixtures/webmcp-disabled-baseline.txt"
TEMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEMP_ROOT"' EXIT

sha256_stream() {
	if command -v shasum >/dev/null 2>&1; then
		shasum -a 256
	else
		sha256sum
	fi
}

tree_fingerprint() {
	local base="$1"
	local count bytes digest file size
	count="$(find "$base" -type f | wc -l | tr -d ' ')"
	bytes=0
	while IFS= read -r -d '' file; do
		if size="$(stat -f '%z' "$file" 2>/dev/null)"; then
			:
		else
			size="$(stat -c '%s' "$file")"
		fi
		bytes=$((bytes + size))
	done < <(find "$base" -type f -print0)
	digest="$(find "$base" -type f | sed "s#^$base/##" | LC_ALL=C sort | while IFS= read -r relative; do
		file_hash="$(sha256_stream < "$base/$relative" | awk '{print $1}')"
		printf '%s  %s\n' "$file_hash" "$relative"
	done | sha256_stream | awk '{print $1}')"
	printf 'files=%s bytes=%s sha256=%s' "$count" "$bytes" "$digest"
}

build_and_check() {
	local name="$1"
	shift
	local output="$TEMP_ROOT/$name"
	"$KUJO_BIN" run "$REPO_ROOT/build.kujo" -- --output "$output" --no-webmcp "$@" >/dev/null
	local actual expected
	actual="$(tree_fingerprint "$output")"
	expected="$(awk -v name="$name" '$1 == name {sub("^" name " ", ""); print; exit}' "$BASELINE")"
	if [[ "$actual" != "$expected" ]]; then
		echo "FAIL disabled baseline $name"
		echo "  expected: $expected"
		echo "  actual:   $actual"
		exit 1
	fi
	echo "PASS disabled baseline $name"
}

cd "$REPO_ROOT"
build_and_check normal
build_and_check minified --minify
build_and_check no-aux --no-aux
build_and_check no-index --no-index
build_and_check posts-root --posts-at-root

KUJO_BIN="$KUJO_BIN" bash scripts/build-parallel.sh 2 2 --output "$TEMP_ROOT/parallel" --no-webmcp >/dev/null
parallel_actual="$(tree_fingerprint "$TEMP_ROOT/parallel")"
parallel_expected="$(awk '$1 == "parallel" {sub("^parallel ", ""); print; exit}' "$BASELINE")"
if [[ "$parallel_actual" != "$parallel_expected" ]]; then
	echo "FAIL disabled baseline parallel"
	echo "  expected: $parallel_expected"
	echo "  actual:   $parallel_actual"
	exit 1
fi
echo "PASS disabled baseline parallel"
echo "WebMCP-disabled frozen baseline verified"
