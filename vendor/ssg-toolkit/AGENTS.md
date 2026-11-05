# Agent Guide

Read this file with `README.md` before making repo changes.

Prioritize copyable examples over tests: examples should model the most token-efficient idioms we want agents to imitate.

Exclude generated/bulk paths from the main sweep unless the task explicitly targets them; document the search exclusions you used.

## Canonical Surfaces

- `README.md`: public onboarding, quick start, config, and behavior reference.
- `build.kujo`: canonical implementation and CLI output surface.
- `kujo-ssg.yml`: default starter configuration.
- `templates/` and `content/`: copyable starter-site examples.
- `docs/release-process.md`: release validation flow.
- `ROADMAP.md`: parity status and known planned work.

## Contract And Bulk Surfaces

- `scripts/test-cli-contract.sh` and `scripts/test-generated-contract.sh` are behavior contracts. Keep explicit setup/output assertions when they make failures easier to understand.
- `output/` is generated site output. Do not edit it by hand or use it as the primary source for examples.
- `assets/css/tailwind.min.css`, `assets/js/alpine.min.js`, fonts, images, and `static/` are bulk/vendor/static assets. Skip them during readability sweeps unless the task is asset-specific.
- `.github/workflows/ci.yml` wires validation but is not an example surface for Kujo code.

Useful broad-search baseline:

```bash
rg -n "print\\(|echo|printf|cat <<|TODO|FIXME|example|generated|legacy|expected" \
	--glob '!output/**' \
	--glob '!assets/css/tailwind.min.css' \
	--glob '!assets/js/alpine.min.js' \
	--glob '!assets/fonts/**' \
	--glob '!assets/images/**' \
	--glob '!static/**' \
	--glob '!tmp/**'
```

## Cleanup Guidelines

- Preserve CLI output spacing and wording unless the task explicitly changes contracts.
- Prefer local helpers such as `print_lines(...)` or path-list loops for repeated display/setup code.
- Keep introductory examples direct; use helpers only after the demonstrated feature remains obvious.
- Do not shorten fixtures just because they are repetitive. If fixture verbosity clarifies a contract, leave it alone.
- If adding stale, legacy, generated, or expected-fail examples, label the reason in the file.

## Validation

Use the standard Kujo VM path:

```bash
npm ci --ignore-scripts
bash scripts/run_ci_checks.sh
```

For focused changes, run the closest contract first, then the full gate. If `kujo` is not on `PATH`, set `KUJO_BIN` or `KUJO_RUNTIME_DIR`.
