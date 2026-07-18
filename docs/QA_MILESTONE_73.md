# Milestone 73 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add explicit, reviewable active-request and latest-response sources to AI mock generation while keeping credentials, vault resolution, environment resolution, and file bytes out of the prepared context.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [mock response extractor](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/editors/mock-response-extractor.tsx) turns an active response into a mock route, while its [model worker](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/main/mock-generation-process.mjs) accepts OpenAPI, specification URL, or specification text sources. This phase closes Brunomnia's reviewable request/response AI-context slice; direct response conversion and URL fetching stay open in the parity ledger.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 44 files, 261 tests |
| Vite production build | Pass — 172 modules; 498,565-byte main JavaScript chunk; 42,804-byte lazy automation-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 40 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 41-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- Active-request context includes structural method/URL/query/header/body/protocol information while excluding authentication values and file bytes.
- Credential-named headers, query/body fields, response headers, cookies, URL user information, and common textual credential assignments are redacted locally.
- Latest-response selection is confined to the active request and, when enabled, the active environment; the newest timestamp wins.
- The exact prepared context is shown before generation and can be supplemented with optional instructions.
- Context source selection defaults to manual input. Missing request/response sources disable generation and produce focused helper errors.
- Prepared context and instructions are independently bounded; composed input never exceeds 190,000 characters before the existing provider hard cap.
- Generated methods, paths, status codes, headers, route count, delay, port, and loopback host continue through the established structured-output validator.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Source-selector state, context disclosure layout, responsive stacking, and disabled-button behavior are compile-, unit-, style-, and bundle-verified only in this phase.

## Acceptance boundary

Credential-name redaction is defense in depth, not general-purpose DLP: arbitrary domain data in a selected request or response body is sent exactly as displayed. Brunomnia does not resolve environment/vault values for context, include binary bytes, fetch a URL automatically, convert a response directly without AI, load `.gguf` files, or add hosted mock deployment. The user must explicitly select non-manual context and can inspect it before invoking the configured provider.
