#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

extract_version() {
	local version_line
	version_line="$(grep -E '^VERSION := "' "$REPO_ROOT/build.kujo" | head -n 1 || true)"
	if [[ -z "$version_line" ]]; then
		echo "ERROR: could not find VERSION declaration in build.kujo"
		exit 1
	fi
	printf '%s\n' "$version_line" | cut -d '"' -f 2
}

resolve_verified_kujo_bin() {
	if [[ -n "${KUJO_BIN:-}" ]]; then
		printf '%s\n' "$KUJO_BIN"
		return
	fi

	local runtime_dir="${KUJO_RUNTIME_DIR:-}"
	if [[ -z "$runtime_dir" && -f "$REPO_ROOT/../kujo/Cargo.toml" ]]; then
		runtime_dir="$REPO_ROOT/../kujo"
	fi
	if [[ -n "$runtime_dir" && -x "$runtime_dir/target/debug/kujo" ]]; then
		printf '%s\n' "$runtime_dir/target/debug/kujo"
		return
	fi
	if command -v kujo >/dev/null 2>&1; then
		command -v kujo
		return
	fi

	echo "ERROR: could not resolve the Kujo runtime used by the CI gate" >&2
	exit 1
}

main() {
	local version
	version="$(extract_version)"

	cd "$REPO_ROOT"

	if [[ ! -f CHANGELOG.md ]]; then
		echo "ERROR: CHANGELOG.md is missing"
		exit 1
	fi

	if ! grep -Fq "## $version" CHANGELOG.md; then
		echo "ERROR: CHANGELOG.md does not contain an entry for version $version"
		exit 1
	fi

	bash scripts/run_ci_checks.sh
	local kujo_bin
	kujo_bin="$(resolve_verified_kujo_bin)"
	KUJO_BIN="$kujo_bin" bash scripts/verify-webmcp-disabled-baseline.sh
	echo "Release gate passed for version $version"
}

main "$@"
