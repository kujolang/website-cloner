# Publish from Website Cloner

[Documentation index](README.md)

The completed-build screen can publish to GitHub Pages and Cloudflare Pages. Connect your own account, choose or create a destination, confirm that it may replace the current Pages site, then select **Publish website**.

The builder creates a separate copy of the editable export and rebuilds it for the destination URL and base path. It uploads only compiled output. The saved preview, source project, and ZIP stay unchanged. No AI runs during publishing.

## Connect GitHub

1. Create a personal access token in [GitHub settings](https://github.com/settings/tokens). A classic token with `public_repo` supports public repositories. Private repositories require suitable repository permissions and a GitHub plan that supports Pages for them. Organization policies can require separate token authorization.
2. Select **GitHub Pages** in the builder, paste the token, and connect.
3. Pick a repository where the connected account has administration access, or create a new public repository in your personal account. Existing organization repositories can be selected when your token has access; creation currently targets your personal account.
4. Confirm the destination and publish.

This connection uses a token, not an OAuth sign-in or the operator's existing `gh` credentials. Fine-grained tokens must permit repository contents and Pages writes, and repository administration for site configuration/creation; policy restrictions are reported by GitHub. The classic token path is the documented starting point.

Uploads use the `website-cloner-pages` branch and `.nojekyll`. An existing branch with that name must carry Website Cloner's ownership marker; otherwise publishing stops. The default branch is preserved, except that an empty repository needs an initialization file before GitHub's Git API can create the publishing branch. Repeated publishes replace the publishing branch's generated tree, including removal of obsolete files, without force-pushing. They configure Pages to serve that branch. A repository whose default branch is `website-cloner-pages` is rejected.

The existing Pages URL is used when available, including a configured custom domain. The builder does not register domains or change DNS. For new sites it computes the standard `OWNER.github.io/REPOSITORY/` URL, or the account root URL for an `OWNER.github.io` repository.

## Connect Cloudflare

1. Create a [Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with **Account Settings: Read** and **Cloudflare Pages: Edit** for the accounts you want to publish to.
2. Select **Cloudflare Pages**, paste the token, and connect.
3. Pick an account and a Direct Upload project, or create a project.
4. Confirm the destination and publish.

Git-connected projects are excluded: their production deployments belong to the configured Git flow. The builder uses the bundled Wrangler version from `package-lock.json`; it never runs an unpinned `npx` install. Credentials are passed only to that upload process. Its working/config directory is isolated from the user's Wrangler profile. Account and project selection are explicit.

The destination URL is the project's `pages.dev` address. Existing custom domains and DNS remain untouched. Provider file and account limits still apply.

## Progress and verification

The panel shows destination preparation, rebuild, upload counts where available, provider completion, and live verification. It polls stored deployment records, so refreshing the page does not start another upload.

GitHub must report a successful Pages build for the uploaded commit. Cloudflare must report a successful production deployment carrying this run's commit marker. The public homepage must return HTML successfully, and a unique `cloner-deploy-ID.txt` file must match this run. Only then does the UI show **Open verified live site**. This verifies deployment identity and homepage reachability, not every page's design or functionality.

Public verification pins DNS through the same public-network boundary used by the crawler; private addresses and unsafe redirects remain blocked. Verification can take up to about 15 minutes after upload. Failed or timed-out runs never receive a verified URL. They may already have uploaded files; inspect the provider dashboard before retrying. Interrupted runs do not automatically republish after server restart.

One hosting operation runs at a time. A build being published cannot be rebuilt or deleted. Source capture does not run again. Temporary deployment copies and upload logs are removed after completion or failure; startup cleans interrupted staging directories. Non-secret deployment receipts remain under `.data/jobs/.publishing` (or the configured migration storage directory).

## Credential handling

Tokens live only in server memory. They are cleared on disconnect or restart, omitted from account-status responses and receipts, and never put in URLs, browser storage, logs returned by the API, or site exports. Each provider uses the token the user entered; there is no ambient developer-account fallback. Connecting a token does not publish a site. Creating a site and publishing are separate user actions.

The builder still binds to loopback and checks the request Origin for mutations. This is a single-user local application, not a secure multi-tenant hosting service. A hosted release needs authentication, per-user credential storage and isolation, quotas, and lifecycle controls.

## Validation scope

Automated fixtures cover both providers' connection/list/create/upload/status transactions, permission failures, existing-branch ownership, stale deployment rejection, interrupted runs, token redaction, and live-marker matching. Browser checks cover account connection, creation/selection, explicit confirmation, progress, disconnect, and verified links on desktop/mobile. A real cached bakery export was rebuilt for a GitHub project URL; canonical URLs and asset prefixes changed while the original output hash stayed unchanged.

Verify each provider with a site you own before relying on its publishing flow. Mock transactions do not prove live account acceptance.

## Export-only hosting

You can still download the ZIP and upload `project/output/` yourself. Editable content is in Markdown/frontmatter and shared templates; run the export's `npm run build` to rebuild. Manual GitHub project hosting requires the correct `SITE_URL` and `BASE_PATH`. Host-specific routing and dynamic features still need review.

Provider references: [GitHub Pages API](https://docs.github.com/en/rest/pages/pages), [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [Cloudflare token permissions](https://developers.cloudflare.com/pages/configuration/api/).

## Local migration throughput

Normal local migrations no longer restart after 20 minutes, 4,000 requests,
or 512 MB downloaded. Individual request deadlines, file-size checks, public
destination checks, robots rules, and disk-space recovery still apply.

Downloads share a queue across page workers. Defaults are 12 requests overall
and 6 per source host. Set `CLONER_DOWNLOAD_CONCURRENCY` and
`CLONER_HOST_CONCURRENCY` in the builder environment to tune them (maximum 32).
Increasing concurrency cannot fix a source server that is not responding.

Completed page transformations, processed CSS, downloaded assets, and recent
failed-asset cooldowns are checkpointed. Resume reuses these checkpoints.
Older jobs retain their downloaded assets but need one processing pass to
create the new page checkpoints. Rebuild can retry unavailable assets.

During asset collection, source timeouts and HTTP 429/503 suspend new requests.
Automatic retries honor Retry-After and use increasing waits. Five consecutive
source pauses without checkpoint progress stop with an actionable error.
The progress screen shows saved/unavailable assets, active/queued requests,
retries, and transfer speed. A completed export with unavailable content or
styles still fails the corresponding quality checks.
