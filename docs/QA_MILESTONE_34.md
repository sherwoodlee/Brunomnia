# Milestone 34 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: separate device-local certificate-validation preferences for API and authentication traffic, plus per-request inheritance/overrides for native API transports.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [settings defaults](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) enable both `validateSSL` and `validateAuthSSL`, the [general settings UI](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) exposes separate API-request and authentication controls, the [ordinary libcurl transport](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/network/libcurl-promise.ts) reads `validateSSL` during execution, and the [OAuth token path](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/network/o-auth-2/get-token.ts) substitutes `validateAuthSSL` for token traffic.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 27 files, 171 tests |
| Vite production build | Pass — 156 modules; 491.08 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 516,633-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 24 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Every verification and packaging gate uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- New devices and imported workspaces enable both validation preferences; explicit local false values survive migration while malformed truthy values cannot silently disable verification.
- New requests use Preferences. Always/Never take precedence over the API device value through a pure resolver without mutating saved request transport.
- Workspace v15 and earlier request booleans migrate to Always/Never so upgrades preserve existing behavior; requests without saved transport validation adopt inheritance.
- Native HTTP/GraphQL invocation receives the resolved API value, and Event Stream/gRPC input uses the same effective policy.
- Collection runs, primary/secondary scripts, plugins, artifact imports, Git-AI, and HTTP-backed integrations receive both settings through the shared request context.
- OAuth token acquisition forces Use Preferences for its cloned transport and resolves the separate authentication value, even when API validation remains enabled.
- Ordinary cURL imports inherit API validation; explicit `--insecure` becomes Never.
- The CLI now migrates workspace input through the shared v16 path. Node Fetch cannot disable verification per request, so an effective Never mode fails clearly instead of modifying process-wide TLS security.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The Preferences and Transport controls are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

This evidence accepts current-compatible API/authentication validation defaults plus Brunomnia's additional request-level Always/Never modes for native transports. Browser engines own certificate verification; per-request insecure TLS in the CLI, automated OAuth authorization-window/callback capture, and live trusted/untrusted certificate fixtures remain open in [PARITY.md](PARITY.md).
