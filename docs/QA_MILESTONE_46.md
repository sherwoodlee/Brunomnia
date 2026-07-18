# Milestone 46 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: align saved-response navigation with current Insomnia's chronological evidence and add persistent, preview-only JSONPath/XPath response filtering with bounded per-request history.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The [response-history dropdown](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/dropdowns/response-history-dropdown.tsx) groups results into Just Now, Less Than Two Hours Ago, Today, This Week, and Older Than This Week and displays status, restored URL/method, elapsed time, and size. The [response pane](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/panes/response-pane.tsx) stores a current filter plus ten recent filters per request. The [response viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-viewer.tsx) supplies those values to read-only JSON/XML previews, and the [code editor](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/.client/codemirror/code-editor.tsx) applies JSONPath or XPath on Enter and reports JSON matches.

The same pinned response-history source exposes select, delete-current, and clear-history actions but no response-comparison action. The previous generic comparison item is therefore removed from the parity ledger as an unsupported assumption, not marked implemented.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 33 files, 208 tests |
| Vite production build | Pass — 162 modules; 495.74 KB / 495,738-byte main JavaScript chunk; 4,641-byte response-preview/filter chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 521,233-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 26 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled and reuses the generated Cargo target directory.

The sandbox result remains one test short of the full 27-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No native behavior changed in this phase. No rendered-browser claim is made.

## Focused coverage

- JSON bodies are recognized even under a misleading text content type; XML is recognized by media type or markup shape; other bodies do not expose a filter surface.
- JSONPath supports `$`, dot and quoted-bracket properties, numeric array indexes, array/object wildcards, and recursive property descent while preserving deterministic result order.
- Unsupported predicates, unions, slices, malformed brackets, invalid JSON, and invalid selectors produce a visible bounded error/empty result rather than mutating the response or crashing the preview.
- XML filtering uses the WebView DOM parser, rejects parser errors, evaluates standards-based XPath, serializes element/attribute/text matches safely, and reports the match count.
- Enter applies and remembers a trimmed filter; clearing restores the complete body without erasing history; choosing a recent filter reapplies it without duplication.
- Workspace normalization caps filters at 2,000 characters, retains ten unique filters, ignores malformed entries, and removes metadata for request IDs that no longer exist.
- Saved response choices use the five current upstream time groups and include receipt time, status, historical method when available, actual URL, duration, and stored body size.
- The filter changes only the preview. Stored response bodies and all export helpers continue to receive the original response object.
- Response filter evaluation and UI are lazy-loaded, preserving main-bundle headroom and a normal loading boundary.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. XPath execution, focus order, native select rendering, and responsive toolbar fit are compile- and source-verified only in this phase.

## Acceptance boundary

The JSONPath evaluator is an honest dependency-free baseline, not full JSONPath Plus: predicates, unions, slices, and script expressions remain open. XPath requires the standards-based desktop/browser DOM and is not executed inside the Node-only unit runner. Filter metadata is bounded per request but is not independently encrypted from the local workspace store. Comparison is not claimed because the pinned current upstream history UI has no comparison action.
