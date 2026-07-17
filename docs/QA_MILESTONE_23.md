# Milestone 23 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: resolved and redacted collection-run request metadata, content-free body evidence, independent request snapshot budgets, executed-URL continuity, and combined live/saved request-response inspection.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 24 files, 126 tests |
| Vite production build | Pass — 153 modules; 466.83 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 480,049-byte CommonJS executable |
| CLI JSON request-evidence smoke | Pass — trusted offline run wrote protocol, method, executed URL, configured headers, binary filename/size metadata, and stored-byte count |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 20 tests passed; the unchanged loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build/execution, and native packaging used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed that independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The native source did not change in this milestone. The sandbox result remains 20/21: only the unchanged integration that opens a loopback listener was denied. No 21/21 claim is made.

## Focused coverage

- Each request snapshot stores protocol, method, resolved/executed URL, configured enabled headers, body mode/summary/size, payload-estimate state, stored-byte count, and truncation flags.
- Header and query names matching authorization, cookie, token, secret, password, passphrase, or API-key patterns store `[redacted]` instead of the value.
- A focused fixture resolves environment values into the URL, preserves a public query value and Accept header, redacts an access token and API key, and proves neither the API key nor JSON password body value appears in serialized request evidence.
- JSON/text/GraphQL/gRPC/WebSocket content is counted but not retained. URL-encoded evidence keeps field names; multipart evidence keeps field/file names and estimated payload size; binary evidence keeps filename and decoded size.
- One request snapshot is limited to 16,000 UTF-8 content bytes and the report to 500,000. The 70-attempt test proves both caps and eventual zero-byte truncated snapshots.
- Desktop demo, stream, native/browser HTTP, and CLI execution paths now return the executed URL when available. The attempt pane shows request evidence above the existing response snapshot.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The combined evidence pane is typechecked, but visual layout, focus order, scrolling, and assistive-technology behavior are not claimed as manually validated.

## Acceptance boundary

This evidence accepts bounded configured request evidence, not full transport-console parity. Transport-added cookies and advanced-auth headers are not guaranteed in the snapshot, multipart byte size excludes wire framing, and arbitrary custom secret names cannot be inferred. URLs, non-redacted headers, field names, and filenames can still be sensitive; reports remain device-local unless explicitly exported. Other gaps remain in [PARITY.md](PARITY.md).
