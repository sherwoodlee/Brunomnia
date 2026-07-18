# Milestone 60 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add a free, explicit HTML remote-resource authority that can reproduce static and active response-page network behavior without silently broadening the safe default or the independent JavaScript grant.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [response WebView](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/viewers/response-web-view.tsx) loads response HTML as a data URL after inserting the response URL base, without an injected network CSP. The [response viewer](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/viewers/response-viewer.tsx) separately controls WebView JavaScript. Brunomnia exposes remote network authority separately and keeps both grants off by default.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 42 files, 253 tests |
| Vite production build | Pass — 170 modules; 497.97 KB / 497,969-byte main JavaScript chunk; 20,469-byte response-preview chunk; 18,174-byte preferences chunk; 4,212-byte response-download chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 28 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 29-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- With both grants off, default sources, scripts, network APIs, workers, frames, media, objects, forms, and remote styles/images/fonts remain blocked.
- Remote-only mode permits HTTP(S) CSS, images, fonts, media, and frames but still has no `script-src`, `connect-src`, or `worker-src` authority.
- Script-only mode retains inline scripts plus denied connections/workers and does not permit external scripts or subresources.
- Dual-grant mode adds HTTP(S) external scripts, HTTP(S)/WebSocket connections, and blob/HTTP(S) workers without `unsafe-eval`.
- Every mode retains the response URL base, no-referrer behavior, opaque origin, and omitted sandbox tokens for forms, popups, modals, downloads, same-origin, parent, and top navigation.
- The new preference defaults false, accepts only literal true, persists locally, resets on import, and participates in Restore defaults.
- Top-level, content-detected, saved-history, and recursively selected multipart HTML receive the same authority pair.
- The feature is neither account-gated nor subscription-gated and does not alter stored bodies, headers, history, copies, filters, or exports.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Remote CSS/media/frame loading, script loading, fetch/WebSocket/worker execution, warnings, CORS, mixed-content behavior, and sandbox enforcement are compile-, policy-string-, prop-wiring-, and bundle-verified only in this phase.

## Acceptance boundary

Brunomnia defaults both high-authority grants off while current Insomnia implicitly permits response subresources and defaults JavaScript on. The remote-resource grant is limited to HTTP(S) resources, HTTP(S)/WebSocket connections, and blob/HTTP(S) workers. Forms, popups, downloads, same-origin access, objects, `eval`, parent/top navigation, non-web schemes, and WebView-level certificate/proxy overrides remain unavailable. Platform CORS and mixed-content rules may prevent loads that Electron would handle differently.
