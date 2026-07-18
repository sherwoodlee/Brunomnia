# Milestone 74 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: create a new editable local mock route directly from the active request's latest saved text response, without invoking an AI provider or any remote service.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [mock response extractor](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/editors/mock-response-extractor.tsx) derives a pathname from the active response URL, removes `Content-Length`, and supports new-route creation or existing-route overwrite. This phase closes Brunomnia's new-route creation slice; overwrite and response-pane server selection remain explicit gaps.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 265 tests |
| Vite production build | Pass — 173 modules; 498,565-byte main JavaScript chunk; 44,560-byte lazy automation-workbench chunk; no chunk-size warning |
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

- The active request's latest response is selected with the existing active-environment response-history policy.
- The saved request method becomes the mock method; unsupported custom methods safely fall back to GET.
- Absolute response URLs contribute only their pathname. Query and fragment data are excluded, relative paths are accepted, and invalid values use `/new-route`.
- Status, decoded text body, and bounded response headers become editable route fields.
- `Content-Length`, `Content-Encoding`, `Connection`, and `Transfer-Encoding` are omitted because the stored body is decoded and the mock transport recomputes framing.
- Text responses with non-UTF source bytes retain their decoded text. Binary media is refused because the current mock route model has no byte-backed body.
- Empty bodies are accepted and copied bodies cannot exceed 10,000,000 characters.
- The new route is selected immediately in the mock workbench for review before the server is started or restarted.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Button availability, route-selection focus, responsive header controls, and running-server restart behavior are compile-, unit-, style-, and bundle-verified only in this phase.

## Acceptance boundary

This phase creates a new route only in the currently selected mock server. It does not overwrite an existing route, select another server from the response pane, convert binary bodies, hot-reload a running native mock instance, or fetch a URL. Conversion is local and deterministic; it does not contact the configured AI provider.
