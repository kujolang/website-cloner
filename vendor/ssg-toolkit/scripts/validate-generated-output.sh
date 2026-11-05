#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-output}"

if [[ ! -d "$OUT_DIR" ]]; then
	echo "ERROR: output directory not found: $OUT_DIR"
	exit 1
fi

failures=0
html_count=0

record_failure() {
	echo "$1"
	failures=$((failures + 1))
}

while IFS= read -r html_file; do
	html_count=$((html_count + 1))

	if ! grep -Eqi '^<!doctype html>' "$html_file"; then
		record_failure "FAIL doctype: $html_file"
	fi

	if ! grep -Eqi '<html[^>]* lang="[^"]+"' "$html_file"; then
		record_failure "FAIL html-lang: $html_file"
	fi

	if ! grep -Eqi '<main[ >]' "$html_file"; then
		record_failure "FAIL main-landmark: $html_file"
	fi

	if grep -Eqi '<a[^>]*></a>' "$html_file"; then
		record_failure "FAIL empty-link: $html_file"
	fi

	if grep -Eqi '<img[[:space:]][^>]*>' "$html_file"; then
		if grep -Eio '<img[[:space:]][^>]*>' "$html_file" | grep -Eiv ' alt="' >/dev/null; then
			record_failure "FAIL image-alt: $html_file"
		fi
	fi

	if grep -qi 'class="skip-link"' "$html_file"; then
		if ! grep -qi 'id="main-content"' "$html_file"; then
			record_failure "FAIL skip-link-target: $html_file"
		fi
	fi

done < <(find "$OUT_DIR" -name '*.html' -type f | sort)

if [[ "$html_count" -eq 0 ]]; then
	record_failure "FAIL no-html: no HTML files found in $OUT_DIR"
fi

if [[ -f "$OUT_DIR/sitemap.xml" ]]; then
	if ! grep -q '<urlset' "$OUT_DIR/sitemap.xml"; then
		record_failure "FAIL sitemap-format: $OUT_DIR/sitemap.xml"
	fi
fi

if [[ -f "$OUT_DIR/sitemap.xsl" ]]; then
	record_failure "FAIL unexpected-sitemap-stylesheet: $OUT_DIR/sitemap.xsl"
fi

if [[ -f "$OUT_DIR/feed/index.xml" ]]; then
	if ! grep -q '<rss' "$OUT_DIR/feed/index.xml"; then
		record_failure "FAIL rss-format: $OUT_DIR/feed/index.xml"
	fi
fi

webmcp_index="$OUT_DIR/.well-known/kujo-site-index.json"
webmcp_marker_count="$( { grep -RIl --include='*.html' 'data-kujo-webmcp' "$OUT_DIR" 2>/dev/null || true; } | wc -l | tr -d ' ')"
if [[ "$webmcp_marker_count" -gt 0 || -f "$webmcp_index" ]]; then
	if [[ ! -f "$webmcp_index" ]]; then
		record_failure "FAIL webmcp-index-missing: $webmcp_index"
	elif ! python3 - "$OUT_DIR" <<'PY'
import json
import posixpath
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

out = Path(sys.argv[1]).resolve()
index_path = out / '.well-known' / 'kujo-site-index.json'
try:
    data = json.loads(index_path.read_text(encoding='utf-8'))
except Exception as exc:
    raise SystemExit(f'FAIL webmcp-json: {exc}')

if data.get('schema') != 'kujo-ssg-site-index/v1':
    raise SystemExit('FAIL webmcp-schema')
items = data.get('items')
if not isinstance(items, list):
    raise SystemExit('FAIL webmcp-items')
ids = [item.get('id') for item in items]
urls = [item.get('url') for item in items]
if len(ids) != len(set(ids)) or len(urls) != len(set(urls)):
    raise SystemExit('FAIL webmcp-duplicates')

base_path = data.get('site', {}).get('base_path', '/')
for item in items:
    url = item.get('url', '')
    path = urlsplit(url).path
    if not path.startswith(base_path):
        raise SystemExit(f'FAIL webmcp-base-path: {url}')
    route = path[len(base_path):].strip('/')
    target = out / route / 'index.html'
    if not target.is_file():
        raise SystemExit(f'FAIL webmcp-route: {url} -> {target}')

class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and 'data-kujo-webmcp' in attrs:
            self.refs.append((attrs.get('src'), attrs.get('data-kujo-site-index')))

marked = 0
for html in out.rglob('*.html'):
    parser = Scripts()
    parser.feed(html.read_text(encoding='utf-8'))
    for source, index_ref in parser.refs:
        marked += 1
        if not source or not index_ref:
            raise SystemExit(f'FAIL webmcp-script-attributes: {html}')
        for ref in (source, index_ref):
            resolved = (html.parent / posixpath.normpath(ref)).resolve()
            if out not in resolved.parents and resolved != out:
                raise SystemExit(f'FAIL webmcp-reference-escape: {html} -> {ref}')
            if not resolved.is_file():
                raise SystemExit(f'FAIL webmcp-reference: {html} -> {ref}')
if marked == 0:
    raise SystemExit('FAIL webmcp-script-marker')
if (out / '404.html').is_file() and 'data-kujo-webmcp' in (out / '404.html').read_text(encoding='utf-8'):
    raise SystemExit('FAIL webmcp-404-policy')
PY
	then
		record_failure "FAIL webmcp-contract: $OUT_DIR"
	fi
fi

echo "Checked HTML files: $html_count"

if [[ "$failures" -gt 0 ]]; then
	echo "Validation failed: $failures issue(s)"
	exit 1
fi

echo "Validation passed"
