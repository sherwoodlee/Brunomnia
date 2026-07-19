# Milestone 132 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: close the gRPC parity row by matching pinned endpoint parsing, adding Unix-domain channels, correcting default trusted TLS, and exercising the official public plaintext/TLS examples across all four RPC shapes.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `network/grpc/parse-grpc-url.ts` prepends `grpc://` when no scheme is present, recognizes `grpc://` and `grpcs://`, and preserves `unix:` targets. Its table tests use `grpcb.in:9000` as the canonical scheme-less plaintext input.
- Current Kong gRPC documentation uses `grpcb.in:9000` for plaintext, `grpcs://grpcb.in:9001` for trusted TLS, ordinary server reflection, and the `hello.HelloService` unary, server-streaming, client-streaming, and bidirectional methods.
- Pinned channel construction uses direct `@grpc/grpc-js` credentials and does not attach Insomnia's HTTP/HTTPS proxy agent. Current documentation also states that gRPC requests do not have persisted request/response history, so neither behavior remains a parity requirement.

## Implementation evidence

- Scheme-less `host:port` inputs normalize to plaintext HTTP/2 while explicit `grpc:`, `grpcs:`, `http:`, and `https:` inputs retain their expected security mode.
- Unix desktop builds accept absolute `unix:` socket paths and adapt `tokio::net::UnixStream` through Hyper's standard Tokio I/O wrapper into Tonic.
- Every secure channel now installs Tonic's enabled native roots, even when no custom CA, validation override, or client identity is configured. Existing custom CA, PEM/PFX identity, and Never-verifier behavior remain layered on the same path.
- Connection errors retain Tonic's nested transport diagnostic instead of collapsing failures to an opaque `transport error` string.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused local gRPC suite | Pass — 11 tests; public matrix intentionally ignored |
| Official `grpcb.in` compatibility matrix | Pass — reflection and unary over plaintext/TLS plus all four RPC shapes |
| Full Vitest suite | Pass — 60 files, 406 tests |
| Full native suite | Pass — 98 tests, 1 opt-in public test ignored |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production and bundled CLI build | Pass — 285 modules transformed and CLI bundled |
| Bundled CLI startup | Pass |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

The public matrix is `#[ignore]` so ordinary offline tests remain deterministic. It was run explicitly with:

```sh
cargo test --offline grpc_client::tests::validates_official_grpcb_plaintext_tls_and_all_call_shapes -- --ignored --exact --nocapture
```

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone completes the gRPC ledger row. The public service is mutable external infrastructure, so repository-owned reflection, all-call-shape, status/metadata, TLS, CA, mTLS, validation, and Unix-socket fixtures remain the deterministic regression foundation. Other `Baseline` and `Early baseline` rows remain; Brunomnia is not declared feature-complete.
