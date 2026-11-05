#!/usr/bin/env python3
"""Parser-based minification preserves JS behavior and CSS token boundaries."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(os.environ.get("SSG_TEST_SOURCE_ROOT", Path(__file__).resolve().parents[1]))
KUJO = os.environ.get("KUJO_BIN", shutil.which("kujo"))
ESBUILD = os.environ.get("SSG_ESBUILD_BIN", str(ROOT / "node_modules/.bin/esbuild"))


class Minification(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for name in ["content", "templates", "assets", "output"]:
            (self.root / name).mkdir()
        (self.root / "output/keep").write_text("KEEP")
        (self.root / "kujo-ssg.json").write_text(
            json.dumps(
                {
                    "minify": True,
                    "webmcp": False,
                    "no_aux": True,
                    "no_index": True,
                    "fonts": [],
                }
            )
        )

    def build(self, binary=ESBUILD):
        environment = dict(os.environ)
        environment.pop("SSG_ESBUILD_BIN", None)
        if binary is not None:
            environment["SSG_ESBUILD_BIN"] = binary
        return subprocess.run(
            [KUJO, "run", str(ROOT / "build.kujo")],
            cwd=self.root,
            env=environment,
            text=True,
            capture_output=True,
            timeout=120,
        )

    def test_javascript_behavior_and_css_tokens(self):
        javascript = r"""/*! Preserve license */
const label = "a  b"; // preserve this statement boundary
function automaticSemicolon() { return
  {broken: true}; }
globalThis.result = {label, regex: /a {2}b/.test(label),
  template: String.raw`a  ${label} \n b`, asi: automaticSemicolon(),
  environment: process.env.NODE_ENV, unicode: "été 🐕"};
"""
        css = '/*! Preserve license */\np :is(.a, .b) { content: "a  b"; width: calc(100% - 2px); --label: "x  y"; }\n'
        # Unicode, spaces and interior .js segments must retain their complete stem.
        (self.root / "assets/behavior.js").write_text(javascript)
        (self.root / "assets/été.js extra.js").write_text("globalThis.extra = true;")
        (self.root / "assets/style.css").write_text(css)
        (self.root / "assets/vendor.min.js").write_text("/* untouched */")
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        generated = self.root / "output/assets/behavior.min.js"
        evaluator = "const fs=require('fs'),vm=require('vm'); const c={process:{env:{NODE_ENV:'keep-dynamic'}}}; vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),c); console.log(JSON.stringify(c.result));"

        def evaluate(path):
            return subprocess.check_output(
                ["node", "-e", evaluator, str(path)], text=True
            )

        self.assertEqual(
            evaluate(self.root / "assets/behavior.js"), evaluate(generated)
        )
        self.assertTrue((self.root / "output/assets/été.js extra.min.js").exists())
        self.assertIn("Preserve license", generated.read_text())
        min_css = (self.root / "output/assets/style.min.css").read_text()
        self.assertIn('"a  b"', min_css)
        self.assertIn('"x  y"', min_css)
        self.assertIn("100% - 2px", min_css)
        self.assertIn("p :is", min_css)
        self.assertIn("Preserve license", min_css)
        self.assertEqual(
            (self.root / "output/assets/vendor.min.js").read_text(), "/* untouched */"
        )
        self.assertLess(generated.stat().st_size, len(javascript.encode()))
        self.assertLess(len(min_css.encode()), len(css.encode()))
        # The local package entry point works without an OS-specific npm shim.
        (self.root / "node_modules").mkdir()
        (self.root / "node_modules/esbuild").symlink_to(
            ROOT / "node_modules/esbuild", target_is_directory=True
        )
        result = self.build(binary=None)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(evaluate(self.root / "assets/behavior.js"), evaluate(generated))

    def test_missing_minifier_preserves_existing_output(self):
        result = self.build(str(self.root / "missing-esbuild"))
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.root / "output/keep").read_text(), "KEEP")
        self.assertIn("npm ci --ignore-scripts", result.stdout + result.stderr)

    def test_wrong_version_preserves_existing_output(self):
        binary = self.root / "wrong-version"
        binary.write_text("#!/bin/sh\nprintf '0.0.0\\n'\n")
        binary.chmod(0o755)
        result = self.build(str(binary))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("esbuild 0.28.2", result.stdout + result.stderr)
        self.assertEqual((self.root / "output/keep").read_text(), "KEEP")

    def test_parse_failure_is_not_silently_published(self):
        (self.root / "assets/broken.js").write_text('const broken = "unterminated')
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("broken.js", result.stdout + result.stderr)
        self.assertFalse((self.root / "output/assets/broken.min.js").exists())


if __name__ == "__main__":
    unittest.main()
