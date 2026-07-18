# Milestone 81 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: preserve repeated query and URL-encoded form pairs as ordered arrays, add bounded Liquid-style bracket/dot access across request collections, and percent-decode path segments/route parameters without query-style `+` conversion.

The source audit reconciled Kong's current [dynamic mocking documentation](https://developer.konghq.com/insomnia/dynamic-mocking/), the pinned [Mockbin request handoff](https://github.com/Kong/insomnia-mockbin/blob/c2a388563ea8259f9b235e4b3dfe87f64d568014/lib/routes/bins/run.js), its [body parser](https://github.com/Kong/insomnia-mockbin/blob/c2a388563ea8259f9b235e4b3dfe87f64d568014/lib/middleware/body-parser.js), and Node's current [query-string contract](https://nodejs.org/api/querystring.html). Node documents ordered repeated-key arrays and a default 1,000-pair parse limit.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 270 tests |
| Vite production build | Pass — 173 modules; 498,565-byte main JavaScript chunk; 49,227-byte lazy automation-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 518,331-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native mock parser/renderer/handler suite | Pass — 12 tests |
| Sandboxed `cargo test --locked` | Environment-limited — 52 policy/parser/renderer/handler tests pass; the unchanged loopback-listener integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — real `beforeBuildCommand` rebuilt the renderer/CLI before the executable and unsigned `Brunomnia.app` |
| Changed-path whitespace checks | Pass |

Frontend verification reuses the fresh locked-dependency `/private/tmp` mirror established for Milestone 80. Native lint/test/build gates use the independently warmed Cargo target. Tauri runs the mirror's real build hook rather than bypassing the production frontend build.

The sandbox result remains one test short of the full 53-test native suite: only the existing mock-server integration that opens a loopback listener is denied. All socket-free request parsing, rendering, and Axum handler fixtures pass. No rendered-browser claim is made.

## Focused coverage

- Query and URL-encoded form pairs are UTF-8 percent-decoded, retain insertion order, and promote repeated names from strings to arrays.
- Only the first 1,000 pairs are retained; executable boundary coverage proves index 999 exists and index 1000 is missing.
- Numeric bracket (`tag[0]`) and dotted (`tag.1`) indices work alongside dot properties and quoted bracket keys.
- Quoted access preserves keys containing dots, including `req.queryParams['na.me']` and `req.body['profile.name']`.
- The same traversal supports nested JSON arrays/objects and multipart arrays; malformed access syntax remains literal.
- Query/form `+` decodes to a space. Path `+` remains literal.
- Valid percent-encoded UTF-8, spaces, and encoded slashes decode in path segments and route parameters.
- Invalid UTF-8 percent bytes retain the original path segment rather than emitting replacement characters.
- Static route text can match an encoded equivalent, and an async handler fixture proves repeated query selection plus a decoded route parameter without opening a socket.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Inspector examples, repeated query authoring, encoded-path entry, responsive layout, and restart-after-edit behavior are compile-, unit-, style-, and bundle-verified only in this phase.

## Acceptance boundary

Bracket expressions support quoted literal property names and numeric indices. They do not evaluate dynamic index variables or arbitrary Liquid expressions. Query/form pair values use UTF-8 form decoding; alternative legacy encodings are not supported. Whole arrays/objects stringify as JSON when output directly, so templates should index repeated values when scalar text is required.
