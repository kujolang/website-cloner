#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$REPO_ROOT/dist}"
PACKAGE_NAME="${2:-kujo-ssg-docs-template}"

if [[ ! "$PACKAGE_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ || "$PACKAGE_NAME" == "." || "$PACKAGE_NAME" == ".." ]]; then
	echo "ERROR: package name must be a safe single path segment" >&2
	exit 2
fi

mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd -P)"
ARCHIVE="$OUT_DIR/$PACKAGE_NAME.tar.gz"
STAGING_PARENT="$(mktemp -d "$OUT_DIR/.${PACKAGE_NAME}.XXXXXX")"
trap 'rm -rf -- "$STAGING_PARENT"' EXIT
PACKAGE_ROOT="$STAGING_PARENT/$PACKAGE_NAME"

mkdir -p "$PACKAGE_ROOT/scripts"

cp -R "$REPO_ROOT/starters/docs-site/." "$PACKAGE_ROOT/"
cp "$REPO_ROOT/package.json" "$REPO_ROOT/package-lock.json" "$PACKAGE_ROOT/"
cp "$REPO_ROOT/build.kujo" "$PACKAGE_ROOT/build.kujo"
cp "$REPO_ROOT/scripts/docgen_ssg_bridge.kujo" "$PACKAGE_ROOT/scripts/docgen_ssg_bridge.kujo"
cp "$REPO_ROOT/scripts/docgen_reduce.py" "$PACKAGE_ROOT/scripts/docgen_reduce.py"
cp "$REPO_ROOT/scripts/docs_search_index.kujo" "$PACKAGE_ROOT/scripts/docs_search_index.kujo"
cp "$REPO_ROOT/scripts/docs_search_index.py" "$PACKAGE_ROOT/scripts/docs_search_index.py"
cp "$REPO_ROOT/scripts/update_docs.kujo" "$PACKAGE_ROOT/scripts/update_docs.kujo"
cp "$REPO_ROOT/scripts/validate-generated-output.sh" "$PACKAGE_ROOT/scripts/validate-generated-output.sh"
cp "$REPO_ROOT/scripts/test_helpers.sh" "$PACKAGE_ROOT/scripts/test_helpers.sh"

tar -C "$STAGING_PARENT" -czf "$STAGING_PARENT/$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME"
mv -f "$STAGING_PARENT/$PACKAGE_NAME.tar.gz" "$ARCHIVE"
printf 'Docs template package: %s\n' "$ARCHIVE"
