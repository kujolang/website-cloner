# External resource failures

[Documentation index](README.md)

The cloner scopes network outages to the migration source origin. An unavailable third-party origin is skipped for the rest of that attempt, rather than poisoning the source connection and restarting the whole migration. This applies to both HTTP and browser capture, including third-party robots lookups, timeouts, DNS failures, rate limits and browser access denials. There is no Twitter or Cloudflare hostname exception.

External requests still require robots permission and public-address validation. Denied resources are not fetched through another transport. A blocked origin stays blocked for the current attempt; a new explicit resume can check it again. Source-origin outages retain the existing stop/retry behavior. Without a configured source origin, the network client retains its previous conservative outage behavior.

Capture warnings identify skipped origins; asset failures remain in the existing asset warnings. Missing external fonts, images, styles or embeds can affect fidelity and must not be presented as successfully captured. This change prevents those failures from stopping unrelated page capture; it does not recreate unavailable content or implement remote services.

Regression coverage: `tests/external-resource-failures.test.mjs`, `tests/browser-network.test.mjs`, existing request recovery, download scheduling, asset cooldown and capture/API tests. Browser fixtures exercise external robots403 and an embedded script403 while source capture continues, plus source denial, robots disallow, private destinations and read-only behavior.
