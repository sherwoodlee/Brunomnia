# Milestone 83 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: reproduce Insomnia's response-pane mock server/route selection, create, overwrite, and navigation workflow locally while removing project-type and commercial-plan gates.

## Source audit

The audit pinned Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` and inspected `mock-response-extractor.tsx`, `mock-route-modal.tsx`, the new-route action, and the method/path conflict utility. The upstream extractor explicitly blocks some local-project users unless they use a cloud project or enterprise self-hosted mock server. Brunomnia retains the user-visible workflow but introduces no equivalent entitlement branch.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 274 tests |
| Focused response-to-mock suite | Pass — 10 tests |
| Vite production build | Pass — 174 modules; lazy extractor/conversion chunks; main JavaScript below 500 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 54 tests with the loopback fixture outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- New-server creation is account-free, binds only `127.0.0.1`, selects the first available port from 4010, and creates the first response-backed route.
- Existing-server creation accepts an editable HTTP method and path and rejects a duplicate method/path that would be shadowed by route order.
- Existing-route overwrite preserves authored routing/scenario fields while replacing only response fields.
- Missing server/route selections are rejected instead of mutating a different target.
- Binary and oversized response refusal remains shared with the existing direct conversion path.
- Live responses remain available when response-history retention is zero; selected historical responses retain their own request snapshot.
- **Go to mock** carries exact server and route IDs into the lazy mock workbench.
- A running target receives one direct native route-set update after response-pane create or overwrite.
- The feature and conversion engine are lazy chunks rather than additions to the startup bundle.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibits the in-app Browser. Selector state, labels, responsive CSS, focus routing, and live-update invocation are type-, unit-, bundle-, and native-command verified only in this phase.

## Acceptance boundary

The response tab supports HTTP and GraphQL text responses. Streaming, gRPC, binary, and oversized responses cannot be transformed. Creation uses an inline path/method editor rather than a second modal, and deployment remains the existing device-local loopback server.
