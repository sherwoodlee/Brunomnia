# Milestone 175 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: close the remaining real Runner encoding-label gap with portable KOI8-RU and KOI8-T decoding while preserving strict malformed-byte errors, the 5 MB source bound, reopen-safe drafts, and account-free local operation.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Insomnia declares `iconv-lite` `^0.6.3`; that version's generated single-byte tables define distinct 128-character KOI8-RU and KOI8-T mappings.
- KOI8-RU adds Ukrainian/Belarusian `ґ/Ґ`, `є/Є`, `і/І`, `ї/Ї`, and `ў/Ў` positions to the KOI8 family. KOI8-T replaces its upper punctuation/control region with Tajik Cyrillic letters and intentionally leaves several bytes undefined.
- ISO-8859-12 was never standardized. Although pinned `EncodingPicker` lists it, the native handler checks `iconv.encodingExists` and returns an unsupported-encoding error, so implementing a fabricated mapping would reduce rather than improve parity.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner regressions | Pass — 1 file, 34 tests |
| Full Vitest suite | Pass — 68 files, 513 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 515 renderer modules; 167.31 kB stylesheet; 61.87 kB automation workbench; 71.61 kB interchange dialogs; 420.53 kB main renderer; 5,317,963-byte CLI bundle |
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

- Portable KOI8-RU and KOI8-T strings reproduce the pinned iconv-lite 0.6.3 byte order without adding a browser polyfill or Node runtime dependency.
- ASCII bytes pass through unchanged. KOI8-RU regression evidence covers distinct lowercase/uppercase Belarusian short-U positions, while KOI8-T covers Tajik `қ`, `ғ`, `ҳ`, and ordinary Cyrillic output.
- KOI8-T bytes represented as replacement slots in the pinned table fail strict decoding with the same actionable Runner error shape as every other malformed selected encoding.
- Chunked output remains bounded by the existing 5 MB input ceiling and avoids argument-count or quadratic concatenation hazards for large valid files.
- The full 41-label picker, exact selected-byte draft retention, encoding reparsing, JSON/CSV validation, and cleanup behavior from M174 remain unchanged.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M175 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed mappings, strict compilation, focused regressions, full suites, and packaged-app verification.

## Acceptance boundary

Milestone 175 accepts portable decoding for every real encoding in the pinned 41-label picker. ISO-8859-12 remains visible and explicitly unsupported like pinned Insomnia; deterministic BOM/strict-UTF-8/Windows-1252 fallback is retained instead of claiming exact probabilistic chardet identity. Remaining collection-run protocol semantics and broader Inso work also remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 176.
