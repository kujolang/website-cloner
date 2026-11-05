# WPForms acceptance review

Status: pending. This is scoped evidence for the installed free-plugin fixtures, not a complete WPForms or WPForms Pro claim. CAPTCHA checks remain deferred at the user's request.

## Revalidated on 2026-10-25

Fourteen current regression tests passed across enhanced choices, choice counts, plain/alias masks, text counters and word limits. They cover configured versus disconnected activation, editable/removable constraints, keyboard selection, filtering, reset, incomplete values, disabled controls, selection replacement and IME safeguards. Tests use controlled fixtures and do not establish visual parity for arbitrary source layouts.

The existing native WPForms export also passed a disposable-copy authoring check: editing Markdown/title, field label and name, confirmation target and select options survived an SSG rebuild. Required groups and email confirmation validated; one intercepted local delivery contained the edited field name without source tokens. The source project was unchanged. No source submission or AI occurred.

The first authoring attempt failed because this terminal did not have Kujo on PATH. Repeating with the installed Kujo executable directory on PATH passed. The builder has its own configured KUJO_BIN; this was a test invocation prerequisite, not a verified builder defect.

## Evidence and remaining gates

| Gate | Evidence | Remaining scope |
| --- | --- | --- |
| Native authoring | Current disposable export check passed | Independent fixture and aggregate acceptance rerun |
| Choices/masks/counters/limits | 14 current regression tests passed | Wider source configurations and unsupported mask syntax |
| Desktop/mobile fidelity | Historical wpforms-native-v33-checkpoint.json: 15 comparisons, minimum pixel 0.996709; alias sample 1.0 | Current combined export/state comparisons; inherited overflow must remain reported |
| Metadata, links, accessibility | Historical 12-page audit PASS; alias sample one advisory | Current full aggregate audit, configured error-state keyboard/a11y checks |
| Reuse and Markdown | Historical 12 Markdown records, five shared templates, no snapshot fallback | Current combined receipt and independent authoring coverage |
| Delivery | Current intercepted request contract passed | Real local receiver and owner-verified external delivery; no mailbox claim |
| Paid/conditional/multistep features | No full acceptance evidence | Licensed/configured fixtures required |
| No AI | Current tests and authoring check use no AI | Preserve this invariant for remaining acceptance |

## Reproduction

```sh
node --test tests/choices-runtime.test.mjs tests/form-word-limits.test.mjs tests/form-input-mask.test.mjs tests/form-text-counters.test.mjs tests/form-mask-aliases.test.mjs tests/form-choice-counts.test.mjs
# Requires Kujo on PATH or KUJO_BIN pointing to an installed executable.
node tests/fixtures/platform-wpforms-authoring.mjs
```

Next: verify independent source/export states and configured service feedback, then produce a combined audit/visual/authoring receipt. Do not mark this family complete while these gates remain open.

## Configured-service field error styling

The shared export/runtime now identifies configured WPForms explicitly and uses the plugin's `wpforms-error` class for controls and messages. Modern containers get `em` messages; classic containers get labels. Same-name grouped fields share one message outside the option labels, linked through `aria-describedby`. Corrections/reset restore original accessibility attributes and remove generated feedback; remote message text is never interpreted as HTML.

The implementation is grounded in the installed WPForms Lite frontend validator (`assets/js/frontend/wpforms.min.js`), which uses these error classes/elements. This change covers service-returned field errors, not complete client-validation, wrapper-state, or plugin-wide presentation parity. It adds no bundle or source request and activates only for configured WPForms delivery.

Verification: provider selection/disconnected behavior plus real loopback HTTP422/accepted responses at1440/390px, focus, grouped descriptions, safe text, correction and reset. CF7 feedback and native export regression checks remain required alongside this test. No source submissions or AI.

Result:17 WPForms/export-delivery checks passed with Kujo configured; both existing CF7 client/server feedback checks passed. The final WPForms-specific pair also passed after the markup adjustment. Full-family status remains pending.

## Independent cached fixture acceptance — 2026-10-25

Current choice, counter and mask candidate-runtime checks passed at1440/390px. All six initial screenshots matched their saved source baselines exactly; choice authoring/keyboard/filtering/removal, counters, mask editing, invalid-value rejection and reset passed. The helper scripts now copy the complete component runtime set instead of mixing a new registry with missing dependencies in an old fixture export. This repairs test setup, not a demonstrated fresh-export defect.

