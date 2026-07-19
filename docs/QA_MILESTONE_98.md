# Milestone 98 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: replace the prior Socket.IO-to-WebSocket downgrade with a first-class, account-free Socket.IO request model, native transport, authoring surface, runner path, and Insomnia v4/v5 interchange.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` was pinned for the clean-room behavior audit.
- Audited upstream surfaces include `socket-io-request.ts`, `socket-io-payload.ts`, `socket-io-response.ts`, the main-process Socket.IO transport, request/payload/listener editors, and the Socket.IO smoke fixture.
- Matched behavior includes custom Engine.IO paths, URL-path namespaces, query parameters, headers, cookies, Bearer connect auth, ordered JSON/text arguments, optional acknowledgements, enabled and live-toggled named listeners, ordered event evidence, runner sampling, and Insomnia v4/v5 interchange.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 51 files, 323 tests |
| Focused Socket.IO/storage/interchange suite | Pass — 5 files, 63 tests |
| Vite production build | Pass — 188 modules; Socket.IO bridge 2.13 kB; editor 4.67 kB; console 2.69 kB; gRPC helper 1.61 kB; project helper 3.29 kB; main JavaScript 497.66 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native Socket.IO loopback | Pass — connect, emit, acknowledgement, listener, and disconnect |
| Native test suite | Pass — 71 tests, including loopback fixtures outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Workspace v23 normalization bounds Socket.IO paths, event names, up to 100 ordered arguments, argument sizes/modes, acknowledgement state, and up to 500 listener names/descriptions/states while safely filling older workspaces.
- The native Engine.IO v4 implementation builds the WebSocket handshake and namespace from the request URL, answers Engine.IO and WebSocket heartbeats, joins/leaves the namespace, enforces a 1 MiB packet bound, and rejects malformed event names or unsupported binary attachment packets safely.
- Header/query templating, cookie-jar forwarding, and Bearer-token namespace authentication match the audited upstream request semantics without adding a paid or account branch.
- Emits preserve argument order and type, acknowledgement IDs are correlated with their originating event, enabled listeners filter incoming events, and live add/remove commands update the active session.
- The lazy editor and console expose path, event, arguments, acknowledgement, listeners, connect/disconnect, emit, and ordered incoming/outgoing/system evidence without pushing the main production chunk over its warning budget.
- Runner sampling uses the same transport and records its bounded event snapshot as an HTTP-shaped result for existing report and assertion pipelines.
- Insomnia v4/v5 import/export retains first-class Socket.IO identity, custom path, inline or separate payloads, argument modes/order, acknowledgement, cookies, and listener state.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. Upstream source inspection, semantic controls, event wiring, focused frontend/native fixtures, a real loopback Socket.IO exchange, warning-free production bundling, and desktop packaging provide the acceptance evidence.

## Acceptance boundary

This milestone is a Socket.IO baseline rather than universal socket.io-client compatibility. It connects directly through Engine.IO v4 WebSocket transport instead of negotiating polling/fallback transports. Binary attachment packets are reported but not decoded or composed. Custom proxy/client identity/TLS-validation overrides, richer persistent message collections/search/export, streaming plugin hooks, and live third-party server fixtures remain open.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
