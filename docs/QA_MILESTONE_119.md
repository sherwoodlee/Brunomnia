# Milestone 119 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: generate bounded protobuf request examples from loaded descriptors and expose current-Insomnia-compatible explicit request-body replacement without an account or entitlement gate.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `main/ipc/automock.ts` walks each reflected method's request type and generates strings, UUID-shaped ID fields, numeric values, booleans, bytes, first enum values, nested objects, repeated samples, and maps with a per-key depth guard.
- `main/ipc/grpc.ts` attaches the generated plain object to reflected `GrpcMethodInfo.example`.
- `ui/components/panes/grpc-request-pane.tsx` enables an explicit request-stub button when an example exists and replaces the current body only after the click.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 56 files, 363 tests |
| Focused descriptor-example fixture | Pass — scalar, UUID, repeated, map, enum, bytes, nested, oneof, and recursion cases |
| Native test suite | Pass — 95 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 197 modules; 307.55 kB main, 192.35 kB React vendor, 9.32 kB gRPC editor, and 5.31 kB gRPC bridge JavaScript with no warning |
| Bundled CLI build/startup/policy refusal | Pass — 530.3 kB CommonJS executable; custom TLS material remains explicitly refused |
| macOS Tauri debug `.app` bundle | Pass — arm64 executable and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Every native schema load now returns an `example` object for each method, whether descriptors came from server reflection or an imported proto tree.
- The generator uses protobuf JSON field names, `Hello` strings, UUID v4 values for field names beginning or ending in `id`, upstream-compatible sample numbers, booleans, valid base64 bytes, and the first enum number.
- Nested messages recurse, repeated fields receive one item, maps receive one valid key/value pair, and one field is selected from each real oneof so the generated JSON remains valid for dynamic message parsing.
- Generation stops at 500 fields and three recursive levels; cycles become empty objects and cannot exhaust the stack or create an unbounded IPC payload.
- The request editor exposes **Use stub** beside the selected method and pretty-prints the example into the current message only after an explicit click. Client and bidirectional methods receive one message object suitable for the interactive send lifecycle.
- Browser development retains a shape-compatible empty example because its regex preview has no full descriptors; real field generation runs in Tauri.
- The native fixture asserts camel-cased `userId`, a parseable UUID, representative scalar values, repeated strings, base64 bytes, first enum value, nested object, map sample, first oneof branch, omission of the second branch, and recursive truncation.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes descriptor-generated gRPC request stubs. Buf Schema Registry reflection, disable-user-agent behavior, richer connection-error guidance, and broad third-party fixtures remain open. The gRPC and other parity rows remain `Baseline`; Brunomnia is not declared feature-complete.
