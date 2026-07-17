# Milestone 22 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: UTF-8-safe response snapshots for collection-run attempts, per-attempt and aggregate storage bounds, live/saved desktop response inspection, and versioned JSON evidence without expanding concise reporters.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 24 files, 125 tests |
| Vite production build | Pass — 153 modules; 466.79 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 474,796-byte CommonJS executable |
| CLI JSON snapshot smoke | Pass — trusted offline run wrote status text, headers, exact 11-byte body preview, truncation flags, response size, and stored-byte count |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 20 tests passed; the unchanged loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build/execution, and native packaging used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed that independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The native source did not change in this milestone. As in Milestones 16–21, the sandbox result is 20/21: only the unchanged integration that opens a loopback listener was denied. No 21/21 claim is made.

## Focused coverage

- Every response snapshot shares the runner result's status/duration while adding bounded status text, response headers, a body preview, original size, stored-byte count, and explicit status/header/body truncation flags.
- One attempt can retain at most 32,000 UTF-8 content bytes. Body content is capped at 16,000 bytes; up to 64 headers use 256-byte names and 2,048-byte values.
- One mutable 1,000,000-byte budget spans all attempts. A 70-request test proves the sum never exceeds the cap and that later results receive empty, explicitly truncated snapshots once it is exhausted.
- The truncator uses a fatal UTF-8 decoder and backs up from the byte limit until a complete code-point boundary is found. The fixture's four-byte emoji body proves the preview does not end with a broken sequence.
- Pointer click, Enter, and Space select result rows. The detail pane shows live or saved response status, size, timing, retained headers/body, and truncation state, with an explicitly labeled close control.
- Versioned JSON serializes the bounded snapshot automatically. Spec/list/dot/min/progress/TAP and JUnit remain free of response content to stay concise and avoid silently copying response data into common CI logs.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The detail pane is typechecked and its row/close controls have keyboard behavior and explicit semantics, but visual layout, focus order, scrolling, and assistive-technology behavior are not claimed as manually validated.

## Acceptance boundary

This evidence accepts bounded response-level run evidence, not full request/response console parity. Request headers/bodies, redirect traces, cookie deltas, syntax-highlighted viewers, arbitrary-size response bodies, binary rendering, full protocol-specific consoles, and the other gaps in [PARITY.md](PARITY.md) remain open. Explicit JSON export can contain sensitive response content; reports remain device-local unless the user exports them.
