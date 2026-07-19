# Milestone 120 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: implement current-Insomnia-compatible Buf Schema Registry reflection, including its binary Connect contract, request configuration, User-Agent policy, persistence, interchange semantics, and account-free editor access.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia-data/src/models/grpc-request.ts` defines `reflectionApi` as enabled, URL, API key, and module fields with `https://buf.build` and `buf.build/connectrpc/eliza` defaults, plus optional `disableUserAgentHeader`.
- `packages/insomnia/src/main/ipc/grpc.ts` proves that enabled `reflectionApi` means the Buf Registry API—not ordinary gRPC server reflection—and issues a unary binary Connect request to `buf.reflect.v1beta1.FileDescriptorSetService/GetFileDescriptorSet` over HTTP/1.1.
- The pinned request contains module field 1, empty version field 2, and repeated symbols field 3; the response contains optional `FileDescriptorSet` field 1 and version field 2. It adds optional Bearer authentication, emits `insomnia/<version>` unless disabled, and specializes unauthenticated/not-found errors.
- `packages/insomnia/src/ui/components/modals/request-settings-modal.tsx` exposes the registry enable switch, URL, masked API key, and module without making them commercial entitlements.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 56 files, 366 tests |
| Focused renderer/storage/interchange/security regressions | Pass — 5 files, 73 tests |
| Native test suite | Pass — 96 tests with localhost bind access |
| Focused Buf Connect loopback fixture | Pass — binary request/response, headers, auth, User-Agent policy, descriptor decode, 401, and 404 |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 197 modules; 308.15 kB main, 192.35 kB React vendor, 10.81 kB gRPC editor, and 5.53 kB gRPC bridge JavaScript with no warning |
| Bundled CLI build/startup | Pass — 531.0 kB CommonJS executable |
| macOS Tauri debug `.app` bundle | Pass — app-only bundle, arm64 executable, and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- The native schema command recognizes explicit `reflection`, `proto`, and `buf` sources and rejects unknown source strings instead of silently treating them as reflection.
- Buf mode appends the exact Connect service/method path to a validated HTTP(S) base URL, preserves an existing base path, removes query/fragment components, posts `application/proto`, accepts `application/proto`, and sends `Connect-Protocol-Version: 1`.
- The request serializes the resolved module with empty version and symbol filters. An optional API key becomes `Authorization: Bearer …`; User-Agent is exactly `brunomnia/<version>` unless suppression is enabled.
- Registry responses are streamed through a 10 MiB post-decompression ceiling before protobuf decoding. Missing descriptor sets remain a valid empty schema, malformed descriptor responses fail explicitly, and 401/404 statuses use pinned-upstream-compatible messages.
- Registry transport reuses native timeout, validation, CA, proxy, redirect, request-local identity, and workspace identity logic while forcing HTTP/1.1. Renderer certificate selection is performed against the resolved registry URL rather than the separate gRPC service endpoint.
- The editor adds a third **Buf registry** mode with URL, module, masked API key, and disable-user-agent controls. Every setting supports persisted edits, schema-affecting changes invalidate stale descriptors, and no control checks an account or entitlement.
- Workspace v32 bounds URL to 8,192 characters, API key to 65,536, and module to 2,048; publication scanning blocks plaintext keys while accepting complete vault/external references.
- Insomnia v4/v5 imports now interpret `reflectionApi.enabled` as Buf mode and preserve URL/key/module/User-Agent policy. Exports emit the same semantics instead of incorrectly using the ordinary-reflection source.
- The loopback fixture captures the real binary wire request and proves descriptor decoding, Bearer auth, required Connect/content headers, product-header inclusion/suppression, and specialized authorization/module failures.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes Buf Schema Registry reflection and disable-user-agent behavior. Richer gRPC connection-error guidance and broader third-party fixtures remain open. The gRPC and other parity rows remain `Baseline`; Brunomnia is not declared feature-complete.
