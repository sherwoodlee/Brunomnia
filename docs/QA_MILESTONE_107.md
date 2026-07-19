# Milestone 107 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: reconcile Brunomnia's request-body surface with the pinned Insomnia model, add missing row controls and body-rendering policy, preserve those controls through interchange/history, and verify native multipart/binary wire behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `RequestBody` exposes MIME type, raw text, one file path, or body parameters. `RequestBodyParameter` exposes name, value, description, disabled state, multiline boolean/content-type string, filename, and type; it does not expose arbitrary per-part headers.
- The pinned URL-encoded and multipart editors both use the ordered key-value editor with multiline editing and descriptions; multipart additionally permits files. The network builder maps a multiline content-type string onto a text part and infers file MIME from its path.
- `settingDisableRenderRequestBody` and v5 `settings.renderRequestBody` control whether body values are templated independently from the rest of the request.
- Brunomnia retains approved file bytes instead of the absolute source path. That keeps the workspace portable and bounded by explicit user selection, but does not reproduce an environment-templated filesystem path.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 53 files, 341 tests |
| Focused body/editor/storage/interchange suite | Pass — 6 files, 62 tests |
| Focused native HTTP-body suite | Pass — 7 tests |
| Vite production build | Pass — 191 modules; main JavaScript 497.77 kB with no warning; lazy body editor 6.61 kB |
| Startup bundle change | Pass — main JavaScript reduced from 499.79 kB to 497.77 kB |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 76 tests with localhost bind access |
| macOS Tauri debug `.app` bundle | Pass — app-only packaging plus executable and `Info.plist` checks |
| Changed-path whitespace checks | Pass |

## Focused coverage

- One lazy chunk now owns URL-encoded and multipart row editing. Rows retain authored order and expose enablement, Text/Multiline/File modes where applicable, descriptions, up/down movement, add/remove, selected files, filenames, and content types.
- Pure editor tests prove mode identity, text/multiline metadata continuity, file-state clearing across incompatible mode changes, and bounded row movement.
- Workspace v27 persists a default-on `renderBodyTemplates` policy. Direct Tauri sends and browser development prove literal versus resolved body values; CLI and code generation use the same branch.
- The body-only policy covers raw text, GraphQL variables, URL-encoded names/values, and multipart names/values/filenames/content types without disabling URL/header/auth/transport rendering.
- Historical snapshots created before v27 restore with rendering enabled. Workspace migration retains an explicit false value and normalizes malformed multipart multiline flags.
- Insomnia v4/v5 round trips prove request rendering policy, URL-encoded and multipart disabled state, descriptions, multiline editing/content type, and order. Postman form descriptions and multiline text are retained.
- Native request construction proves exact binary `00 01 ff` bytes, saved MIME defaulting, and explicit Content-Type precedence.
- A real HTTP/1.1 loopback captures the production reqwest multipart request and proves boundary-bearing Content-Type, enabled multiline JSON text, edited file name/MIME, disabled omission, exact `00 ff 0a 0d` file bytes, and successful response decoding.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. No screenshot, DOM, console, or visual-interaction claim is made. Verification is limited to pinned source inspection, focused model/wire tests, strict TypeScript/Rust gates, full frontend/native suites, production/CLI builds, and desktop app packaging.

## Acceptance boundary

Brunomnia's packaged Tauri path now covers the pinned request-body controls and native wire behavior recorded above. Absolute file paths selected by a source client are intentionally converted to approved stored bytes, so dynamically templated filesystem body paths remain open. Browser-development `FormData` cannot attach a custom MIME type to a text part without file-shaped Blob semantics, and broader third-party multipart encoding matrices remain unverified. The request-body parity row therefore remains `Baseline`, and Brunomnia is not yet declared feature-complete.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
