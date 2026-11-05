#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUJO_BIN="${KUJO_BIN:-kujo}"
BUILD_SCRIPT="$REPO_ROOT/build.kujo"

source "$REPO_ROOT/scripts/test_helpers.sh"

SERVER_PID=""

stop_remote_server() {
	if [[ -n "${SERVER_PID:-}" ]]; then
		kill "$SERVER_PID" >/dev/null 2>&1 || true
		wait "$SERVER_PID" 2>/dev/null || true
		SERVER_PID=""
	fi
}

cleanup_temp_site_state() {
	stop_remote_server
	rm -f kujo-ssg.yml kujo-ssg.yaml kujo-ssg.json
	rm -rf output output-yml output-yaml output-json output-yml-preferred output-yaml-preferred output-json-fallback output-cli output-cli-fields output-cli-fields-blocked output-private output-suppressed output-no-drafts output-with-drafts content-cli templates-cli assets-cli remote-assets
	if [[ -n "${ABS_OUTPUT_DIR:-}" ]]; then
		rm -rf -- "$ABS_OUTPUT_DIR"
	fi
}

write_yaml_config() {
	local target_path="$1"
	local site_url="$2"
	local output_dir="$3"
	local blog_slug="$4"
	local posts_per_page="$5"

	cat > "$target_path" <<EOF
site_url: $site_url
site_title: Kujo SSG Starter Site
site_tagline: A complete starter that showcases pages, posts, custom types, and taxonomies.

output: $output_dir
content: content
templates: templates
assets: assets

blog_slug: $blog_slug
posts_per_page: $posts_per_page
sort_by: date

fonts:
  - Bree Serif
  - Inter

robots: public
llms: public

watch: false
minify: true
download_remote_images: false
no_index: false
no_aux: false
EOF
}

write_json_config() {
	local target_path="$1"
	local site_url="$2"
	local output_dir="$3"
	local blog_slug="$4"
	local posts_per_page="$5"

	cat > "$target_path" <<EOF
{
	"site_url": "$site_url",
	"site_title": "Kujo SSG Starter Site",
	"site_tagline": "A complete starter that showcases pages, posts, custom types, and taxonomies.",
	"output": "$output_dir",
	"content": "content",
	"templates": "templates",
	"assets": "assets",
	"blog_slug": "$blog_slug",
	"posts_per_page": $posts_per_page,
	"sort_by": "date",
	"fonts": ["Bree Serif", "Inter"],
	"robots": "public",
	"llms": "public",
	"watch": false,
	"minify": true,
	"download_remote_images": false,
	"no_index": false,
	"no_aux": false
}
EOF
}

write_override_config() {
	local target_path="$1"

	cat > "$target_path" <<'EOF'
site_url: https://config-source.example.test
site_title: Config Site Title
site_tagline: Config tagline should not survive CLI overrides.

output: output-config
content: content
templates: templates
assets: assets

blog_slug: config-blog
posts_per_page: 2
sort_by: title

fonts:
  - Bree Serif
  - Inter

robots: public
llms: public

watch: false
minify: false
download_remote_images: false
no_index: false
no_aux: false
EOF
}

assert_standard_config_build() {
	local output_dir="$1"
	local blog_slug="$2"
	local site_url="$3"

	assert_path_exists "$output_dir/index.html"
	assert_path_exists "$output_dir/$blog_slug/index.html"
	assert_path_exists "$output_dir/robots.txt"
	assert_path_exists "$output_dir/llms.txt"
	assert_path_exists "$output_dir/sitemap.xml"
	assert_path_missing "$output_dir/sitemap.xsl"
	assert_path_exists "$output_dir/feed/index.xml"
	assert_file_contains "$output_dir/index.html" '<title>Kujo SSG Starter Site</title>'
	assert_file_contains "$output_dir/index.html" 'A complete starter that showcases pages, posts, custom types, and taxonomies.'
	assert_file_contains "$output_dir/robots.txt" 'Allow: /'
	assert_file_contains "$output_dir/llms.txt" "$site_url/sitemap.xml"
	assert_file_contains "$output_dir/sitemap.xml" "$site_url/$blog_slug/"
	assert_file_contains "$output_dir/feed/index.xml" '<title>Kujo SSG Starter Site</title>'
}

assert_glob_exists() {
	local pattern="$1"
	if ! compgen -G "$pattern" >/dev/null; then
		echo "Expected path matching $pattern"
		exit 1
	fi
}

