# Milestone 174 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: complete the pinned Runner encoding-picker inventory, add portable UTF-32 decoding, and preserve bounded source bytes across data-dialog reopenings without persisting unrestricted filesystem paths.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `EncodingPicker` exposes 41 labels: UTF-8/16/32, ASCII, sixteen ISO-8859 entries, nine Windows code pages, GB18030, EUC-JP/KR/CN, Big5, Shift_JIS, and four KOI8 variants.
- Pinned selection resolves Electron's file path, detects with `chardet`, decodes with `iconv-lite`, and re-reads that path whenever the encoding changes. Its visible inventory can still exceed the labels accepted by the backend's `iconv.encodingExists` check.
- Brunomnia's user-selected browser/Tauri file bytes are already bounded to 5 MB. Retaining those bytes only in the open synthetic Runner document reproduces re-decoding without adding durable path authority or surviving document closure.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner regressions | Pass — 1 file, 34 tests |
| Full Vitest suite | Pass — 68 files, 513 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 515 renderer modules; 167.31 kB stylesheet; 61.87 kB automation workbench; 71.61 kB interchange dialogs; 419.67 kB main renderer; 5,317,963-byte CLI bundle |
| Bundled CLI startup/help | Pass — unchanged collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled Runner preview smoke | Pass — split-YAML project input, selected request order, data, and delay |
| Bundled localhost CLI template smoke | Pass — denial, File grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- The picker now keeps all 41 pinned labels visible in pinned order rather than hiding labels that the active WebView cannot construct.
- UTF-32 LE/BE BOMs are detected before their UTF-16 prefixes. Portable decoding strips the matching BOM, accepts valid scalar values including astral code points, rejects surrogates/out-of-range values, and requires complete four-byte units.
- ASCII rejects bytes above `0x7f`; ISO-8859-1 preserves exact `0x00`–`0xff` code points instead of inheriting the WHATWG Windows-1252 alias; EUC-CN resolves through the compatible GBK decoder. Remaining labels use fatal active-WebView decoding, and unavailable rare labels produce an explicit unsupported-device error.
- Exact source bytes round-trip through bounded Base64 in the unsaved Runner draft. Reopening the dialog immediately enables encoding changes and reparsing without file re-selection.
- Raw text edits, Remove Data, and Runner-document closure discard source bytes, filename, and encoding identity together. Draft bytes never enter workspace persistence, project interchange, reports, CLI arguments, or sync data.
- Existing JSON/CSV parsing, preview bounds, automatic iteration count, selected request plan, execution, reports, and Run via CLI path requirements remain unchanged.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M174 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed controls, strict compilation, focused decoding regressions, full suites, and packaged-app verification.

## Acceptance boundary

Milestone 174 accepts the pinned 41-label inventory, portable UTF-32/ASCII/Latin-1 behavior, deterministic BOM detection, and bounded reopen-safe source-byte continuity. Labels that require iconv tables absent from the active WebView remain visible but can return an explicit unsupported error; probabilistic chardet identity and durable filesystem-path re-reading are not claimed. Remaining collection-run protocol semantics and broader Inso work also remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 175.
