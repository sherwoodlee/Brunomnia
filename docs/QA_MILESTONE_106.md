# Milestone 106 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: make all six local client-code targets self-contained for multipart and standalone binary request bodies while preserving exact bytes, resolved metadata, duplicate parts, content types, and honest compatibility bounds.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Insomnia renders the effective request into HAR, represents multipart bodies as name/value or name/file-path parameters, and delegates generation to the installed HTTPSnippet target/client matrix.
- Brunomnia cannot recover an absolute source path from a WebView-selected file because its workspace deliberately retains the approved bytes instead. This milestone therefore emits one exact Base64-backed body rather than inventing a filesystem path.
- The new `Client code generation` parity row remains `Baseline`: Brunomnia has six local targets, not the full HTTPSnippet matrix, and does not claim dependency installation, advanced runtime signing, compilation, or execution.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 52 files, 332 tests |
| Focused code-generation suite | Pass — 6 tests |
| Vite production build | Pass — 190 modules; main JavaScript 499.79 kB with no warning; lazy code-generation chunk 11.68 kB |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 74 tests with localhost bind access |
| macOS Tauri debug `.app` bundle | Pass — app-only packaging plus executable and `Info.plist` checks |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Multipart materialization resolves active variables in field names, text values, filenames, and content types; drops disabled/empty-name rows; and retains duplicate names in authored order.
- Text parts preserve UTF-8 bytes and optional content types. File parts preserve exact decoded bytes, an edited or source filename, and an edited or source MIME type.
- The serializer uses CRLF framing, quotes backslashes and quotes in disposition parameters, neutralizes header line breaks with visible warnings, and chooses a deterministic boundary absent from every part's metadata and bytes.
- The exact generated boundary replaces a stale authored multipart Content-Type. Standalone binary generation adds its saved MIME type only when no explicit Content-Type exists.
- cURL decodes the shared payload through a temporary file with GNU `base64 --decode` and BSD `base64 -D` fallback. JavaScript Fetch, Python Requests, Go `net/http`, Java `HttpClient`, and C# `HttpClient` decode the same Base64 payload in memory.
- Byte-level tests decode the JavaScript body, assert multipart framing/metadata/resolved text/duplicate fields/binary `0xff` data/closing boundary, force a boundary collision, and prove every target contains the identical encoded body and matching Content-Type.
- Missing attachments and malformed saved Base64 produce explicit warnings and omission instead of generating corrupt bytes. Multipart metadata line breaks cannot create an injected header row.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. No screenshot, DOM, console, or visual-interaction claim is made. Verification is limited to pinned source inspection, byte-level generator tests, strict TypeScript/Rust gates, full frontend/native suites, production/CLI builds, and desktop app packaging.

## Acceptance boundary

This milestone verifies materialized bytes and generated source text, not target package availability or execution on six external runtimes. Brunomnia still lacks Insomnia's complete HTTPSnippet target/client catalog and runtime-specific Digest, OAuth 1, IAM, Hawk, ASAP, NTLM, and Netrc signing reproduction. Inline files make snippets portable but can produce large preview text. The parity ledger remains `Baseline`, so Brunomnia is not yet declared feature-complete.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