setup_cli_contract_site() {
	local site_dir="$1"

	mkdir -p "$site_dir/content/pages" "$site_dir/content/posts" "$site_dir/templates" "$site_dir/assets/css"
	cat > "$site_dir/content/pages/about.md" <<'EOF'
---
title: About
description: About page.
---

# About
EOF
	cat > "$site_dir/content/pages/contact.md" <<'EOF'
---
title: Contact
description: Contact page.
---

# Contact
EOF
	cat > "$site_dir/content/pages/getting-started.md" <<'EOF'
---
title: Getting Started
description: Getting started page.
---

# Getting Started
EOF
	for idx in 1 2 3 4; do
		cat > "$site_dir/content/posts/post-${idx}.md" <<EOF
---
title: Post ${idx}
author: 1
date: 2026-05-0${idx}
description: Post ${idx} description.
---

# Post ${idx}

Body ${idx}.
EOF
	done
	cat > "$site_dir/content/authors.yml" <<'EOF'
1: Test Author
EOF
	cat > "$site_dir/content/categories.yml" <<'EOF'
1: News
EOF
	cat > "$site_dir/content/tags.yml" <<'EOF'
1: Test
EOF
	cat > "$site_dir/templates/layout.html" <<'EOF'
<!DOCTYPE html><html lang="{{lang}}"><head><title>{{page_title}}</title>{{canonical_tag}}<link rel="stylesheet" href="{{stylesheet_path}}"></head><body><nav>{{navigation}}</nav><p>{{site_tagline}}</p><main id="main-content">{{content}}</main></body></html>
EOF
	cat > "$site_dir/templates/page.html" <<'EOF'
<article><h1>{{title}}</h1>{{featured_image_html}}<section>{{body}}</section></article>
EOF
	cat > "$site_dir/templates/post.html" <<'EOF'
<article><h1>{{title}}</h1>{{featured_image_html}}<section>{{body}}</section></article>
EOF
	cat > "$site_dir/templates/page-home.html" <<'EOF'
<main id="main-content"><h1>{{title}}</h1><p>{{description}}</p>{{posts_html}}{{pagination}}</main>
EOF
	cat > "$site_dir/templates/page-blog.html" <<'EOF'
<main id="main-content"><h1>Blog</h1><p>{{description}}</p>{{posts_html}}{{pagination}}</main>
EOF
	cat > "$site_dir/templates/404.html" <<'EOF'
<main id="main-content"><h1>Not found</h1></main>
EOF
	cat > "$site_dir/assets/css/style.css" <<'EOF'
body {
	color: #111111;
}
EOF
}

