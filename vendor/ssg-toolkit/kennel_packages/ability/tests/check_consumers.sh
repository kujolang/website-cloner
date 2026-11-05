#!/usr/bin/env bash
set -euo pipefail

ABILITY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ROOT="$(cd "$ABILITY_ROOT/.." && pwd)"
KUJO_BIN="${KUJO_BIN:-$WORKSPACE_ROOT/kujo/target/debug/kujo}"

if [[ -d "$WORKSPACE_ROOT/cms" ]]; then
  test ! -f "$WORKSPACE_ROOT/cms/schemas/ability.schema.json"
  rg -q '^from ability import .*validate_ability_definition' "$WORKSPACE_ROOT/cms/backend/modules/ability_contract.kujo"
  rg -q '^name = "ability"$' "$WORKSPACE_ROOT/cms/kennel.lock"
  rg -q '^requested_kind = "commit"$' "$WORKSPACE_ROOT/cms/kennel.lock"
  (cd "$WORKSPACE_ROOT/cms" && "$KUJO_BIN" test-run tests/cms_contract_tests.kujo -v)
fi

if [[ -d "$WORKSPACE_ROOT/agents-sdk" ]]; then
  test ! -f "$WORKSPACE_ROOT/agents-sdk/config/ability.schema.json"
  rg -q '^from ability import .*validate_ability_definition' "$WORKSPACE_ROOT/agents-sdk/src/agents/abilities/contract.kujo"
  rg -q '^name = "ability"$' "$WORKSPACE_ROOT/agents-sdk/kennel.lock"
  rg -q '^requested_kind = "commit"$' "$WORKSPACE_ROOT/agents-sdk/kennel.lock"
  (cd "$WORKSPACE_ROOT/agents-sdk" && "$KUJO_BIN" test-run tests/ability_contract_tests.kujo -v)
fi

if [[ -d "$WORKSPACE_ROOT/mcp" ]]; then
  rg -q '^from ability import .*validate_ability_definition' "$WORKSPACE_ROOT/mcp/src/abilities/projection.kujo"
  rg -q '^name = "ability"$' "$WORKSPACE_ROOT/mcp/kennel.lock"
  rg -q '^requested_kind = "commit"$' "$WORKSPACE_ROOT/mcp/kennel.lock"
  (cd "$WORKSPACE_ROOT/mcp" && "$KUJO_BIN" run tests/test_07_ability_projection.kujo --interpreter)
fi

echo "ability consumer conformance: all checks passed"
