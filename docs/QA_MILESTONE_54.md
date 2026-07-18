# Milestone 54 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: replace decoded-string multipart parsing and part export with exact-byte sections, true byte sizes, and shared charset-aware inspection text while retaining the established bounds and navigation.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The pinned [main-process multipart parser](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/multipart-buffer-to-array.ts) feeds the response `Uint8Array` through `multiparty` and returns each part's byte buffer, byte count, headers, name, filename, and title. The pinned [multipart viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-multipart-viewer.tsx) selects those parts and passes the chosen byte buffer into the friendly response viewer. Brunomnia keeps its dependency-free bounded parser but now indexes and slices the exact response buffer rather than already decoded text.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 39 files, 237 tests |
| Vite production build | Pass — 167 modules; 498.23 KB / 498,231-byte main JavaScript chunk; 14,510-byte response-preview chunk; 4,212-byte response-download chunk; no chunk-size warning |
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

- The parser converts the aggregate entity to a bounded-chunk byte-index string solely for delimiter/header indexing; every part body is sliced from the original `Uint8Array` using the corresponding indexes.
- Delimiters still require line boundaries and a complete closing marker. Quoted boundaries, CRLF/LF framing, preambles/epilogues, boundary-like payload content, folded headers, and escaped disposition parameters retain their Phase 50 behavior.
- Binary payload bytes including NUL, `0xff`, and `0x80` remain exact in part state and the Save part artifact instead of becoming replacement characters.
- Original byte length drives selector evidence even when the charset-decoded string has a different UTF-8 length.
- Per-part Content-Type retains parameters. Windows-1252 and the complete Phase 53 alias/fallback path produce inspectable Unicode without mutating the original part bytes.
- Save part always builds its Blob from a copied exact byte buffer, never the 1,000,000-character preview or decoded string. Supplied filenames remain sanitized; unnamed octet-stream/PDF/textual parts receive useful extensions.
- The outer 5/100 MiB guard runs before byte-string allocation. The parser retains 100-part and 100-header caps and visible malformed/incomplete errors.
- Source and Raw still show the complete aggregate body. Visual multipart navigation remains in the lazy response-preview chunk, and the main renderer remains below its warning threshold.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Binary part selection, displayed replacement glyphs, header toggling, save prompting, and external verification of saved files are compile-, unit-, and artifact-byte-verified only in this phase.

## Acceptance boundary

The parser still receives the already buffered aggregate body and materializes a second one-code-unit-per-byte indexing string; it is not upstream's streaming `multiparty` implementation. Part header decoding does not implement RFC 2047 and filename parameters do not implement RFC 5987/2231. Selected part bodies remain textual and do not yet recursively invoke HTML/CSV/image/PDF/audio/multipart friendly viewers. Save uses the browser/WebView path rather than a native dialog. Raw compressed wire multipart framing remains unavailable.
