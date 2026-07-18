# Milestone 33 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: a device-local request-timeout preference resolved at execution time, per-request inheritance/custom overrides, and disabled-deadline support.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [settings defaults](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) set `timeout` to 30,000 ms, the [general settings UI](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) describes `0` as disabling timeouts, and the [ordinary libcurl transport](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/network/libcurl-promise.ts) reads the live setting during execution and passes zero directly to libcurl. The current [request documentation](https://developer.konghq.com/insomnia/requests/) likewise documents a 30,000 ms default.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 27 files, 164 tests |
| Vite production build | Pass — 156 modules; 488.65 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 483,180-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 24 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Every verification and packaging gate uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- New devices and imported workspaces default to 30,000 ms; valid nonnegative values survive migration, invalid values default safely, and zero remains a first-class disabled state.
- New requests use Preferences, custom requests retain their own timeout, and the pure resolver proves both precedence directions without mutating saved transport data.
- Workspace v14 and earlier requests with saved deadlines migrate to Custom so an upgrade cannot silently change runtime behavior; requests without a saved transport timeout adopt inheritance.
- Native HTTP/GraphQL invocation receives the effective value. Browser Fetch creates an AbortSignal only for positive deadlines.
- Event Stream and gRPC transport inputs receive the same resolved value. Native zero omits HTTP connect/total deadlines, SSE response-header timing, gRPC channel/RPC deadlines, and gRPC stream deadlines.
- Collection runs, CLI runs, primary and secondary script/plugin traffic, artifact imports, OAuth, Git-AI, and HTTP-backed integrations receive the device preference.
- GraphQL introspection, AI, MCP, Konnect, and bounded script subrequests retain explicit safety deadlines, even if the device preference is unlimited.
- Ordinary cURL imports inherit Preferences; an explicit `--max-time` becomes Custom and can represent zero.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The Preferences and Transport controls are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

This evidence accepts current-compatible global timeout behavior plus Brunomnia's additional per-request Custom mode. WebSocket connection APIs do not expose the same total timer as HTTP; established Event Streams intentionally remain unlimited after response headers. Live slow-server timing fixtures, rendered control QA, and browser-engine maximum-delay edge cases remain open in [PARITY.md](PARITY.md).
