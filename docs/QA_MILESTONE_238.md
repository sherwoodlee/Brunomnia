# Milestone 238 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: persist Insomnia-compatible MCP connection responses, event/notification logs, timeline evidence, history controls, and dedicated filtering without publishing device-local traffic.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `insomnia-data/src/models/mcp-response.ts` defines a non-syncable response per MCP connection with environment, transport/status, event-log, timeline, error, and request-version fields.
- Pinned `main/mcp/common.ts` creates unique event/timeline streams per connection, records outgoing/incoming/error/close/notification events, returns newest-first events, and separates notifications from the ordinary event query.
- Pinned `realtime-response-pane.tsx`, `mcp-notification-tab.tsx`, and the request loader expose response history, environment filtering, Events/Notifications/Console tabs, Message/Open/Close/Error selection, search, non-destructive clear-view, details, delete, and clear. Selecting historical MCP response state closes the live client first.

## Implementation

- Workspace v39 adds bounded local `mcpSessions` records keyed to the renderer/native logical connection identity. HTTP and STDIO preserve one ID across reused operations; every successful protocol response now contributes a matching result event.
- Each connection retains outgoing methods, result payloads, server messages, idle notifications, reviewed responses, stderr/errors, and elapsed console evidence. Unexpected failure, explicit disconnect, configuration replacement, environment change, historical selection, deletion, and clearing finalize or close the correct record.
- Events and notifications are separated. Events support All/Message/Open/Close/Error selection, method/payload search, newest-first auto-selection, payload detail, and non-destructive clear-view. Notifications have a separate count, payload search, and detail. Console entries retain bounded elapsed evidence.
- History uses the existing 20/default, finite, zero, or unlimited retention preference and active-environment visibility/pruning. Selecting or deleting old history closes a live connection, and clear removes the client's active-environment records.
- Each connection is capped at 5,000 events, one million characters per event payload, five million method/payload characters in aggregate, and 5,000 console entries; migration retains at most 5,000 valid client/environment records and converts stale connected state to disconnected after restart.
- MCP history remains device-local like pinned `canSync = false`: folder/Git reads preserve current records, split projects never write them, ordinary imports clear them, and encrypted-sync/shareable payloads strip them.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused MCP history/migration/security suites | Passed: 7 frontend files, 100 tests |
| Full Vitest suite | Passed: 81 files, 602 tests |
| Full native suite | Passed across full plus isolated reruns: 126 tests; 1 public-fixture test ignored |
| Packaged CLI template and runner smokes | Passed |
| Rust formatting, clippy, and check | Passed |
| Clean TypeScript/Vite/CLI production build | Passed: 531 modules; 179.74 kB CSS, 106.17 kB Integration workbench, 439.59 kB main, 16,453,575-byte CLI |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

The full frontend suite and packaged CLI smokes ran with loopback access because their disposable MCP, HTTP, and protocol fixtures bind local sockets. Native runs covered all 126 local tests: under host contention, the unchanged millisecond cancellation assertion and five-second login-shell fixture each flaked in separate full attempts while the other 125 passed; both passed immediately in isolated reruns, and no native source changed in M238. The generated CLI changed with the expected workspace-v39 migration bundle and has SHA-256 `c21ae16fef386e0997f39f2f040480b33edadd132d6a44786edf16d07bdf7d35`.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. Deterministic history helpers, transport fixtures, migration/security tests, and the production renderer build verify the state and interaction contract without external MCP credentials.

## Remote gate

Pending implementation commit publication, workflow completion, signed GHCR inspection, and independent exact-identity verification.

## Acceptance boundary

M238 closes persistent MCP response/event/notification/timeline history and dedicated event filtering. Live third-party compatibility evidence and OS-keychain-wrapped runtime credentials remain. MCP clients stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
