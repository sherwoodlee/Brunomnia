# Milestone 26 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: persistent per-request SSE reconnect controls, long-running native response lifetime, server retry hints, `Last-Event-ID` resume, reconnect cancellation, status feedback, and migration normalization.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 24 files, 139 tests |
| Vite production build | Pass — 153 modules; 477.85 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 482,242-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 22 tests passed; the unchanged loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build, native checks, and packaging used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result is 22/23: only the existing mock-server integration that opens a loopback listener was denied. The five focused native streaming tests pass. No 23/23 or live reconnection-fixture claim is made.

## Focused coverage

- Existing and imported requests receive automatic reconnect, a 1,000 ms local delay, unlimited attempts, server retry-hint support, and event-ID resume by default.
- Imported and execution-time numeric settings are clamped to a 100–60,000 ms delay and 0–1,000 reconnect attempts; explicit boolean opt-outs survive migration.
- Active SSE responses have no total lifetime timeout, but connection establishment retains the bounded transport timeout.
- Chunked and CRLF parsing retains named/multiline data while valid `id:` and numeric `retry:` metadata update reconnect state.
- Zero reconnects means unlimited retries; a positive limit stops exactly after that many attempts; disabling automatic reconnect prevents the first retry.
- Reconnect delays and connection attempts are cancellable, and resumed connections optionally send the latest non-empty valid `Last-Event-ID`.
- Reconnect attempts, errors, successful reopens, and terminal close are distinguishable in the ordered event log and application status.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The browser fallback does not claim native reconnect execution.

## Acceptance boundary

This evidence accepts a persistent native SSE reconnect baseline. The environment cannot bind a deterministic local Event Stream server, so remote close, retry timing, and `Last-Event-ID` wire behavior are not claimed as live integration-tested. Event search/export, streaming plugin hooks, browser reconnect simulation, and reconnect-aware collection-run sampling remain open in [PARITY.md](PARITY.md).
