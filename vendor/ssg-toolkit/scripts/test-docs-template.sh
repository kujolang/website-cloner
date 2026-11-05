#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUJO_BIN="${KUJO_BIN:-kujo}"

source "$REPO_ROOT/scripts/test_helpers.sh"

main() {
	local temp_dir
	temp_dir="$(mktemp -d)"
	trap "rm -rf '$temp_dir'" EXIT

	local package_out="$temp_dir/dist"
	touch "$temp_dir/preserve-me"
	run_expect_failure "$REPO_ROOT/scripts/package-docs-template.sh" "$package_out" "../preserve-me"
	assert_output_contains "ERROR: package name must be a safe single path segment"
	assert_path_exists "$temp_dir/preserve-me"
	run_expect_success "$REPO_ROOT/scripts/package-docs-template.sh" "$package_out"
	assert_output_contains "Docs template package:"
	assert_path_exists "$package_out/kujo-ssg-docs-template.tar.gz"

	tar -C "$temp_dir" -xzf "$package_out/kujo-ssg-docs-template.tar.gz"
	local site_dir="$temp_dir/kujo-ssg-docs-template"
	assert_path_exists "$site_dir/build.kujo"
	assert_path_exists "$site_dir/package.json"
	assert_path_exists "$site_dir/package-lock.json"
	cmp "$REPO_ROOT/package-lock.json" "$site_dir/package-lock.json"
	assert_path_exists "$site_dir/scripts/update_docs.kujo"
	assert_path_exists "$site_dir/templates/post-docs.html"
	assert_path_exists "$site_dir/assets/js/docs.js"

	pushd "$site_dir" >/dev/null
	run_expect_success "$KUJO_BIN" run scripts/docs_search_index.kujo -- \
		--content content \
		--output assets/js/docs-search-index.json \
		--site-url https://docs.example.test
	assert_output_contains "Docs search index generated"
	assert_file_contains assets/js/docs-search-index.json '"schema_version": "kujo-docs-search/v1"'
	assert_file_contains assets/js/docs-search-index.json '"title": "Start Here"'

	run_expect_success "$KUJO_BIN" run ./build.kujo -- --site-url https://docs.example.test
	assert_output_contains "Build complete"
	assert_path_exists output/start-here/index.html
	assert_path_exists output/reference/index.html
	assert_path_exists output/assets/fonts/inter-latin-400.woff2
	assert_path_exists output/assets/fonts/inter-latin-700.woff2
	assert_file_contains output/start-here/index.html 'class="docs-shell"'
	assert_file_contains output/start-here/index.html 'class="docs-meta"'
	assert_file_contains output/start-here/index.html 'href="#first-path"'
	assert_file_contains output/tutorials/five-minute-quickstart/index.html '<pre><code class="language-bash">'
	assert_file_not_contains output/tutorials/five-minute-quickstart/index.html '```bash'
	assert_file_contains output/assets/js/docs-search-index.json '"title": "Start Here"'
	bash scripts/validate-generated-output.sh output

	local target_repo="$temp_dir/fixture-target"
	mkdir -p "$target_repo/src"
	cat > "$target_repo/src/math.kujo" <<'KUJO'
/// Adds two values.
pub func add(a, b) {
	return a + b
}
KUJO

	run_expect_success "$KUJO_BIN" run scripts/update_docs.kujo -- \
		--target-repo "$target_repo" \
		--site-url https://docs.example.test \
		--max-undocumented 10 \
		--max-warnings 10 \
		--allow-adapter-low-yield \
		--skip-validation
	assert_output_contains "Docs update complete"
	assert_path_exists content/reference/generated/.docgen-ssg-manifest.json
	assert_path_exists output/reference/api-reference/index.html
	assert_file_contains content/reference/generated/api-reference.md 'section: "Reference"'
	assert_file_contains content/reference/generated/api-reference.md 'template: "docs"'
	assert_file_contains output/assets/js/docs-search-index.json 'API Reference'
	popd >/dev/null

	echo "Docs template contract passed"
}

main "$@"
