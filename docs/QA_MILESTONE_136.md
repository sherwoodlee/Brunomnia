# Milestone 136 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: complete pinned Server-Sent Events response parity and add the shared selectable realtime message-detail workflow across SSE, WebSocket, GraphQL subscriptions, and Socket.IO without closing still-open proxy capabilities.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/ui/components/websockets/realtime-response-pane.tsx` shares response history, event filtering/search, clear-view, message selection, Headers, Cookies, and Console/Timeline presentation across cURL Event Stream, WebSocket, Socket.IO, and GraphQL-subscription responses; the cURL-backed Event Stream disables its type selector.
- `packages/insomnia/src/ui/hooks/use-realtime-connection-events.ts` resolves each response's events through protocol-specific `findMany` calls and refreshes after new-event notifications.
- `packages/insomnia/src/ui/components/websockets/event-view.tsx` provides Friendly/Source/Raw message inspection, raw clipboard copy, and per-message save; binary WebSocket data is decoded best-effort for display.
- `packages/insomnia/src/ui/components/socket-io/event-view.tsx` formats each ordered Socket.IO argument independently in the selected message detail.
- `packages/insomnia/src/main/network/curl.ts`, `websocket.ts`, and `socket-io.ts` append NDJSON events to response-owned files, while response models retain the paths. That is an internal persistence strategy: the user-visible contract is response-scoped incremental history, selection, retrieval, delete, and clear behavior.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused event/history regressions | Pass — 2 files, 10 tests |
| Full Vitest suite | Pass — 62 files, 437 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 506 renderer modules; 7.64 kB lazy StreamConsole chunk; 343.03 kB main renderer; 5,279,883-byte CLI bundle |
| Bundled CLI startup/help | Pass |
| Bundled localhost CLI template smoke | Pass — denial, File grant, Node OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 99 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Incoming and outgoing events are selectable; selecting the same event again closes the pane. Open, reconnect, upgrade, error, close, and other system rows remain list-only, matching the pinned detail components' effective behavior.
- Selection, Socket.IO argument choice, and action errors reset when another saved session is selected. If bounded retention evicts the selected event, the detail pane closes instead of retaining stale data.
- Friendly mode pretty-prints valid JSON. Source and Raw preserve the original message text. The existing request-scoped response preview setting persists the selected mode across live and historical realtime sessions.
- Socket.IO Friendly mode parses the native ordered argument array and exposes up to 100 arguments separately; nested binary Buffer-shaped JSON remains ordinary inspectable JSON.
- Raw copy uses unformatted text. Text and JSON artifacts retain their exact UTF-8 content and safe deterministic extensions. Binary WebSocket artifacts decode the transport's Base64 representation to exact bytes rather than saving the Base64 wrapper.
- Event-list summaries collapse whitespace and cap text at 240 characters, while binary rows show exact decoded byte counts. The full selected content remains available in the detail pane.
- Existing stream history keeps up to 5,000 newest events and approximately five million text characters, persists incremental lifecycle/message data directly in the device-local project, and retains history/filter/clear/delete semantics without exposing an Electron filesystem path.
- Existing native SSE coverage exercises CRLF/chunk parsing, named and multiline events, retry hints, event IDs, `Last-Event-ID`, finite/unlimited reconnect policy, reconnect failure, and explicit cancellation against loopback servers.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. This milestone makes no screenshot, DOM, console, keyboard-interaction, or visual-layout claim beyond source inspection, strict compilation, pure preview/artifact tests, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 136 accepts Server-Sent Events parity for the pinned source-backed lifecycle, history, and response-inspection workflows. Bounded inline device-local persistence replaces response-owned NDJSON paths without omitting a user-visible action; per-message export is not presented as a whole-log export. WebSocket and Socket.IO remain `Baseline` because PAC-authenticated system proxy discovery is still open. The Server-Sent Events row is `Complete`; 22 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 137.

Retrospective correction from Milestone 137: a deeper audit of the pinned WebSocket and Socket.IO connect paths disproved the PAC/system-proxy requirement recorded above. Those paths install an explicit manual HTTP/HTTPS proxy agent when configured and otherwise install no proxy agent. The 22-row count remains the historical Milestone 136 ledger state; Milestone 137 closes WebSocket after separately implementing its actual redirect-policy gap.
