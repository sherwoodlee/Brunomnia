# Milestone 231 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add reviewed per-client MCP STDIO process environments, isolate direct children from unrelated ambient variables, and restart persistent sessions when resolved environment configuration changes.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `insomnia-data/src/models/mcp-request.ts` stores ordered `EnvironmentKvPairData` on every MCP request. The STDIO request pane alone exposes a text-only **Environment** editor and locks it while connected.
- Pinned `mcp-url-bar.tsx` renders enabled environment rows through the active Insomnia environment before opening the connection.
- Pinned `main/mcp/transport-stdio.ts` filters blank names and creates the SDK `StdioClientTransport` with an explicit environment containing shell-resolved `PATH` plus reviewed values instead of the complete Electron process environment.
- Pinned Insomnia v5 interchange retains MCP environment rows. Brunomnia's first-class Insomnia MCP-resource import/export remains a separate open gap; M231 covers its own v38 JSON and split-YAML persistence without claiming that interchange closure.

## Implementation

- Workspace v38 adds up to 100 ordered enabled/disabled text rows to each MCP client. Local JSON, scoped Brunomnia export/import, duplicate projects, and split-YAML `mcp-clients/` files preserve row IDs, order, enabled state, and protected references.
- The disconnected STDIO editor exposes add, enable, name, value, and remove controls. A connected process must be disconnected before rows can be edited, matching the pinned locked-while-connected lifecycle.
- Enabled names and values render immediately before native dispatch through the selected project environment and existing prompt, file, local-vault, and external-vault template boundaries. Blank rendered names are omitted and the last enabled duplicate name wins.
- Sensitive token/password/secret/API-key/private-key names require a complete local-vault or approved external-vault reference before rendering. Workspace publication diagnostics report plaintext sensitive process variables alongside existing MCP credentials.
- Native spawn clears ambient variables, restores only the app's current `PATH`, then applies reviewed rows. A reviewed `PATH` overrides the default. Names reject NUL/`=`, values reject NUL, and native bounds enforce 512-byte names, 32,768-byte values, 100 variables, and 1 MB combined input.
- Resolved environment values join executable and arguments in the native persistent-session fingerprint. A changed row, vault result, or selected project environment closes the old process and initializes one replacement before the next operation.
- The same isolated spawn helper covers the retained renderer path and the native no-session-key compatibility path. No environment value is written to event output, workspace runtime metadata, or error messages.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused MCP/model/security/interchange/workbench suites | Passed: 7 files, 95 tests |
| Focused native lifecycle and split-YAML checks | Passed: 9 tests, including clean environment, configured value, environment-fingerprint restart, explicit close, and YAML round trip |
| Full Vitest suite | Passed: 80 files, 587 tests |
| Full native suite | Passed: 116 tests; 1 public-fixture test ignored |
| Packaged CLI template and runner smokes | Passed |
| Rust formatting, clippy, and check | Passed |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 73.02 kB Integration workbench, 434.07 kB main, 16,449,664-byte CLI |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

The full frontend/native suites and packaged CLI smokes ran with loopback access because their disposable MCP, HTTP, and protocol fixtures bind local sockets. The generated CLI changed only through the expected workspace-v38 migration bundle rebuild.

## Manual/rendered QA

The local browser restriction prevents a rendered interaction claim. Deterministic renderer payload tests, workspace migration/security/interchange tests, a split-YAML native round trip, and a real Unix child prove disabled-row filtering, environment/vault rendering, duplicate handling, sensitive-value refusal, ambient-variable isolation, retained `PATH`, process restart, and persistence without external MCP credentials.

## Remote gate

Main commit `0908382a16a7a38091c21b7bae7fc740bd3c9252` completed verify and publish in [Actions run 29710330797](https://github.com/sherwoodlee/Brunomnia/actions/runs/29710330797). Node 22 rebuilt the generated CLI, passed the freshness and non-root no-network trust smoke, and published AMD64/ARM64 provenance/SBOM manifests at:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:ed0dc55dff5f3729ec461cb510bcc8fd8f59f17ebb783efe548a61d1ec185bab
```

Independent `cosign verify` passed issuer `https://token.actions.githubusercontent.com` and the exact `cli-container.yml@refs/heads/main` identity, validated the M231 commit and digest claims plus the trusted certificate chain, and found transparency-log entry `2204608149`.

## Acceptance boundary

M231 closes reviewed project-scoped STDIO environment rows, template/vault resolution, plaintext-sensitive-value refusal, ambient-environment isolation, bounded native dispatch, workspace v38 persistence, and environment-triggered persistent-process replacement. Exact login-shell `PATH` discovery and first-class Insomnia v4/v5 MCP-resource import/export remain. Recursive/conditional schema forms, long-lived GET/POST SSE resumption/reconnect, elicitation and reviewed sampling UI, notification/server-request response UI, multiple authorization-server failover, DPoP, live third-party fixtures, and OS-keychain-wrapped runtime credentials also remain. MCP clients and Import/export stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
