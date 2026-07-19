# Milestone 115 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add Insomnia-style workspace CA and multiple host/port-scoped PEM client certificates across native request, authentication, realtime, integration, and gRPC transports.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Insomnia stores one workspace CA record and multiple client-certificate records as non-synced workspace children, with enable/disable controls and host selection.
- Pinned matching first checks host plus assumed/default port, then retries without port only when no record matched; gRPC credentials accept CA PEM independently or together with client PEM identity.
- Brunomnia previously exposed one request-local PEM identity and validation toggle but had no workspace CA, identity list, or cross-transport certificate manager.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 56 files, 359 tests |
| Focused private-CA native loopbacks | Pass — HTTPS, WSS, and gRPC |
| Native test suite | Pass — 88 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 197 modules; main JavaScript 498.43 kB with no warning |
| Bundled CLI build/startup | Pass — 523.4 kB CommonJS executable |
| macOS Tauri debug `.app` bundle | Pass — executable and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Workspace v30 normalizes one 5 MiB CA and up to 100 client records with 512-character hosts and 1 MiB certificate/key fields.
- The certificate manager supports PEM file import and paste, enable/disable, deletion, explicit request-local precedence, and upstream-style port-first/host-fallback wildcard selection.
- Workspace records remain in the local project catalog, are omitted from split-YAML/Git and encrypted-sync payloads, and survive project reload and sync pull from current-device state.
- Shared HTTP contexts cover ordinary requests, OAuth, GraphQL introspection, scripts/plugins, runners, URL import, AI/MCP/Konnect integrations, and project commit suggestions; stream and gRPC serializers receive the same selected material.
- Reqwest, Rustls WebSocket/Socket.IO, HTTPS proxy, and Tonic roots retain native trust while adding the enabled CA. Invalid or oversized material fails explicitly at renderer and native boundaries.
- Repository-owned private CA/server fixtures drive real HTTPS, WSS, and gRPC trust loopbacks; strict default rejection and prior request-local Never/mTLS behavior remain covered.
- No account, organization, telemetry, hosted runtime, subscription, or entitlement check is introduced.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

PFX/PKCS#12 identities, certificate-path compatibility exports, richer gRPC metadata/schema workflows, and broad third-party certificate fixtures remain open. Milestone 117 later confirmed the pinned upstream gRPC channel does not install the application HTTP/HTTPS proxy agent, so custom gRPC proxy transport is not a parity requirement. Related parity rows remain `Baseline`, and Brunomnia is not declared feature-complete.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
