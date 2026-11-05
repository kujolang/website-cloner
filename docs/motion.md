# Motion import and review

[Documentation index](README.md)

The importer records motion **before** removing source scripts from the export. `motion-manifest.json` records each route's admitted effects, reviewed adapter fingerprints and unsupported effects. The page model and migration report retain the same provenance. A changed custom script fails closed into review instead of silently using an obsolete adapter.

## Supported conversions

- Elementor `data-settings` entrance presets: fadeIn, fadeInUp/Down/Left/Right and zoomIn. Source delay and fast/normal/slow duration are retained within bounded values. Responsive overrides and unknown presets require review. Content loses Elementor's invisible class even when its preset is unsupported, so removal of its controller does not hide text forever.
- Reviewed Elementor.com homepage hero: desktop media shrink/translation, crossfade to the target image, secondary image reveal and heading rise, pinned to scroll progress.
- Reviewed Elementor.com horizontal cards: desktop pinning and horizontal translation determined from actual overflow width.

These use a small first-party runtime based on Web Animations, IntersectionObserver, requestAnimationFrame and sticky positioning, with a translation fallback for imported clipping ancestors. There is no runtime network dependency. Motion.dev's [scroll documentation](https://motion.dev/docs/scroll) confirms the scroll-progress/element-offset/sticky-pinning model; browser-native APIs are sufficient for the constrained effects currently supported. A general GSAP-to-Motion compiler is **not** implemented.

The two custom adapters were reviewed against public homepage inline scripts captured October 19, 2026, at https://elementor.com/. SHA256 is over trimmed script text with CRLF normalized to LF:

- Hero: `b17a58ac09e2d57de20ed5dd79e1b38ff367be99792c951de36b2fd0d84deeb1`
- Cards: `e2f77a2bf84c6248d124ddea7cb67ac43b5f92d1bc8ce099ebe9a072c6dfbc5d`

The adapters are reviewed reconstructions, not copied executable code or a claim of identical timing. Direct MP4 and WebM sources are downloaded through the checked asset pipeline and played locally. Muted Duda background videos retain looping inline playback; source controls are preserved on ordinary videos. Video URLs and posters are editable in component media frontmatter. Unavailable, oversized or unsupported video sources retain a poster and produce a warning. Authenticated streams, DRM and arbitrary player scripts are not reconstructed. GSAP scrub smoothing, nested video scaling and image-swap details remain simplified. The custom steps timeline, other custom scripts and external Lottie assets remain explicitly reported limitations. CSS-authored passive animation is retained as source styling; it is not automatically validated for behavioral equivalence.

## Trust and accessibility

The export removes downloaded scripts, inline event handlers and executable source elements. Its CSP permits reviewed local runtimes by exact hash, including `vendor/migration-motion.js`. Browser capture may execute source scripts in an isolated, read-only network environment; it does not make those scripts trusted export code. No `unsafe-inline` script, script host allowlist, eval or source-code interpreter is enabled. Motion configuration is escaped JSON in a meta tag, never generated executable code. Previews run on a separate origin. CSP restricts connections, and disconnected forms do not submit to source services. AI repairs remain CSS-only.

Each exported page carries the trusted inline runtime so root, nested routes, ZIP/offline hosting and project base paths behave consistently. Browser reduced-motion preferences disable reconstructed motion and remove its pin spacers/styles, including when the preference changes while viewing. Resizing tears down and remeasures the effect; desktop-only effects remain inactive on tablet/mobile. Without JavaScript, the imported static baseline remains readable. Source CSS can still impose its own responsive/reduced-motion rules.

## Verification and extension contract

New source captures and rebuilt static comparisons both request reduced motion, so CSS media queries use the same preference. Historical captures retain their original settings. Separately, `motionChecks` visits sampled routes at desktop/tablet/mobile sizes, checks runtime activation, expected pin counts, scroll progress at 0/50/100%, transform changes, actual viewport pin position, visible image loading and reduced-motion restoration. Evidence is saved under `evidence/motion/`. A failed motion check fails the migration quality gate. Passing these checks proves local behavior, **not** similarity to the executing source site. These local checks do not establish equivalence to every source animation.

To add an adapter: collect source evidence without executing untrusted code; implement only the necessary effects in the trusted runtime; register an exact reviewed source fingerprint; provide a browser regression fixture and real-site scroll evidence; document timing/fidelity differences. Do not evaluate source expressions or extend the AI repair schema with JavaScript. Unsupported motion must remain in the report until an adapter is reviewed and verified.