The combined12-record cached fixture rebuild passed with no blocking quality failures. The post-build audit passed across16 output pages with0 issues and4 performance samples; all15 visual comparisons passed (minimum pixel0.9967091779657224). Five shared content templates serve the12 Markdown/frontmatter records,10 pages use shared templates, and the template roundtrip report passed. No HTML snapshot fallback or AI calls occurred. Wrapper elapsed time was310598ms.

The local fixture had to be restarted before supplemental source comparisons could finish. This run reused captured content/assets but made18 requests/541762bytes to complete baseline evidence; it was not entirely offline. Capture progress events successfully showed each route and viewport. The output remains `needs-review` for its explicit sample scope. Initial screenshot agreement does not prove all open/error states, and lab performance samples do not supply field Core Web Vitals or production verification. Detailed receipt: the fixture report.

Final shipped-script checks also passed for choices and masks at both widths (four initial screenshots with similarity1.0 and all interaction assertions passed). These checks used the generated runtime rather than copying candidate scripts. Broader validation-state visuals and plugin/Pro variants remain open.

## Required-field validation parity — 2026-10-25

The builder now captures allowlisted public WPForms validation messages from its single-line JSON settings assignment (with or without a semicolon), without evaluating JavaScript or retaining nonces/endpoints. Configured exports use inline messages, source error classes/wrapper states, group placement and column sublabel ordering. Required/email/confirmation messages remain editable in form definitions; reset clears validation state. Presentation version38 refreshes cached definitions. Generic forms and disconnected delivery remain unchanged.

Six client/server feedback tests and42 extraction/cache regressions passed. An installed source versus current candidate native rebuild comparison at1440/390px matched the four required messages and three error wrappers, with screenshot similarities0.9998495/0.9996408 after label-placement correction. No source submissions or AI occurred.

This gate remains **needs-review**: direct computed-style checks and screenshot inspection reveal copied inline border colours overriding source WPForms invalid colours. Both viewports report `borderParity:false`. High pixel similarity hides the small but visible error border difference. Fix generated paint without discarding genuine authored inline styles, then rerun the state comparisons before closing this gate. Evidence: the fixture report; reproducer: `KUJO_BIN=... node tests/fixtures/platform-wpforms-validation.mjs` with the isolated fixture on9439.

## Provenance-aware control paint — 2026-10-25

Rendered capture now records the original values/priorities of the paint declarations it freezes, together with their captured values. Configured form runtime restores those proven originals using the browser CSS declaration API, which handles shorthand borders correctly. Unconfigured forms retain captured disabled-state paint. Genuine authored styles and later edits—including priority changes—are preserved. The mechanism applies to configured forms generally, not a source domain or WPForms-only CSS override.

A fresh one-page installed fixture export passed normal verification with no blocking quality failures and initial viewport similarity1.0; its one audit advisory belongs to the limited linked-page sample. A current candidate native rebuild matched the live required-error state exactly at1440/390px: pixels1.0, matching messages/wrappers, and exact red error borders (`borderParity:true`). The test now requires border parity instead of relying only on a screenshot threshold. Existing presentation tests and six feedback regressions passed, including preservation of authored/later inline edits.

This supersedes the border mismatch for newly captured provenance-tagged controls. Older unmarked captured paint is deliberately untouched: an inline color alone does not establish whether the builder or author supplied it. Such older exports need a trustworthy original capture before equivalent restoration can be promised. Full WPForms family acceptance remains pending.

The regenerated shipped-script check also passed at both widths with screenshot similarity1.0 and exact border parity. Its cached rebuild recorded0 network requests/bytes,0AI calls and no blocking quality failures (43043ms pipeline time). The single-page audit advisory is four uncaptured internal destinations; this sample does not claim whole-site link completeness. See the fixture report.

## Open and filtered choices — 2026-10-25

The generated native export now has explicit source comparisons for the single-select open dropdown and the multiselect filtered by typing `mat`. All four1440/390px comparisons matched visible options and screenshot similarity1.0, with no source submissions or AI. The reproducer uses normal keyboard input; Playwright `fill` alone does not emit the key events used by the source widget and initially produced a misleading mismatch. Evidence: the fixture report and `platform-wpforms-choice-states.mjs`. This closes these sampled open/filter states, not all WPForms features.

