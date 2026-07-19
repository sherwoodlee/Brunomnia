# Milestone 35 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: device-local system/manual proxy preferences plus inherited, custom, and direct request modes for native HTTP-family transports.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [settings defaults](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) default manual proxying off and retain separate `httpProxy`, `httpsProxy`, and `noProxy` values; the [general settings UI](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) exposes those device settings; and the [libcurl transport](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/network/libcurl-promise.ts) either resolves the Electron session proxy or applies the manual protocol-specific proxy plus no-proxy list at execution time.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 27 files, 177 tests |
| Vite production build | Pass — 156 modules; 493.13 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 518,961-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 24 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Every verification and packaging gate uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- New devices and imported workspaces leave manual proxying off with empty HTTP, HTTPS, and no-proxy fields, preserving reqwest's supported system/environment discovery.
- New requests use Preferences. Custom and Direct take precedence through a pure resolver without mutating the stored request transport.
- Manual preferences select the HTTP or HTTPS proxy from the fully resolved request URL and forward the same no-proxy list to reqwest.
- Workspace v16 and earlier nonempty request proxy fields migrate to Custom so upgrades preserve behavior; empty legacy fields adopt inheritance.
- Native HTTP/GraphQL invocation and Event Stream setup receive the effective system/custom/direct mode, selected URL, and exclusions.
- Collection runs, primary/secondary scripts, plugins, artifact imports, OAuth, Git-AI, and HTTP-backed integrations receive the device proxy context through shared execution paths.
- Ordinary cURL imports inherit Preferences; explicit `--proxy` and script proxy mutations become Custom request overrides.
- Browser development mode remains browser-owned. The bundled Node Fetch CLI cannot safely attach the manual proxy per request, so an effective manual requirement fails clearly instead of being silently ignored.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The Preferences and Transport controls are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

This evidence accepts current-compatible device proxy settings for native HTTP, GraphQL, OAuth, Event Stream setup, and HTTP-backed secondary/integration traffic, plus Brunomnia's additional request-level Custom/Direct modes. Reqwest system/environment discovery is not claimed to reproduce Electron session PAC behavior. Browser routing, WebSocket proxy transport, CLI manual-proxy execution, and live proxy fixtures remained open at this milestone. Milestone 117 later confirmed the pinned upstream gRPC channel does not install the application HTTP/HTTPS proxy agent, so custom gRPC proxy transport is not a parity requirement.
