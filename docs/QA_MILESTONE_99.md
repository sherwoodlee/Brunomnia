# Milestone 99 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: replace the direct-WebSocket-only Socket.IO baseline with upstream-compatible Engine.IO v4 polling-first negotiation, standards-based WebSocket upgrade, and fully functional polling fallback.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/main/network/socket-io.ts` uses `socket.io-client` 4.8.1 without overriding its default transport order, passes query/headers/cookies/proxy/TLS/client identity options, and records the Engine.IO `upgrade` event.
- The resulting compatibility target is HTTP polling first, optional SID-preserving WebSocket probe/upgrade, and continued polling when upgrade is unavailable rather than requiring direct WebSocket support.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 51 files, 323 tests |
| Vite production build | Pass — 188 modules; main JavaScript 497.66 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused Socket.IO negotiation suite | Pass — 4 tests |
| Native test suite | Pass — 72 tests, including loopback fixtures outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Polling and WebSocket URLs preserve user query ordering while replacing reserved `EIO`, `transport`, `sid`, and cache-buster parameters; HTTP(S)/WS(S) inputs map to the correct transport schemes and custom Engine.IO path.
- Initial polling is performed through the existing streaming HTTP client, retaining custom/system/direct proxy behavior, no-proxy exclusions, certificate-validation mode, redirect bounds, connect timeout, preferred HTTP mode, and domain-scoped PEM identity.
- Every polling request receives a unique cache-buster, response bodies are streamed into a strict 1 MiB UTF-8 limit, non-success statuses remain actionable, and open packets validate SID plus bounded server `maxPayload`.
- Advertised WebSocket upgrades reconnect with the existing SID and headers, send `2probe`, require `3probe`, send `5`, and only then move the namespace connect and session loop to WebSocket.
- Failed or policy-ineligible upgrades retain polling. A dedicated receive task keeps one long poll active while emit, heartbeat, and disconnect POSTs progress concurrently, avoiding HTTP/1 connection head-of-line deadlock.
- Both transport loops share event-name/argument/packet bounds, acknowledgement IDs, live listener updates, incoming/outgoing/system records, namespace errors, Engine.IO heartbeat handling, and cleanup semantics.
- Real loopback fixtures prove both polling-only and polling-to-WebSocket sessions through namespace connect, emit, acknowledgement, incoming named listener, transport evidence, and disconnect.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. The milestone changes native negotiation only; pinned source inspection, strict compiler/lint gates, unit coverage, two real transport loopbacks, warning-free frontend bundling, and desktop packaging provide the acceptance evidence.

## Acceptance boundary

Binary Socket.IO attachments remain reported but are not decoded or composed. WebSocket upgrade is skipped when custom proxy/client identity or disabled certificate-validation policy is active because the current Tungstenite connector cannot preserve those authorities; the polling transport remains fully functional and policy-correct. Persistent message collections/search/export, streaming plugin hooks, and live third-party server fixtures remain open.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
