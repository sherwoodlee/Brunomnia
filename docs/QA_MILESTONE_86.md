# Milestone 86 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: reproduce the quote-aware string tokenization, ordinary string escapes, computed bracket properties, and inactive-branch syntax validation of the LiquidJS engine behind current Insomnia dynamic mocks without enabling disabled tags or filters.

## Source audit

- Kong/insomnia-mockbin commit `fe06c386407e6df5fd5b6004daae4e105c202572` continues to run LiquidJS 10.27 with only `assign`, `if`, `unless`, `raw`, and `default` enabled.
- LiquidJS commit `a8fd734b5ec4e0a6ffd1501a5961edc1e241be17` implements quote-aware token boundaries and `parseStringLiteral()` named control, Unicode, octal, and pass-through escapes.
- The pinned LiquidJS expression fixtures require literal and dynamic brackets, nested property expressions such as `foo[doo["foo"]]`, typed assigned-value traversal, and array/string `size`-style access.

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
| Focused native mock suite | Pass — 19 tests with the loopback fixture outside the filesystem sandbox |
| Native test suite | Pass — 59 tests with the loopback fixture outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Output and tag closers plus control openers inside quoted strings remain content rather than changing token boundaries.
- Escaped quotes/backslashes, named controls, Unicode hex, octal, and unknown pass-through escapes match pinned LiquidJS examples for valid Unicode scalar output.
- Literal, numeric, assigned, request-derived, and nested computed keys traverse parsed request values and typed locals.
- Dynamic header names preserve existing case-insensitive request-header lookup; arrays and strings expose bounded `size`, `first`, and `last` reads.
- Quoted pipes remain fallback content, and sequential allowed `default` filters evaluate in order.
- Unsupported filters and malformed property/string syntax in inactive branches still produce the structured template-error response.
- Unicode identifiers and quoted values do not trigger byte-boundary panics.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibits the in-app Browser. This milestone changes only native template tokenization/evaluation and is covered by renderer, handler, type, bundle, and app-build gates.

## Acceptance boundary

Range literals and property reads rooted directly on quoted/range values remain unsupported. Exact LiquidJS diagnostic wording/token locations, JavaScript lone-surrogate and object/Drop identity, runtime wall-clock/memory accounting, and exact FakerJS corpus/distribution identity remain outside this baseline.
