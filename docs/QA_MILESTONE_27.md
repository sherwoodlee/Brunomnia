# Milestone 27 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: current upstream preferred-HTTP-version settings parity, device-local normalization, native HTTP/1 and HTTP/2 policy, full HTTP-family propagation, and actual negotiated-version response evidence.

The scope was reconciled against the current public Insomnia `develop` source at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [General settings UI](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) exposes Default, HTTP 1.0, HTTP 1.1, HTTP/2 PriorKnowledge, and HTTP/2, while the [native transport](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/network/libcurl-promise.ts) maps those values into libcurl policy. HTTP/3 remains commented out upstream.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 24 files, 142 tests |
| Vite production build | Pass — 153 modules; 479.14 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 482,277-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 23 tests passed; the unchanged loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build, native checks, and packaging used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result is 23/24: only the existing mock-server integration that opens a loopback listener was denied. No live HTTP negotiation fixture or 24/24 claim is made.

## Focused coverage

- The device-local preference accepts exactly Default, HTTP 1.0, HTTP 1.1, HTTP/2, and HTTP/2 Prior Knowledge; old and malformed values normalize to Default.
- Workspace imports reset the preference while local, project, and encrypted-sync flows retain the existing device-local preference boundary.
- HTTP 1.0 and 1.1 create HTTP/1-only clients and set the matching request version; HTTP/2 Prior Knowledge creates an HTTP/2-only client.
- Standard HTTP/2 retains negotiation and HTTP/1 fallback behavior. All five client configurations build without network access.
- The selected value reaches ordinary requests, GraphQL and schema introspection, SSE initial/reconnect calls, collection runs, script/plugin requests, artifact URL imports, OAuth token calls, AI/MCP/Konnect integrations, and Git commit suggestions.
- Frontend invocation tests prove that transient preference input does not mutate the saved request transport. Stream-input tests prove the same boundary for SSE.
- Native responses retain the actual protocol string before consuming the body; response summaries, timelines, saved history, and SSE open/reopen events expose it.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Browser development mode cannot force an HTTP version and is explicitly labeled as browser-managed.

## Acceptance boundary

This evidence accepts a native preferred-HTTP-version baseline matching the current upstream settings surface. The environment cannot bind deterministic HTTP/1 and HTTP/2 peers, so wire-level negotiation, h2c Prior Knowledge, redirect continuity, and challenge-auth continuity are source/unit-tested rather than live integration-tested. HTTP/3, compression controls, and broader client-network diagnostics remain open in [PARITY.md](PARITY.md).
