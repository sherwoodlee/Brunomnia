# Milestone 44 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: export the currently displayed non-streaming response body as raw text or prettified JSON through a deterministic, local download artifact, while creating production-bundle headroom by lazy-loading the existing code-generation dialog.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [response pane](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/panes/response-pane.tsx) exposes response-body download from the preview toolbar; the [preview action dropdown](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/dropdowns/preview-mode-dropdown.tsx) separates Export raw response and Export prettified response; and the [download helper](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/panes/response-pane-utils.ts) derives a request-name/timestamp/content-type filename, prettifies JSON on request, and otherwise preserves the body.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 32 files, 198 tests |
| Vite production build | Pass — 160 modules; 493.26 KB / 493,263-byte main JavaScript chunk; 829-byte response-download chunk; 7,616-byte code-generation dialog chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 520,380-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 26 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled and reuses the generated Cargo target directory to avoid a second multi-gigabyte dependency build.

The sandbox result remains one test short of the full 27-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No native behavior changed in this phase. No rendered-browser claim is made.

## Focused coverage

- Every displayed non-streaming response, including a selected historical entry, exposes Export raw and downloads the exact stored UTF-8 body string.
- JSON content types additionally expose Export pretty; valid JSON receives two-space indentation and invalid JSON remains verbatim.
- Content-type lookup is case-insensitive, removes parameters, recognizes JSON/XML/HTML/CSV/YAML textual extensions, and falls back to `text/plain` plus `.txt`.
- Request names are trimmed, whitespace-normalized, stripped of unsafe filename characters, collapsed, bounded to 120 characters, and default to `response` when empty.
- The generated filename follows `<safe-request-name>-<timestamp>.<extension>`.
- Download uses a local Blob/object URL and the same browser/WebView anchor path already used by Brunomnia exports; no content leaves the device.
- The response artifact implementation loads only when an export is requested and handles a failed chunk load without an unhandled rejection.
- The existing code-generation dialog and generator move out of the main bundle and retain the established Suspense loading boundary.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Save/download prompting, focus order, and visual footer fit are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

Brunomnia's current response contract stores decoded UTF-8 text, not the upstream byte buffer, so byte-exact binary response downloads are not claimed. The action uses the browser/WebView download path rather than a native save dialog. Per-response HAR/debug export, response comparison/search, and persistent WebSocket/SSE histories remain open.
