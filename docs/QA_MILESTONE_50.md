# Milestone 50 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: add decoded-text multipart response navigation, header inspection, textual part preview, and part export to Visual Preview with explicit MIME and byte-fidelity bounds.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The pinned [response viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-viewer.tsx) routes friendly multipart content to the [multipart response viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-multipart-viewer.tsx), which selects parsed parts, exposes headers/save actions, and recursively displays the selected content. The pinned [main-process parser](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/multipart-buffer-to-array.ts) uses byte-backed multiparty parsing and returns each part's title, name, filename, byte count, headers, and buffer.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 36 files, 220 tests |
| Vite production build | Pass — 165 modules; 496.36 KB / 496,364-byte main JavaScript chunk; 12,495-byte response-preview chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 521,368-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 26 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled and reuses the generated Cargo target directory.

The sandbox result remains one test short of the full 27-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No native behavior changed in this phase. No rendered-browser claim is made.

## Focused coverage

- Visual Preview recognizes `multipart/*` only after the large-response guard passes; Source and Raw continue to show the complete original response text.
- Boundary extraction accepts quoted/unquoted parameters, rejects missing/newline/over-200-character values, escapes regular-expression syntax, and requires a closing delimiter.
- Delimiters are recognized only at line boundaries with optional closing markers/whitespace, preserving ordinary boundary-like strings inside part content.
- CRLF and LF framing work; folded header lines unfold before case-preserving name/value parsing.
- Content-Disposition name and filename parameters support quoted/unquoted values plus escaped quote/backslash characters; unnamed parts get deterministic labels.
- Each part retains up to 100 headers, a normalized content type, complete decoded body text, and a UTF-8 byte count.
- The viewer caps navigation at 100 parts, active text rows at 1,000,000 decoded characters, and reports both truncation states.
- Header visibility resets on part changes. Selected-part fallback remains deterministic when a new response has fewer parts.
- JSON part text prettifies; other content remains exact decoded text. No nested HTML or media execution occurs.
- Save part writes the complete decoded part through Blob/object URL, uses supplied filenames after filesystem-safe normalization, derives JSON/HTML/XML/CSV/text extensions otherwise, and never uses the truncated preview string.
- Parser/viewer/download code remains in the lazy response-preview chunk; the main bundle is unchanged from Phases 48–49.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Part switching, header toggling, save prompting, scrolling, focus order, and visual density are compile- and source-verified only in this phase.

## Acceptance boundary

Unlike upstream's byte-backed multiparty parser, Brunomnia parses already decoded UTF-8 text. Binary part bytes can be lossy, recursive friendly viewers are not invoked, RFC 5987/2231 filename encoding is not implemented, and Save part uses the browser/WebView download path. These remain explicit gaps.
