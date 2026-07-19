# Milestone 100 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: replace unsupported Socket.IO binary attachment notices with upstream-compatible receive-side binary event and acknowledgement reconstruction over both Engine.IO transports.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Upstream Socket.IO payload authoring offers JSON and Text modes only. The main-process listener and acknowledgement callbacks receive `socket.io-client` decoded values, persist them through `JSON.stringify`, and the event view formats object arguments as JSON.
- In Node, decoded Buffer values serialize as `{ "type": "Buffer", "data": [...] }`; that is the compatibility target rather than adding a binary-send mode absent from the pinned editor.

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
| Focused Socket.IO suite | Pass — 5 tests |
| Native test suite | Pass — 73 tests, including loopback fixtures outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Type 5 binary events and type 6 binary acknowledgements validate one to 100 attachments, namespace framing, acknowledgement IDs, and JSON-array payload structure within the existing 1 MiB packet ceiling.
- Recursive hydration walks nested arrays and objects, validates every placeholder index, and substitutes the complete byte vector as Node Buffer-shaped JSON before any listener or acknowledgement record is emitted.
- WebSocket sessions retain a pending binary packet across its following raw binary frames. Polling sessions decode `b<base64>` Engine.IO packets into the same state machine, including multiple attachments and packets bundled by the record separator.
- Binary named events use the same enabled-listener and namespace checks as text events. Binary acknowledgements remove the same pending emit ID and appear as `<event> · ack` with hydrated arguments.
- A malformed count, payload, attachment index, base64 body, unexpected attachment, text packet before completion, extra attachment, or total attachment data beyond 1 MiB produces a visible system error and closes the invalid stream.
- Unit coverage proves nested two-attachment event hydration and binary acknowledgement hydration. Both real transport loopbacks deliver a binary acknowledgement, ordinary JSON event, binary listener event, then disconnect cleanly.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. The existing stream console already renders event text; pinned source inspection, strict compiler/lint gates, unit coverage, two binary-capable loopbacks, warning-free frontend bundling, and desktop packaging provide the acceptance evidence.

## Acceptance boundary

Pinned upstream does not expose a distinct binary-send argument mode, so no such authoring control is claimed. WebSocket upgrade remains disabled when custom proxy/client identity or disabled certificate-validation policy is active; polling remains fully functional. Persistent message collections/search/export, streaming plugin hooks, and live third-party fixtures remain open.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
