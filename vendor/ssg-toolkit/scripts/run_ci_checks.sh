#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

resolve_kujo_bin() {
	if [[ -n "${KUJO_BIN:-}" ]]; then
		if [[ ! -x "$KUJO_BIN" ]]; then
			echo "ERROR: KUJO_BIN is not executable: $KUJO_BIN"
			exit 1
		fi
		printf '%s\n' "$KUJO_BIN"
		return
	fi

	local runtime_dir="${KUJO_RUNTIME_DIR:-}"
	if [[ -z "$runtime_dir" && -f "$REPO_ROOT/../kujo/Cargo.toml" ]]; then
		runtime_dir="$REPO_ROOT/../kujo"
	fi

	if [[ -n "$runtime_dir" ]]; then
		if [[ ! -f "$runtime_dir/Cargo.toml" ]]; then
			echo "ERROR: KUJO_RUNTIME_DIR does not point to a Kujo Cargo project: $runtime_dir"
			exit 1
		fi
		cargo build --manifest-path "$runtime_dir/Cargo.toml"
		local built_bin="$runtime_dir/target/debug/kujo"
		if [[ ! -x "$built_bin" ]]; then
			echo "ERROR: Kujo runtime build did not produce an executable binary at $built_bin"
			exit 1
		fi
		printf '%s\n' "$built_bin"
		return
	fi

	if command -v kujo >/dev/null 2>&1; then
		command -v kujo
		return
	fi

	echo "ERROR: could not resolve a Kujo runtime. Set KUJO_BIN or KUJO_RUNTIME_DIR first."
	exit 1
}

verify_kujo_bin() {
	local kujo_bin="$1"
	local help_output

	if ! help_output=$("$kujo_bin" --help 2>&1); then
		echo "ERROR: failed to execute Kujo binary: $kujo_bin"
		printf '%s\n' "$help_output"
		exit 1
	fi

	if ! printf '%s\n' "$help_output" | grep -Eq '(^|[[:space:]])run([[:space:]]|$)'; then
		echo "ERROR: resolved Kujo binary does not expose the language runtime 'run' command: $kujo_bin"
		exit 1
	fi
}

main() {
	local kujo_bin
	kujo_bin="$(resolve_kujo_bin)"
	verify_kujo_bin "$kujo_bin"

	export KUJO_BIN="$kujo_bin"
	export SSG_ESBUILD_BIN="${SSG_ESBUILD_BIN:-$REPO_ROOT/node_modules/.bin/esbuild}"

	cd "$REPO_ROOT"
	python3 scripts/test-hardening-contract.py
	python3 scripts/test-content-boundaries.py
	python3 scripts/test-docs-pipeline.py
	python3 scripts/test-minification.py
	node scripts/test-docs-search-runtime.js
	bash scripts/test-cli-contract.sh
	bash scripts/test-generated-contract.sh
	bash scripts/test-bug-regressions.sh
	bash scripts/test-webmcp-contract.sh
	bash scripts/test-docgen-ssg-bridge.sh
	bash scripts/test-docs-template.sh
	bash scripts/test-docs-contract.sh
	bash scripts/test-ability-contract.sh
	bash scripts/test-ability-pack-integration.sh
	"$KUJO_BIN" run ./build.kujo -- --site-url https://example.com
	./scripts/validate-generated-output.sh output
	echo "CI checks passed"
}

main "$@"
