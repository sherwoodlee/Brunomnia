# Milestone 82 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: apply mock route edits to an already-running native loopback server without changing its listener address or requiring stop/start.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 270 tests |
| Vite production build | Pass — 173 modules; no chunk-size warning |
| Bundled CLI build | Pass — 518,331-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Socket-free live-update fixture | Pass |
| Native test suite | Pass — 54 tests outside the filesystem sandbox, which does not permit the one `127.0.0.1` fixture |
| macOS Tauri debug `.app` bundle | Pass — real `beforeBuildCommand` rebuilt the renderer and CLI before bundling `Brunomnia.app` |

## Focused coverage

- Running servers retain a shared, asynchronous route snapshot rather than a start-time-only vector.
- The renderer debounces updates independently per server, so switching between mock servers does not discard a pending edit.
- Route updates replace the complete route set atomically and return the current enabled-route count.
- Matching clones one route before request-body parsing or delay, preventing a mid-request edit from mixing old and new route fields.
- The socket-free handler fixture removes `/before`, adds `/after`, and serves the new status/body without constructing a new router.
- The real loopback fixture starts once, serves the original route, updates native state, and receives the edited status, route ID, and body from the same base URL.
- Shutdown cleanup compares the running route-store identity before removing state, so an older listener cannot delete a replacement with the same server ID.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibits the in-app Browser. The running-state label now states that edits apply live; TypeScript, bundle, native command, and lifecycle behavior are covered by automated gates.

## Acceptance boundary

Route changes are applied after a 180 ms local debounce. Host and port changes still require restart because they define the bound listener. An in-flight request finishes with the route snapshot it matched; subsequent requests use the latest route set.
