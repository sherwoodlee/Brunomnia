# Milestone 75 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: overwrite the selected local mock route's response fields from the active request's latest saved text response while preserving authored routing and scenario controls.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [mock response extractor](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/editors/mock-response-extractor.tsx) patches an existing route with active-response body, status, MIME type, and headers while retaining the existing route identity. Phase 74 added Brunomnia's new-route path; this phase closes the selected-route overwrite slice.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 267 tests |
| Vite production build | Pass — 173 modules; 498,565-byte main JavaScript chunk; 45,039-byte lazy automation-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 40 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 41-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- The selected route receives the latest response's bounded status, decoded text body, and response headers.
- Route ID, name, method, path, enabled state, and delay are preserved exactly.
- Replacement header IDs are stable under the route ID and old response headers are fully replaced rather than accidentally merged.
- Decoded-body `Content-Length`, `Content-Encoding`, `Connection`, and `Transfer-Encoding` headers remain omitted.
- Binary and oversized responses receive the same focused refusal as new-route creation.
- Latest-response selection remains confined to the active request and active environment when response-history filtering is enabled.
- The action is disabled until a response is available and its title states the exact fields it replaces.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Selected-route targeting, button availability, preserved editor controls, and running-server restart behavior are compile-, unit-, style-, and bundle-verified only in this phase.

## Acceptance boundary

Overwrite is explicit and affects the selected route in the selected mock server only. It does not change the route's method/path/name/delay/enabled fields, convert binary bodies, hot-reload a running native mock instance, or expose a server/route chooser inside the request response pane. The local action does not contact an AI provider.
