# Milestone 167 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned-compatible collection-runner log retention and Console inspection over Brunomnia's existing response timeline evidence while preserving retries, errors, live controls, reporters, portable CLI behavior, and bounded account-free local storage.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Runner advanced settings default `keepLog` to true, disable its “Keep logs after run” checkbox during execution, and switch the send runtime to a no-op timeline appender when retention is off.
- Pinned Console aggregates each retained response timeline in execution order, prepends `------ Start of request (<name>) ------`, and appends execution errors.
- Pinned timeline rendering prefixes every nonblank line by category: `< ` HeaderIn, `| ` DataIn/DataOut, `> ` HeaderOut, `<< ` and `>> ` SSL data, and `* ` Text, with a blank separator when the category changes.
- Brunomnia stores timeline evidence directly in each retained attempt rather than response-file paths. Capture is therefore bounded to 64,000 UTF-8 bytes per attempt, 1,000,000 bytes per report, and 1,000 entries per attempt; sensitive request/response header values and URL query values are redacted before report persistence.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused runner/timeline/storage/reporter regressions | Pass — 4 files, 78 tests |
| Full Vitest suite | Pass — 67 files, 503 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 512 renderer modules; 161.20 kB stylesheet; 50.51 kB automation workbench; 71.61 kB interchange dialogs; 410.97 kB main renderer; 5,314,146-byte CLI bundle |
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

- Runner document drafts retain the default-on log setting independently while switching tabs; the setting is disabled during a run and persisted on each report.
- Every retained retry attempt captures ordered response timeline entries when enabled and omits them when disabled without changing result, assertion, live-item, or reporter accounting.
- UTF-8-safe per-attempt and aggregate budgets preserve hidden markers and elapsed time, normalize invalid elapsed values, and surface a truncation notice without exceeding report retention bounds.
- Text and HeaderIn/HeaderOut capture redact sensitive URL query values plus Authorization, Cookie, token, password, passphrase, secret, and API-key-shaped header names before timeline evidence enters a report.
- Console aggregation preserves retry order, request separators, transport/script errors, and report-level flow errors; multiline formatting covers every pinned timeline category and filters blank lines like the pinned viewer.
- Results/Console controls preserve existing live progress, per-row Skip, Cancel run, selected attempt evidence, JSON/JUnit downloads, saved reports, and CLI execution flow.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M167 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed labels/states, strict compilation, focused model/formatting evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 167 accepts pinned-shaped default-on log retention, bounded attempt/report timeline persistence, request separators, category prefixes, multiline grouping, retry/error order, sensitive-header redaction, and a Results/Console inspection path. Brunomnia's current HTTP timeline still lacks transport-native duplicate raw header order plus libcurl-style redirect/network diagnostics, and the Runner does not yet expose a dedicated saved-run History picker. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 168.
