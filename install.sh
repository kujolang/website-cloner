#!/usr/bin/env bash
# Bootstrap Node without changing the user's system installation.
set -euo pipefail
BASE="${CLONER_HOME:-$HOME/.local/share/website-cloner}"
case "$(uname -s)" in Darwin) OS=darwin;; Linux) OS=linux;; *) echo 'Website Cloner supports macOS and Linux.' >&2; exit 1;; esac
case "$(uname -m)" in arm64|aarch64) ARCH=arm64;; x86_64) ARCH=x64;; *) echo 'Unsupported CPU architecture.' >&2; exit 1;; esac
for cmd in curl tar; do command -v "$cmd" >/dev/null || { echo "Install $cmd, then try again." >&2; exit 1; }; done
mkdir -p "$BASE/runtime"
WORK=$(mktemp -d)
trap 'result=$?; trap - EXIT; rm -rf "$WORK"; exit "$result"' EXIT
if [ -x "$BASE/runtime/node/bin/node" ]; then export PATH="$BASE/runtime/node/bin:$PATH"; fi
if ! command -v npm >/dev/null || ! command -v node >/dev/null || ! node -e 'const [a,b,c]=process.versions.node.split(".").map(Number);process.exit((a===22&&(b>23||b===23&&c>=4))||(a===24&&(b>22||b===22&&c>=1))||a>26||(a===26&&(b>12||b===12&&c>=1))?0:1)' >/dev/null 2>&1; then
  VERSION=22.23.4
  ARCHIVE="node-v$VERSION-$OS-$ARCH.tar.gz"
  echo "Installing private Node ${VERSION}..."
  curl --fail --location --retry 3 "https://nodejs.org/dist/v$VERSION/$ARCHIVE" -o "$WORK/$ARCHIVE"
  curl --fail --location --retry 3 "https://nodejs.org/dist/v$VERSION/SHASUMS256.txt" -o "$WORK/SHASUMS256.txt"
  (cd "$WORK"; awk -v name="$ARCHIVE" '$2 == name {print}' SHASUMS256.txt > checksum; test -s checksum; if command -v shasum >/dev/null; then shasum -a 256 -c checksum; else sha256sum -c checksum; fi)
  tar -xzf "$WORK/$ARCHIVE" -C "$WORK"
  mkdir -p "$BASE/runtime/node"
  cp -R "$WORK/node-v$VERSION-$OS-$ARCH/." "$BASE/runtime/node/"
  export PATH="$BASE/runtime/node/bin:$PATH"
fi
SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ]; then SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd); fi
if [ -f "$SCRIPT_DIR/scripts/install.mjs" ]; then
  SOURCE="$SCRIPT_DIR"
else
  echo 'Downloading Website Cloner…'
  curl --fail --location --retry 3 'https://github.com/kujolang/website-cloner/archive/refs/heads/main.tar.gz' -o "$WORK/source.tar.gz" || { echo 'Source download failed. The repository must be public, or download it with your GitHub account and run its install.sh.' >&2; exit 1; }
  mkdir "$WORK/source"
  tar -xzf "$WORK/source.tar.gz" -C "$WORK/source" --strip-components=1
  SOURCE="$WORK/source"
fi
export CLONER_HOME="$BASE"
node "$SOURCE/scripts/install.mjs" "$SOURCE"
