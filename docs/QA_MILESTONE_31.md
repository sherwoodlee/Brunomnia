# Milestone 31 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: a device-local follow-redirect default with per-request Use Preferences, Always, and Never inheritance.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [settings defaults](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) enable redirects by default, the [general settings UI](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) exposes that choice, and the [libcurl request transport](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/network/libcurl-promise.ts) resolves request-level `global`, `on`, and `off` values against it.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 26 files, 152 tests |
| Vite production build | Pass — 155 modules; 483.82 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 482,415-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 24 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Every verification and packaging gate uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- New devices and imported workspaces default to following redirects; valid device-local false preferences survive ordinary migration.
- Legacy requests with a false redirect boolean become Never, enabled requests become Use Preferences, and explicit three-state modes normalize their compatibility boolean.
- A shared pure resolver proves global true/false inheritance plus Always/Never precedence.
- Ordinary native/browser HTTP and GraphQL requests resolve the effective policy without mutating saved request transport.
- Native Event Stream connection and reconnect attempts use the same effective policy and maximum redirect ceiling.
- Main sends, collection runs, script and plugin subrequests, URL imports, OAuth, and HTTP-backed integrations receive the device preference. Security-sensitive GraphQL introspection, AI, MCP, and Konnect requests explicitly remain Never.
- Insomnia v4 top-level and v5 nested settings preserve `global`, `on`, and `off` through compatibility import/export.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The Preferences toggle and Transport selector are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

This evidence accepts redirect-default inheritance as a baseline. Live redirect chains cannot be bound in this sandbox, browser Fetch does not expose a hop ceiling, and redirect-hop timeline entries, per-request numeric ceilings, and WebSocket handshake redirect controls remain open in [PARITY.md](PARITY.md).
