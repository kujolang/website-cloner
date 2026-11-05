# Limits and remaining work

[Documentation index](README.md)

Website Cloner produces an editable static site from publicly accessible content. It does not promise a complete 1:1 copy of every website. A completed pipeline and a passing template roundtrip are different from verified visual and functional parity.

## Source access

- Private, authenticated, robots-denied or otherwise unavailable content cannot be recovered from a public URL alone.
- Public REST metadata may be incomplete. Unexposed types, fields and relationships remain unknown.
- Whole-site capture has no default page-count cap, but discovery may miss URLs. Explicit samples omit pages by design.
- Request deadlines, file-size checks, source backoff and disk checks remain in force. Browser-assisted capture does not bypass challenges or permission checks.
- WXR and authenticated WordPress imports are not implemented.

## Design and authoring

The builder preserves source layouts with shared templates, Markdown and presentation data. Complex pages may still need HTML components or JSON edits. Source CSS can contain large or unused rules; removing it without evidence can change the design.

Supported components use trusted local runtimes. Unknown scripts, effects, widgets and unavailable embeds can leave visual or interactive gaps. Browser comparisons sample routes and states; passing them does not certify every page. Missing baselines remain quality failures.

Source colours are preserved by default. Accessibility audits can therefore report inherited contrast problems. Repairs that change the design require deliberate review.

## Dynamic services

Local search uses captured content. Contact forms can use an explicitly configured replacement service, but the source WordPress endpoint is not revived. Unsupported or unconfigured forms remain disconnected. Delivery tests do not prove email delivery or server-side spam protection.

Product catalogs contain snapshots, not live inventory. Checkout, accounts, memberships, booking, payments and other server-backed features need separate services. Plugin detection alone does not prove support. See the [compatibility status](platform-support/STATUS.md) for tested scope and remaining gates.

## Publishing and installation

GitHub Pages and Cloudflare Pages publishing use user-supplied API tokens; OAuth is not implemented. Automated provider fixtures pass, but live account acceptance remains separate. Deployment verification checks the uploaded version and homepage, not the whole site's design.

The installer has a fresh macOS acceptance record. Linux desktop acceptance and a public download release remain unverified. See [installation verification](installer-verification.md).

## Before offering a hosted service

The server is single-user and loopback-only. A public service needs authenticated job ownership, isolated workers, enforced network and resource limits, quotas, retention rules, abuse controls and per-user credential storage. Application checks and CSP are not an OS sandbox.

## Next priorities

1. Expand independent site and plugin fixtures, including unsupported configurations.
2. Fix source-baseline and interaction gaps without disguising missing evidence as a pass.
3. Simplify complex exported content where shared structures can preserve both design and editing behavior.
4. Complete platform installation and live hosting acceptance tests.
