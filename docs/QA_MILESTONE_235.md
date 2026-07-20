# Milestone 235 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: replace buffered MCP HTTP response handling with bounded native Streamable HTTP POST/GET SSE lifecycles, event-ID resumption, pinned reconnect behavior, live event delivery, and deterministic cleanup.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/main/mcp/transport-streamable-http.ts` delegates HTTP MCP connections to the exact locked `@modelcontextprotocol/sdk` `1.29.0` `StreamableHTTPClientTransport` and starts its optional GET stream after `notifications/initialized` is accepted.
- The locked SDK treats GET `405` as expected and nonfatal, reconnects GET streams, and resumes a POST response only when an SSE event ID primed that still-unanswered request. Resume uses GET plus `Last-Event-ID`, never a replayed POST, and stops as soon as the matching JSON-RPC response arrives even if the original POST remains open.
- Locked defaults start at one second, multiply by `1.5`, cap at 30 seconds, allow two retries, and honor the server's SSE `retry` field. Brunomnia implements that observable lifecycle without importing Electron or the SDK runtime.

## Implementation

- The shared HTTP renderer still owns template/vault/file resolution, plugin hooks, OAuth acquisition, calculated headers, API-key/auth signing, cookies policy, proxy selection, certificate validation, client identity, redirect policy, timeout preference, and HTTP-version preference. Only the fully prepared MCP request enters the dedicated native streaming transport; nested OAuth token requests deliberately remain finite ordinary HTTP.
- Native POST handling reads JSON finitely or SSE incrementally, returns immediately on the matching result/error, retains earlier notifications for the existing operation event parser, and never waits for server EOF after that match. An unfinished POST reconnects only with a valid latest event ID, through GET and `Last-Event-ID`, for at most two attempts.
- Accepted `notifications/initialized` starts one optional project/client-scoped GET task. It treats `405` as an informational completion, emits JSON notifications and reconnect state live to the integration console, refreshes its renderer channel on later calls, preserves event IDs, respects bounded server retry, and stops after two retries.
- The native registry holds at most 100 GET tasks. Explicit disconnect, configuration replacement, logical-session eviction, and app teardown paths drop the corresponding task; per-operation cancellation drops the exact response reader while preserving the reusable session and detached protocol cancellation notification.
- Bounds cap session keys and event IDs at 8,192 bytes, server session IDs at 4,096 bytes, each SSE event at 4 MiB, and one POST exchange at 1,000 messages plus 8 MiB of cumulative body/message data. Header and finite-body reads retain the existing 30-second MCP deadline; active SSE bodies remain cancellation/reconnect driven.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused MCP HTTP frontend/native suites | Passed: 2 frontend files, 32 tests; 6 native lifecycle tests |
| Full Vitest suite | Passed: 80 files, 593 tests |
| Full native suite | Passed: 124 tests; 1 public-fixture test ignored |
| Packaged CLI template and runner smokes | Passed |
| Rust formatting, clippy, and check | Passed |
| Clean TypeScript/Vite/CLI production build | Passed: 529 modules; 176.45 kB CSS, 86.40 kB Integration workbench, 434.16 kB main, 16,449,664-byte CLI |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

The full frontend/native suites and packaged CLI smokes ran with loopback access because their disposable MCP, HTTP, and protocol fixtures bind local sockets. The generated CLI remains byte-identical at SHA-256 `2ec54c299ee0b366e88d061454cd6745df3e425bfe787bb4b8938d002d671fe9` because this milestone changes desktop MCP transport and renderer integration only. The accepted Tauri gate used `--bundles app`; the broader local command also rebuilt the app but its optional DMG script was unavailable, so M235 makes no DMG claim.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. Deterministic raw-loopback fixtures hold POST and GET sockets open, force EOF and HTTP failures, inspect request methods and headers, and capture native channels; strict React/TypeScript compilation and the rebuilt packaged app verify the renderer boundary without external MCP credentials or providers.

## Remote gate

Pending implementation commit publication, workflow completion, signed GHCR inspection, and independent exact-identity verification.

## Acceptance boundary

M235 closes the named long-lived MCP GET/POST SSE resumption and reconnect gap. It does not add response controls for server-initiated JSON-RPC requests, elicitation, reviewed sampling, multiple authorization-server failover, DPoP, live third-party fixtures, or OS-keychain-wrapped runtime credentials. MCP clients stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
