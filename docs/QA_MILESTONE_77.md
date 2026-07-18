# Milestone 77 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: render a safe request-aware output subset in native local mock response bodies using incoming headers, query parameters, path segments, raw/parsed bodies, and the documented `default` filter.

The scope was reconciled against Kong's current [dynamic mocking documentation](https://developer.konghq.com/insomnia/dynamic-mocking/), which defines `req.headers`, `req.queryParams`, `req.pathSegments`, `req.body`, Faker values, the `default` filter, and restricted `assign`/`if`/`unless`/`raw` tags. This phase closes the request-data output/filter slice; conditional tags, multipart fields, and Faker remain explicit next phases.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 270 tests |
| Vite production build | Pass — 173 modules; 498,565-byte main JavaScript chunk; 48,278-byte lazy automation-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 43 policy/parser/renderer/handler tests pass; the unchanged loopback-listener integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 44-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- Header lookup is case-insensitive and supports documented bracket or dot notation.
- Query decoding, zero-based path-segment access, and existing `{parameter}` route values render into response bodies.
- Raw request bodies are available only when bounded valid UTF-8.
- JSON and `+json` objects/arrays support dotted field/index access; URL-encoded form fields are decoded.
- Missing known values render empty or use the documented `default` filter.
- Existing timestamp, UUID, and route path-parameter tokens continue to render.
- Unknown variables/tags remain literal so unsupported syntax is reviewable and later phases can extend it without data loss.
- An async handler-level fixture sends a real Axum request body/headers/query/path through route matching and validates the rendered response without binding a socket.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Inspector examples, long template editing, responsive layout, and restart-after-edit behavior are compile-, unit-, style-, and bundle-verified only in this phase.

## Acceptance boundary

This is an output-only Liquid-compatible subset, not the full LiquidJS engine. It does not yet implement `assign`, `if`, `unless`, `raw`, multipart field parsing, Faker variables, arbitrary filters, repeated-value arrays, or percent-decoded path segments. Incoming bodies over 1,000,000 bytes or invalid UTF-8 expose an empty body context; the static route still responds. Running native mock instances require restart after edits.
