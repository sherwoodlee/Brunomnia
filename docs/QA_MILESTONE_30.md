# Milestone 30 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: selectable device-local response history with finite, zero, unlimited, and active-environment-scoped retention.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [settings defaults](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) define 20 responses and environment filtering off, the [settings UI](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) documents `-1` as retain-all, and the [request loader](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.tsx) filters histories by active environment.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 25 files, 147 tests |
| Vite production build | Pass — 154 modules; 482.62 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 482,355-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 24 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Every verification and packaging gate used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- New devices and migrated data default to 20 saved responses per request with environment filtering off; imports reset both values.
- New stored entries include unique local IDs and active-environment identity. Legacy entries receive deterministic IDs without inventing an environment association.
- The pure retention policy covers positive limits, zero persistence, `-1` unlimited storage, per-request isolation, and optional per-environment scopes.
- The response selector lists eligible entries newest first and restores saved body, header, timing, status, URL, size, and protocol evidence.
- Selecting another request or changing the active environment under filtering restores the newest eligible response instead of leaking the prior request's display.
- Response template tags use only the active environment when filtering is enabled.
- Main sends, collection runs, and secondary script requests share the retention policy; cookie/response chaining retains newest-first behavior.
- Managed project and encrypted-sync merges preserve device-local history and preferences, while shareable payloads omit stored responses.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The Preferences controls and response selector are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

This evidence accepts a response-history retention/filtering baseline. Individual response deletion, pinning, comparison, export, search, request-version snapshots, and response body size/pre-allocation controls remain open in [PARITY.md](PARITY.md). `-1` can grow the device-local workspace file without a storage quota; that is explicit user-controlled behavior.
