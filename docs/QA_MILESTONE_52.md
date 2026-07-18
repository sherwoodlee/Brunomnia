# Milestone 52 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: add exact-byte image, PDF, and audio response previews to Visual Preview with bounded local Blob URLs, explicit lifecycle/error states, and useful raw-export extensions.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The pinned [response viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-viewer.tsx) routes friendly `image/*` and `audio/*` bodies from its byte buffer and routes `application/pdf` to a dedicated component. The pinned [PDF viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-pdf-viewer.tsx) creates a Blob URL, embeds it in a titled iframe, and revokes the URL on cleanup. Brunomnia uses revocable Blob URLs for all three media families to avoid the upstream image/audio data-URL Base64 expansion while preserving the same user-visible capability.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 39 files, 231 tests |
| Vite production build | Pass — 167 modules; 497.35 KB / 497,345-byte main JavaScript chunk; 14,105-byte response-preview chunk; 4,212-byte response-download chunk; no chunk-size warning |
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

- Content-Type matching is case-insensitive, ignores parameters, accepts valid image/audio subtypes, recognizes only `application/pdf` for PDF, and rejects incomplete/unrelated values.
- The media artifact reconstructs the Phase 51 exact decoded entity bytes, including malformed UTF-8 that differs from the inspection string, and preserves the normalized MIME type on its Blob.
- Visual Preview routes images to a responsive contained image surface, PDFs to a titled full-height iframe, and audio to accessible native controls. Source Code and Raw Data do not allocate a media URL.
- Object URLs are created inside the media effect only after the outer 5/100 MiB guard permits rendering. Cleanup revokes the URL when the selected response, MIME type, mode, or component changes.
- Empty bodies, Blob/URL construction failures, and WebView media decode errors produce bounded visible messages rather than falling through to the text viewer.
- Media content is never inserted as HTML and does not trigger an application-level remote fetch. SVG stays in the browser's image context.
- Raw export retains exact bytes and derives `.bin`, `.pdf`, and common image/audio extensions; prettified JSON and textual diagnostics are unchanged.
- The media helper/component remains in the lazy response-preview chunk and extension mapping remains in the lazy response-download chunk. The main JavaScript chunk is byte-for-byte unchanged from Phase 51.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Actual image layout, operating-system PDF controls, audio playback/codecs, corrupt-media event behavior, focus order, and save prompting are compile-, source-, and artifact-byte-verified only in this phase.

## Acceptance boundary

Media routing follows the declared Content-Type and does not sniff file signatures. Available formats and controls depend on the macOS/Windows/Linux WebView; Brunomnia does not bundle codecs, a PDF engine, waveform/transcript tools, or media editing. The response body is still fully buffered before preview. Declared charset decoding, filesystem-backed/deferred bodies, byte-backed recursive multipart viewers, interactive HTML, and raw wire evidence remain explicit parity gaps.
