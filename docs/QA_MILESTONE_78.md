# Milestone 78 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add a deliberately bounded Liquid-style control subset to native local mock response bodies: response-local assignment, nested `if`/`unless` with optional `else`, simple truthiness/equality, and literal `raw` regions.

The scope follows the restricted control tags described in Kong's current [dynamic mocking documentation](https://developer.konghq.com/insomnia/dynamic-mocking/) without embedding a general template engine. Unknown or over-limit content remains literal, and the renderer never evaluates JavaScript, shell commands, includes, or loops.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 270 tests |
| Vite production build | Pass — 173 modules; 498,565-byte main JavaScript chunk; 48,688-byte lazy automation-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native mock renderer/handler suite | Pass — 7 tests |
| Sandboxed `cargo test --locked` | Environment-limited — 45 policy/parser/renderer/handler tests pass; the unchanged loopback-listener integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 46-test native suite: only the existing mock-server integration that opens a loopback listener is denied. The socket-free async handler fixture and all six pure mock parser/renderer fixtures pass. No rendered-browser claim is made.

## Focused coverage

- `assign` accepts bounded local names and values from quoted literals or supported request expressions; oversized local values remain literal.
- `if` and `unless` support truthiness and `==`/`!=`, an optional `else`, and correctly nested mixed controls.
- Assignments in the selected fragment remain available to later output in the same response render.
- `raw` preserves output/control-looking text and recognizes whitespace-normalized `endraw` tags.
- Unknown tags remain byte-for-byte literal instead of silently disappearing or gaining execution semantics.
- A 21st nested conditional remains literal; at most 20 levels are evaluated.
- A 1,001st output token remains literal after the 1,000-operation budget is exhausted.
- Dynamic insertion stops after 5,000,000 bytes and preserves the crossing output literally; static route text is not charged against that budget.
- Existing request-aware values, the `default` filter, timestamp/UUID, and route parameters continue to pass their earlier fixtures.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Inspector examples, long template editing, responsive layout, and restart-after-edit behavior are compile-, unit-, style-, and bundle-verified only in this phase.

## Acceptance boundary

This is a safe compatibility subset, not the full LiquidJS engine. It does not implement `elsif`, loops, includes, arbitrary filters/operators, multipart form-field access, Faker variables, repeated-value arrays, percent-decoded path segments, or live route hot reload. Empty and string/JSON `false` values are falsey; other non-empty values are truthy. Once a resource bound is reached, the remainder is emitted literally rather than partially discarded.
