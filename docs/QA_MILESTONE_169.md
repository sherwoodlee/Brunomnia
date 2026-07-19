# Milestone 169 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned-compatible collection-runner data-file upload, preview, update/remove, automatic iteration sizing, and default bail behavior while preserving raw editing, per-document drafts, execution flow, history, Console, CLI, and bounded account-free local operation.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Runner defaults both `bail` and `keepLog` to true, disables advanced toggles and data upload during execution, and retains configuration independently by runner parent ID.
- Pinned Upload Data accepts `.json` and `.csv`, requires JSON arrays with at least one key-value object or CSV headers plus data, unions object keys for preview, and supports select/change, preview, remove, and upload.
- Applying uploaded data stores its rows and file path and changes iteration count to the number of valid rows. Pinned execution wraps when configured iterations exceed available rows.
- Pinned desktop file loading includes an encoding picker. Brunomnia intentionally uses the browser/Tauri file surface's UTF-8 text decoding and names non-UTF-8 selection as a remaining gap rather than silently guessing encodings.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused runner regressions | Pass — 1 file, 31 tests |
| Full Vitest suite | Pass — 67 files, 505 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 513 renderer modules; 164.80 kB stylesheet; 55.97 kB automation workbench; 71.61 kB interchange dialogs; 412.39 kB main renderer; 5,314,366-byte CLI bundle |
| Bundled CLI startup/help | Pass — collection, suite/API-spec, filter, data, trust, and reporter contracts present |
| Bundled direct suite and API-spec-prefix runs | Pass — 1/1 test and 1/1 matched assertion for both selectors |
| Bundled collection data/flow smokes | Pass — two CSV iterations produced two results; flow executed first/third and persisted second as skipped |
| Bundled localhost CLI template smoke | Pass — denial, File grant, saved `insomnia.send()`, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 107 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Runner drafts now retain the imported source filename alongside exact file text and still discard all unsaved data only when their synthetic document closes.
- JSON upload requires an array, retains valid object members, unions named keys, converts scalars predictably, and serializes nested objects/arrays compactly instead of producing `[object Object]`.
- CSV upload preserves CRLF normalization, quoted commas, missing trailing values, and exact string iteration values.
- File parsing rejects unsupported extensions, empty datasets, unnamed variables, more than 5 MB, more than 1,000 iterations, or more than 100 variables before updating the active draft.
- The modal exposes select/change, filename and row/variable counts, first-100-row preview, remove, apply, outside-click and Escape dismissal; applying sets iterations to valid row count.
- Raw JSON/CSV editing remains available. Editing raw text clears stale file identity without changing data until the next run.
- A new Runner defaults bail to true like pinned Insomnia; retained pre-M169 drafts continue using their explicit saved value.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M169 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed dialog semantics, strict compilation, focused parser evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 169 accepts pinned-shaped default bail, JSON/CSV data selection, bounded parsing, source retention, preview, update/remove, and automatic iteration sizing. Non-UTF-8 encoding selection and generated CLI command/path preview remain absent; direct raw editing is an intentional account-free extension. Transport-native duplicate raw header order and libcurl-style redirect/network diagnostics, remaining collection-run protocol semantics, and broader Inso work also remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 170.
