# Milestone 43 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: capture an independent editable request version with each newly persisted response, restore matching versions when historical responses are selected, and restore the newest remaining version after single-response deletion.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [response history dropdown](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/dropdowns/response-history-dropdown.tsx) resolves each response's `requestVersionId` and restores that request version before activating the response; the [single-response delete action](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/routes/organization.%24organizationId.project.%24projectId.workspace.%24workspaceId.debug.request.%24requestId.response.delete.tsx) restores the latest remaining request version after deletion; and entries without a request-version ID remain explicitly response-only in the upstream UI.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 31 files, 194 tests |
| Vite production build | Pass — 159 modules; 499.96 KB / 499,964-byte main JavaScript chunk; 939-byte lazy historical-request validator/restorer; no chunk-size warning |
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

- New direct-send, collection-run, and script-subrequest response records carry a structured-cloned request snapshot independent from later edits.
- Snapshot coverage includes every editable request field already present in `ApiRequest`: method/protocol, URL, parameters, headers, body, auth, GraphQL/gRPC/stream configuration, scripts, documentation, transport policy, and source metadata.
- Selecting a saved response restores its matching request snapshot before the next edit while retaining the stable current request ID and folder placement.
- Deleting the selected response restores the newest remaining visible request version when one exists; clearing environment history intentionally leaves the current request unchanged.
- Missing snapshots and snapshots with a mismatched request ID remain response-only.
- Runtime structural validation rejects malformed snapshots before they can replace an editable request.
- The asynchronous restore checks the active request ID again after loading its validator, preventing a late result from modifying a request the user switched to.
- Migration preserves valid local snapshot data, while response history and its snapshots remain omitted from managed projects and encrypted-sync revisions.
- The validator is dynamically imported only when restoration is requested, keeping the main production chunk below Vite's 500 kB warning threshold.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Historical selection, focus behavior, and visual feedback are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

Legacy response entries cannot reconstruct request versions they never stored. Restoration deliberately preserves current collection/folder placement and does not time-travel the selected environment, cookies, plugin state, local vault session, or project branch. Response comparison/export/search and persistent WebSocket/SSE histories remain open.

Milestone 150 later aligns restoration with the pinned ignore list by also preserving the current request name, documentation/description, and source linkage. It also records the response's bounded pre/post-script assertions, cookie policy, and environment identities. The legacy response-only behavior above remains intentional pinned compatibility, not a reconstruction gap.
