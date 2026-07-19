# Milestone 138 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: complete pinned Socket.IO connection-lifecycle parity with automatic post-connect Engine.IO recovery, offline listener and emit continuity, cancellable backoff/negotiation, and persistent history evidence without broadening the full-parity claim.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/main/network/socket-io.ts` constructs pinned `socket.io-client@^4.8.1` without overriding `reconnection`, `reconnectionAttempts`, `reconnectionDelay`, `reconnectionDelayMax`, or `randomizationFactor`, so the library's enabled, unlimited, one-second exponential, five-second maximum, 0.5-randomized defaults define the connection contract.
- The pinned `connect_error` handler calls `socket.close()`, making initial namespace/transport failure terminal. Explicit client or namespace disconnects are likewise terminal under Socket.IO semantics; ordinary transport close/error after a successful connection remains reconnectable.
- Socket.IO buffers packets emitted while disconnected and retains local event handlers across manager reconnection. Brunomnia preserves those user-visible semantics while keeping its bounded native packet/listener limits and without replaying a packet already handed to the failed transport.
- Reconnection uses the existing resolved client options rather than rerunning request plugins. Brunomnia similarly retains the initially rendered input and rebuilds native proxy, redirect, TLS, CA, identity, polling, upgrade, and namespace state from it on each attempt.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Socket.IO transport/reconnect regressions | Pass — 7 native tests |
| Full Vitest suite | Pass — 62 files, 437 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 506 renderer modules; 7.64 kB lazy StreamConsole chunk; 343.03 kB main renderer; 5,279,883-byte CLI bundle |
| Bundled CLI startup/help | Pass |
| Bundled localhost CLI template smoke | Pass — denial, File grant, Node OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 104 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- A successful connection owns one durable command channel, listener set, offline emit queue, and monotonically increasing acknowledgement sequence while individual polling or WebSocket transports are replaceable.
- Engine.IO close, WebSocket close/error/end, polling request failure/end, heartbeat-send failure, and event-send transport failure enter the reconnect path only after the initial namespace has connected.
- The first retry waits a randomized 500–1,500 ms. Subsequent delays double with the same randomization and never exceed five seconds; attempts continue until a connection succeeds or the client stops.
- Delay and handshake phases continue consuming commands. Listener switches apply immediately, emits queue in order, and explicit disconnect cancels either phase without waiting for the next attempt.
- Each attempt opens a fresh Engine.IO session, rejoins the URL-derived namespace with the same optional Bearer connect token, and re-attempts an advertised WebSocket upgrade while retaining polling fallback and all effective transport policy.
- A real polling fixture closes `engine-1`, observes reconnecting evidence, accepts `engine-2`, confirms the namespace, receives an event queued while offline, and emits old/new listener events after an offline listener swap. Only the newly enabled event reaches the client.
- Initial failure, server namespace disconnect, malformed or oversized packet/binary data, explicit client disconnect, and command-channel closure remain terminal. Pending acknowledgements from a failed transport are discarded rather than attached to a replacement session.
- Reconnect attempts, errors, successful opens, repeated upgrades, and the final closed state append to the original saved stream session; the account-free history, filters, inspection, copy/export, delete, and clear surface remains unchanged.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. This milestone changes native lifecycle behavior and documentation; it makes no screenshot, DOM, console, keyboard-interaction, or visual-layout claim beyond strict compilation, loopback protocol evidence, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 138 accepts Socket.IO parity for the pinned source-backed connection, polling/upgrade, namespace, authentication, proxy/TLS, message, acknowledgement, listener, binary, reconnection, history, and inspection workflows. The native reconnect queue exists only for the live process and deliberately does not replay events already handed to a failed transport. The Socket.IO row is `Complete`; 20 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 139.
