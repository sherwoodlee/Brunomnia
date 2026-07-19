# Milestone 122 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: support both stable and legacy gRPC server-reflection protocols, including the exact v1alpha RPC used by Insomnia's pinned dependency, without weakening error or transport policy.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Its `package-lock.json` resolves `grpc-reflection-js` to Kong commit `f806b5a0dc2092b7a6fb54dfb66c38fb58231774`.
- The pinned dependency tree contains only `static/grpc/reflection/v1alpha/reflection.proto` for reflection, and generated `reflection_grpc_pb.js` declares `/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo`.
- Its client opens that generated bidirectional RPC for service listing, file-containing-symbol lookup, and recursive dependency retrieval.
- Stable `grpc.reflection.v1` is the current protocol, so Brunomnia negotiates v1 first and uses v1alpha only when v1 is explicitly unimplemented; this is a compatible superset of the pinned behavior.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 56 files, 374 tests |
| Focused stable/legacy reflection fixture | Pass — real v1 and v1alpha-only servers |
| Native test suite | Pass — 97 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 197 modules; 308.40 kB main, 192.35 kB React vendor, 10.74 kB gRPC editor, and 7.66 kB gRPC bridge JavaScript with no warning |
| Bundled CLI build/startup | Pass — 531.0 kB CommonJS executable |
| macOS Tauri debug `.app` bundle | Pass — app-only bundle, arm64 executable, and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Reflection connects once with the existing endpoint parser, timeout, TLS validation, workspace CA, domain-scoped PEM/PFX identity, and templated metadata.
- The client sends stable v1 `ListServices` first. A non-unimplemented v1 transport or protocol failure is returned immediately, preventing fallback from obscuring authentication, validation, metadata, or server errors.
- Transport `Code::Unimplemented` and reflection error response code 12 select v1alpha on the same channel. If v1alpha also fails, its exact status or protocol error reaches the shared connection-guidance surface.
- Both implementations remove reflection services from the selectable list, request each application service's containing file, suppress duplicate descriptor protos, and reject empty results.
- Shared decoding enforces the existing reflected descriptor validity and 10 MiB encoded schema boundary before producing service/method metadata and request examples.
- The native fixture starts one stable-v1 reflection server and one v1alpha-only server from the same repository-owned proto descriptor. Each advertises `brunomnia.test.Greeter`, returns its descriptors, and produces a nonempty reusable descriptor set.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes stable and pinned-legacy gRPC reflection protocol compatibility. A live external third-party server matrix remains open. The gRPC and other parity rows remain `Baseline`; Brunomnia is not declared feature-complete.
