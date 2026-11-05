# Repository hardening

The local application uses atomic checkpoint writes, coalesced progress persistence, streamed downloads and resolved-path checks for static files. Worker callback failures reach job recovery rather than escaping into the server.

Regression coverage includes concurrent writes, retained event history, cancellation, recovery, file boundaries and publishing transactions. Run `npm test` and `npm audit` from the repository root. The test runner limits file concurrency to two to bound browser and subprocess load.

Passing repository tests does not prove visual fidelity on every source, live hosting-account acceptance or clean installation on every platform. See [installer verification](../installer-verification.md), [publishing verification](../publishing-verification.md) and [limitations](../limitations.md).
