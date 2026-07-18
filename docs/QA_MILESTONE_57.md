# Milestone 57 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: add a free, device-local HTML response JavaScript preference while preserving Brunomnia's safe default and retaining a materially narrower authority boundary than an ordinary page or Electron WebView.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The pinned [settings model](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) defaults `disableHtmlPreviewJs` to false, the pinned [General preferences](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) exposes Disable JS in HTML preview, and the pinned [response viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-viewer.tsx) passes that choice to its response WebView. Brunomnia exposes the capability as Allow inline JavaScript but intentionally defaults it off.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 41 files, 245 tests |
| Vite production build | Pass — 169 modules; 497.44 KB / 497,440-byte main JavaScript chunk; 16,590-byte response-preview chunk; 17,361-byte preferences chunk; 4,212-byte response-download chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 521,881-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 27 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 28-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- The false default produces an empty iframe sandbox and the established `default-src 'none'` policy without any `script-src` grant.
- The explicit true value produces only `sandbox="allow-scripts"`; `allow-same-origin`, forms, popups, modals, downloads, and navigation capabilities are absent.
- The scripted policy adds inline scripts but not external script sources or `unsafe-eval`, while explicitly retaining `connect-src 'none'`, `object-src 'none'`, `base-uri 'none'`, and `form-action 'none'`.
- Top-level and selected multipart HTML use one shared preview composition. An amber warning remains visible outside the iframe whenever scripting is enabled.
- The preference model defaults false, accepts only literal boolean true, resets imported true values to false, persists supported local true values, and participates in Restore defaults.
- Replacing the loading workspace's hand-copied preferences object with the canonical defaults removes drift and shrinks the main renderer by 791 bytes from Phase 56 despite the new prop wiring.
- The feature is neither account-gated nor subscription-gated and does not modify response bodies, headers, history, or exports.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Inline DOM interaction, the warning banner, iframe navigation, and platform WebView CSP enforcement are compile-, policy-string-, persistence-, and bundle-verified only in this phase.

## Acceptance boundary

Brunomnia deliberately defaults JavaScript off while pinned Insomnia defaults it on. The iframe stays opaque-origin and offline for scripts/subresources, but the sandbox cannot preempt CPU-intensive inline code and same-frame link/script navigation remains WebView behavior. Brunomnia does not reproduce Electron response-WebView base-URL injection, remote resources, same-origin access, forms, popups, downloads, parent/top navigation, or a response-link preference. Only trusted response bodies should receive the device-local grant.
