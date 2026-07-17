# Milestone 29 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: a device-local maximum redirect preference with no-follow, zero, finite, and unlimited native policies across HTTP-family execution.

The scope was reconciled against the [current upstream Insomnia setting](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) and [transport](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/network/libcurl-promise.ts) at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The setting describes `-1` as unlimited and the transport applies a positive `MAXREDIRS` value. [Reqwest's redirect policy contract](https://docs.rs/reqwest/0.12.28/reqwest/redirect/struct.Policy.html) supplies explicit none, limited, and custom behavior for the Tauri native client.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 24 files, 142 tests |
| Vite production build | Pass — 153 modules; 479.76 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 482,297-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 24 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Every verification and packaging gate used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full native suite: only the existing mock-server integration that opens a loopback listener is denied. No live redirect-chain fixture or full native-suite claim is made.

## Focused coverage

- Preferences default to 10 redirects, accept zero and integer finite limits, normalize every value below `-1` to `-1`, and reset to 10 on workspace import.
- The native model also defaults missing transport input to follow redirects, validate certificates, use a 60-second timeout, and allow 10 redirects instead of inheriting Rust primitive defaults.
- Per-request no-follow takes precedence over every numeric preference.
- Zero and positive values build an explicit limited policy; `-1` builds a custom unlimited policy.
- Ordinary requests retain their total timeout across a redirect chain.
- SSE applies the request timeout until response headers arrive, including redirects, while leaving an established stream without a total deadline. Reconnect attempts reuse the same policy.
- Primary sends, GraphQL introspection, collection runs, secondary script/plugin traffic, artifact imports, OAuth token requests, AI/MCP/Konnect integrations, and Git AI calls inherit the device preference.
- Invocation and stream serialization do not mutate the request's saved transport object.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The Preferences control is compile- and source-verified only in this phase.

## Acceptance boundary

This evidence accepts a native maximum-redirect baseline. The environment cannot bind deterministic redirect peers, so actual zero/finite/unlimited hop chains are source/unit/build-verified rather than live integration-tested. Browser development mode cannot enforce the setting; WebSocket handshake redirects, redirect-chain timeline entries, per-request numeric overrides, and broader network diagnostics remain open in [PARITY.md](PARITY.md).
