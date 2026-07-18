# Milestone 42 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: persisted response-history actions for deleting the selected saved response and clearing the active request/environment history, with deterministic response-panel fallback and preservation of unrelated scopes.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [response history dropdown](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/dropdowns/response-history-dropdown.tsx) exposes Delete Current Response and Clear History; the [single-response action](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/routes/organization.%24organizationId.project.%24projectId.workspace.%24workspaceId.debug.request.%24requestId.response.delete.tsx) removes the selected response and activates the latest remaining response; and the [clear action](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/routes/organization.%24organizationId.project.%24projectId.workspace.%24workspaceId.debug.request.%24requestId.response.delete-all.tsx) scopes removal to the active request and environment.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 31 files, 190 tests |
| Vite production build | Pass — 158 modules; 499.63 KB / 499,631-byte main JavaScript chunk; no chunk-size warning |
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

- Delete removes only the selected persisted response ID and leaves every other saved response untouched.
- Clear removes all saved responses for the active request and active environment, including when cross-environment display is enabled.
- Clear preserves the same request's history from other environments and every other request's history.
- After either action, the panel selects the newest remaining response allowed by the current environment filter; if none remains it returns to an empty response state.
- Delete is disabled without a selected saved response. Clear reports the active-environment count and is disabled at zero.
- Both action buttons carry explicit accessible names.
- Existing finite, zero, unlimited, environment-filtered visibility, response-template, and retention semantics remain unchanged.
- Response history remains device-local and omitted from managed projects and encrypted-sync payloads.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Button focus order, visual fit, and pointer interaction are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

This baseline covers ordinary persisted HTTP/GraphQL/gRPC response entries already supported by Brunomnia's history store. Selecting a historical response does not restore the request version that produced it. Response compare/export/search and persistent WebSocket/SSE history actions remain open.
