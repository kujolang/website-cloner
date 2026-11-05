#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

source "$REPO_ROOT/scripts/test_helpers.sh"

assert_file_contains "$REPO_ROOT/docs/current-capability-matrix.md" '# Kujo SSG current capability matrix'
assert_file_contains "$REPO_ROOT/docs/current-capability-matrix.md" '| Local featured-image containment | Supported |'
assert_file_contains "$REPO_ROOT/docs/current-capability-matrix.md" '| Size-optimized featured-image WebP conversion | Supported |'
assert_file_contains "$REPO_ROOT/docs/current-capability-matrix.md" '| Plain sitemap XML | Supported |'
assert_file_contains "$REPO_ROOT/docs/current-capability-matrix.md" '| Delimiter-aware frontmatter | Supported |'
assert_file_contains "$REPO_ROOT/docs/current-capability-matrix.md" '| DocGen-to-SSG Markdown bridge | Supported |'
assert_file_contains "$REPO_ROOT/docs/current-capability-matrix.md" '| Reusable docs-site starter package | Supported |'
assert_file_contains "$REPO_ROOT/docs/current-capability-matrix.md" '| Remote featured-image/font destination policy | Supported |'
assert_file_contains "$REPO_ROOT/README.md" 'scripts/docgen_ssg_bridge.kujo'
assert_file_contains "$REPO_ROOT/README.md" 'scripts/update_docs.kujo'
assert_file_contains "$REPO_ROOT/README.md" 'scripts/package-docs-template.sh'
assert_file_contains "$REPO_ROOT/ROADMAP.md" 'Closed SSG-002'

echo "Documentation contract passed"
