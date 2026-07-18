# Milestone 79 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: render the complete current documented `faker` property surface in native local mock response bodies without an account, hosted service, JavaScript engine, network fetch, or new runtime dependency.

The source audit reconciled Kong's current [Faker variables list](https://developer.konghq.com/insomnia/faker-variables/) with the exact [Insomnia Mockbin allowlist at commit c2a3885](https://github.com/Kong/insomnia-mockbin/blob/c2a388563ea8259f9b235e4b3dfe87f64d568014/lib/routes/bins/run.js). Both expose 118 property-style names through `faker`; every one is represented in the native executable table test.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 270 tests |
| Vite production build | Pass — 173 modules; 498,565-byte main JavaScript chunk; 48,987-byte lazy automation-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native Faker/mock suite | Pass — 10 tests |
| Sandboxed `cargo test --locked` | Environment-limited — 48 policy/parser/renderer/handler tests pass; the unchanged loopback-listener integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 49-test native suite: only the existing mock-server integration that opens a loopback listener is denied. The complete socket-free Faker/mock subset passes. No rendered-browser claim is made.

## Focused coverage

- A table-driven test invokes all 118 currently documented names and requires a non-empty output below 1,000 bytes.
- Representative shape checks parse UUID and ISO timestamp outputs and validate boolean, alphanumeric, hexadecimal-color, millisecond-timestamp, and image-data-URI forms.
- The response renderer proves known Faker values are inserted and an unknown `faker` property remains literal.
- Identifiers, colors, text/lorem, dates, internet/IP, names, addresses, jobs, image references, finance, company, database, file/system, and commerce categories are all represented.
- Each occurrence is generated independently and remains subject to the Phase 78 token and dynamic-expansion budgets.
- Image outputs are strings only. Rendering a Faker image variable does not perform a network request.
- No new package or native dependency was introduced.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Inspector examples, long template editing, responsive layout, and repeated-send variation are compile-, unit-, style-, and bundle-verified only in this phase.

## Acceptance boundary

This phase preserves Insomnia's documented names and output categories, not FakerJS implementation identity. Brunomnia uses a compact built-in English test-data corpus; exact strings, locale breadth, distributions, and date semantics can differ from upstream FakerJS. Generated data is for tests and mocks, never credentials, cryptographic keys, financial validation, or identity proof. Unknown names remain literal rather than silently resolving to empty text.
