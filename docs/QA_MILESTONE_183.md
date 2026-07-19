# Milestone 183 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: correct Brunomnia Runner History from attempt-level aggregate columns to pinned retained-assertion accounting, align duration units and precision, derive the row outcome icon from assertion failures, and use the pinned live `Cancel all` wording without changing execution or persistence.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/ui/components/panes/runner-result-history-pane.tsx` traverses every saved request's assertion results, counts passed/failed/skipped assertions, sets Total to their sum, and marks the row successful exactly when the failed-assertion count is zero. Request-attempt pass/fail aggregates are not the History columns.
- The same pane formats saved-run duration through `getTimeAndUnit`, shows source, iterations, duration, assertion totals, and exact deletion, and leaves Start Time and Avg. Resp. Time columns commented out.
- Pinned `packages/insomnia/src/ui/components/tags/time-tag.tsx` changes to seconds only above 1,000 ms and minutes only above 60,000 ms, then rounds to zero decimals above 100, one above 10, and two otherwise.
- Pinned `packages/insomnia/src/ui/components/panes/runner-live-progress-pane.tsx` labels its active aggregate cancellation action `Cancel all`; it marks every unfinished item canceled through the existing runner feedback path.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner History regressions | Pass — 1 file, 3 tests |
| Full Vitest suite | Pass — 73 files, 534 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 524 renderer modules; 171.50 kB stylesheet; 66.58 kB automation workbench; 71.61 kB interchange dialogs; 430.73 kB main renderer; 5,343,117-byte CLI bundle |
| Bundled CLI startup/help | Pass — unchanged collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled Runner preview smoke | Pass — split-YAML input, selected order, data, delay, and assertion evidence |
| Bundled localhost CLI template smoke | Pass — denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- History aggregates every retained assertion across all iterations, requests, and retry attempts in Brunomnia's additive report model. Current passed/failed/skipped fields and legacy passed booleans share the same status resolver used by Results.
- Total is passed plus failed plus skipped. A request failure with no assertion rows contributes zero tests, and the row icon is failed only when at least one retained assertion failed, matching the pinned pane rather than the report's request-attempt failure count.
- Valid started/finished timestamps produce elapsed duration. Invalid timestamps fall back to the sum of nonnegative attempt durations so legacy/corrupt date evidence remains bounded and deterministic.
- Exactly 1,000 ms remains `1000 ms`; 1,001 ms becomes seconds. Exactly 60,000 ms remains `60 s`; 60,001 ms becomes minutes. Representative two-, one-, and zero-decimal magnitude paths are covered.
- History displays the formatted value and exposes raw milliseconds as a tooltip. Existing newest-first collection/folder scoping, reopening, Console/export selection, exact deletion, and 30-report retention are unchanged.
- `Cancel all` still sets the same cancellation flag, aborts the active browser/native transport or stream, marks unfinished items canceled, and cancels an active OAuth authorization. No new authority, persistence, cloud, account, telemetry, or entitlement behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M183 therefore makes no screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond pure regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 183 accepts pinned History assertion totals, assertion-failure success state, duration unit/precision behavior, and active `Cancel all` wording. Brunomnia continues to retain every retry attempt and therefore counts its assertions rather than collapsing additive evidence; raw request-attempt aggregates remain in reports/exports and the Runner header, not the pinned-shaped History columns. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 184.

M192 supersedes M183's duration-source adaptation for newly created reports: new History/export duration now uses the pinned summed completed-response duration, while the M183 wall-clock rule remains only as a compatibility fallback for legacy reports without that explicit field.
