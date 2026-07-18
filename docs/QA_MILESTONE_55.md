# Milestone 55 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: route selected multipart response sections recursively through Brunomnia's existing friendly viewers while preserving exact bytes, case-sensitive MIME boundaries, and explicit memory bounds.

The scope remains reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The pinned [main-process multipart parser](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/multipart-buffer-to-array.ts) exposes each part as a `Uint8Array`, and the pinned [multipart response viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-multipart-viewer.tsx) passes the selected part back through the friendly `ResponseViewer`. Brunomnia now follows that selected-part composition while retaining its stricter local bounds.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 39 files, 240 tests |
| Vite production build | Pass — 167 modules; 498.23 KB / 498,231-byte main JavaScript chunk; 15,577-byte response-preview chunk; 4,212-byte response-download chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 521,776-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 27 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 28-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- Aggregate and per-part Content-Type values retain their parameter casing; dispatch normalizes only for comparison, so an `InnerCase` MIME boundary is not silently changed before recursive parsing.
- A selected image, PDF, or audio section constructs its local Blob directly from the exact `Uint8Array` part slice. A focused artifact test covers direct binary multipart bytes.
- Selected HTML uses the existing network-blocked, script-disabled sandbox; CSV keeps its row/column/cell bounds; JSON/plain text keeps charset decoding, prettification, and the 1,000,000-character display cap.
- A selected nested multipart section receives another independent selector, header toggle, exact Save action, error state, and friendly body router. Only that selected path is instantiated.
- Recursive parsing stops before a sixth nested level. A selected nested multipart section above 5 MiB remains unparsed and gives exact-save guidance, bounding additional byte-index string allocation.
- Focused tests execute nested case-sensitive boundary parsing plus exact allow/depth/size guard thresholds. All prior binary, charset, framing, malformed-input, count-limit, media, and artifact-byte tests remain green.
- The response-preview implementation remains lazy. The main renderer stays byte-identical to Phase 54 and below the configured warning threshold.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Nested selectors, headers, safe HTML, CSV tables, media decoding, and save prompting are compile-, parser-, guard-, and artifact-byte-verified only in this phase.

## Acceptance boundary

Friendly routing trusts declared Content-Type and does not sniff payload signatures. Recursive multipart expansion is deliberately capped at five levels and 5 MiB for each nested selected aggregate; exact Save remains available outside those bounds. The parser remains buffered and materializes a byte-index string at every expanded level. Safe HTML does not resolve Content-ID attachments and remains non-interactive. MIME encoded-word headers, extended filename parameters, native save dialogs, and raw compressed wire framing remain unavailable.