main() {
	local temp_dir
	temp_dir="$(mktemp -d)"
	trap 'stop_remote_server; if [[ -n "${temp_dir:-}" ]]; then rm -rf "$temp_dir"; fi' EXIT

	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --help
	assert_output_contains "Usage: kujo run ./build.kujo [options]"

	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --version
	assert_output_contains "build.kujo 1.2.0"

	setup_cli_contract_site "$temp_dir"
	pushd "$temp_dir" >/dev/null

	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --definitely-not-a-real-flag
	assert_output_contains "Error: Unknown option: --definitely-not-a-real-flag"

	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output
	assert_output_contains "Error: Missing value for --output"

	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --sort-by bogus
	assert_output_contains "Error: Invalid value for sort_by: bogus"

	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --robots weird
	assert_output_contains "Error: Invalid value for robots: weird"

	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --fonts "Inter');body{display:none}/*,Inter"
	assert_output_contains "Error: Invalid font family: Inter');body{display:none}/*"

	cat > kujo-ssg.yml <<'EOF'
site_url: https://demo.kujo.local
site_title: Kujo SSG Starter Site
site_tagline: A complete starter that showcases pages, posts, custom types, and taxonomies.

output: output
content: content
templates: templates
assets: assets

blog_slug: blog
posts_per_page: 2
sort_by: bogus

fonts:
  - Bree Serif
  - Inter

robots: public
llms: public

watch: false
minify: true
download_remote_images: false
no_index: false
no_aux: false
EOF
	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --site-url https://example.com
	assert_output_contains "Error: Invalid value for sort_by: bogus"

	cat > kujo-ssg.yml <<'EOF'
site_url: [
EOF
	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --site-url https://example.com
	assert_output_contains "Error: Could not parse kujo-ssg.yml:"

	rm -f kujo-ssg.yml
	cat > kujo-ssg.json <<'EOF'
{"site_url":
EOF
	run_expect_failure "$KUJO_BIN" run "$BUILD_SCRIPT" -- --site-url https://example.com
	assert_output_contains "Error: Could not parse kujo-ssg.json:"

	cleanup_temp_site_state
	write_yaml_config kujo-ssg.yml https://yml.example.test output-yml stories 2
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --site-url https://yml.example.test
	assert_output_contains "Build complete"
	assert_standard_config_build output-yml stories https://yml.example.test

	cleanup_temp_site_state
	write_yaml_config kujo-ssg.yaml https://yaml.example.test output-yaml journal 2
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --site-url https://yaml.example.test
	assert_output_contains "Build complete"
	assert_standard_config_build output-yaml journal https://yaml.example.test

	cleanup_temp_site_state
	write_json_config kujo-ssg.json https://json.example.test output-json dispatch 2
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --site-url https://json.example.test
	assert_output_contains "Build complete"
	assert_standard_config_build output-json dispatch https://json.example.test

	cleanup_temp_site_state
	write_yaml_config kujo-ssg.yml https://yml-preferred.example.test output-yml-preferred editorial 2
	write_yaml_config kujo-ssg.yaml https://yaml-ignored.example.test output-yaml-preferred ignored-yaml 2
	write_json_config kujo-ssg.json https://json-ignored.example.test output-json-fallback ignored-json 2
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --site-url https://yml-preferred.example.test
	assert_output_contains "Loaded configuration from kujo-ssg.yml"
	assert_path_exists output-yml-preferred/editorial/index.html
	assert_path_missing output-yaml-preferred
	assert_path_missing output-json-fallback

	cleanup_temp_site_state
	write_yaml_config kujo-ssg.yaml https://yaml-preferred.example.test output-yaml-preferred magazine 2
	write_json_config kujo-ssg.json https://json-fallback.example.test output-json-fallback ignored-json 2
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --site-url https://yaml-preferred.example.test
	assert_output_contains "Loaded configuration from kujo-ssg.yaml"
	assert_path_exists output-yaml-preferred/magazine/index.html
	assert_path_missing output-json-fallback

	cleanup_temp_site_state
	write_yaml_config kujo-ssg.yml https://config.example.test output config-blog 2
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output output-cli --blog-slug releases --posts-per-page 1 --site-url https://override.example.test --sort-by date
	assert_output_contains "Build complete"
	assert_path_missing output
	assert_path_exists output-cli/releases/index.html
	assert_path_exists output-cli/releases/page/4/index.html
	assert_file_contains output-cli/sitemap.xml "https://override.example.test/releases/"

	cleanup_temp_site_state
	write_override_config kujo-ssg.yml
	cp -R content content-cli
	cp -R templates templates-cli
	cp -R assets assets-cli
	cat > content-cli/pages/cli-only.md <<'EOF'
---
title: CLI Only Page
description: Proof that the CLI content directory overrides the config value.
---

# CLI Only

This page only exists in the CLI override content tree.
EOF
	cat >> templates-cli/layout.html <<'EOF'

<!-- cli-template-marker -->
EOF
	cat > assets-cli/css/style.css <<'EOF'
body {
	background: #123456;
	color: #fefefe;
}
EOF
	mkdir -p remote-assets
	printf 'RIFFTESTWEBP' > remote-assets/cli-remote-proof.webp
	local server_port
	if ! command -v python3 >/dev/null 2>&1; then
		echo "python3 is required for CLI override contract tests"
		exit 1
	fi
	local remote_image_url
	local server_ready
	server_ready=0
	for _ in {1..10}; do
		server_port=$((20000 + RANDOM % 20000))
		python3 -m http.server "$server_port" --bind 127.0.0.1 --directory remote-assets >/dev/null 2>&1 &
		SERVER_PID="$!"
		remote_image_url="http://127.0.0.1:${server_port}/cli-remote-proof.webp"
		for _ in {1..20}; do
			if curl -fsS "$remote_image_url" >/dev/null 2>&1; then
				server_ready=1
				break 2
			fi
			if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
				break
			fi
			sleep 0.1
		done
		stop_remote_server
	done
	if [[ "$server_ready" -ne 1 ]]; then
		echo "Failed to start local remote-image test server"
		exit 1
	fi
	cat > content-cli/pages/remote-image-proof.md <<EOF
---
title: Remote Image Proof
featured_image: $remote_image_url
description: Proof that the CLI remote-image flag overrides the config value.
---

# Remote Image Proof

This post proves remote-image downloading through CLI overrides.
EOF
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output output-cli-fields-blocked --content content-cli --templates templates-cli --assets assets-cli --site-url https://cli-fields.example.test --no-index --no-aux --no-aliases --download-remote-images
	assert_output_contains "blocked by explicit outbound destination policy 'deny_private'"
	assert_file_contains output-cli-fields-blocked/remote-image-proof/index.html "$remote_image_url"
	if compgen -G 'output-cli-fields-blocked/images/cli-remote-proof-*' >/dev/null; then
		echo "Private remote image was mirrored without explicit opt-in"
		exit 1
	fi

	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output output-cli-fields --content content-cli --templates templates-cli --assets assets-cli --site-title "CLI Override Title" --site-tagline "CLI override tagline wins." --site-url https://cli-fields.example.test --watch --minify --download-remote-images --allow-private-remote-images
	assert_output_contains "Warning: --watch is currently not implemented."
	assert_output_contains "Build complete"
	assert_path_missing output-config
	assert_path_exists output-cli-fields/cli-only/index.html
	assert_path_exists output-cli-fields/remote-image-proof/index.html
	assert_path_exists output-cli-fields/assets/css/style.min.css
	assert_file_contains output-cli-fields/cli-only/index.html 'CLI Override Title'
	assert_file_contains output-cli-fields/cli-only/index.html 'CLI override tagline wins.'
	assert_file_contains output-cli-fields/cli-only/index.html 'cli-template-marker'
	assert_file_contains output-cli-fields/assets/css/style.min.css 'body{background:#123456;color:#fefefe}'
	assert_file_contains output-cli-fields/remote-image-proof/index.html '/images/cli-remote-proof-'
	assert_glob_exists 'output-cli-fields/images/cli-remote-proof-*.webp'

	cleanup_temp_site_state
	write_override_config kujo-ssg.yml
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output output-private --site-url https://private.example.test --robots private --llms private
	assert_output_contains "Build complete"
	assert_file_contains output-private/robots.txt 'Disallow: /'
	assert_path_missing output-private/llms.txt

	cleanup_temp_site_state
	write_override_config kujo-ssg.yml
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output output-suppressed --site-url https://suppressed.example.test --no-index --no-aux
	assert_output_contains "Build complete"
	assert_path_exists output-suppressed/about/index.html
	assert_path_missing output-suppressed/index.html
	assert_path_missing output-suppressed/config-blog/index.html
	assert_path_missing output-suppressed/robots.txt
	assert_path_missing output-suppressed/llms.txt
	assert_path_missing output-suppressed/sitemap.xml
	assert_path_missing output-suppressed/feed/index.xml

	# Draft preview: drafts are excluded by default and included with --drafts.
	cleanup_temp_site_state
	cp "$REPO_ROOT/kujo-ssg.yml" "$temp_dir/kujo-ssg.yml"
	cat > content/posts/draft-preview-proof.md <<'EOF'
---
title: Draft Preview Proof
custom_url: draft-preview-proof
author: 1
date: 2026-06-01
description: Hidden unless drafts are enabled.
draft: true
---

# Draft Body Marker DRAFTXYZZY
EOF
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output output-no-drafts --site-url https://example.com
	assert_output_contains "Build complete"
	assert_path_missing output-no-drafts/blog/draft-preview-proof/index.html
	assert_file_not_contains output-no-drafts/sitemap.xml 'draft-preview-proof'
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output output-with-drafts --drafts --site-url https://example.com
	assert_output_contains "Build complete"
	assert_path_exists output-with-drafts/blog/draft-preview-proof/index.html
	assert_file_contains output-with-drafts/blog/draft-preview-proof/index.html 'DRAFTXYZZY'
	rm -f content/posts/draft-preview-proof.md

	# Absolute --output paths must build from the filesystem root, not be
	# silently rewritten relative to the working directory.
	cleanup_temp_site_state
	cp "$REPO_ROOT/kujo-ssg.yml" "$temp_dir/kujo-ssg.yml"
	ABS_OUTPUT_DIR="$(mktemp -d)/abs-output"
	# Top-level segment of the absolute path (e.g. "var" or "tmp"); the old bug
	# created this as a stray relative directory under the working directory.
	abs_top_segment="${ABS_OUTPUT_DIR#/}"
	abs_top_segment="${abs_top_segment%%/*}"
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --output "$ABS_OUTPUT_DIR" --site-url https://example.com
	assert_output_contains "Build complete"
	assert_path_exists "$ABS_OUTPUT_DIR/index.html"
	assert_path_missing "$abs_top_segment"
	rm -rf "$ABS_OUTPUT_DIR"
	unset ABS_OUTPUT_DIR

	cleanup_temp_site_state
	cp "$REPO_ROOT/kujo-ssg.yml" "$temp_dir/kujo-ssg.yml"
	run_expect_success "$KUJO_BIN" run "$BUILD_SCRIPT" -- --site-url https://example.com --sort-by date
	assert_output_contains "Build complete"
	run_expect_success "$REPO_ROOT/scripts/validate-generated-output.sh" output
	assert_output_contains "Validation passed"

	popd >/dev/null
	echo "CLI contract tests passed"
}

main "$@"
