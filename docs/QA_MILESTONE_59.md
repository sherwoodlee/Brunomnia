# Milestone 59 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: reproduce current Insomnia's default-on clickable HTTP(S) links in friendly JSON and Source Code response viewers, including its device-local disable preference, while keeping Raw Data inert and confining the desktop external-open boundary.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. The current [settings model](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia-data/src/models/settings.ts) defaults `disableResponsePreviewLinks` to false, [General preferences](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/settings/general.tsx) labels it Disable links in response viewer, and the [response viewer](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/viewers/response-viewer.tsx) applies the choice to friendly JSON and source CodeEditor callbacks. Raw mode has no callback, and HTML uses the separate response WebView.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 42 files, 251 tests |
| Vite production build | Pass — 170 modules; 497.68 KB / 497,677-byte main JavaScript chunk; 19,411-byte response-preview chunk; 17,764-byte preferences chunk; 4,212-byte response-download chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 521,998-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 28 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 29-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- The exact upstream preference label defaults false, accepts only literal true, persists locally, resets on import, and participates in Restore defaults.
- Friendly JSON and Source Code linkify absolute HTTP(S) text; Raw Data and disabled mode render the unchanged line.
- Surrounding text and trailing punctuation remain byte-for-character identical in the rendered code line.
- XML `&amp;`, `&quot;`, `&lt;`, and `&gt;` are decoded only in the opened target, matching upstream's XML-specific callback behavior.
- URL validation rejects empty, malformed, `javascript:`, `file:`, and over-8-KiB values in both renderer and native layers.
- At most 100 targets per line become buttons; overflow remains ordinary response text.
- The native command uses `std::process::Command` argument vectors for macOS `open`, Windows `rundll32`, or Linux `xdg-open`, never a command shell.
- Native spawn/validation errors are visible and do not navigate the Brunomnia application WebView.
- The feature is neither account-gated nor subscription-gated and does not alter response bodies, filters, history, copies, or exports.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Button activation, default-browser launch, focus styling, popup policy, and platform opener integration are compile-, unit-, prop-wiring-, and bundle-verified only in this phase.

## Acceptance boundary

The dependency-free linker does not reproduce CodeMirror's complete URL recognition or editor gestures. It recognizes absolute HTTP(S) text only; relative strings are not made clickable. The macOS command path is compiled and packaged, while Windows and Linux opener paths require release-host integration fixtures. Automatic remote resources in the original HTML response document remain a separate parity gap.
