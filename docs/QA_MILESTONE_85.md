# Milestone 85 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: reproduce Mockbin's permissive missing-variable behavior and strict structured failure response for unsupported, malformed, or resource-exhausting response templates without enabling disabled Liquid syntax.

## Source audit

- Kong developer-doc commit `73995e32ed758882a290c945807225d7442b483e` lists `assign`, `if`, `unless`, and `raw` as the only allowed tags and `default` as the only allowed filter.
- Kong/insomnia-mockbin commit `fe06c386407e6df5fd5b6004daae4e105c202572` configures LiquidJS 10.27 with `strictVariables: false`, `strictFilters: true`, and that tag/filter allowlist, then maps template exceptions to an HTTP 500 body with `error` and `message` properties.
- LiquidJS 10.27 at commit `a8fd734b5ec4e0a6ffd1501a5961edc1e241be17` resolves missing variables to nil under non-strict mode while unsupported filters and parser failures throw.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 274 tests |
| Vite production build | Pass — main JavaScript below 500 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native mock suite | Pass — 18 tests with the loopback fixture outside the filesystem sandbox |
| Native test suite | Pass — 58 tests with the loopback fixture outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Missing known values, unknown variable roots, and unknown Faker names render empty while `default` remains available.
- Unsupported filters and tags fail instead of remaining literal; invalid syntax in an unselected branch is still parsed and rejected.
- Unclosed outputs, conditionals, and raw blocks plus duplicate/misordered branches and invalid assignment names return deterministic diagnostics.
- Source-character, token, nesting, local-count, assigned-value, and dynamic-expansion ceilings stop rendering with an error rather than exposing a partial literal remainder.
- The async handler returns JSON status 500 with stable `error`/`message` properties, permissive CORS, and route identity headers.
- Valid typed operators, branches, Faker values, dynamic tokens, and request-aware fields continue rendering under the prior bounds.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibits the in-app Browser. This milestone changes only native rendering and handler failure behavior; it is covered by pure renderer, async handler, type, bundle, and app-build gates.

## Acceptance boundary

The observable permissive-variable and strict-syntax error contract matches Mockbin. Diagnostic wording and token locations are Brunomnia-owned rather than byte-identical LiquidJS output. Escape handling, object identity, runtime wall-clock/memory accounting, and exact FakerJS corpus/distribution identity remain outside this baseline.
