#!/bin/bash
# Parallel (multi-process) build orchestrator for Kujo SSG.
#
# Mirrors how fast SSGs (incl. the reference SSG) scale: shard the embarrassingly-parallel
# per-post rendering across CPU cores using independent `kujo run` processes,
# then merge. The default single-process `kujo run ./build.kujo` is unchanged;
# this is an opt-in fast path for large sites.
#
# Many *small* shards (≈200–300 posts each) keep every worker in the fast linear
# regime; a bounded concurrency (≈ CPU cores) avoids oversubscription.
#
# Usage:
#   bash scripts/build-parallel.sh <shards|auto> <concurrency|auto> [build args...]
#
# `auto` picks a near-optimal shard count (~120 posts/shard — measured to keep each
# worker in the fast, low-super-linearity regime) and concurrency = CPU cores.
#
# Examples:
#   KUJO_BIN=/path/to/kujo bash scripts/build-parallel.sh auto auto \
#       --content content --output output --site-url https://example.com --posts-per-page 25
#   bash scripts/build-parallel.sh 40 12 --content content --output output ...
set -euo pipefail

if [ "$#" -lt 2 ]; then
    echo "Usage: bash scripts/build-parallel.sh <shards|auto> <concurrency|auto> [build args...]" >&2
    exit 2
fi

SHARDS="$1"; shift
CONCURRENCY="$1"; shift
KUJO="${KUJO_BIN:-kujo}"
BUILD="./build.kujo"

# Resolve --content from the build args (default "content") to count posts for auto-sizing.
CONTENT="content"
prev=""
for a in "$@"; do
    case "$a" in
        --phase|--phase=*|--shard|--shard=*|--shards|--shards=*)
            echo "phase, shard, and shards are managed by the parallel orchestrator" >&2
            exit 2
            ;;
    esac
    if [ "$prev" = "--content" ]; then
        CONTENT="$a"
    elif [[ "$a" == --content=* ]]; then
        CONTENT="${a#--content=}"
    fi
    prev="$a"
done

CORES="$( (sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 8) )"
if ! [[ "$CORES" =~ ^[0-9]+$ ]] || [ "$CORES" -lt 1 ]; then
    CORES=8
elif [ "$CORES" -gt 64 ]; then
    CORES=64
fi

if [ "$CONCURRENCY" = "auto" ]; then
    CONCURRENCY="$CORES"
fi

if [ "$SHARDS" = "auto" ]; then
    POSTS=0
    if [ -d "$CONTENT/posts" ]; then
        POSTS="$(find "$CONTENT/posts" -maxdepth 1 -type f -name '*.md' -print | wc -l | tr -d ' ')"
    fi
    [ "$POSTS" -lt 1 ] && POSTS=1
    # ~120 posts/shard, but never fewer than the core count (so all cores stay busy)
    SHARDS=$(( (POSTS + 119) / 120 ))
    [ "$SHARDS" -lt "$CORES" ] && SHARDS="$CORES"
    echo "auto: $POSTS posts -> $SHARDS shards, $CONCURRENCY concurrent"
fi

for n in "$SHARDS" "$CONCURRENCY"; do
    if ! [[ "$n" =~ ^[0-9]+$ ]] || [ "$n" -lt 1 ]; then
        echo "shards and concurrency must be positive integers (or 'auto')" >&2
        exit 2
    fi
done

if [ "$SHARDS" -gt 256 ]; then
    echo "shards must not exceed 256" >&2
    exit 2
fi
if [ "$CONCURRENCY" -gt 64 ]; then
    echo "concurrency must not exceed 64" >&2
    exit 2
fi

start=$(date +%s.%N)

echo "[1/3] setup"
"$KUJO" run "$BUILD" -- --phase setup "$@"
t_setup=$(date +%s.%N)

echo "[2/3] rendering posts: $SHARDS shards, $CONCURRENCY at a time"
fail_flag="$(mktemp)"
active_pids=""
cleanup_fail_flag() {
    rm -f -- "$fail_flag"
}
cleanup_workers() {
    local worker pid
    for worker in $active_pids; do
        pid="${worker%%:*}"
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
    active_pids=""
}
handle_signal() {
    cleanup_workers
    cleanup_fail_flag
    exit 130
}
trap cleanup_fail_flag EXIT
trap handle_signal INT TERM
# Bounded parallelism in fixed-size batches. This avoids `wait -n`, which is
# unavailable on the bash 3.2 that ships with macOS (where the fallback `wait`
# serialized every shard after the first batch). Each batch launches up to
# CONCURRENCY independent `kujo run` workers and waits for the whole batch.
i=0
while [ "$i" -lt "$SHARDS" ]; do
    batch_end=$((i + CONCURRENCY))
    [ "$batch_end" -gt "$SHARDS" ] && batch_end="$SHARDS"
    j="$i"
    active_pids=""
    while [ "$j" -lt "$batch_end" ]; do
        "$KUJO" run "$BUILD" -- --phase posts --shard "$j" --shards "$SHARDS" "$@" &
        active_pids="$active_pids $!:$j"
        j=$((j + 1))
    done
    for worker in $active_pids; do
        pid="${worker%%:*}"
        shard="${worker##*:}"
        if ! wait "$pid"; then
            echo "shard $shard failed" >>"$fail_flag"
        fi
    done
    active_pids=""
    i="$batch_end"
    # A failed batch cannot produce a complete site. Reap its workers, then
    # stop before starting more shards; preserve every failure diagnostic.
    if [ -s "$fail_flag" ]; then
        break
    fi
done

if [ -s "$fail_flag" ]; then
    echo "A posts shard failed:" >&2
    cat "$fail_flag" >&2
    exit 1
fi
cleanup_fail_flag
trap - EXIT INT TERM
t_render=$(date +%s.%N)

echo "[3/3] finalize"
"$KUJO" run "$BUILD" -- --phase finalize --shards "$SHARDS" "$@"
t_finalize=$(date +%s.%N)

printf "  phases: setup=%.1fs  render=%.1fs  finalize=%.1fs\n" \
    "$(echo "$t_setup - $start" | bc)" \
    "$(echo "$t_render - $t_setup" | bc)" \
    "$(echo "$t_finalize - $t_render" | bc)"

end=$(date +%s.%N)
printf "Parallel build complete in %.1fs (%s shards, %s concurrency)\n" \
    "$(echo "$end - $start" | bc)" "$SHARDS" "$CONCURRENCY"
