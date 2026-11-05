# WordPress launch demo

Use a fresh, local WordPress site with its bundled Twenty Twenty-Five theme, four pages and two posts. No client content or AI account is required.

From the repository root:

```sh
npm run demo:setup
npm run demo:source
```

In another terminal:

```sh
FIXTURE_ORIGINS=http://127.0.0.1:9411 npm restart
```

Open the builder, paste `http://127.0.0.1:9411/`, leave AI disabled and press **CLONE**. Follow the [complete demo guide](../docs/launch-demo.md) for prerequisites, editing the resulting Markdown, verification and cleanup. Generated databases and clones stay local and are not part of the release.
