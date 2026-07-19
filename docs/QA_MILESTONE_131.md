# Milestone 131 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: close the pinned Cookies, chaining, and dynamic variables row with the exact Faker/JSONPath engines, confined File tags, full response-filter selectors, and guided request-field insertion.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/package.json` pins `@faker-js/faker` 9.7.0 and resolves `jsonpath-plus` 10.4.0. Brunomnia now pins those same versions rather than retaining dependency-free approximations.
- `common/templating/faker-functions.ts` maps exactly 118 public names to Faker modules. Brunomnia's registry preserves that exact name/order/function mapping and loads the package only when a Faker value is requested.
- `common/templating/local-template-tags.ts` runs JSONPath with JSONPath Plus, returns the first result, errors for invalid JSON/query/no results, and routes File through `context.util.readFile`. Brunomnia follows the same observable contract with JSONPath's safe evaluator and its existing canonical-root Tauri bridge.
- Pinned local tag definitions cover Faker, Base64, timestamp, UUID, OS, hash, File, JSONPath, cookie, response/request values, prompt, and external/plugin families. Brunomnia's Tags dialog exposes every locally supported family without an account or entitlement check.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Focused dynamic-variable/shared-request regressions | Pass — 5 files, 53 tests |
| Full Vitest suite | Pass — 60 files, 406 tests |
| Native test suite | Pass — 97 tests |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production and bundled CLI build | Pass — 285 modules transformed and CLI bundled |
| Bundled CLI startup | Pass — help exits successfully and lists lint, generate, export, collection, and test commands |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- All 118 pinned Faker names execute through Faker 9.7 and return non-empty string representations; unknown names fail explicitly.
- JSONPath predicates, recursive descent, slices, unions, invalid JSON, malformed queries, and empty results cover both tags and response-preview filtering.
- Base64 normal/URL/hex behavior, timestamp aliases, explicit cookie URLs, response chaining, and missing-cookie failures remain source-shaped.
- File tags invoke only a supplied mediated reader; absent grants fail before any host read. Existing native tests cover empty paths, canonical containment, regular files, size ceilings, and symlink escapes.
- Twenty concurrent fields render independent raw-tag parser state.
- The builder emits escaped compatible syntax, enumerates every shared-renderer destination, immutably appends/replaces values, preserves IDs containing delimiters, and rejects stale destinations.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone completes the pinned Cookies, chaining, and dynamic variables ledger row. File tags remain desktop-only under Brunomnia's explicit 5 MB approved-root bound. gRPC/stream execution and the portable CLI do not yet resolve external-vault or File tags. Existing unrelated `Baseline` and `Early baseline` rows remain; Brunomnia is not declared feature-complete.
