#!/usr/bin/env bash

export SSG_ESBUILD_BIN="${SSG_ESBUILD_BIN:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/node_modules/.bin/esbuild}"

LAST_OUTPUT=""

run_capture() {
	local output
	local status
	local timeout_secs="${SSG_TEST_COMMAND_TIMEOUT_SECS:-300}"

	printf 'RUN'
	printf ' %q' "$@"
	printf '\n'

	if command -v timeout >/dev/null 2>&1; then
		output=$(timeout "$timeout_secs" "$@" 2>&1)
		status=$?
	else
		output=$("$@" 2>&1)
		status=$?
	fi
	LAST_OUTPUT="$output"
	return "$status"
}

run_expect_success() {
	local status
	set +e
	run_capture "$@"
	status=$?
	set -e
	if [[ "$status" -ne 0 ]]; then
		echo "FAIL command should have succeeded: $*"
		if [[ "$status" -eq 124 ]]; then
			echo "Command timed out after ${SSG_TEST_COMMAND_TIMEOUT_SECS:-300}s"
		fi
		printf '%s\n' "$LAST_OUTPUT"
		exit 1
	fi
}

run_expect_failure() {
	local status
	set +e
	run_capture "$@"
	status=$?
	set -e
	if [[ "$status" -eq 0 ]]; then
		echo "FAIL command should have failed: $*"
		printf '%s\n' "$LAST_OUTPUT"
		exit 1
	fi
	if [[ "$status" -eq 124 ]]; then
		echo "FAIL command timed out instead of failing normally: $*"
		printf '%s\n' "$LAST_OUTPUT"
		exit 1
	fi
}

assert_output_contains() {
	local needle="$1"
	if ! printf '%s\n' "$LAST_OUTPUT" | grep -Fq "$needle"; then
		echo "FAIL expected output to contain: $needle"
		printf '%s\n' "$LAST_OUTPUT"
		exit 1
	fi
}

assert_path_exists() {
	local target_path="$1"
	if [[ ! -e "$target_path" ]]; then
		echo "FAIL expected path to exist: $target_path"
		exit 1
	fi
}

assert_path_missing() {
	local target_path="$1"
	if [[ -e "$target_path" ]]; then
		echo "FAIL expected path to be missing: $target_path"
		exit 1
	fi
}

assert_file_contains() {
	local target_path="$1"
	local needle="$2"
	if ! grep -Fq "$needle" "$target_path"; then
		echo "FAIL expected file to contain: $needle"
		echo "FILE: $target_path"
		exit 1
	fi
}

assert_file_not_contains() {
	local target_path="$1"
	local needle="$2"
	if grep -Fq "$needle" "$target_path"; then
		echo "FAIL expected file to NOT contain: $needle"
		echo "FILE: $target_path"
		exit 1
	fi
}

setup_temp_site() {
	local repo_root="$1"
	local site_dir="$2"
	cp "$repo_root/kujo-ssg.yml" "$site_dir/kujo-ssg.yml"
	cp -R "$repo_root/assets" "$site_dir/assets"
	cp -R "$repo_root/content" "$site_dir/content"
	cp -R "$repo_root/templates" "$site_dir/templates"
}
