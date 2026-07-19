# Milestone 168 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned-compatible collection-runner History navigation over Brunomnia's bounded saved reports while preserving current-run Results/Console behavior, folder scope, exports, live controls, CLI execution, and account-free local persistence.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Runner loads results by parent runner ID, reverses them to newest-first order, and exposes Results, History, and Console tabs.
- Pinned History rows show source, iterations, duration, total, passed, failed, skipped, and delete; the source carries a precise created-time tooltip and pass/fail marker.
- Selecting a history source loads that saved execution and returns to Results; its response timelines then drive Console. Deletion removes exactly the selected saved result.
- Brunomnia adapts the parent runner ID to collection plus optional folder identity, preserving independent workspace-wide and nested-folder histories without inventing an account or server record.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused runner/reporter/storage regressions | Pass — 3 files, 73 tests |
| Full Vitest suite | Pass — 67 files, 504 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 512 renderer modules; 162.61 kB stylesheet; 52.67 kB automation workbench; 71.61 kB interchange dialogs; 411.21 kB main renderer; 5,314,278-byte CLI bundle |
| Bundled CLI startup/help | Pass — collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled direct suite and API-spec-prefix runs | Pass — 1/1 test and 1/1 matched assertion for both selectors |
| Bundled collection and request-flow smokes | Pass — collection fixture passed; flow executed first/third and persisted second as skipped |
| Bundled localhost CLI template smoke | Pass — denial, File grant, saved `insomnia.send()`, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 107 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- New reports persist their historical source plus optional folder ID; root collection reports remain distinct from every folder Runner, including nested-folder execution targets.
- The shared scope selector retains newest-first workspace order, treats pre-M168 reports without folder identity as collection-root history, and returns no cross-collection or cross-folder rows.
- History exposes source and exact local timestamp, iterations, bounded run duration, total/pass/fail/skip counts, success/failure markers, and an exact-entry delete action.
- Selecting any retained report reopens its saved live rows, attempts, request/response evidence, Console timeline, truncation state, and log-retention state before returning to Results.
- JSON and JUnit exports follow the selected historical report; starting a new run resets historical selection without changing request-plan or cancellation semantics.
- Immutable exact deletion persists through the ordinary workspace writer and preserves every unrelated collection/folder report.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M168 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed labels/actions, strict compilation, focused scope/deletion evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 168 accepts pinned-shaped newest-first Runner History, parent-runner scoping, source/time and run metrics, historical Results/Console reopening, selected-run export, and exact deletion. Reports created before M168 did not retain folder identity and therefore remain visible only in collection-root history. Transport-native duplicate raw header order and libcurl-style redirect/network diagnostics, remaining collection-run protocol semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 169.
