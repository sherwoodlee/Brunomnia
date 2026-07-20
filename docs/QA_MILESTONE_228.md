# Milestone 228 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: close active MCP discovery and invocation cancellation for HTTP and STDIO while preserving explicit persistent-session and interactive server-request gaps.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `event-log-view.tsx` marks pending outgoing MCP events and exposes **Cancel Request** with the owning MCP request ID plus exact JSON-RPC message ID.
- Pinned `main/mcp/common.ts` retains one `AbortController` per pending message ID, while `main/network/mcp.ts` injects that signal into each SDK request and removes the controller after settlement.
- Connection shutdown has a separate connection-level controller. Brunomnia therefore closes operation cancellation without claiming pinned persistent connection, reconnect, long-lived stream, or server-request response behavior.

## Implementation

- HTTP initialization, paginated discovery, and primitive invocation receive one workbench-owned `AbortSignal`. Canceling aborts the active native HTTP exchange and makes discovery rethrow cancellation instead of converting it into an optional-list warning.
- Every non-notification HTTP JSON-RPC request registers a one-shot abort listener that dispatches a detached `notifications/cancelled` message with its exact request ID and current `Mcp-Session-Id`. The cancellation path has a five-second deadline, disables redirects/cookies/plugins/new OAuth acquisition, and never masks local cancellation if delivery fails.
- STDIO calls carry the same bounded cancellation identity through Tauri. A race-safe native registry covers cancellation before or after call registration, polls at 50 ms, emits `notifications/cancelled` for the pending request, kills the fresh child, waits for it, and joins stdout/stderr readers.
- The integration workbench exposes **Cancel MCP operation** only while MCP discovery or invocation is active, aborts on unmount, reports manual cancellation without an error banner, and retains a bounded local event for that manual action.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused MCP frontend suites | Passed: 3 files, 17 tests |
| Full Vitest suite | Passed: 79 files, 577 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 64.23 kB Integration workbench, 433.88 kB main, byte-identical 16,449,585-byte CLI |
| Focused native MCP suite | Passed: 5 tests, including live Unix child termination |
| Full native suite | Passed: 113 tests; 1 public-fixture test ignored |
| Rust formatting, clippy, and check | Passed |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app` |

The full native suite ran with loopback access because unrelated HTTP, streaming, mock, OAuth, gRPC, and Git fixtures bind local sockets. All executable native tests passed.

## Manual/rendered QA

The local browser restriction still prevents a rendered interaction claim. Deterministic frontend transport fixtures and a real disposable STDIO child prove the cancellation lifecycle; no external MCP credentials or server are required.

## Remote gate

Main commit `d1ee8bc997f7c282692e396367398d307706e24a` completed verify and publish in [Actions run 29708689281](https://github.com/sherwoodlee/Brunomnia/actions/runs/29708689281). Node 22 rebuilt the generated CLI, passed its freshness check, and ran the non-root read-only smoke with `--network none`, standalone suites, and explicitly granted TypeScript config/plugin tags. The publish job produced signed AMD64/ARM64 provenance/SBOM manifests at:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:f5a1e0e7dbd186966cb4108eeb63768fd35bc6f494606075e5eb89b8f8c4cd2e
```

Independent `cosign verify` passed issuer `https://token.actions.githubusercontent.com` and the exact `cli-container.yml@refs/heads/main` identity, validated the M228 commit and digest claims plus the trusted certificate chain, and found transparency-log entry `2204514896`.

## Acceptance boundary

M228 closes active HTTP and fresh-process STDIO discovery/invocation cancellation. Milestone 229 later adds reusable project-scoped HTTP connections, protocol/session headers, explicit termination, and bounded expired-session replacement; Milestone 230 adds persistent project/client-scoped STDIO sessions, explicit termination, retained-process cancellation, and fatal-session cleanup. Recursive/conditional schema forms, long-lived GET/POST SSE resumption/reconnect, reviewed per-client STDIO environment overrides, elicitation and reviewed sampling UI, notification response UI, multiple authorization-server failover, DPoP, live third-party fixtures, and OS-keychain-wrapped runtime credentials remain. MCP clients stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
