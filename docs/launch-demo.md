# Reproduce the launch demo

The demo uses a fresh, local WordPress installation with its bundled Twenty Twenty-Five theme, four pages and two posts. The content and abstract illustration are original synthetic fixtures. No client site, paid plugin or AI account is involved.

WordPress 6.8.3 and SQLite Integration 2.2.23 are pinned for this fixture. These are reproducibility pins, not production upgrade recommendations. Keep the source on loopback. The demo source needs Python 3.10+ and PHP 8.2+ with PDO SQLite and GD; ordinary Website Cloner users do not need PHP or Python to clone a public site.

## Prepare the source

From the repository root:

```sh
npm run demo:setup
npm run demo:source
```

Setup downloads the pinned packages and creates a new database under ignored `work/launch-demo`. Repeating setup preserves that fixture. To repeat from an empty database, stop the source server and move `work/launch-demo` outside the repository before setup.

Keep the source terminal open. Visit [Field Notes Studio](http://127.0.0.1:9411/) and review Home, About, Services, Contact and the two journal posts. Contact is an informational page; no delivery service is implied.

## Clone with one button

In another terminal, allow only this local demo origin and start the builder:

```sh
FIXTURE_ORIGINS=http://127.0.0.1:9411 npm restart
```

This operator setting allows the known loopback fixture. It does not disable checks for other network destinations. Remove the setting and restart when you finish testing the local source.

1. Open [Website Cloner](http://127.0.0.1:4310/).
2. Enter `http://127.0.0.1:9411/`.
3. Keep **Preserve Source Without AI** and **Standard capture** selected.
4. Press **CLONE** once. Wait for the result, then inspect its findings and preview.
5. Download the ZIP. It contains the frontend and the editable SSG project.

## Show the useful part

A short demonstration should show the source, the URL and no-AI selection, the real progress indicator, then the result at desktop and mobile widths. Open an inner page and a post. Show the Markdown files, frontmatter and shared templates in the downloaded project.

Edit a sentence in a post, run `npm run build` in that project, and show the updated output. Keep the original download intact so the comparison remains reproducible. Upload only `output/` when deploying; do not publish the fixture database or internal build files.

If you shorten the waiting period in a recording, label it as a time cut and state the measured duration. A small default-theme example demonstrates this workflow; it does not prove universal theme/plugin support, identical animation or working server-backed services. Optional AI review proposes constrained CSS changes; it does not fact-check all site content or guarantee a better result.

## Finish

Stop the source with Ctrl-C in its terminal. Stop the builder with `npm stop`, or restart it without the temporary `FIXTURE_ORIGINS` environment setting for ordinary public-site use. Demo databases, screenshots and generated clones remain local and ignored by Git.

## Verified rehearsal

The November 5 rehearsal used the normal CLONE button, standard capture and no AI. It completed in 83.83 seconds of migration work with no waiting. Nine captured routes produced thirteen output routes, including auxiliary pages. All nine records rendered through five content-role templates; the three default pages shared one template and the two posts shared another.

There were no failed quality checks, missing images or stylesheet-asset failures. The technical audit passed with zero findings. Fifteen desktop/tablet/mobile comparisons had minimum pixel similarity 0.999994 and minimum layout similarity 0.933333. These are sampled measurements, not a universal parity claim. The homepage screenshots were visually reviewed at desktop and mobile widths. Mobile navigation checks passed.

The result remains `needs-review` because the source post comment forms have no static delivery service. AI calls and all token counts were zero. An independent copy of the downloaded project rebuilt successfully after a Markdown sentence edit; its validator passed all thirteen routes. Original export files remained unchanged. Local databases, run IDs, screenshots and generated output are excluded from the repository.
