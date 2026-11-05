# Security Policy

## Supported versions

Security fixes are provided for the latest `1.x` release. Consumers should pin
an exact reviewed commit and update promptly when a security release is
published. Package `0.x` releases are unsupported.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Send a private report
to `contact@kujolang.ai` with the affected version or commit, impact, minimal
reproduction, and any known mitigations. Remove credentials, tenant data, and
personal information from the report.

We will acknowledge a complete report within three business days, validate and
classify it, coordinate a fix and disclosure window, and publish upgrade
guidance. A report may require downstream fixes because identity, policy,
approval persistence, idempotency persistence, audit storage, handlers, and
transport authentication are application-owned.

## Security boundary

The package validates portable contracts and orchestrates an embedded execution
boundary. It is not an authentication service, authorization policy engine,
secret store, sandbox, network server, or durable database. See
`docs/SECURITY_MODEL.md` before exposing an Ability through any transport.
