# Milestone 101 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: persist WebSocket, Socket.IO, and Server-Sent Events connections as device-local response-history sessions with upstream-compatible retention, environment filtering, chronological selection, delete, clear, and event-log lifecycle behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Upstream creates WebSocket and Socket.IO response models through the same `maxHistoryResponses` setting used by ordinary responses and writes their ordered events to response-owned event logs.
- Its shared response loader applies the active-environment filter, sorts newest first, restores request versions when present, and exposes the Just Now / Less Than Two Hours Ago / Today / This Week / Older Than This Week selector with delete-current and clear-history actions.
- Event Stream requests use the same response loader/history surface. Brunomnia therefore applies one session-history contract to WebSocket, Socket.IO, and SSE rather than inventing protocol-specific retention controls.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 52 files, 326 tests |
| Focused stream-history/storage/project/security suite | Pass — 4 files, 41 tests |
| Vite production build | Pass — 190 modules; main JavaScript 497.93 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 73 tests, including loopback fixtures outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass — app-only packaging plus executable and `Info.plist` checks |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Workspace v24 migration accepts only sessions whose request still exists, normalizes protocol, identity, direction, timestamps, and event text, and caps persisted input at 5,000 sessions and 5,000 events per session.
- New connections retain a session immediately, then append every incoming, outgoing, system, reconnect, error, close, and closed event through functional workspace updates. Logs preserve the newest 5,000 events and about 5 million text characters while retaining the latest event.
- Positive, zero, and unlimited `maxHistoryResponses` values match ordinary response behavior. Active-environment filtering changes both visibility and future per-scope pruning.
- Request, environment, filter, and local-project changes restore the newest eligible session. Historical selection disconnects a different live session before swapping the console; delete removes one session and clear removes only the active request/environment scope.
- Late events still persist to their owning saved session but cannot replace another request or workspace's visible log/status. Scope changes and competing selections cannot let delayed disconnect completions clear a newer live connection.
- A terminal error/close records `endedAt`; subsequent reconnecting/open evidence clears that terminal marker. A connection that finishes opening after its view scope was abandoned is immediately closed.
- Local project reload and encrypted-sync merge keep the device's session history. Shared encrypted revisions omit it, split-YAML projects do not serialize it, and duplicated local projects begin with empty session/response history.
- Cold-path mock shutdown, mediated script-file reads, and analyzed-import application now load lazily. GraphQL remains static because its editor/storage users already place that module in the main graph; this keeps the main chunk below Vite's 500 kB warning threshold without an ineffective dynamic import.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. No screenshot, DOM, console, or visual-interaction claim is made. Verification is limited to pinned source inspection, strict compiler/lint gates, focused lifecycle tests, the full frontend/native suites, production bundling, CLI startup, and desktop app packaging.

## Packaging note

The default debug packaging command created `Brunomnia.app` and then failed in Tauri's optional `bundle_dmg.sh` step. A clean app-only rerun completed successfully and validated the executable plus property list. This milestone claims a working debug `.app`, not a signed/notarized DMG or cross-platform installer.

## Acceptance boundary

Brunomnia does not yet retain a request-version snapshot, handshake/timeline headers, or an upstream-style filesystem event-log path per stream session. Saved-event search/export, streaming plugin hooks, live third-party fixtures, signed installers, and rendered interaction QA remain open.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
