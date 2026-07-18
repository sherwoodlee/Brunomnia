# Milestone 47 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: prevent large stored responses from triggering automatic JSON/XML detection, parsing, prettification, filter evaluation, line splitting, and preview-row rendering while preserving an explicit raw download path.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The pinned [response viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-viewer.tsx) initially blocks large bodies, offers Save To File, Show Anyway, and session-wide Always Show for the large band, and presents a download-only warning for huge responses. The pinned [constants](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/common/constants.ts) define `LARGE_RESPONSE_MB = 5` and `HUGE_RESPONSE_MB = 100`; the viewer multiplies both by 1024 × 1024 and uses strict greater-than checks.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 34 files, 210 tests |
| Vite production build | Pass — 163 modules; 495.85 KB / 495,845-byte main JavaScript chunk; 5,716-byte guarded response-preview/filter chunk; no chunk-size warning |
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

- `5 * 1024 * 1024` and `100 * 1024 * 1024` are pinned as the large and huge boundaries; exactly-equal values remain in the lower band, matching upstream strict greater-than behavior.
- Invalid, infinite, and negative size evidence normalizes to the normal band rather than accidentally blocking a response.
- A blocked large response returns its warning before mounting the component that detects JSON/XML, parses JSON, evaluates XPath/JSONPath, prettifies content, splits lines, or constructs code rows.
- Show anyway keys the reveal to the displayed response, so choosing another large saved response receives its own warning.
- Always show is module-scoped to the current renderer session and bypasses only the 5–100 MiB band; app reload restores the default warning.
- The huge band remains download-only even if the session-wide large-response reveal was enabled earlier.
- Save response to file reuses the original lazy raw-body Blob download and does not substitute a filtered or prettified preview.
- Response-panel summary and footer no longer parse or split the body during ordinary rendering; pretty-copy work occurs only after an explicit Copy action.
- The guard affects Preview only. Headers, cookies, timeline, tests, response history, deletion/clearing, and the explicit raw/pretty/debug/HAR footer actions remain available.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Warning layout, focus order, download prompting, and session-reveal interaction are compile- and source-verified only in this phase.

## Acceptance boundary

Brunomnia still receives and persists the complete decoded UTF-8 body in memory before Preview sees it. This reduces renderer CPU/DOM pressure but is not file-backed or load-on-demand storage, does not preserve compressed/raw bytes, and cannot produce byte-exact binary downloads. The 100 MiB guard is intentionally absolute rather than inheriting the upstream module-global bypass edge case.
