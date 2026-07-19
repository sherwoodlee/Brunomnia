# Milestone 117 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add current-Insomnia-compatible interactive gRPC start/send/commit/cancel lifecycle behavior, preserve native transport policy, and remove a source-unsupported custom-proxy item from the parity backlog without adding an account or entitlement gate.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/main/ipc/grpc.ts` stores active calls in `grpcCalls`, registers `grpc.start`, `grpc.sendMessage`, `grpc.commit`, `grpc.cancel`, and `grpc.closeAll`, and forwards status, data, error, and end events.
- Unary and server-streaming calls send the initial body at start. Client-streaming and bidirectional calls stay writable until `commit` calls `end`; `cancel` cancels any active call.
- The pinned channel path constructs `@grpc/grpc-js` clients with secure or insecure channel credentials and does not install the application's HTTP/HTTPS proxy agent. Custom gRPC proxy transport is therefore not a parity requirement and was removed from current gap statements.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 56 files, 363 tests |
| Focused real gRPC lifecycle loopback | Pass — client stream, bidirectional stream, half-close, and cancel over HTTP/2 |
| Native test suite | Pass — 94 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 197 modules; 307.55 kB main, 192.35 kB React vendor, 8.49 kB gRPC editor, and 5.06 kB gRPC bridge JavaScript with no warning |
| Bundled CLI build/startup/policy refusal | Pass — 530.3 kB CommonJS executable; custom TLS material remains explicitly refused |
| macOS Tauri debug `.app` bundle | Pass — arm64 executable and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Native state permits at most 100 active sessions, rejects duplicate IDs, bounds each command queue to 256 entries, schema-validates each JSON message after a 1 MiB limit, and uses generation tokens so an ending call cannot remove a newer call that reused its ID.
- Tauri exposes start, send-message, commit, cancel, and close-all commands. Client and bidirectional streams accept independent messages; commit half-closes only the request side; cancel remains available after commit while responses are pending.
- Unary and server-streaming sessions send their initial object automatically. Every shape emits ordered start/outgoing/incoming/status/error/cancel/end records through a retained Tauri IPC channel.
- Session setup reuses authored URL normalization, timeout behavior, templated metadata, certificate validation, workspace CA trust, and host/port-scoped PEM or PFX/PKCS#12 identity resolution from reflection and one-shot calls.
- The gRPC body editor provides account-free Start, Send message, Commit, Cancel, and Clear controls, call state/type, visible errors, and a newest-500 event console. Browser development retains deterministic lifecycle simulation.
- Focused renderer tests assert environment and metadata substitution, workspace TLS payloads, IPC channel event normalization, and independent send/commit/cancel invocations.
- A real in-process Tonic HTTP/2 server aggregates two client-stream messages, echoes two bidirectional messages before half-close, and observes explicit cancellation.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes the interactive gRPC lifecycle gap and corrects the proxy audit. Milestone 118's response-state audit additionally confirms pinned Insomnia keeps gRPC messages transient, so persisted call history is not a parity requirement. Structured status fidelity, Buf Schema Registry reflection, reflected request examples, disable-user-agent behavior, richer connection-error guidance, and broad third-party fixtures remain open at this checkpoint. The gRPC and other parity rows remain `Baseline`; Brunomnia is not declared feature-complete.
