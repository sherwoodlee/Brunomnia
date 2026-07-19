# Milestone 108 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add pinned Insomnia-compatible GraphQL subscription routing and `graphql-transport-ws` lifecycle behavior to the Tauri transport, reuse the realtime response/history surface, and remove unsupported persisted-query language from the parity ledger.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `isGraphqlSubscriptionRequest` parses the GraphQL body, honors `operationName`, and treats only the selected `subscription` operation as realtime.
- Pinned connect routing changes HTTP(S) to WS(S), requests `graphql-transport-ws`, and sends `{"type":"connection_init"}` after the WebSocket opens.
- Pinned WebSocket handling sends a UUID-backed `subscribe` message with the rendered GraphQL request body after `connection_ack`, then closes on protocol `error` or `complete`.
- No pinned persisted-query execution path was found. The unsupported persisted-query gap was therefore removed rather than retained as an unsubstantiated parity requirement.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 53 files, 347 tests |
| Focused GraphQL/protocol/history/storage suite | Pass — 4 files, 51 tests |
| Focused native GraphQL subscription loopback | Pass — 1 test |
| Vite production build | Pass — 191 modules; main JavaScript 499.99 kB with no warning |
| Startup bundle change | Pass — main JavaScript increased from 497.77 kB to 499.99 kB while remaining below Vite's 500 kB warning threshold |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 77 tests with localhost bind access |
| macOS Tauri debug `.app` bundle | Pass — app-only packaging plus executable and `Info.plist` checks |
| Changed-path whitespace checks | Pass |

## Focused coverage

- A bounded executable-document scanner selects one operation like GraphQL `getOperationAST`: a named operation wins when configured, a sole operation is selected automatically, and ambiguous or missing names do not stream.
- Focused tests cover comments, quoted subscription-like text, fragments, directives, variable definitions, object defaults, multiple operations, anonymous queries, and operation-name switching.
- GraphQL queries and mutations remain ordinary HTTP requests. Only a selected subscription changes the primary action and response panel to Connect/Disconnect plus realtime evidence.
- The frontend converts `http:`/`https:` endpoints to `ws:`/`wss:`, preserves WS(S), rejects ambient schemes, replaces authored subprotocol rows with `graphql-transport-ws`, and reuses the exact parsed GraphQL HTTP payload shape.
- Existing enabled headers, cookies, Basic/Bearer/API-key authentication, query API keys, and already acquired OAuth 2 tokens remain available to the handshake.
- The native transport forces the required subprotocol, sends exact `connection_init`, creates a fresh UUID subscribe envelope on each acknowledgement, classifies incoming protocol message types, and closes after `error` or `complete`.
- A real loopback WebSocket server asserts the request path/subprotocol, exact init frame, UUID subscribe ID, query/variables/operation-name payload, next and complete events, client close, and native session cleanup.
- GraphQL subscriptions reuse realtime metadata, event filtering/search, retention, environment scoping, historical request restoration, delete/clear, Headers, and Timeline. Workspace v28 persists GraphQL stream-session identity.
- Collection-run routing now samples selected GraphQL subscriptions through the same native lifecycle instead of silently sending them as HTTP.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. No screenshot, DOM, console, or visual-interaction claim is made. Verification is limited to pinned source inspection, focused operation/protocol/history/storage tests, a real native loopback, strict TypeScript/Rust gates, full frontend/native suites, production/CLI builds, and desktop app packaging.

## Acceptance boundary

Brunomnia's packaged Tauri path now covers the pinned GraphQL subscription lifecycle recorded above without an account, organization, plan, or entitlement gate. Full GraphQL language-service validation/autocomplete, richer schema workflows, streaming plugin hooks, advanced signing, WebSocket proxy/client-identity parity, upstream filesystem-backed logs, and broad third-party fixtures remain open. The GraphQL parity row therefore remains `Baseline`, and Brunomnia is not yet declared feature-complete.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
