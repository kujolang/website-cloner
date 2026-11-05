#!/usr/bin/env bash
set -euo pipefail

ABILITY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUJO_BIN="${KUJO_BIN:-$ABILITY_ROOT/../kujo/target/debug/kujo}"

cd "$ABILITY_ROOT"
"$KUJO_BIN" run tests/contract_tests.kujo --interpreter
"$KUJO_BIN" run tests/runtime_contract_tests.kujo --interpreter
"$KUJO_BIN" check ability.kujo
