#!/usr/bin/env python3
"""Generate synthetic content for large-site build benchmarks.

Usage:
    python3 scripts/generate-benchmark-content.py <count> <out_dir>

Example:
    python3 scripts/generate-benchmark-content.py 10000 bench-content
    kujo run ./build.kujo -- --content bench-content --output bench-output \
        --site-url https://bench.example.com --posts-per-page 25

The generated tree includes posts/, pages/, and copies the core taxonomy
lookups so the build exercises the full pipeline (dates, excerpts, tags,
categories, sitemap, feed, llms).
"""

import os
import random
import shutil
import sys
from pathlib import Path

MARKER_NAME = ".kujo-ssg-benchmark-content"
MARKER_CONTENT = "kujo-ssg-benchmark-content/v1\n"
MAX_POSTS = 100_000

WORDS = (
    "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod "
    "tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam "
    "quis nostrud exercitation ullamco laboris"
).split()


def para(n: int) -> str:
    return " ".join(random.choice(WORDS) for _ in range(n))


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    try:
        count = int(sys.argv[1])
    except ValueError:
        print("count must be an integer", file=sys.stderr)
        return 2
    if count < 1 or count > MAX_POSTS:
        print(f"count must be between 1 and {MAX_POSTS}", file=sys.stderr)
        return 2

    root = Path(sys.argv[2])
    resolved_root = root.resolve(strict=False)
    cwd = Path.cwd().resolve()
    if resolved_root == cwd or resolved_root in cwd.parents:
        print(
            "refusing to replace the working directory or one of its ancestors",
            file=sys.stderr,
        )
        return 2

    random.seed(42)

    if root.exists() or root.is_symlink():
        marker = root / MARKER_NAME
        if (
            root.is_symlink()
            or not root.is_dir()
            or marker.is_symlink()
            or not marker.is_file()
            or marker.read_text(encoding="utf-8") != MARKER_CONTENT
        ):
            print(
                f"refusing to replace unowned benchmark directory: {root} (missing valid {MARKER_NAME})",
                file=sys.stderr,
            )
            return 2
        shutil.rmtree(root)
    (root / "posts").mkdir(parents=True)
    (root / "pages").mkdir()
    (root / MARKER_NAME).write_text(MARKER_CONTENT, encoding="utf-8")

    for name in ("authors.yml", "categories.yml", "tags.yml"):
        src = os.path.join("content", name)
        if os.path.exists(src):
            shutil.copy(src, root / name)

    for i in range(1, count + 1):
        y = 2024 + (i % 2)
        m = random.randint(1, 12)
        d = random.randint(1, 28)
        title = f"Benchmark Post Number {i} About {random.choice(WORDS).title()}"
        body = "\n\n".join(f"## Section {j}\n\n{para(40)}" for j in range(1, 5))
        fm = (
            f"---\ntitle: {title}\n"
            f"date: {y}-{m:02d}-{d:02d}\n"
            f"author: {random.randint(1, 3)}\n"
            f"description: Synthetic benchmark post {i}.\n"
            f"categories: [{random.randint(1, 3)}]\n"
            f"tags: [{random.randint(1, 5)}, {random.randint(1, 5)}]\n"
            f"excerpt: Synthetic excerpt for benchmark post {i}.\n"
            f"---\n\n{body}\n"
        )
        with (root / "posts" / f"post-{i:05d}.md").open("w", encoding="utf-8") as f:
            f.write(fm)

    for name, t in (("about", "About"), ("contact", "Contact")):
        with (root / "pages" / f"{name}.md").open("w", encoding="utf-8") as f:
            f.write(
                f"---\ntitle: {t}\ndescription: {t} page.\n---\n\n## {t}\n\n{para(60)}\n"
            )

    print(f"Generated {count} posts + 2 pages into {root}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
