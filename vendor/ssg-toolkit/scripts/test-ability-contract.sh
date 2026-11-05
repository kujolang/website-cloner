#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 - "$repo_root" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
catalog = json.loads((root / "abilities/registry.json").read_text())
assert catalog["schema"] == "kujo.ssg.ability-catalog/v1"
assert catalog["pack_id"] == "kujo.ssg.core"
assert catalog["pack_version"] == "1.0.0"
assert catalog["ability_version"] == "1.0.1"
assert catalog["runtime"] == "runtime.kujo"
assert (root / "abilities" / catalog["runtime"]).is_file()
manifest = (root / "kennel.toml").read_text()
lock = (root / "kennel.lock").read_text()
pin = "be093e62bc93e5ec01e99e7da16c5657507ac820"
assert f'commit = "{pin}"' in manifest
assert f'resolved_commit = "{pin}"' in lock
ids = []
for entry in catalog["entries"]:
    definition = json.loads((root / "abilities" / entry["definition"]).read_text())
    assert definition["schema"] == "kujo.ability/v1"
    assert definition["version"] == "1.0.0"
    assert definition["input_schema"]["type"] == "object"
    assert definition["output_schema"]["type"] == "object"
    assert definition["effects"]
    ids.append(definition["id"])
assert len(ids) == len(set(ids)) == 10
assert "kujo.ssg.site.build" in ids
assert "kujo.ssg.site.build-shards" in ids
assert "kujo.ssg.artifact.export" in ids
build = json.loads((root / "abilities/kujo.ssg.site.build.json").read_text())
assert {(effect["kind"], effect["resource"]) for effect in build["effects"]} == {
    ("read", "kujo.ssg.project"),
    ("write", "kujo.ssg.generated-output"),
    ("external", "kujo.ssg.network"),
}
print("SSG Ability catalog contract passed")
PY
