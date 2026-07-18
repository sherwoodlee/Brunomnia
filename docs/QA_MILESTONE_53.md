# Milestone 53 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: honor declared HTTP response charsets across native/browser execution and every text consumer while preserving exact decoded entity bytes for raw export and byte-backed viewers.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The pinned [response viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-viewer.tsx) extracts `charset` from Content-Type, maps `utf8`, `utf16le`, `ucs2`, `ucs-2`, `latin1`, `binary`, and `win1250` through `win1258`, decodes through `TextDecoder`, and falls back to UTF-8 when decoding fails. Brunomnia applies that contract before response hooks rather than only inside the visual viewer so plugins, scripts, filters, templates, history, and diagnostics cannot disagree with Preview.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 39 files, 236 tests |
| Vite production build | Pass — 167 modules; 498.21 KB / 498,213-byte main JavaScript chunk; 14,105-byte response-preview chunk; 4,212-byte response-download chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 521,776-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 27 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 28-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- Content-Type header names and charset parameters are case-insensitive; values may be quoted, single-quoted, or unquoted and are bounded before decoder construction.
- The pinned compact aliases map to Encoding Standard labels. Other labels supported by the desktop WebView pass through unchanged; missing and failed labels use UTF-8.
- Windows-1252 bytes decode to their intended Unicode text and retain the exact single-byte entity in Base64 because UTF-8 re-encoding differs.
- UTF-16LE/`ucs2` decoding works even when every original byte is individually valid UTF-8, preventing the NUL-interleaved inspection string that a validity-only test would produce.
- A leading UTF-8 BOM is removed from inspection text like `TextDecoder` while its original bytes remain exactly recoverable for raw download.
- Native Tauri responses are normalized immediately after the command returns; browser Fetch passes the response charset directly into the same byte decoder.
- Timeline construction and plugin hooks occur after decoding, so saved history, chained templates, response scripts, JSON/XML/CSV parsing, Source/Raw/Copy, and HAR/debug text share one string.
- Valid ordinary UTF-8 and charset-declared ASCII remain reconstructable without a duplicate byte sidecar. Malformed UTF-8 and corrupt persisted Base64 retain the prior safe fallbacks.
- The helper remains dependency-free. Its main-bundle increase stays below Vite's warning threshold, while media and response-download chunks remain unchanged.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Operating-system decoder-label breadth, visual glyph rendering, copy behavior, and external inspection of downloaded legacy-encoded files are compile-, unit-, and artifact-byte-verified only in this phase.

## Acceptance boundary

Brunomnia trusts the declared charset and does not attempt statistical encoding detection. `TextDecoder` label support can vary with the operating-system WebView; unsupported labels deliberately fall back to UTF-8 replacement decoding. Raw export is exact for the decoded HTTP entity, not compressed wire bytes. Filesystem-backed/deferred bodies, byte-backed recursive multipart viewers, content-type/encoding sniffing, interactive HTML, and raw transport traces remain explicit parity gaps.
