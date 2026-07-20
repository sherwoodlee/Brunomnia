# Milestone 230 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: retain one reusable project-scoped MCP STDIO process across discovery and invocation, preserve it through protocol cancellation, and expose explicit process termination without claiming the remaining interactive MCP surface.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `main/mcp/common.ts` stores one ready connection context and MCP `Client` per MCP request resource. Primitive list/call/read functions retrieve that client instead of reconnecting for each operation.
- Pinned `main/network/mcp.ts` creates one transport, connects it once, retains it after initial primitive discovery, and closes the client on explicit disconnect. STDIO does not use HTTP session termination but follows the same retained-client lifecycle.
- Pinned `main/mcp/transport-stdio.ts` creates one SDK `StdioClientTransport`, captures persistent stderr, and leaves process shutdown to `client.close()`. The root lock resolves `@modelcontextprotocol/sdk` `1.29.0`.
- Pinned STDIO also accepts reviewed per-request environment overrides and a shell-resolved `PATH`. Brunomnia does not yet expose that editor/interchange surface, so M230 records it as a remaining MCP gap rather than overstating parity.

## Implementation

- Renderer calls carry one deterministic catalog-project/client session key. Native state retains at most 100 initialized direct-child processes, rejects oversized or NUL-containing 512-byte session keys, and refuses a 101st active key instead of silently evicting another client.
- Each retained process serializes operations through one session lock and assigns monotonically increasing JSON-RPC IDs after initialization. Executable and argument fingerprints replace stale sessions defensively; roots remain request-current.
- **Disconnect** clears renderer state first, then terminates the child on a blocking worker, waits for exit, and joins stdout/stderr readers. Disabling/deleting a client and changing connection settings use the same path.
- Active cancellation sends `notifications/cancelled` for the exact request, stops waiting within 50 ms, and retains the initialized process. A post-cancel native probe reconciles renderer state if cancellation races process exit. A normal server JSON-RPC error is also reusable.
- Process exit, malformed protocol output, timeout, stream-limit exhaustion, or another fatal transport error removes the native session. The next user operation starts clean; the failed operation is never retried silently.
- Renderer connected state is recorded only after a reusable native result and includes the executable/argument fingerprint. Spawn failure and fatal non-cancellation errors cannot leave a false connected marker.
- Cumulative retained-session output remains bounded to 20 MB stdout and 10 MB stderr. The pre-existing no-session-key native path remains one-shot for compatibility, while the desktop renderer always supplies a scoped persistent key.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused MCP renderer/workbench suites | Passed: 3 files, 24 tests |
| Focused native MCP STDIO suite | Passed: 8 tests, including real reuse, cancellation retention, explicit restart, and fatal-protocol recovery fixtures |
| Full Vitest suite | Passed: 80 files, 585 tests |
| Full native suite | Passed: 116 tests; 1 public-fixture test ignored |
| Rust formatting, clippy, and check | Passed |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 70.83 kB Integration workbench, 433.89 kB main, byte-identical 16,449,585-byte CLI |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors; generated CLI unchanged |

The full frontend and native suites ran with loopback access because MCP HTTP and unrelated native protocol fixtures bind disposable local sockets. An app-only debug bundle passed. A broader debug packaging attempt had already produced the app before the optional DMG wrapper failed; M230 does not claim a DMG packaging gate.

## Manual/rendered QA

The local browser restriction prevents a rendered interaction claim. Deterministic renderer mocks plus real disposable Unix child processes cover stable project identity, process reuse, monotonic calls, retained-process cancellation, explicit close/restart, fatal cleanup, spawn-failure state, and configuration fingerprinting without external MCP credentials or providers.

## Remote gate

Pending the first push of the M230 implementation commit to `main`.

## Acceptance boundary

M230 closes persistent project/client-scoped STDIO initialization, serialized process reuse, retained-process cancellation, explicit/configuration-triggered termination, and fatal-session cleanup. Recursive/conditional schema forms, long-lived GET/POST SSE resumption/reconnect, reviewed per-client STDIO environment overrides, elicitation and reviewed sampling UI, notification/server-request response UI, multiple authorization-server failover, DPoP, live third-party fixtures, and OS-keychain-wrapped runtime credentials remain. MCP clients stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
