# Milestone 48 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: add the current Insomnia per-request Visual Preview, Source Code, and Raw Data response modes while preserving response-filter, large-body, history, and export boundaries.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The pinned [preview-mode dropdown](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/dropdowns/preview-mode-dropdown.tsx) stores a per-request-meta mode and exposes the same copy/export actions. The shared [preview-mode constants](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/common-src/preview-mode.ts) define `friendly`, `source`, and `raw` with short labels Preview, Source, and Raw and long labels Visual Preview, Source Code, and Raw Data. The pinned [response viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-viewer.tsx) routes friendly content to JSON, HTML, image, PDF, CSV, multipart, audio, or source viewers; raw bypasses prettification; source retains filtering/prettification.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 34 files, 210 tests |
| Vite production build | Pass — 163 modules; 496.36 KB / 496,364-byte main JavaScript chunk; 6,717-byte response-preview chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 521,368-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 26 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled and reuses the generated Cargo target directory.

The sandbox result remains one test short of the full 27-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No native behavior changed in this phase. No rendered-browser claim is made.

## Focused coverage

- Per-request metadata accepts only `friendly`, `source`, or `raw`; missing, legacy, malformed, and unknown values normalize to `source`.
- The toolbar uses the current upstream long labels and changes only the active request's persisted preview mode.
- Source mode retains JSON/XML detection, filter application/history, match counts, safe errors, JSON prettification, and line numbers.
- Raw mode bypasses response-filter evaluation and prettification and hides line-number gutters while preserving the exact stored UTF-8 line content.
- Visual Preview retains the JSON/text baseline and routes `text/html` into a dedicated iframe.
- HTML uses an empty sandbox permission set plus an injected `default-src 'none'` policy; only inline styles and data-backed images/fonts are permitted, so response content cannot execute script, submit forms, gain top-navigation permission, or fetch remote resources.
- Active filters remain stored while hidden by Raw or HTML visual mode and reappear when Source/compatible Visual Preview is selected.
- The 5/100 MiB guard wraps all modes and returns before filtered/raw/HTML body construction. Selecting a mode while blocked does not reveal or evaluate the body.
- Copy writes the original stored response string, matching the pinned Copy raw response action; raw, pretty, debug, and HAR exports remain independent of preview mode.
- The evaluator, HTML iframe, raw/source rows, and mode toolbar remain in the lazy preview chunk.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Iframe rendering, native select appearance, focus order, mode switching, and responsive fit are compile- and source-verified only in this phase.

## Acceptance boundary

Brunomnia's response contract is decoded UTF-8 text, so Visual Preview cannot yet reproduce upstream byte-backed image, PDF, audio, CSV-table, multipart, or charset-aware viewers, and Raw Data is not original wire bytes. HTML is deliberately non-interactive and network-blocked; enabling response JavaScript is not claimed. These remain explicit parity gaps.
