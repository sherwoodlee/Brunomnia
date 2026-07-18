# Milestone 36 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: device-persistent bulk request-header and query-parameter editors with current-compatible line parsing and safe workspace migration.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [settings defaults](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) default `useBulkHeaderEditor` and `useBulkParametersEditor` off; the [request pane](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/panes/request-pane.tsx) persists direct Bulk Edit/Regular Edit toggles; and the [header](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/editors/request-headers-editor.tsx) and [parameter](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/editors/request-parameters-editor.tsx) editors serialize enabled nonblank rows and parse one first-colon-delimited pair per nonblank line.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 28 files, 179 tests |
| Vite production build | Pass — 157 modules; 495.08 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 519,159-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 24 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Every verification and packaging gate uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- New devices, legacy workspaces, and imported workspaces default both bulk modes off; only literal stored booleans can enable them.
- Header and query tabs toggle the device preferences directly, so the chosen editor mode follows the user across requests without entering shareable project data.
- Formatting retains enabled nonblank rows in order and preserves duplicates while omitting disabled and fully blank rows.
- Parsing trims names/values, splits only at the first colon, ignores blank lines, keeps name-only rows, and creates enabled request rows in source order.
- The controlled bulk surface retains the user's draft spacing while synchronizing when a different request or regular-row edit changes the semantic rows.
- HTTP, GraphQL, WebSocket, and Event Stream request headers use the same bulk surface; query parameters remain the shared ordered request model.
- Workspace v18, project serialization, replacement/merge imports, and Brunomnia export/import round trips agree on the new schema version.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The request-pane toggles and editor layout are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

Bulk text cannot represent disabled rows or descriptions. Matching current Insomnia, the first bulk edit replaces those fields with enabled name/value rows. Brunomnia does not claim upstream CodeMirror template highlighting/autocomplete in this surface, and path parameters, gRPC metadata, folder headers, and environment rows remain structured. These bounds remain open in [PARITY.md](PARITY.md).
