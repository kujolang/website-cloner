#!/usr/bin/env python3
"""Exercise publication and DocGen mutation boundaries on the standard Kujo VM."""

from html.parser import HTMLParser
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
KUJO = os.environ.get("KUJO_BIN", "kujo")


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.active = None
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script":
            self.active = [attrs, ""]
            self.scripts.append(self.active)
        if tag == "a":
            self.links.append(attrs.get("href", ""))

    def handle_endtag(self, tag):
        if tag == "script":
            self.active = None

    def handle_data(self, text):
        if self.active is not None:
            self.active[1] += text


def run(script, root, *args):
    return subprocess.run(
        [KUJO, "run", str(REPO / script), "--", *map(str, args)],
        cwd=root,
        capture_output=True,
        text=True,
        timeout=120,
    )


class Publication(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name).resolve()
        cls.content = cls.root / "content"
        (cls.content / "posts").mkdir(parents=True)
        external = cls.root / "external"
        external.mkdir()
        (external / "private.md").write_text(
            "---\ntitle: External\n---\nEXTERNAL-PUBLICATION-SENTINEL"
        )
        for name in ("pages", "linked"):
            (cls.content / name).symlink_to(external, target_is_directory=True)
        (cls.content / "posts" / "external.md").symlink_to(external / "private.md")
        (external / "authors.yml").write_text("1: EXTERNAL-AUTHOR-SENTINEL\n")
        (cls.content / "authors.yml").symlink_to(external / "authors.yml")
        cls.title = "Café 日本語 </script><script>metadataAttack()</script>"
        cls.description = "Control\x01 text <tag>"
        (cls.content / "posts" / "safe.md").write_text(
            "---\ntitle: "
            + json.dumps(cls.title)
            + "\nseo_description: "
            + json.dumps(cls.description)
            + '\nauthor: 1\ntemplate: docs\nprevious: "java\\tscript:alert(1)"\nnext: /safe:next/\n---\nSafe body\n'
        )
        cls.placeholder_title = "Literal {{lang}} {{stylesheet_path}} {{content}}"
        (cls.content / "posts" / "placeholders.md").write_text(
            "---\ntitle: " + json.dumps(cls.placeholder_title) + "\n---\nBody with a [link](https://example.test).\n"
        )
        shutil.copytree(REPO / "templates", cls.root / "templates")
        cls.result = run("build.kujo", cls.root, "--site-url", "https://example.test")
        if cls.result.returncode:
            raise AssertionError(cls.result.stdout + cls.result.stderr)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_metadata_stays_json_and_preserves_text(self):
        parsed = Scripts()
        parsed.feed((self.root / "output/blog/safe/index.html").read_text())
        self.assertFalse(
            any(
                "metadataAttack()" in body
                for attrs, body in parsed.scripts
                if attrs.get("type") != "application/ld+json"
            )
        )
        metadata = [
            json.loads(body)
            for attrs, body in parsed.scripts
            if attrs.get("type") == "application/ld+json"
        ]
        self.assertEqual(metadata[0]["headline"], self.title)
        self.assertEqual(metadata[0]["description"], self.description)
        self.assertIn("/safe:next/", parsed.links)
        self.assertFalse(
            any("script:" in href.lower().replace("\t", "") for href in parsed.links)
        )

    def test_json_metadata_is_not_reinterpreted_as_template_source(self):
        parsed = Scripts()
        parsed.feed((self.root / "output/blog/placeholders/index.html").read_text())
        metadata = [
            json.loads(body)
            for attrs, body in parsed.scripts
            if attrs.get("type") == "application/ld+json"
        ]
        self.assertEqual(metadata[0]["headline"], self.placeholder_title)
        self.assertEqual(metadata[0]["name"], self.placeholder_title)

    def test_collection_roots_and_lookup_links_are_not_published(self):
        for file in (self.root / "output").rglob("*"):
            if file.is_file() and file.suffix in (".html", ".json", ".xml", ".txt"):
                text = file.read_text()
                self.assertNotIn("EXTERNAL-PUBLICATION-SENTINEL", text, str(file))
                self.assertNotIn("EXTERNAL-AUTHOR-SENTINEL", text, str(file))
        self.assertFalse((self.root / "output/private").exists())
        self.assertFalse((self.root / "output/linked").exists())

    def test_kujo_search_skips_external_links(self):
        result = run(
            "scripts/docs_search_index.kujo",
            self.root,
            "--content",
            "content",
            "--output",
            "search.json",
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads((self.root / "search.json").read_text())
        self.assertEqual(len(payload["items"]), 2)
        self.assertEqual(
            {item["title"] for item in payload["items"]},
            {self.title, self.placeholder_title},
        )
        self.assertNotIn("EXTERNAL-PUBLICATION-SENTINEL", json.dumps(payload))


class Bridge(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        (self.root / "scripts").mkdir()
        shutil.copy(REPO / "scripts/docgen_reduce.py", self.root / "scripts")
        self.generated = self.root / "content/reference"
        self.generated.mkdir(parents=True)
        self.project = self.root / "project.json"
        self.project.write_text(
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
            "discovery_skip_counts": {},
            "cache_stats": {"hits": 0, "misses": 0},
            "languages": [],
        }
        (self.root / "payload.json").write_text(
            json.dumps(
                {
                    "file": "/fixture/repo",
                    "project_json_path": str(self.project),
                    "gaps_json_path": str(self.root / "gaps.json"),
                    "summary": summary,
                }
            )
        )
        self.args = [
            "--ssg-root",
            self.root,
            "--docgen-payload",
            self.root / "payload.json",
        ]

    def large(self):
        # Force the supported Python path without inflating useful fixture data.
        with self.project.open("a") as handle:
            handle.write(" " * (8 * 1024 * 1024))

    def invoke(self, *args):
        return run("scripts/docgen_ssg_bridge.kujo", self.root, *self.args, *args)

    def test_dry_run_does_not_build_or_mutate_either_backend(self):
        # A build invocation would create this sentinel, avoiding any dependency
        # on a complete starter and proving dry-run does not dispatch a build.
        (self.root / "build.kujo").write_text('write_file("build-ran", "bad")\n')
        for backend in ("kujo", "python"):
            with self.subTest(backend=backend):
                if backend == "python":
                    self.large()
                result = self.invoke("--dry-run")
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertFalse((self.root / "build-ran").exists())
                self.assertEqual(list(self.generated.iterdir()), [])

    def test_generated_and_manifest_links_are_rejected_before_mutations(self):
        sentinel = self.root / "sentinel.md"
        sentinel.write_text("outside sentinel")
        for backend in ("kujo", "python"):
            if backend == "python":
                self.large()
            for filename in ("api-reference.md", ".docgen-ssg-manifest.json"):
                with self.subTest(backend=backend, filename=filename):
                    target = self.generated / filename
                    target.symlink_to(sentinel)
                    result = self.invoke("--skip-build")
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("symbolic link", result.stdout + result.stderr)
                    self.assertEqual(sentinel.read_text(), "outside sentinel")
                    target.unlink()
            (self.generated / "linked").symlink_to(self.root, target_is_directory=True)
            (self.generated / "stale.md").write_text("stale sentinel")
            manifest = self.generated / ".docgen-ssg-manifest.json"
            manifest.write_text(
                json.dumps(
                    {
                        "schema_version": "docgen-ssg-manifest/v1",
                        "files": ["stale.md", "linked/sentinel.md"],
                    }
                )
            )
            result = self.invoke("--skip-build")
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(sentinel.read_text(), "outside sentinel")
            self.assertTrue((self.generated / "stale.md").exists())
            manifest.unlink()
            (self.generated / "linked").unlink()
            (self.generated / "stale.md").unlink()

    def test_dry_run_requires_existing_payload_before_docgen(self):
        result = run(
            "scripts/docgen_ssg_bridge.kujo",
            self.root,
            "--dry-run",
            "--target-repo",
            self.root,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--dry-run requires --docgen-payload", result.stdout)
        self.assertFalse((self.root / ".docgen").exists())


if __name__ == "__main__":
    unittest.main()
