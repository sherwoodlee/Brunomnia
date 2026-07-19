# Milestone 109 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: apply effective certificate validation and domain-scoped PEM client identity to native WebSocket/WSS handshakes, including GraphQL subscriptions, while retaining an explicit custom-proxy gap.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned WebSocket execution filters configured client certificates for the resolved WSS target and supplies PEM certificate/key material to the `ws` client.
- Pinned WebSocket execution passes the global `validateSSL` setting as `rejectUnauthorized`; GraphQL subscriptions use the same WebSocket path after their URL is converted to WSS.
- Pinned proxy routing is a separate agent choice and remains open here. Brunomnia does not claim proxy parity from TLS connector work.
- Brunomnia already resolves device/per-request API validation and exact/wildcard/comma/newline certificate domains before native invocation. This milestone reuses those effective values instead of creating a second policy model.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 53 files, 347 tests |
| Focused native WSS/mTLS loopback | Pass — 1 test |
| Vite production build | Pass — 191 modules; main JavaScript 499.99 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Native test suite | Pass — 78 tests with localhost bind access |
| macOS Tauri debug `.app` bundle | Pass — app-only packaging plus executable and `Info.plist` checks |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Native WebSocket connection setup uses the default Tokio-Tungstenite/native-root connector when validation is enabled and no client identity applies, preserving the established default path.
- A request whose effective validation is Never receives an isolated Rustls verifier that accepts the peer certificate for that connection only. No process-global TLS state changes.
- Client certificate and key must be supplied together. Certificate chains and PKCS#1, PKCS#8, or SEC1 keys parse from in-memory PEM and become one Rustls client identity.
- Identity selection reuses native HTTP's domain matcher: `*`, exact hosts, `*.suffix`, comma-separated values, and newline-separated values. Nonmatching identities are not parsed or sent.
- Plain `ws:` does not construct TLS identity state. WSS WebSocket and converted GraphQL subscription URLs share the same connector.
- Direct dependency declarations use Rustls, native roots, PKI types, and Tokio-Rustls versions already present transitively in the lockfile; no runtime download, hosted service, login, or commercial gate is introduced.
- Repository-owned P-256 test fixtures define a private CA, localhost server, and client identity. A real loopback first rejects that untrusted server under default validation, then rejects a client whose identity allowlist does not match, and finally completes HTTP 101 plus clean close when validation is disabled and the identity domain matches.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. No screenshot, DOM, console, or visual-interaction claim is made. Verification is limited to pinned source inspection, strict offline Rust gates, a real native WSS/mTLS loopback, full frontend/native suites, production/CLI builds, and desktop app packaging.

## Acceptance boundary

Brunomnia's packaged Tauri path now covers pinned WSS certificate-validation and PEM client-identity behavior for WebSocket and GraphQL subscription requests without an account or entitlement gate. Custom WebSocket proxy transport, redirect-chain evidence, upstream filesystem-backed event/timeline logs, streaming plugin hooks, and broad third-party fixtures remain open. The WebSocket and GraphQL rows therefore remain `Baseline`, and Brunomnia is not yet declared feature-complete.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
