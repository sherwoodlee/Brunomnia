# Milestone 118 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: preserve current-Insomnia-compatible structured gRPC status state across native IPC and the interactive response surface, while correcting persisted call history as a source-unsupported parity gap.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.tsx` keeps one transient `GrpcRequestState` per request with `running`, request messages, response messages, optional `StatusObject`, optional `ServiceError`, and loaded methods.
- `ui/components/panes/grpc-response-pane.tsx` renders the numeric status code and details from that transient state, falls back to the error message when no status exists, and displays response messages as tabs.
- `main/ipc/grpc.ts` forwards each call's status object, including code, details, and metadata. The pinned renderer does not persist gRPC call messages as response history, so persisted gRPC history is not a parity requirement.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 56 files, 363 tests |
| Focused real gRPC status loopback | Pass — success metadata, `CANCELLED`, and `INVALID_ARGUMENT` details/error metadata |
| Native test suite | Pass — 94 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 197 modules; 307.55 kB main, 192.35 kB React vendor, 9.13 kB gRPC editor, and 5.29 kB gRPC bridge JavaScript with no warning |
| Bundled CLI build/startup/policy refusal | Pass — 530.3 kB CommonJS executable; custom TLS material remains explicitly refused |
| macOS Tauri debug `.app` bundle | Pass — arm64 executable and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- The shared native event shape adds optional `statusCode`, `statusName`, `statusDetails`, and repeated `metadata`; existing realtime event constructors omit those fields and retain their previous wire shape.
- Successful unary, client-streaming, server-streaming, and bidirectional sessions collect initial response metadata. Response streams also collect final trailers after normal completion.
- Non-OK Tonic statuses emit the structured status event before the existing error and end records, preserving status metadata even when no response message exists. Explicit cancellation emits cancel, `1 CANCELLED`, then end without fabricating an error.
- At most 500 combined initial/trailing metadata values cross IPC, each encoded value is limited to 64 KiB, ASCII values remain text, and binary values retain Tonic's base64 wire representation.
- The gRPC editor shows success/error color, numeric code, canonical name, details, and expandable repeated metadata while retaining the ordered status event in the call console.
- Browser development emits the same structured `0 OK` shape, and renderer tests prove native structured fields survive event ID normalization.
- The real HTTP/2 fixture returns `x-received-count: 2` with a successful client-stream response, verifies explicit code `1 CANCELLED`, and rejects a unary call with code `3`, `name is required`, and `x-error-id: reject-1`; native assertions verify all fields.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes structured gRPC status fidelity and corrects the transient-history audit. Milestone 119 later closes reflected request examples. Buf Schema Registry reflection, disable-user-agent behavior, richer connection-error guidance, and broad third-party fixtures remain open. The gRPC and other parity rows remain `Baseline`; Brunomnia is not declared feature-complete.
