# Contributing

Report bugs through [GitHub Issues](https://github.com/kujolang/website-cloner/issues). Include your version, operating system, capture mode, whether AI was enabled, and the smallest steps that reproduce the problem. Share source URLs only with permission.

Do not upload `.env`, credentials, browser cookies, private site content, saved build directories or full ZIP exports. Redact screenshots and logs before sharing. For security problems, follow [SECURITY.md](SECURITY.md).

For a code change, start from `main`, keep the change focused, and include a synthetic regression fixture when it fixes behavior. Run the affected tests, then `npm test` for changes to shared migration code. Keep downloaded sites, databases and generated evidence in ignored local directories. Do not add domain-specific fixes where a structural rule can solve the problem.

See the [launch demo](docs/launch-demo.md) for a small, authorized WordPress source you can reproduce locally. Publishing tests must use accounts and destinations you control.

## Release versions

Use patch versions for compatible fixes, minor versions for added capabilities, and document breaking changes explicitly during the 0.x preview period. Update `package.json`, the root version in `package-lock.json`, the README badge and `CHANGELOG.md` together. Run ShipCheck’s gate plus the relevant tests before tagging. Tag the reviewed commit, then publish a GitHub release with the known limits and verification scope. Never move an existing release tag to new code.

The [Core checks template](docs/ci/core-checks.yml) covers network/file boundaries and recovery without a browser or Kujo installation. It is not the full browser/SSG regression suite or Linux desktop installer acceptance.

CI is not active yet. A maintainer with GitHub workflow-write permission can copy the template to `.github/workflows/ci.yml` and confirm that its first run passes. The template uses read-only repository permissions and pinned action revisions.
