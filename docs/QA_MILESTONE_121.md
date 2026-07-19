# Milestone 121 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: provide pinned-Insomnia-compatible actionable guidance for recognized gRPC connection, TLS, reflection, cancellation, and method failures while preserving native details and unknown errors.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/ui/utils/grpc.ts` recognizes seven string families: self-signed server chains, `CERTIFICATE_REQUIRED`, `CANCELLED`, `WRONG_VERSION_NUMBER`, invalid local issuer certificates, reflection status 12, and `UNIMPLEMENTED`.
- The pinned helper maps those families to **Server Certificate Cannot Be Validated**, **Client Certificate Required**, **Server Cancelled Request**, **TLS Not Supported**, **Local Root Certificate Error**, **Reflection Not Supported**, and **Unimplemented Method** guidance.
- `grpc-request-pane.tsx` applies the helper when reflection loading fails; the workspace debug route applies it to asynchronous `grpc.error` events. Unknown errors retain their original error presentation.
- Brunomnia's native stack is Tonic/Rustls rather than grpc-js/OpenSSL, so equivalent spellings such as `UnknownIssuer`, `CertificateRequired`, and title-case Tonic status names are included without broad substring matching.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 56 files, 374 tests |
| Focused gRPC bridge and guidance fixture | Pass — 12 tests |
| Native test suite | Pass — 96 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 197 modules; 308.40 kB main, 192.35 kB React vendor, 10.74 kB gRPC editor, and 7.66 kB gRPC bridge JavaScript with no warning |
| Bundled CLI build/startup | Pass — 531.0 kB CommonJS executable |
| macOS Tauri debug `.app` bundle | Pass — app-only bundle, arm64 executable, and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Invalid or empty configured CA PEM is identified before generic certificate failures and explains how to disable or replace the local root.
- OpenSSL-style self-signed/unknown-issuer text and Rustls `UnknownIssuer`/invalid-peer-certificate text share server-certificate guidance that points to workspace root trust or the API validation preference.
- grpc-js `CERTIFICATE_REQUIRED`, Rustls `CertificateRequired`, and missing-peer-certificate variants explain that the server requires a client identity.
- `WRONG_VERSION_NUMBER` explains that a `grpcs://` request reached a plaintext service and suggests the insecure scheme only for that explicit case.
- Reflection-context status 12/`Unimplemented` maps to reflection enablement or proto-source guidance before the generic unimplemented-method classifier. Call-context `Unimplemented` remains method-specific.
- Both `CANCELLED` and `CANCELED` spellings map to server-cancellation guidance and retain the pinned TLS-scheme suggestion.
- Schema loads expose the focused title in response status and explanation plus underlying error in the body. Live start/send/commit/cancel catches and native error events use the same multiline formatter.
- Unknown failures return no guidance object and format byte-for-byte as their original message, preventing misleading diagnosis.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes pinned gRPC connection-error guidance. Broader third-party gRPC fixtures remain open. The gRPC and other parity rows remain `Baseline`; Brunomnia is not declared feature-complete.
