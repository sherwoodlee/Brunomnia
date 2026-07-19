# Milestone 84 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: reproduce the condition, branch, truthiness, and default-filter semantics exposed by the LiquidJS engine behind current Insomnia dynamic mocks without enabling tags or filters that Mockbin disables.

## Source audit

- Kong developer-doc commit `73995e32ed758882a290c945807225d7442b483e` lists `assign`, `if`, `unless`, and `raw` as the only allowed tags and `default` as the only allowed filter.
- Kong/insomnia-mockbin commit `fe06c386407e6df5fd5b6004daae4e105c202572` configures LiquidJS 10.27 with that allowlist, `strictVariables: false`, `strictFilters: true`, and `lenientIf: true`.
- LiquidJS 10.27 tag/operator source at commit `a8fd734b5ec4e0a6ffd1501a5961edc1e241be17` defines ordered `elsif`, six comparison operators, `contains`, `not`, and right-to-left same-precedence `and`/`or`; Shopify truthiness treats only false and nil as falsey.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 274 tests |
| Vite production build | Pass — 174 modules; main JavaScript below 500 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native Liquid suite | Pass — typed operators/truthiness and default-filter fixtures |
| Native test suite | Pass — 56 tests with the loopback fixture outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- String-versus-number equality stays strict while relational comparisons reproduce JavaScript/Liquid numeric coercion.
- All six comparisons, string and array `contains`, unary `not`, and right-associative `and`/`or` are executable.
- Operator words inside quoted strings and Unicode property paths do not confuse or panic the scanner.
- `if` and `unless` select the first matching `elsif`, then optional `else`; nested controls and raw regions keep their existing bounds.
- Empty strings and arrays plus zero are truthy, while false, null, and missing paths are falsey.
- `empty` matches empty strings/arrays/objects; `blank` also matches false, nil, and whitespace-only strings.
- `default` replaces false, nil, empty strings, and empty arrays while preserving zero.
- Assignments retain typed values and continue to obey local-count and rendered-byte limits.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibits the in-app Browser. The mock inspector now advertises `elsif` and condition operators; rendering behavior is native-unit, handler, type, bundle, and app-build verified.

## Acceptance boundary

Unsupported variables/tags/filters remain literal rather than producing Mockbin's template-error response. Exact LiquidJS parser diagnostics, escape handling, object identity, and wall-clock/memory-limit behavior remain outside this baseline.
