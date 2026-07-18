# Milestone 51 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: preserve exact decoded HTTP entity bytes across native/browser execution, saved response history, raw downloads, and response-plugin buffers without duplicating ordinary valid UTF-8 bodies.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The pinned [response model](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/response.ts) keeps a `Uint8Array` buffer for bodies below 5 MB and a filesystem path for complete bodies. The pinned [response download helper](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/panes/response-pane-utils.ts) writes that byte buffer directly for raw export and decodes it only for prettified JSON. Its [UTF-8 helpers](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/common/utils/utf8-bytes.ts) use `TextDecoder` for the inspectable string and chunked Base64/byte conversions.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 38 files, 228 tests |
| Vite production build | Pass — 166 modules; 497.35 KB / 497,345-byte main JavaScript chunk; 3,839-byte response-download chunk; 12,501-byte response-preview chunk; no chunk-size warning |
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

- Native Reqwest execution consumes the response as bytes after automatic content decoding, records the actual decoded byte count, and then derives the inspection string.
- Browser Fetch execution uses `arrayBuffer()` and the same byte-to-inspection contract instead of consuming the body through lossy `text()`.
- Valid UTF-8 stores only the string because `TextEncoder` reconstructs the exact entity bytes; malformed UTF-8 stores the replacement-character inspection string plus a chunked Base64 sidecar.
- Empty and valid Unicode bodies do not pay duplicate response-storage cost. Invalid bytes, embedded NULs, and historical binary data remain exactly recoverable.
- Raw export uses the byte sidecar when present and otherwise emits the exact UTF-8 reconstruction. Prettified JSON continues to use the decoded text and falls back to exact raw bytes when parsing fails.
- Saved-response normalization preserves only string byte sidecars and safely falls back to inspectable text if a persisted Base64 value is corrupt.
- Response plugins receive exact `SafeBuffer` bytes. Binary `setBody` replacements retain their buffer and byte count; string replacements delete stale byte evidence.
- Existing response timelines, JSONPath/XPath filters, Source/Raw text inspection, HAR/debug text exports, cookie handling, request snapshots, and 5/100 MiB guards keep their established behavior.
- The byte helper is dependency-free. Raw artifact creation remains in the lazy response-download chunk, while the main production bundle remains below Vite's warning threshold.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Save prompting and inspection of a binary file in an external application are compile-, unit-, and artifact-byte-verified only in this phase.

## Acceptance boundary

Brunomnia preserves the decoded HTTP entity exposed by Reqwest or Fetch, not compressed wire bytes. It still buffers the complete body in memory before applying preview limits and stores response history in the device-local workspace rather than Insomnia's filesystem-backed/deferred body paths. Text inspection remains UTF-8 with replacement characters; declared non-UTF-8 charset decoding is not yet implemented. Multipart parsing remains text-backed, image/PDF/audio viewers remain open, and debug/HAR exports intentionally remain textual. Native save dialogs, raw header ordering/duplicates, redirect/TLS traces, and pre-allocation body limits are not claimed.
