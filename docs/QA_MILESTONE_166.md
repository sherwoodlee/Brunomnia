# Milestone 166 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned-compatible `insomnia.execution` script state and collection-runner request-flow control while preserving live progress, retries, bail, portable CLI behavior, and bounded local execution.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `Execution` exposes a request ancestry `location` array with `location.current`, `skipRequest()`, and `setNextRequest(requestIdOrName)`; pre-request execution state is carried into the after-response script.
- Pinned runner flow seeks forward by exact request ID or the last request with a matching trimmed name, marks bypassed requests skipped, repeats the current request when it targets itself, and ignores a requested jump after an execution error.
- Pinned pre-request `skipRequest()` avoids transport execution while retaining the script-selected next target; a missing or already-passed target skips the remaining current-iteration plan.
- Brunomnia adds a report-visible safety boundary to self-directed flow: 10,000 extra steps by default, with the same bounded result surfaced in desktop and CLI reports instead of allowing an unbounded loop.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused runner/script/import/reporter regressions | Pass — 4 files, 75 tests |
| Full Vitest suite | Pass — 67 files, 500 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 512 renderer modules; 160.62 kB stylesheet; 49.22 kB automation workbench; 71.61 kB interchange dialogs; 409.38 kB main renderer; 5,312,290-byte CLI bundle |
| Bundled CLI startup/help | Pass — collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled direct suite and API-spec-prefix runs | Pass — 1/1 test and 1/1 matched assertion for both selectors |
| Bundled collection-flow smoke | Pass — first request selected the third by ID; second persisted as skipped; exact first/third execution order verified |
| Bundled localhost CLI template smoke | Pass — denial, File grant, saved `insomnia.send()`, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 107 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Browser Worker and portable Node sandboxes expose bounded execution ancestry, the pinned `current` accessor, pre-send skip, and request ID/name selection while preserving the existing isolation boundary.
- Runner flow covers forward ID jumps, last duplicate-name selection, missing targets, self-repeat, pre-script skip with a retained target, and retry resolution before applying the selected flow.
- Non-converging self-targeting emits one failed safety result, a persisted `flowError`, text/JSON reporter evidence, and a desktop error instead of hanging the run.
- Direct desktop sends stop before transport when the pre-request script skips; after-response scripts inherit the pre-request execution state.
- Postman `pm.execution.*` and legacy `postman.setNextRequest()` imports translate to the executable Brunomnia contract.
- The shared runner path gives the bundled collection CLI identical selected-order, skipped-live-item, retry, reporter, and flow-bound behavior.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M166 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed controls, strict compilation, focused script/flow evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 166 accepts pinned-shaped execution location, pre-send skip, request ID/name selection, duplicate-name behavior, self-repeat, missing-target handling, retry continuity, portable CLI flow, Postman translation, and a bounded non-converging-flow failure. Full transport-added request/response console fidelity, remaining collection-run protocol semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 167.
