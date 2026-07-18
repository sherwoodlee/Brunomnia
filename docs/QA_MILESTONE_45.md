# Milestone 45 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: export the currently displayed HTTP/GraphQL response as a deterministic HTTP debug transcript or a one-entry HAR 1.2 artifact, using the matching saved request version for historical responses when available.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [preview action dropdown](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/dropdowns/preview-mode-dropdown.tsx) exposes Export HTTP debug and Export as HAR alongside raw/prettified response export. Its selected-response HAR path identifies both the request and response, while its debug path concatenates inbound header evidence and body text.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 32 files, 201 tests |
| Vite production build | Pass — 160 modules; 493.96 KB / 493,957-byte main JavaScript chunk; 3,700-byte response-download chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 520,380-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 26 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled and reuses the generated Cargo target directory to avoid a second multi-gigabyte dependency build.

The sandbox result remains one test short of the full 27-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No native behavior changed in this phase. No rendered-browser claim is made.

## Focused coverage

- HTTP and GraphQL responses expose separate Export debug and Export HAR actions; gRPC and streaming surfaces do not claim HTTP diagnostic compatibility.
- Debug output contains the negotiated/default HTTP version, response status and text, case-insensitively sorted displayed headers, a CRLF separator, and the exact displayed UTF-8 body.
- HAR output is valid JSON with one HAR 1.2 entry, Brunomnia creator metadata, recorded time/duration, status, request/response protocol, headers, content metadata, body, byte sizes, redirect location, and basic timing fields.
- The actual recorded request URL supplies ordered, duplicate-preserving query pairs; an unresolved URL safely falls back to enabled configured query rows.
- Selected saved responses use their matching structured request snapshot, so a historical URL, method, configured headers, and supported payload description are not silently replaced by the current authoring state.
- JSON, text, GraphQL, URL-encoded, and multipart metadata map to HAR post data. Known textual byte sizes use UTF-8 accounting; unknown multipart/binary sizes remain `-1` rather than being invented.
- Filenames use the established bounded filesystem-safe request name plus timestamp and `.txt` or `.har` extension.
- Artifact construction remains a pure tested boundary; Blob/object-URL download code stays in the existing lazy response-download chunk.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Save/download prompting, focus order, and visual footer fit are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

Brunomnia persists decoded aggregate response text and a header map, not raw wire events. Debug export therefore cannot preserve original header ordering, duplicate response-header fields, TLS diagnostics, redirect hops, compressed bytes, or binary bytes. HAR request evidence comes from the saved editable request snapshot and cannot reconstruct transport-added headers, resolved secret values, request cookies, or multipart framing. These limits remain explicit rather than fabricating unavailable evidence.
