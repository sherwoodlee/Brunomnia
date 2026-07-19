# Milestone 116 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add password-protected PFX/PKCS#12 client identities to workspace and request-local certificate controls, scripts, and every native TLS transport without an account or entitlement gate.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Insomnia stores `pfx` plus `passphrase` as the mutually exclusive alternative to `cert` plus `key`, retains host filtering, and forwards selected records through HTTP, WebSocket, Socket.IO, authentication, scripts, and gRPC.
- Brunomnia Milestone 115 already had one local workspace CA, multiple host/port-scoped PEM identities, request-local precedence, and shared transport propagation; binary PKCS#12 parsing and script PFX files remained open.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 56 files, 361 tests |
| Focused PKCS#12 native loopbacks | Pass — HTTPS, WSS, and gRPC mTLS |
| Native test suite | Pass — 93 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 197 modules; 307.48 kB main and 192.35 kB React vendor JavaScript with no warning |
| Bundled CLI build/startup/policy refusal | Pass — 530.3 kB CommonJS executable |
| macOS Tauri debug `.app` bundle | Pass — executable and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Workspace v31 normalizes mutually exclusive PEM or base64 PFX identities, 5 MiB decoded bundle and 4 KiB passphrase bounds, masked editor input, request-local precedence, and existing port-first/host-fallback wildcard selection.
- One pure-Rust resolver validates IPC material, decodes modern PBES2/PBKDF2/AES-256 and legacy PKCS#12 encryption, selects the first private-key certificate chain, and supplies in-memory PEM to Reqwest, Rustls, and Tonic.
- Shared transport contexts continue through ordinary HTTP/GraphQL, OAuth, GraphQL introspection, WebSocket/subscriptions, Socket.IO, SSE, runners, scripts/plugins, AI/MCP/Konnect integrations, project traffic, and secure gRPC reflection/calls.
- Primary and secondary scripts accept `pfx.src`/`pfxPath` plus passphrase only with the existing file grant, path allowlist, 5 MB per-file, 20-file, and 20 MB aggregate limits; the Worker receives no file bytes.
- Workspace PFX data/passphrases remain local across split-YAML/Git and encrypted-sync operations, explicit Brunomnia JSON export preserves them, and request-local PFX secrets join plaintext-publication checks.
- Native tests parse generated modern/legacy bundles and a real OpenSSL-produced modern fixture, reject conflicting/oversized/wrong-passphrase material, preserve domain scoping, and complete real HTTPS, WSS, and gRPC mTLS handshakes.
- The portable CLI resolves workspace selection and explicitly rejects custom CA or PEM/PFX identities because Node Fetch lacks per-request TLS authority; it no longer risks silently dropping the policy.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes password-protected PFX/PKCS#12 identity import and native desktop execution. Certificate-path compatibility import/export, encrypted PEM-key passphrases, portable CLI client-certificate transport, richer gRPC metadata/schema workflows, and broad third-party fixtures remain open. Milestone 117 later confirmed the pinned upstream gRPC channel does not install the application HTTP/HTTPS proxy agent, so custom gRPC proxy transport is not a parity requirement. Related parity rows remain `Baseline`; Brunomnia is not declared feature-complete.
