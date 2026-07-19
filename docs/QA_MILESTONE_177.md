# Milestone 177 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned-shaped Runner Results status controls and name filtering across active, latest, and reopened historical runs while preserving aggregate evidence, saved reports, exports, Console continuity, and account-free local operation.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `RunnerTestResultPane` exposes All, Passed, Failed, and Skipped controls plus a `Filter test results with name` text input. It passes both values into each request-result card's assertion rows.
- Pinned average-response-time and start-time history columns are commented out; implementing them as claimed active parity surfaces would be incorrect.
- Brunomnia uses a flat attempt table rather than nested request cards. M177 applies the four source categories at attempt level and searches request identity plus assertion/error evidence, preserving the same discovery goal without inventing nested duplicate rows.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner regressions | Pass — 1 file, 38 tests |
| Full Vitest suite | Pass — 68 files, 517 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 515 renderer modules; 168.10 kB stylesheet; 62.62 kB automation workbench; 71.61 kB interchange dialogs; 421.09 kB main renderer; 5,317,654-byte CLI bundle |
| Bundled CLI startup/help | Pass — unchanged collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled Runner preview smoke | Pass — split-YAML project input, selected request order, data, and pre-send delay |
| Bundled localhost CLI template smoke | Pass — denial, File grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- A pure filter resolves the latest retry result for each live-item key, preserving legacy keyless report matching by request ID and iteration.
- Passed uses the retained final attempt outcome; Failed includes HTTP/assertion/transport failures plus canceled attempts; Skipped uses the explicit live-item state; pending/running rows remain visible only under All.
- Case-insensitive search covers request name, resolved/editable URL, status message, runner error, attempt error, assertion name, and assertion error. Whitespace-only queries preserve every row in the chosen category.
- Active, latest, and selected historical data all feed the same helper. Filtering is presentation-only: planned/finished/skipped/canceled counters, selected report, report storage, Console, JSON/JUnit/TAP/text artifacts, and deletion remain unchanged.
- The source-shaped toolbar uses pressed-state buttons, a labeled search input with the pinned placeholder, filtered/total evidence, and a distinct no-match state. Hiding a selected attempt also hides its detail pane without deleting selection; clearing the filter restores it.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M177 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed controls, strict compilation, pure filter regressions, full suites, and packaged-app verification.

## Acceptance boundary

Milestone 177 accepts source-shaped result categories and name filtering through Brunomnia's flat attempt-table adaptation. It does not claim the commented-out upstream average-response/start-time columns. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 178.
