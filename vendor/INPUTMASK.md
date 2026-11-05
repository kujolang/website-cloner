# Inputmask runtime

The standalone browser distribution is Inputmask5.0.9, MIT licensed, from https://registry.npmjs.org/inputmask/-/inputmask-5.0.9.tgz (upstream https://github.com/RobinHerbots/Inputmask).

Archive SHA512 integrity: `s0lUfqcEbel+EQXtehXqwCJGShutgieOaIImFKC/r4reYNvX3foyrChl6LOEvaEgxEbesePIrw1Zi2jhZaDZbQ==`.
Vendored `scripts/vendor-inputmask.js` SHA256: `0ba6c23e11cd5cb9afd3f22a1f6a9b44e3281573d1856b5c312c646204376b72`.

The archive integrity was checked before extracting its standalone distribution and license. The source WPForms Lite2.0.3 fixture uses the same Inputmask version with its jQuery bridge. Cloner uses the standalone build with `rightAlign:false` and `importDataAttributes:false`; authored contract options are the only initialization input. This avoids adding jQuery solely for masks. The MIT license is included in every native export.

The verified adapter currently accepts plain masks up to256 characters without repetition braces. The adapter also accepts email/integer/decimal aliases and datetime formats dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, HH:MM and HH:MM:ss. Other aliases, date formats, regex and quantified masks remain captured but explicitly unsupported. The library is emitted only for configured recognized fields. Raw120679bytes/gzip35552bytes, plus the small adapter. See tests/form-input-mask.test.mjs and tests/fixtures/platform-wpforms-masks.mjs.
