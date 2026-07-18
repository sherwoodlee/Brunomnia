# Milestone 76 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: fetch an HTTP(S) API specification for explicit review, then use its displayed bounded text as AI mock-generation context only after a separate user action.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [mock-generation worker](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/main/mock-generation-process.mjs) accepts OpenAPI, specification-URL, or specification-text sources. Its current [mock-route model](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia-data/src/models/mock-route.ts) stores response bodies as strings, so this phase targets the actual URL-source gap rather than claiming byte-backed mock bodies as an upstream requirement.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 270 tests |
| Vite production build | Pass — 173 modules; 498,565-byte main JavaScript chunk; 47,992-byte lazy automation-workbench chunk; no chunk-size warning |
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

- Specification source selection is explicit and remains unusable for generation until a successful fetch creates reviewable context.
- URL validation accepts only HTTP(S), removes fragments, caps input at 8,192 characters, and refuses embedded username/password credentials.
- Fetch adds no stored request authentication, cookies, scripts, environment values, vault values, external-secret resolver, or response-history context.
- Workspace redirect, timeout, certificate, HTTP-version, and proxy preferences remain effective for transport.
- Only 2xx text, JSON, YAML, or XML responses are accepted. Empty, binary, and post-buffer responses above 5 MB receive focused errors.
- The exact fetched source is shown before provider invocation; credential-shaped query values are redacted from that model context while ordinary query structure remains.
- URL context stays inside 94,000 characters and composed prompt/context stays inside 190,000 characters before the provider adapter's 200,000-character hard cap.
- URL editing invalidates the prior fetched context, preventing stale-source generation.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Source switching, fetch/create disabled states, review disclosure, responsive URL controls, and network-error placement are compile-, unit-, style-, and bundle-verified only in this phase.

## Acceptance boundary

The 5 MB response limit is enforced after the shared HTTP transport buffers the response. The fetch uses the URL exactly as entered (minus its fragment), including signed query parameters; only the later model context redacts credential-shaped query values. Arbitrary examples or sensitive values inside the fetched specification remain model input exactly as displayed. Brunomnia does not resolve external multi-file references, add stored credentials to the fetch, or contact the model before the separate create action.
