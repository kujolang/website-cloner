# WordPress plugin support

Start with [current status](STATUS.md). The builder detects 20 target families. Nineteen have installed fixtures with scoped evidence; WP Rocket still needs a licensed fixture. **No full plugin-family release gate is complete.** Detection and a passing example do not establish support for every version or configuration.

The builder preserves public content and supported interactions. Features that need a server—payments, account changes, form delivery and booking—need an owner-configured replacement service. They must not report success while disconnected.

## Guides and evidence

- [Target list and acceptance criteria](TARGETS.md)
- [Current coverage and open gates](STATUS.md)
- [Contact Form 7 acceptance](cf7-acceptance.md)
- [WPForms acceptance](wpforms-acceptance.md)
- [Yoast acceptance](yoast-acceptance.md)
- [Rank Math acceptance](rankmath-acceptance.md)
- [Editing captured events](event-authoring.md)

Use STATUS for current coverage, and the acceptance guides for the exact fixture, version and behavior tested. Captcha work is deferred; it is not a completed gate.
