# Milestone 58 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: make HTML visual previews resolve relative links against the actual response URL across live, historical, content-detected, and nested multipart responses, with a reset affordance and without silently enabling automatic remote subresources.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` (2026-07-17 UTC). Its [response WebView](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/viewers/response-web-view.tsx) still inserts the response URL as a `<base>` before loading the HTML document. The same behavior is present in the previously pinned `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62` audit. Brunomnia performs the base composition for valid HTTP(S) URLs even when the response omits an exact lowercase `<head>` tag.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 41 files, 247 tests |
| Vite production build | Pass — 169 modules; 497.47 KB / 497,469-byte main JavaScript chunk; 17,508-byte response-preview chunk; 4,212-byte response-download chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 521,881-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 27 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 28-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- Valid HTTP and HTTPS response URLs are normalized and inserted as an attribute-escaped first `<base>` before response-controlled markup.
- A response-supplied later `<base>` cannot replace Brunomnia's response URL, and ordinary relative resolution follows standard URL semantics.
- Malformed, `javascript:`, file, and other non-HTTP(S) values produce no base and keep `base-uri 'none'`.
- The injected document and iframe both request `no-referrer` navigation behavior.
- The response document retains its existing safe/scripted CSP differences while automatic external scripts, fetch/XHR/WebSocket/EventSource, CSS, images, fonts, objects, and forms remain blocked.
- Live and stored responses use their recorded request URL; selected multipart HTML recursively inherits that same top-level URL.
- Reset preview remounts the original response document after same-frame navigation.
- The feature is neither account-gated nor subscription-gated and does not modify stored body bytes, headers, history, filters, or exports.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Relative-link clicking, reset behavior, followed-page CSP behavior, and platform WebView sandbox enforcement are compile-, policy-string-, prop-wiring-, and bundle-verified only in this phase.

## Acceptance boundary

Brunomnia does not yet auto-load remote CSS, images, fonts, media, external scripts, or fetch connections from the original response document, and it does not yet expose Insomnia's response-link disable preference. Following a link is an explicit navigation: the destination remains in the opaque iframe sandbox but uses its own CSP, and it can execute scripts and network requests when the HTML JavaScript grant supplies `allow-scripts`. Forms, popups, downloads, same-origin access, parent access, and top navigation stay ungranted. The reset button restores the locally stored response.
