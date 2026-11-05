# Authorized real WordPress fixtures

These are **genuine WordPress installations**, backed by isolated SQLite databases and served by PHP, with original synthetic content. They are not static HTML imitations. Five servers share the downloaded core, plugins and themes to limit disk use, but each selects a distinct database. All bind to loopback. No production site is contacted or changed by fixture tests.

| Fixture | URL | Rendering | Content |
|---|---|---|---|
| Gutenberg | http://127.0.0.1:9411 | WordPress 6.8.3 / Twenty Twenty-Five / Gutenberg blocks | Four pages, two posts |
| Classic | http://127.0.0.1:9412 | WordPress 6.8.3 / Twenty Twenty-One 2.6 | Four pages, two posts |
| Page builder | http://127.0.0.1:9413 | Real Elementor 3.32.4 heading, text, image and button widgets | Four pages, two posts |
| Blog | http://127.0.0.1:9414 | Twenty Twenty-One, thirty dated posts in a category, native category/date archives | Four pages, thirty posts |
| Brochure | http://127.0.0.1:9415 | Twenty Twenty-Five, contact form targeting WordPress AJAX | Four pages, two posts |

The brochure form is deliberately a **non-delivering demonstration**, not a configured Contact Form 7 installation. It tests form detection and reporting of unavailable dynamic behavior. All copy and the abstract PNG are original test material. The tiny content corpus exercises layout families and pagination, not production-scale visual diversity. Elementor really renders its stored builder document; no claim of broad Elementor compatibility follows from one layout.

## Reproduce

Requires Python 3.10+, PHP 8.2+ with PDO SQLite, GD and ordinary WordPress extensions, and network access for the initial package downloads. No Docker, MySQL, WP-CLI or admin credentials are needed.

From the repository root:

```sh
python3 tests/fixtures/setup.py --runtime work/fixtures
python3 tests/fixtures/serve.py --runtime work/fixtures
# In another terminal:
python3 tests/fixtures/verify.py
```

The commands above store generated fixture files under `work/fixtures` in the repository. Keep this directory separate from saved migration builds.

Setup is idempotent once each readiness file exists. To reseed, stop fixture servers and remove only the chosen generated runtime directory before running setup again. Servers remain attached to `serve.py`; Ctrl-C stops them together. Admin passwords are randomly generated and never printed or saved outside WordPress's password hash. These local servers must not be exposed to a public interface. Versions are deliberately pinned for reproducibility, not asserted to be current or production hardened.

`verify.py` asserts counts through the live WordPress REST API, checks every content route returns HTTP 200, verifies core sitemap output, confirms the WordPress generator and actual Elementor widget HTML, and verifies the contact form. It writes `runtime-evidence.json`. This verifies source-fixture behavior; migration fidelity is measured by the migration evaluation suite separately.

`work/fixtures/downloads.json` records exact URLs and SHA-256 hashes of downloaded archives. `manifest.json` records expected runtime versions, themes and URLs. Large third-party distributions and SQLite databases are intentionally not committed.

## Licensing and provenance

Original fixture text, seeding/setup/verification code and generated abstract artwork are available under the repository’s license. Downloaded WordPress, bundled default themes, Twenty Twenty-One, Elementor and SQLite Integration retain their upstream GPL licensing; archives contain their own license files. Setup fetches unmodified release archives from WordPress.org:

- https://wordpress.org/wordpress-6.8.3.zip
- https://downloads.wordpress.org/theme/twentytwentyone.2.6.zip
- https://downloads.wordpress.org/plugin/elementor.3.32.4.zip
- https://downloads.wordpress.org/plugin/sqlite-database-integration.2.2.23.zip

The SQLite drop-in follows the upstream documented `db.copy` placement in `wp-content/db.php`; it is only a convenient local fixture database, not a proposed migration runtime dependency. Reference: https://github.com/WordPress/sqlite-database-integration.

## Installed platform fixtures

`platform-setup.py` creates a separate pinned WordPress 6.9 / The Events Calendar 6.18.2 / Twenty Twenty-One 2.6 fixture at port 9420. It uses an isolated MariaDB database over a Unix socket; it never connects to an existing database or opens a database TCP listener. MariaDB (`mariadb-install-db`, `mysqld`, `mariadb`) and PHP's MySQL extension are required. The runtime directory is owner-only. WordPress outbound HTTP and mail are disabled in this fixture. Download receipts record package hashes. These versions are test pins, not a production upgrade recommendation.

```sh
python3 tests/fixtures/platform-setup.py
python3 tests/fixtures/serve.py --runtime work/platform-fixtures
# Separate terminal:
node tests/fixtures/platform-verify.mjs
```

The plugin creates actual event/venue records, a timed event across a DST transition, and a multiday all-day event. Verification reads its real REST responses and rendered pages; it does not yet establish migrated visual/functional acceptance. The SQLite backend used by the older fixtures is unsuitable for this plugin's custom tables, so its database errors must not be attributed to the cloner. Keep this fixture separate from the older fixture runtime.

After source verification, run `node tests/fixtures/platform-migrate.mjs`. It performs an explicitly sampled, at-most-12-page no-AI migration into `artifacts/platform/events`, with normal capture, build and quality checks. It does not use the app's saved-build directory. `platform-run.json` records the result; normal reports and screenshots remain alongside it. This is one installed configuration, not a held-out or complete plugin acceptance result.
