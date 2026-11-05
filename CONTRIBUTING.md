# Contributing

Report bugs through [GitHub Issues](https://github.com/kujolang/website-cloner/issues). Include your version, operating system, capture mode, whether AI was enabled, and the smallest steps that reproduce the problem. Share source URLs only with permission.

Do not upload `.env`, credentials, browser cookies, private site content, saved build directories or full ZIP exports. Redact screenshots and logs before sharing. For security problems, follow [SECURITY.md](SECURITY.md).

For a code change, start from `main`, keep the change focused, and include a synthetic regression fixture when it fixes behavior. Run the affected tests, then `npm test` for changes to shared migration code. Keep downloaded sites, databases and generated evidence in ignored local directories. Do not add domain-specific fixes where a structural rule can solve the problem.

See the [launch demo](docs/launch-demo.md) for a small, authorized WordPress source you can reproduce locally. Publishing tests must use accounts and destinations you control.
