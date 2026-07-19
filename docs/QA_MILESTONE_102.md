# Milestone 102 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: give saved WebSocket, Socket.IO, and Server-Sent Events sessions the same historical editable-request restoration lifecycle as pinned Insomnia realtime responses.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Upstream `webSocketResponse.create` and `socketIOResponse.create` load the owning request, create or reuse a compressed request-version record, and attach its ID before persisting the response.
- The shared history dropdown closes a live realtime request before selecting another response, restores the selected request version, and updates the active response ID.
- Deleting the current response removes its evidence, selects the newest eligible remaining response, and restores that response's request version. Clear-history does not restore a removed version.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 52 files, 327 tests |
| Focused history/storage/interchange/project/security suite | Pass — 7 files, 78 tests |
| Vite production build | Pass — 190 modules; main JavaScript 498.05 kB with no warning |
| Bundled CLI build | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 73 tests, including loopback fixtures outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass — app-only packaging plus executable and `Info.plist` checks |
| Changed-path whitespace checks | Pass |

## Focused coverage

- `StoredStreamSession` now optionally owns an `ApiRequest` snapshot. `createStreamSession` takes a structured clone, so later editor changes cannot mutate historical evidence.
- Connection setup snapshots `active.request`, not the inherited/execution-expanded copy, matching upstream's editable request-version semantics and avoiding flattened folder/collection configuration.
- Stream and ordinary response history share one restore helper. It requires the same request ID, recognized protocol/body mode, and complete row/auth/GraphQL/gRPC/transport/SSE structures before restoring anything.
- Restoration preserves the current request ID and folder placement. Socket.IO data restores only when structurally present, so older request snapshots remain compatible with the v23 protocol addition.
- Selecting a saved session waits for a different live session to disconnect, rechecks the synchronous request/environment/project view scope, then swaps the log and restores the selected request version.
- Deleting a selected session uses the same race guards, selects the newest eligible remaining session, and restores its snapshot. Clearing history intentionally leaves the current editor unchanged.
- Workspace v25 accepts a persisted stream snapshot only when its embedded ID matches the owning session's request ID. Legacy v24 sessions remain selectable event logs without fabricated request versions.
- Project reload and encrypted-sync merge preserve device-local stream snapshots with their sessions; project publication, encrypted revisions, and local-workspace duplication retain the existing omission/reset boundaries.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. No screenshot, DOM, console, or visual-interaction claim is made. Verification is limited to pinned source inspection, strict compiler/lint gates, focused restore/migration tests, the full frontend/native suites, production bundling, and desktop app packaging.

## Acceptance boundary

Brunomnia stores structured request snapshots inside its bounded local workspace rather than upstream's compressed request-version documents. Realtime history still lacks per-session handshake/timeline headers, filesystem-backed event-log paths, saved-event search/export, and streaming plugin hooks. Signed/notarized installers, cross-platform packaging, live third-party fixtures, and rendered interaction QA remain open.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
