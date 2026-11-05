#!/usr/bin/env python3
"""Configuration and docs pipeline contracts using the standard Kujo VM."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

REPO = Path(
    os.environ.get("SSG_TEST_SOURCE_ROOT", Path(__file__).resolve().parents[1])
).resolve()
KUJO = os.environ.get("KUJO_BIN", shutil.which("kujo"))


class Pipeline(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        (self.root / "scripts").mkdir()
        shutil.copy(REPO / "build.kujo", self.root / "build.kujo")
        for name in [
            "update_docs.kujo",
            "docgen_ssg_bridge.kujo",
            "docgen_reduce.py",
            "docs_search_index.py",
            "docs_search_index.kujo",
            "validate-generated-output.sh",
        ]:
            shutil.copy(REPO / "scripts" / name, self.root / "scripts" / name)
        (self.root / "templates").mkdir()
        (self.root / "templates/layout.html").write_text(
            '<!DOCTYPE html>\n<html lang="en"><head><title>{{page_title}}</title>{{canonical_tag}}{{json_ld}}</head><body><main>{{content}}</main></body></html>'
        )
        self.config = {
            "content": "source docs",
            "assets": "site assets",
            "output": "published site",
            "webmcp": False,
            "no_aux": True,
            "fonts": [],
        }
        self.write_config()
        (self.root / "source docs/pages").mkdir(parents=True)
        (self.root / "source docs/pages/guide.md").write_text(
            "---\ntitle: Pipeline Guide\n---\nVisible content"
        )
        (self.root / "site assets/js").mkdir(parents=True)
        (self.root / "site assets/js/marker.js").write_text("/* copied */")

    def write_config(self):
        (self.root / "kujo-ssg.json").write_text(json.dumps(self.config))

    def run_kujo(self, script, *args):
        return subprocess.run(
            [KUJO, "run", str(self.root / script), "--", *map(str, args)],
            cwd=self.root,
            env=dict(os.environ, KUJO_BIN=KUJO),
            capture_output=True,
            text=True,
            timeout=120,
        )

    def success(self, result):
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def payload(self):
        (self.root / "project.json").write_text(
            json.dumps(
                {"languages": [], "modules": [], "symbols": [], "diagnostics": []}
            )
        )
        (self.root / "gaps.json").write_text("[]")
        summary = {
            "schema_version": "docgen-summary/v1",
            "gate_failed": False,
            "gate_failures": [],
            "item_count": 0,
            "project_symbol_count": 0,
            "undocumented_count": 0,
            "broken_link_count": 0,
            "warning_count": 0,
            "languages": [],
            "discovery_skip_counts": {},
            "cache_stats": {"hits": 0, "misses": 0},
        }
        path = self.root / "payload.json"
        path.write_text(
            json.dumps(
                {
                    "file": "/fixture/repo",
                    "summary": summary,
                    "project_json_path": str(self.root / "project.json"),
                    "gaps_json_path": str(self.root / "gaps.json"),
                }
            )
        )
        return path

    def test_inspection_is_read_only_and_uses_canonical_precedence(self):
        (self.root / "published site").mkdir()
        sentinel = self.root / "published site/keep"
        sentinel.write_text("keep")
        self.config["not_public"] = "PRIVATE-CONFIG-SENTINEL"
        self.write_config()
        for suffix in ["json", "yaml", "yml"]:
            path = self.root / f"kujo-ssg.{suffix}"
            if suffix != "json":
                path.write_text(f"content: {suffix}-content\noutput: {suffix}-output\n")
            result = self.run_kujo("build.kujo", "--inspect-config")
            self.success(result)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["schema_version"], "kujo-ssg-config/v1")
            self.assertEqual(
                payload["settings"]["content"],
                self.config["content"] if suffix == "json" else suffix + "-content",
            )
            self.assertNotIn("PRIVATE-CONFIG-SENTINEL", result.stdout)
        result = self.run_kujo(
            "build.kujo",
            "--inspect-config",
            "--content",
            "override source",
            "--output=override output",
            "--site-url",
            "https://example.test///",
        )
        self.success(result)
        settings = json.loads(result.stdout)["settings"]
        self.assertEqual(settings["content"], "override source")
        self.assertEqual(settings["output"], "override output")
        self.assertEqual(settings["site_url"], "https://example.test")
        self.assertEqual(sentinel.read_text(), "keep")
        self.assertFalse((self.root / "override output").exists())
        self.assertFalse((self.root / ".cache").exists())

    def test_inspection_rejects_invalid_config_and_mutating_modes(self):
        for args in [
            ("--init", "yml"),
            ("--output", "source docs"),
            ("--shards", "0"),
            ("--unknown",),
        ]:
            result = self.run_kujo("build.kujo", "--inspect-config", *args)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(json.loads(result.stdout)["ok"])
        (self.root / "kujo-ssg.json").write_text("{bad")
        result = self.run_kujo("build.kujo", "--inspect-config")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(json.loads(result.stdout)["ok"])
        self.assertFalse((self.root / "kujo-ssg.yml").exists())
        self.assertFalse((self.root / "published site").exists())

    def test_update_uses_config_and_cli_roots_through_validation(self):
        # Real DocGen, real build, real output validator; use a tiny documented input.
        target = self.root / "target"
        target.mkdir()
        (target / "math.kujo").write_text(
            "/// Adds two numbers.\npub func add(a, b) { return a + b }\n"
        )
        for override in [False, True]:
            args = []
            content = "source docs"
            output = "published site"
            assets = "site assets"
            if override:
                content = "other docs"
                output = "other output"
                assets = "other assets"
                shutil.copytree(self.root / "source docs", self.root / content)
                shutil.copytree(self.root / "templates", self.root / "other templates")
                (self.root / "templates/layout.html").write_text(
                    "<html>wrong template</html>"
                )
                args = [
                    "--content",
                    content,
                    "--output",
                    output,
                    "--assets",
                    assets,
                    "--templates",
                    "other templates",
                ]
            result = self.run_kujo(
                "scripts/update_docs.kujo",
                "--target-repo",
                target,
                "--site-url",
                "https://pipeline.example.test",
                "--max-undocumented",
                "10",
                "--max-warnings",
                "10",
                "--allow-adapter-low-yield",
                *args,
            )
            self.success(result)
            self.assertTrue(
                (
                    self.root
                    / content
                    / "reference/generated/.docgen-ssg-manifest.json"
                ).is_file()
            )
            self.assertTrue((self.root / output / "guide/index.html").is_file())
            index = json.loads(
                (self.root / output / "assets/js/docs-search-index.json").read_text()
            )
            self.assertIn("Pipeline Guide", [item["title"] for item in index["items"]])
            self.assertIn("API Reference", [item["title"] for item in index["items"]])
            self.assertTrue(
                (self.root / assets / "js/docs-search-index.json").is_file()
            )
            self.assertFalse((self.root / "output").exists())

    def test_bridge_checks_repository_before_final_requested_build(self):
        # CI intentionally overwrites output; the requested final build must win.
        ci = self.root / "scripts/run_ci_checks.sh"
        ci.write_text(
            '#!/bin/bash\nmkdir -p "published site"\nprintf CI > "published site/ci-sentinel"\n'
        )
        result = self.run_kujo(
            "scripts/docgen_ssg_bridge.kujo",
            "--docgen-payload",
            self.payload(),
            "--content-out",
            "source docs/reference",
            "--site-url",
            "https://requested.example.test",
        )
        self.success(result)
        self.assertFalse((self.root / "published site/ci-sentinel").exists())
        self.assertIn(
            "https://requested.example.test",
            (self.root / "published site/guide/index.html").read_text(),
        )

    def test_packaged_bridge_can_skip_repository_checks_but_validates_output(self):
        result = self.run_kujo(
            "scripts/docgen_ssg_bridge.kujo",
            "--docgen-payload",
            self.payload(),
            "--skip-repository-checks",
            "--output",
            "alternate site",
        )
        self.success(result)
        self.assertTrue(
            (self.root / "source docs/reference/.docgen-ssg-manifest.json").is_file()
        )
        self.assertTrue((self.root / "alternate site/guide/index.html").is_file())
        (self.root / "templates/layout.html").write_text("<html>invalid</html>")
        result = self.run_kujo(
            "scripts/docgen_ssg_bridge.kujo",
            "--docgen-payload",
            self.payload(),
            "--skip-repository-checks",
            "--output",
            "invalid site",
        )
        self.assertNotEqual(result.returncode, 0)

    def test_missing_repository_checks_fail_before_generation(self):
        result = self.run_kujo(
            "scripts/docgen_ssg_bridge.kujo",
            "--docgen-payload",
            self.payload(),
            "--content-out",
            "source docs/reference",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--skip-repository-checks", result.stdout + result.stderr)
        self.assertFalse((self.root / "source docs/reference").exists())

    def test_repeated_docgen_receipts_replace_files_but_reject_symlinks(self):
        target = self.root / "target"
        target.mkdir()
        (target / "math.kujo").write_text(
            "/// Adds two numbers.\npub func add(a, b) { return a + b }\n"
        )
        args = [
            "--target-repo",
            target,
            "--skip-build",
            "--allow-adapter-low-yield",
            "--max-warnings",
            "10",
            "--max-undocumented",
            "10",
        ]
        for _ in range(2):
            self.success(self.run_kujo("scripts/docgen_ssg_bridge.kujo", *args))
        receipt = self.root / ".docgen/output/docgen-cli.json"
        self.assertIsInstance(json.loads(receipt.read_text()), dict)
        sentinel = self.root / "keep.json"
        sentinel.write_text("KEEP")
        receipt.unlink()
        receipt.symlink_to(sentinel)
        result = self.run_kujo("scripts/docgen_ssg_bridge.kujo", *args)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(sentinel.read_text(), "KEEP")

    def test_repository_gate_budget_logs_and_failure(self):
        ci = self.root / "scripts/run_ci_checks.sh"
        # More output than the in-memory preview must survive in the log files.
        ci.write_text(
            "#!/bin/bash\npython3 -c 'print(\"evidence\" * 20000)'\nprintf diagnostic >&2\nexit 7\n"
        )
        result = self.run_kujo(
            "scripts/docgen_ssg_bridge.kujo", "--docgen-payload", self.payload()
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("exit code 7", result.stdout)
        self.assertLess(len(result.stdout), 4096)
        logs = list((self.root / ".docgen/output").glob("ci-*"))
        self.assertEqual(len(logs), 1)
        self.assertEqual(
            (logs[0] / "stdout.log").read_text(), "evidence" * 20000 + "\n"
        )
        self.assertEqual((logs[0] / "stderr.log").read_text(), "diagnostic")
        self.assertFalse((self.root / "published site").exists())
        # A CPU-bound fixture proves the explicit deadline without arbitrary sleeps.
        ci.write_text("#!/bin/bash\nwhile :; do :; done\n")
        result = self.run_kujo(
            "scripts/docgen_ssg_bridge.kujo",
            "--docgen-payload",
            self.payload(),
            "--repository-check-timeout",
            "1",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("timed out", result.stdout)
        for value in ["0", "-1", "1.5", "86401", "garbage"]:
            result = self.run_kujo(
                "scripts/docgen_ssg_bridge.kujo", "--repository-check-timeout", value
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("1 to 86400", result.stdout)

    def test_bad_pipeline_config_fails_before_generating_content(self):
        self.config["output"] = "source docs"
        self.write_config()
        result = self.run_kujo("scripts/update_docs.kujo", "--target-repo", "unused")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / ".docgen").exists())
        self.assertFalse((self.root / "source docs/reference").exists())


if __name__ == "__main__":
    unittest.main()
