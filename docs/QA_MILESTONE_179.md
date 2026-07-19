# Milestone 179 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: complete the saved script-assertion result contract across disposable desktop Workers, trusted CLI execution, direct response history, Collection Runner live/latest/history evidence, and account-free local reports.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-data/src/models/runner-test-result.ts` defines passed/failed/skipped status, unknown/pre-request/after-response category, millisecond execution time, test case, and optional error message.
- Pinned `packages/insomnia-scripting-environment/src/objects/test.ts` starts `performance.now()` immediately before the callback, awaits callback settlement, records zero duration for skipped tests, and never invokes a skipped callback.
- Pinned `packages/insomnia/src/network/network.ts` rewrites raw assertion categories to pre-request or after-response after each script phase.
- Pinned `packages/insomnia/src/ui/components/panes/request-test-result-pane.tsx` renders PASS/FAIL/SKIP, category labels, `< 0.1` for zero, one decimal otherwise, and a slow-time treatment at 300 ms.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused assertion/sandbox/Runner/storage/report regressions | Pass — 6 files, 103 tests |
| Full Vitest suite | Pass — 70 files, 522 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 517 renderer modules; 169.82 kB stylesheet; 64.03 kB automation workbench; 71.61 kB interchange dialogs; 423.38 kB main renderer; 5,320,633-byte CLI bundle |
| Bundled CLI startup/help | Pass — unchanged collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled Runner preview smoke | Pass — split-YAML input, selected order, data, delay, promise-returning script execution, non-executed skip callback, skipped/passed status, after-response category, and duration evidence |
| Bundled localhost CLI template smoke | Pass — denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- One backward-compatible result model and helper resolves current status first and legacy `passed` booleans second; unknown legacy category and unavailable timing remain explicit.
- Desktop and CLI test handlers return promises, preserve registration order, time synchronous and asynchronous callbacks through settlement, record failures without rejecting the enclosing script, and implement `insomnia.test.skip()` without invoking its callback.
- Collection execution assigns pre-request and after-response categories before persistence. Explicit skipped assertions count as matched evidence but do not fail an otherwise successful HTTP attempt, trigger retries, or trigger bail.
- Direct response history and Runner reports retain status, category, fractional duration, names, and bounded errors. Workspace migration admits only known values, clamps finite nonnegative durations, and preserves old assertion records.
- Direct response Tests and selected Runner attempt panes render passed/failed/skipped state, source category, pinned-shaped duration labels, errors, missing-error/empty states, and slow timing without adding cloud or entitlement dependencies.
- JSON evidence retains the additive fields. Existing text/JUnit/TAP attempt accounting continues to treat only failed assertions as failures; skipped assertions remain visible in JSON and interactive evidence without corrupting request-level totals.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M179 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond static-render regressions, strict compilation, full suites, real CLI loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 179 accepts the pinned assertion status/category/timing model, promise-returning `test`/`test.skip` behavior, phase assignment, persistence, request/Runner inspection, and skipped-assertion pass semantics. It does not claim byte-identical upstream error strings, row-local filtering inside Brunomnia's flat attempt adaptation, or historical timing that was never recorded. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner and scripting stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 180.
