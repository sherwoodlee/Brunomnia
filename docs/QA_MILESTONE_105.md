# Milestone 105 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: execute the production native Server-Sent Events path against a real loopback server and verify initial connection metadata, server-directed reconnect timing, `Last-Event-ID` resume, resumed event delivery, explicit cancellation, and terminal closure.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Insomnia treats Event Stream as a long-running ordinary response and retains response metadata plus event/timeline evidence; Brunomnia keeps the equivalent bounded structured evidence in its local workspace.
- This milestone closes the prior executable-evidence gap for SSE reconnect and resume behavior without changing the existing explicit bounds for file-backed logs, plugin hooks, or external compatibility fixtures.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 52 files, 329 tests |
| Focused native SSE reconnect loopback | Pass |
| Vite production build | Pass — 190 modules; main JavaScript 499.79 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 74 tests after granting the suite localhost bind access |
| macOS Tauri debug `.app` bundle | Pass — app-only packaging plus executable and `Info.plist` checks |
| Changed-path whitespace checks | Pass |

## Focused coverage

- The native fixture accepts two real HTTP/1.1 requests from production `connect_sse` code rather than invoking the parser in isolation.
- The first request proves `Accept: text/event-stream` and the absence of a fabricated resume header. Its response supplies `id: order-1`, `retry: 100`, a named event, and the first payload.
- The event channel proves first-event delivery, a reconnect lifecycle entry using the server-provided 100 ms delay instead of the authored 1,000 ms delay, and a reconnected-open entry.
- The second captured request proves `Last-Event-ID: order-1`; its named `order.updated` event and `second` payload arrive on the same session channel.
- The connect result proves HTTP 200, HTTP/1.1, content type, and `Server-Sent Events` transport metadata before event consumption.
- Explicit `disconnect_sse` cancels the pending next reconnect, removes the native session handle, and emits a terminal `closed` event without requiring another server response.
- Shared HTTP request capture now retains normalized headers, allowing protocol loopbacks to assert transport-visible behavior in addition to emitted events.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. No screenshot, DOM, console, or visual-interaction claim is made. Verification is limited to pinned source inspection, focused native loopback coverage, strict TypeScript/Rust gates, full frontend/native suites, production/CLI builds, and desktop app packaging.

## Acceptance boundary

This milestone verifies the real packaged-app SSE code path on a local HTTP/1.1 fixture. It does not claim upstream filesystem event/timeline storage, streaming plugin hooks, third-party server compatibility matrices, custom proxy/client-identity streaming upgrades, signed/notarized installers, cross-platform packaging, or rendered interaction QA. The parity ledger remains `Baseline`, so Brunomnia is not yet declared feature-complete.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
