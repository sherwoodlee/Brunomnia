# Milestone 112 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: apply effective API certificate validation and domain-scoped PEM client identity to secure native gRPC schema reflection and all four call shapes.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned gRPC channel creation uses insecure credentials for plain gRPC and passes the global `validateSSL` value as `rejectUnauthorized` for secure gRPC.
- Pinned secure channels attach PEM client certificate/key material selected for the request URL; custom CA and PFX variants remain separate capabilities.
- Brunomnia's frontend already resolves device/per-request API validation and passes domain-scoped PEM material into native reflection and calls. Before this milestone, native Tonic always used its default verifier and attached any configured identity without checking the endpoint domain.
- Tonic 0.14.6 exposes `Endpoint::tls_config_with_verifier`, preserving SNI, identity, timeout, and HTTP/2 behavior while replacing only server-certificate verification.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 53 files, 347 tests |
| Focused native gRPC TLS loopback | Pass — 1 test |
| Native test suite | Pass — 84 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 191 modules; main JavaScript 499.99 kB with no warning |
| Bundled CLI build/startup | Pass |
| macOS Tauri debug `.app` bundle | Pass — app-only packaging plus executable and `Info.plist` checks |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Secure endpoints validate that client certificate and private key are supplied together. Plain HTTP/2 endpoints ignore TLS identity material, matching the upstream insecure-channel boundary.
- Identity selection reuses native HTTP's request-host matcher, including `*`, exact names/IPs, `*.suffix`, comma/newline lists, and bracket-normalized IPv6 literals. A nonmatching identity is neither parsed nor attached.
- Validation-on identity channels explicitly enable Tonic's configured native roots. Validation-on channels without a selected identity keep Tonic's default connector path.
- Effective Never creates one Tonic TLS connector with the same audited Rustls verifier used by WSS. Certificate and TLS signature checks are accepted for that channel only; no process-global verifier or environment variable changes.
- The effective request timeout remains the channel connect/RPC deadline and is also supplied to the custom TLS handshake. Existing bounded or unlimited response-stream collection remains unchanged.
- Repository-owned P-256 fixtures drive one sequential loopback: default validation rejects the private server, Never plus a mismatched domain omits the client identity and is rejected by mTLS, and Never plus a matching domain completes mTLS with HTTP/2 ALPN.
- Reflection and ordinary calls share `connect_channel`, so the same policy reaches schema discovery, unary, client-streaming, server-streaming, and bidirectional execution.
- No account, organization, telemetry, hosted runtime, subscription, or entitlement check is introduced.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. No screenshot, DOM, console, or visual-interaction claim is made. Verification is limited to pinned source inspection, strict offline Rust gates, a real native gRPC TLS/mTLS loopback, full frontend/native suites, production/CLI builds, and desktop app packaging.

## Acceptance boundary

Brunomnia's packaged Tauri path now applies effective validation and domain-scoped PEM identity to secure gRPC reflection and calls. Importable proto trees, custom CA/PFX identity, richer reflection/schema workflows, interactive streaming lifecycle controls, and broad third-party fixtures remain open. Milestone 117 later confirmed the pinned upstream gRPC channel does not install the application HTTP/HTTPS proxy agent, so custom gRPC proxy transport is not a parity requirement. The gRPC parity row therefore remains `Baseline`, and Brunomnia is not yet declared feature-complete.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
