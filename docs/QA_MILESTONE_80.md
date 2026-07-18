# Milestone 80 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: expose bounded multipart request fields to native local mock response templates, including the four upstream media types, repeated-name arrays, and valid-UTF-8 file-part content.

The source audit used Kong's current [dynamic mocking documentation](https://developer.konghq.com/insomnia/dynamic-mocking/) and the exact [Insomnia Mockbin body parser at commit c2a3885](https://github.com/Kong/insomnia-mockbin/blob/c2a388563ea8259f9b235e4b3dfe87f64d568014/lib/middleware/body-parser.js). The upstream parser accepts form-data/mixed/related/alternate, exposes part values by field name, and promotes repeats from a string to an array.

## Automated gates

| Gate | Result |
| --- | --- |
| Fresh locked frontend dependencies | Pass — 109 packages installed; audit reported 0 vulnerabilities |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 270 tests |
| Vite production build | Pass — 173 modules; 498,565-byte main JavaScript chunk; 49,097-byte lazy automation-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 518,331-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native multipart suite | Pass — 3 tests |
| Sandboxed `cargo test --locked` | Environment-limited — 51 policy/parser/renderer/handler tests pass; the unchanged loopback-listener integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

The earlier reusable `/tmp` mirror had been cleaned by macOS. Verification therefore rebuilt a fresh `/private/tmp` mirror, installed the exact lockfile dependency graph, and reused only the independently warmed Cargo target. Tauri ran its real `beforeBuildCommand`, rebuilding the same production renderer and CLI before bundling.

The sandbox result remains one test short of the full 52-test native suite: only the existing mock-server integration that opens a loopback listener is denied. The socket-free async multipart handler fixture and both pure multipart parser/boundary fixtures pass. No rendered-browser claim is made.

## Focused coverage

- `multipart/form-data`, `multipart/mixed`, `multipart/related`, and `multipart/alternate` share the bounded field parser.
- Quoted and unquoted boundaries are accepted; CR/LF/NUL injection, missing boundaries, and overlong boundaries are refused.
- Preambles, epilogues, CRLF/LF framing, multiline values, and filename-bearing text parts are parsed.
- A delimiter-looking line with a non-boundary suffix remains field content.
- Repeated names become JSON arrays and render through zero-based dotted indices.
- More than 100 parts or more than 16,000 per-part header bytes rejects the complete parsed field object.
- Field names are capped at 1,000 bytes; the existing post-route request body inspection remains capped at 1,000,000 bytes.
- An async handler-level fixture carries repeated fields and a filename-bearing text part through Axum route matching and template rendering without opening a socket.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Inspector examples, multipart authoring, responsive layout, and restart-after-edit behavior are compile-, unit-, style-, and bundle-verified only in this phase.

## Acceptance boundary

The complete request body must remain valid UTF-8 and inside the existing 1 MB inspection limit, so binary file content exposes no `req.body` context. Filenames, content types, and per-part headers are not template properties; this matches Mockbin's simple field-value drop. Malformed or over-limit multipart exposes no parsed fields but retains its bounded valid-UTF-8 raw body. Repeated query and URL-encoded names still use the last value and remain a separate parity item.
