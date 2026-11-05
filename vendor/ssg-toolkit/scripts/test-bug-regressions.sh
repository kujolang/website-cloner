#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUJO_BIN="${KUJO_BIN:-kujo}"
BUILD_SCRIPT="$REPO_ROOT/build.kujo"

source "$REPO_ROOT/scripts/test_helpers.sh"

assert_substring_order() {
	local target_path="$1"
	local first_text="$2"
	local second_text="$3"
	local first_pos
	local second_pos
	first_pos="$(grep -boF "$first_text" "$target_path" | head -n 1 | cut -d: -f1 || true)"
	second_pos="$(grep -boF "$second_text" "$target_path" | head -n 1 | cut -d: -f1 || true)"
	if [[ -z "$first_pos" || -z "$second_pos" || "$first_pos" -ge "$second_pos" ]]; then
		echo "FAIL expected text order in $target_path: '$first_text' before '$second_text'"
		exit 1
	fi
}

main() {
	local temp_dir
	temp_dir="$(mktemp -d)"
	trap "rm -rf '$temp_dir'" EXIT

	mkdir -p "$temp_dir/site/content/posts" "$temp_dir/site/content/pages"
	cp -R "$REPO_ROOT/templates" "$temp_dir/site/templates"
	cp -R "$REPO_ROOT/assets" "$temp_dir/site/assets"

	cat > "$temp_dir/site/kujo-ssg.yml" <<'EOF'
site_url: https://example.test///
site_title: Regression Site
site_tagline: Regression fixtures
output: output
content: content
templates: templates
assets: assets
blog_slug: ""
posts_per_page: 20
sort_by: order
fonts: [Bree Serif, Inter]
robots: public
llms: public
minify: false
EOF
	cat > "$temp_dir/site/content/tags.yml" <<'EOF'
99:
  name: Research, Development
EOF
	cat > "$temp_dir/site/content/posts/control-record.md" <<'EOF'
---
title: "Control\tTitle"
date: 2026-01-05
order: 5
tags: [99]
excerpt: Record fields remain aligned
---

# Control record
EOF
	cat > "$temp_dir/site/content/posts/negative-ten.md" <<'EOF'
---
title: Negative Ten
date: 2026-01-03
order: -10
excerpt: NEGATIVE-TEN-MARKER
---

# Negative ten
EOF
	cat > "$temp_dir/site/content/posts/negative-two.md" <<'EOF'
---
title: Negative Two
date: 2026-01-04
order: -2
excerpt: NEGATIVE-TWO-MARKER
---

# Negative two
EOF
	cat > "$temp_dir/site/content/posts/invalid-date.md" <<'EOF'
---
title: Invalid Date
date: 2025-02-29
order: 10
excerpt: Invalid dates stay out of machine-readable metadata
---

# Invalid date
EOF
	cat > "$temp_dir/site/content/posts/unsafe-lang.md" <<'EOF'
---
title: Safe Language
date: 2026-01-06
order: 6
lang: 'EN_us"><script>alert(1)</script>'
excerpt: Language attributes are normalized
---

# Safe language
EOF
	cat > "$temp_dir/site/content/pages/escaped-title.md" <<'EOF'
---
title: '<img src=x onerror=alert(1)>'
description: Escaped frontmatter text
---

# Safe body
EOF
	cat > "$temp_dir/site/content/pages/unsafe-template.md" <<'EOF'
---
title: Unsafe Template Override
template: x/../../outside
---

# Default template remains active
EOF
	cat > "$temp_dir/outside-content.md" <<'EOF'
---
title: Outside Content
---

OUTSIDE-CONTENT-MARKER
EOF
	ln -s "$temp_dir/outside-content.md" "$temp_dir/site/content/pages/outside-content.md"
	mkdir -p "$temp_dir/site/templates/page-x"
	printf '%s\n' 'OUTSIDE-TEMPLATE-MARKER' > "$temp_dir/site/outside.html"

	pushd "$temp_dir/site" >/dev/null

	# 1: destructive output/source overlap must be rejected before cleanup.
	touch content/preserve-me
	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output content
	assert_output_contains "Unsafe output directory"
	assert_path_exists content/preserve-me
	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output content/not-created-yet
	assert_output_contains "overlaps source directory content"
	assert_path_missing content/not-created-yet
	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output .
	assert_output_contains "refusing to delete the working directory or filesystem root"
	mkdir -p "$temp_dir/outside-output"
	touch "$temp_dir/outside-output/preserve-me"
	ln -s "$temp_dir/outside-output" output
	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output output
	assert_output_contains "Unsafe output directory: output is a symbolic link"
	assert_path_exists "$temp_dir/outside-output/preserve-me"
	rm output

	# 2: out-of-range shard indexes must not silently render an empty stripe.
	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --phase posts --shard 2 --shards 2
	assert_output_contains "Invalid shard index: 2 (must be less than shards=2)"
	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --phase posts --shard 0 --shards 257
	assert_output_contains "Invalid value for shards: 257 (must not exceed 256)"

	mkdir -p output
	ln -s "$temp_dir/outside-output" output/outside-link
	ln -s "$temp_dir/outside-output/preserve-me" assets/css/outside-link.css
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT"
	assert_output_contains "Build complete"
	assert_output_contains "Warning: Skipped symlink while copying assets: assets/css/outside-link.css"
	assert_output_contains "Warning: Skipped symlink while scanning content: content/pages/outside-content.md"
	assert_output_contains "Warning: Ignored unsafe template override in content/pages/unsafe-template.md: x/../../outside"
	assert_path_exists "$temp_dir/outside-output/preserve-me"
	assert_path_missing output/assets/css/outside-link.css

	# 3: output cleanup and asset copying never follow symlinks outside their roots.
	assert_path_missing output/outside-link
	assert_path_missing output/outside-content
	assert_file_contains output/unsafe-template/index.html 'Default template remains active'
	assert_file_not_contains output/unsafe-template/index.html 'OUTSIDE-TEMPLATE-MARKER'

	# 4: empty blog_slug keeps posts at root instead of creating /untitled/.
	assert_path_exists output/control-record/index.html
	assert_path_missing output/untitled

	# 5: repeated trailing site-url slashes are normalized across all outputs.
	assert_file_contains output/sitemap.xml '<loc>https://example.test/control-record/</loc>'
	assert_file_not_contains output/sitemap.xml 'https://example.test//'

	# 6: impossible calendar dates do not become publication metadata.
	assert_file_not_contains output/invalid-date/index.html 'article:published_time'
	assert_file_not_contains output/sitemap.xml '<lastmod>2025-02-29</lastmod>'

	# 7: tabs in record fields survive the internal post index without shifting fields.
	assert_file_contains output/index.html $'Control\tTitle'
	assert_file_contains output/index.html 'Record fields remain aligned'

	# 8: comma-bearing tag labels remain one tag after index serialization.
	assert_file_contains output/index.html '<span class="tag listing-tag">Research, Development</span>'

	# 9: signed order values sort numerically.
	assert_substring_order output/index.html 'NEGATIVE-TEN-MARKER' 'NEGATIVE-TWO-MARKER'

	# 10: plain frontmatter values are escaped before entering HTML templates.
	assert_file_contains output/escaped-title/index.html '&lt;img src=x onerror=alert(1)&gt;'
	assert_file_not_contains output/escaped-title/index.html '<h1><img src=x onerror=alert(1)></h1>'

	# 11: lang metadata cannot break out of the html attribute.
	assert_file_contains output/unsafe-lang/index.html '<html lang="en-usscriptalert1script">'
	assert_file_not_contains output/unsafe-lang/index.html '<script>alert(1)</script>'

	# 12: parallel auto-sizing handles an empty posts directory and resource
	# inputs are bounded before any worker process is launched.
	mkdir -p "$temp_dir/empty-content/posts"
	local true_bin
	true_bin="$(command -v true)"
	run_expect_success env KUJO_BIN="$true_bin" bash "$REPO_ROOT/scripts/build-parallel.sh" auto 1 --content="$temp_dir/empty-content" --output "$temp_dir/parallel-output"
	assert_output_contains "Parallel build complete"
	run_expect_failure env KUJO_BIN="$true_bin" bash "$REPO_ROOT/scripts/build-parallel.sh" 257 1
	assert_output_contains "shards must not exceed 256"
	run_expect_failure env KUJO_BIN="$true_bin" bash "$REPO_ROOT/scripts/build-parallel.sh" 1 65
	assert_output_contains "concurrency must not exceed 64"

	# 13: interrupting the orchestrator terminates active shard workers.
	local fake_kujo="$temp_dir/fake-kujo"
	local fake_pid_file="$temp_dir/fake-worker-pids"
	cat > "$fake_kujo" <<'EOF'
#!/usr/bin/env bash
phase=""
previous=""
for argument in "$@"; do
	if [[ "$previous" == "--phase" ]]; then
		phase="$argument"
	fi
	previous="$argument"
done
if [[ "$phase" == "posts" ]]; then
	printf '%s\n' "$$" >> "$FAKE_PID_FILE"
	exec sleep 30
fi
exit 0
EOF
	chmod +x "$fake_kujo"
	FAKE_PID_FILE="$fake_pid_file" KUJO_BIN="$fake_kujo" bash "$REPO_ROOT/scripts/build-parallel.sh" 2 2 >"$temp_dir/interrupted-build.log" 2>&1 &
	local orchestrator_pid=$!
	local attempt
	for attempt in {1..50}; do
		if [[ -f "$fake_pid_file" ]] && [[ "$(wc -l < "$fake_pid_file" | tr -d ' ')" -ge 2 ]]; then
			break
		fi
		sleep 0.1
	done
	if [[ ! -f "$fake_pid_file" ]] || [[ "$(wc -l < "$fake_pid_file" | tr -d ' ')" -lt 2 ]]; then
		kill "$orchestrator_pid" 2>/dev/null || true
		wait "$orchestrator_pid" 2>/dev/null || true
		echo "FAIL parallel interruption fixture did not launch both workers"
		exit 1
	fi
	kill -TERM "$orchestrator_pid"
	local interrupt_status=0
	wait "$orchestrator_pid" || interrupt_status=$?
	if [[ "$interrupt_status" -ne 130 ]]; then
		echo "FAIL interrupted parallel build exited $interrupt_status instead of 130"
		exit 1
	fi
	local worker_pid
	while IFS= read -r worker_pid; do
		if kill -0 "$worker_pid" 2>/dev/null; then
			kill "$worker_pid" 2>/dev/null || true
			echo "FAIL interrupted parallel build left worker $worker_pid running"
			exit 1
		fi
	done < "$fake_pid_file"

	# 14: benchmark fixture regeneration only replaces directories previously
	# created and marked by the generator.
	mkdir -p "$temp_dir/unowned-benchmark"
	touch "$temp_dir/unowned-benchmark/preserve-me"
	run_expect_failure python3 "$REPO_ROOT/scripts/generate-benchmark-content.py" 2 "$temp_dir/unowned-benchmark"
	assert_output_contains "refusing to replace unowned benchmark directory"
	assert_path_exists "$temp_dir/unowned-benchmark/preserve-me"
	run_expect_success python3 "$REPO_ROOT/scripts/generate-benchmark-content.py" 2 "$temp_dir/owned-benchmark"
	assert_path_exists "$temp_dir/owned-benchmark/.kujo-ssg-benchmark-content"
	assert_path_exists "$temp_dir/owned-benchmark/posts/post-00002.md"
	run_expect_success python3 "$REPO_ROOT/scripts/generate-benchmark-content.py" 1 "$temp_dir/owned-benchmark"
	assert_path_missing "$temp_dir/owned-benchmark/posts/post-00002.md"

	popd >/dev/null
	echo "Bug regression tests passed"
}

main "$@"