## Configured error-state keyboard and accessibility checks — 2026-10-25

The installed fixture exposed two shared enhanced-select issues that initial screenshot tests missed: the focusable proxy did not reference validation feedback attached to its native select, and a copied `aria-autocomplete` attribute remained on the multiselect group after its role changed. The shared Choices adapter now synchronizes invalid state and descriptions from the underlying select, retains existing hint IDs, links its own native validation message, and places autocomplete semantics on the search combobox. Untouched required fields are no longer announced as invalid merely because they are empty. These changes apply to configured enhanced selects across providers.

The validation reproducer now audits the configured form after required-field errors, checks that each invalid control references nonempty feedback, checks keyboard focus after Tab, and retains source/rebuilt screenshot and exact border comparisons. Non-contrast axe violations fail this check; contrast findings remain recorded because source colours must be preserved. This is a candidate-runtime fixture check, not proof of every plugin configuration or production delivery.

Result: six focused Choices/WPForms regressions passed, followed by both Choices checks after the ARIA-role correction. The installed candidate fixture passed at1440/390px: screenshot similarity1.0, exact error-border parity, all six invalid controls linked to feedback, usable keyboard focus, and no axe violations other than five source-colour contrast nodes per viewport. No source submissions or AI occurred. Receipt: the fixture report. One preceding fixture attempt failed the border-colour comparison; the unchanged visual code passed on repeat, so timing sensitivity remains a test limitation rather than a proven fixed visual defect. Full-family acceptance remains pending.

## Generated-export verification — 2026-10-25

The same cached one-page fixture was regenerated through the builder, then tested with `--generated` (no candidate script replacement). Desktop/mobile required-error screenshots both scored1.0, borders matched exactly, all invalid controls referenced feedback, keyboard focus remained usable, and axe reported only the five source-colour contrast nodes per viewport. The rebuild took28270ms wall time and recorded0 new network requests/bytes and0AI calls; cumulative historical network totals are not new requests. Evidence: the fixture report.

The Choices regression now checks untouched and recovered invalid states and removal of resolved native error descriptions. It also waits for the reset handler's queued task before revalidating; previously the test could race that handler and mistake its clearing of feedback for missing feedback. Both regression checks passed. Full WPForms acceptance remains pending beyond this installed configuration.

## Fresh whole-fixture acceptance — 2026-10-25

A fresh no-AI crawl of the available installed WPForms fixture completed all13 discovered pages with0 queued URLs and0 discovery failures. This replaces the earlier12-page sample for current fixture coverage. The run generated13 Markdown/frontmatter records using5 shared content templates and no HTML snapshot fallback; template roundtrips passed. All18 viewport comparisons passed configured thresholds (minimum pixels0.9967091779657224; minimum layout0.9444444444444444). These numbers do not mean literal1:1. The generated17-page audit passed with0 issues and4 performance samples. Wall time115298ms;54 requests/2518566bytes;0AI calls.

A disposable native authoring rebuild of this exact fresh output passed: edited Markdown/title, field label/name, matching-email target and options in both selects survived; required radio validation and the edited confirmation target worked, and one intercepted local delivery used the edited field name without source tokens. Source files were unchanged and no source submission occurred. The authoring helper now derives the form route instead of assuming `/request/`, and handles both required radio and checkbox groups.

The build correctly remains `needs-review` because captured forms need an owner-configured replacement service; WordPress AJAX is not silently treated as static functionality. This evidence closes current whole-fixture capture/audit/authoring gates only. Paid/conditional/multistep variants, broader independent configurations and real owner delivery remain unverified. Receipt: the fixture report.

The same fresh whole-fixture output also passed generated-script choices/masks/counters checks at1440/390px. Four initial screenshots matched saved source baselines exactly. Added options, keyboard choice, filtering/removal and one intercepted local request per viewport passed; mask formatting, incomplete-value rejection, counters, over-limit rejection and reset passed. Helpers accept an artifact directory so future acceptance runs test the chosen export instead of silently using an older fixture. Receipt: the fixture report. These are controlled fixture checks; real external delivery and paid/configuration coverage remain open.
