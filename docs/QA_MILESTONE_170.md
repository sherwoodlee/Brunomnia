# Milestone 170 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned-shaped collection-runner data encoding detection, selection, reparsing, and source metadata while preserving M169's bounded upload/preview workflow, raw editing, execution, history, Console, CLI, and account-free local operation.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Encoding Picker exposes forty labels spanning UTF-8/16/32, ASCII, ISO-8859, Windows code pages, GB18030, EUC, Big5, Shift_JIS, and KOI8 families.
- Pinned upload initially reads through its desktop encoding detector, displays the detected encoding only after a file parses, and re-reads the retained filesystem path whenever the user changes encoding.
- Browser and Tauri WebView `TextDecoder` implement the portable WHATWG subset rather than every Node iconv label. Brunomnia dynamically offers only labels the current device can construct and names UTF-32/rare unavailable labels as a remaining gap.
- Browser file handles do not expose durable paths. Brunomnia retains selected bytes only while the upload dialog remains open, persists decoded text plus source name/encoding, and requires file re-selection to change encoding after reopening.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused runner regressions | Pass — 1 file, 32 tests |
| Full Vitest suite | Pass — 67 files, 506 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 513 renderer modules; 165.22 kB stylesheet; 56.61 kB automation workbench; 71.61 kB interchange dialogs; 413.95 kB main renderer; 5,315,658-byte CLI bundle |
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

- Encoding detection recognizes UTF-16 little-/big-endian BOMs, accepts strict valid UTF-8, and uses Windows-1252 as a deterministic fallback for invalid UTF-8 without claiming probabilistic charset detection.
- Decoding reuses the 5 MB byte ceiling, rejects labels unavailable on the active device, and uses fatal decoding so malformed selections remain visible instead of silently replacing bytes.
- The portable inventory dynamically covers supported UTF-8/16, Windows-125x, ISO-8859, GB18030, EUC-JP/KR, Big5, Shift_JIS, and KOI8-R/U labels.
- A newly selected file retains exact bytes in dialog memory. Changing encoding immediately decodes, reparses JSON/CSV, refreshes preview/row/variable counts, and keeps actionable decode or syntax errors visible.
- Applying data persists decoded text, filename, and encoding in the Runner draft; raw edits or removal clear stale source identity and restore UTF-8 metadata.
- Reopening a saved upload displays its source encoding but disables re-decoding until the user re-selects a file, matching browser authority rather than retaining an unrestricted path.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M170 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed controls, strict compilation, focused byte/encoding evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 170 accepts broad device-supported data encodings, deterministic detection, bounded fatal decoding, encoding-driven reparse, and source-encoding persistence. UTF-32 and rare labels outside WebView `TextDecoder`, durable path-backed re-reading after the dialog closes, and generated CLI command/path preview remain absent. Transport-native duplicate raw header order and libcurl-style redirect/network diagnostics, remaining collection-run protocol semantics, and broader Inso work also remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 171.
