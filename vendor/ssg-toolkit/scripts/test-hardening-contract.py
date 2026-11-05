#!/usr/bin/env python3
"""Behavioral regressions for local inspection and generated-content boundaries."""

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

REPO = Path(
    os.environ.get("SSG_TEST_SOURCE_ROOT", Path(__file__).resolve().parents[1])
).resolve()


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, REPO / "scripts" / filename)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


helper = module("ability_helper", "ability-inspect.py")
reducer = module("docgen_reducer", "docgen_reduce.py")


class Boundaries(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.output = self.root / "output"
        self.output.mkdir()

    def rejected(self, code, function, *args):
        receipt = io.StringIO()
        with contextlib.redirect_stdout(receipt), self.assertRaises(SystemExit):
            function(*args)
        self.assertEqual(json.loads(receipt.getvalue())["code"], code)

    def test_inspection_counts_all_links_and_keeps_actionable_details(self):
        for i in range(205):
            page = self.output / f"p{i}"
            page.mkdir()
            (page / "index.html").write_text("<title>Page</title>")
        (self.output / "index.html").write_text(
            "<title>Home</title>" + '<a href="missing">bad</a>' * 250
        )
        for name in ("sitemap.xml", "robots.txt", "llms.txt", "feed/index.xml"):
            target = self.output / name
            target.parent.mkdir(exist_ok=True)
            target.write_text("fixture")
        result = helper.output_inspect(self.root, "output")
        self.assertEqual(result["broken_link_count"], 250)
        self.assertLessEqual(len(result["details"]), 200)
        readiness = helper.readiness(self.root, "output")
        self.assertFalse(readiness["ready"])
        self.assertEqual(readiness["issue_count"], 250)
        self.assertTrue(readiness["details"][0].startswith("broken:"))

    def test_inspection_avoids_hashing_but_comparison_checks_bytes(self):
        (self.output / "index.html").write_text("<title>Home</title>")
        with patch.object(
            helper, "hash_file", side_effect=AssertionError("inspection must not hash")
        ):
            helper.output_inspect(self.root, "output")
        other = self.root / "other"
        other.mkdir()
        (other / "index.html").write_text("<title>Away</title>")
        self.assertFalse(
            helper.output_compare(self.root, "output", "other")["identical"]
        )

    def test_enumeration_bounds_non_markdown_files_and_directories(self):
        content = self.root / "content"
        content.mkdir()
        for i in range(4):
            (content / f"{i}.bin").touch()
        with patch.object(helper, "MAX_FILES", 3):
            self.rejected("file_limit_exceeded", helper.source_list, self.root)
        for path in content.iterdir():
            path.unlink()
        for i in range(4):
            (content / str(i)).mkdir()
        with patch.object(helper, "MAX_ENTRIES", 3, create=True):
            self.rejected("entry_limit_exceeded", helper.source_list, self.root)

    def test_export_checks_ancestors_before_creating_directories(self):
        self.rejected(
            "invalid_artifact_path",
            helper.export_artifact,
            self.root,
            "output",
            "../site.tar",
        )
        (self.root / "linked.tar").symlink_to(self.root / "missing.tar")
        self.rejected(
            "invalid_artifact_path",
            helper.export_artifact,
            self.root,
            "output",
            "linked.tar",
        )
        outside = self.root / "outside"
        outside.mkdir()
        project = self.root / "project"
        project.mkdir()
        (project / "output").mkdir()
        (project / "linked").symlink_to(outside, target_is_directory=True)
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit):
            helper.export_artifact(project, "output", "linked/new/site.tar")
        self.assertFalse((outside / "new").exists())

    def test_failed_export_removes_only_its_partial_archive(self):
        (self.output / "index.html").write_text("<title>Home</title>")
        with patch.object(
            helper.tarfile.TarFile,
            "addfile",
            side_effect=OSError("fixture write failure"),
        ):
            with self.assertRaises(OSError):
                helper.export_artifact(self.root, "output", "archive.tar")
        self.assertFalse((self.root / "archive.tar").exists())
        (self.root / "archive.tar").write_text("existing sentinel")
        self.rejected(
            "artifact_exists",
            helper.export_artifact,
            self.root,
            "output",
            "archive.tar",
        )
        self.assertEqual((self.root / "archive.tar").read_text(), "existing sentinel")

    def test_helper_errors_are_json_without_tracebacks(self):
        result = subprocess.run(
            [
                "python3",
                str(REPO / "scripts/ability-inspect.py"),
                "output-inspect",
                "missing",
            ],
            cwd=self.root,
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(result.stderr)
        self.assertEqual(json.loads(result.stdout)["code"], "invalid_directory")

    def test_stale_manifest_is_validated_before_any_deletion(self):
        content = self.root / "content"
        content.mkdir()
        (content / "stale.md").write_text("keep until validated")
        (self.output / "victim.md").write_text("outside sentinel")
        (content / "linked").symlink_to(self.output, target_is_directory=True)
        (content / ".docgen-ssg-manifest.json").write_text(
            json.dumps(
                {
                    "schema_version": "docgen-ssg-manifest/v1",
                    "files": ["stale.md", "linked/victim.md"],
                }
            )
        )
        with self.assertRaises(SystemExit):
            reducer.remove_stale(content, ".docgen-ssg-manifest.json", [], False)
        self.assertEqual((self.output / "victim.md").read_text(), "outside sentinel")
        self.assertTrue((content / "stale.md").exists())

    def test_python_search_does_not_publish_external_file_links(self):
        content = self.root / "content"
        content.mkdir()
        (content / "good.md").write_text("---\ntitle: Good\n---\nVisible")
        (self.output / "secret").write_text("EXTERNAL-SEARCH-SENTINEL")
        (content / "secret.md").symlink_to(self.output / "secret")
        (content / "cycle").symlink_to(content, target_is_directory=True)
        result = subprocess.run(
            [
                "python3",
                str(REPO / "scripts/docs_search_index.py"),
                "--content",
                str(content),
                "--output",
                str(self.root / "search.json"),
            ],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads((self.root / "search.json").read_text())
        self.assertEqual([item["title"] for item in payload["items"]], ["Good"])


class Parallel(unittest.TestCase):
    def test_phase_ownership_and_failed_batch_stop(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            fake = root / "kujo"
            log = root / "calls"
            fake.write_text(
                '#!/bin/bash\nprintf "%s\\n" "$*" >> "$CALL_LOG"\ncase "$*" in *"--phase posts"*) exit 7;; esac\n'
            )
            fake.chmod(0o700)
            env = dict(os.environ, KUJO_BIN=str(fake), CALL_LOG=str(log))
            wrapper = str(REPO / "scripts/build-parallel.sh")
            for flag in ("--phase", "--phase=full", "--shards", "--shard=0"):
                result = subprocess.run(
                    ["bash", wrapper, "4", "2", flag, "full"],
                    env=env,
                    capture_output=True,
                    text=True,
                )
                self.assertEqual(result.returncode, 2)
                self.assertFalse(log.exists())
            result = subprocess.run(
                ["bash", wrapper, "4", "2"], env=env, capture_output=True, text=True
            )
            self.assertEqual(result.returncode, 1)
            calls = log.read_text().splitlines()
            self.assertEqual(
                len(calls), 3
            )  # setup + the two workers in the first batch
            self.assertNotIn("--phase finalize", "\n".join(calls))
            self.assertIn("shard 0 failed", result.stderr)
            self.assertIn("shard 1 failed", result.stderr)


if __name__ == "__main__":
    unittest.main()
