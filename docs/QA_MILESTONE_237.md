# Milestone 237 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add negotiated MCP resource subscribe/unsubscribe behavior across HTTP and persistent STDIO, including idle STDIO notification delivery, and remove two OAuth requirements contradicted by the exact pinned Insomnia runtime.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-data/src/models/mcp-request.ts` keeps connection-local `subscribeResources`; `mcp-pane.tsx` exposes Subscribe/Unsubscribe only when the initialized server advertises `capabilities.resources.subscribe` and only for ordinary resources.
- Pinned `packages/insomnia/src/main/mcp/client-requests.ts` sends `resources/subscribe` and `resources/unsubscribe` with the resource URI. `main/network/mcp.ts` clears subscriptions during graceful connection close, and resource-updated notifications remain in the MCP notification/event views.
- The exact locked `@modelcontextprotocol/sdk` `1.29.0` implementation selects `authorization_servers[0]`. Its shared schema parses DPoP metadata, but its client auth path generates no DPoP key/proof and exposes no DPoP provider hook; pinned `McpOAuthClientProvider` likewise implements none. Multiple authorization-server failover and DPoP are therefore false parity requirements, not Brunomnia omissions.

## Implementation

- HTTP initialization records negotiated subscription support beside the bounded project/client session. STDIO returns the initialization capabilities from native state; both transports keep at most 5,000 subscribed URIs in connection-local device memory and clear them with disconnect, replacement, observed fatal transport failure, or eviction.
- `setMcpResourceSubscription` validates bounded URIs, refuses disconnected or unsupported servers before transport, sends the exact subscribe/unsubscribe method through the existing session recovery/authentication path, and mutates local state only after a successful protocol result.
- The resource operation pane shows Subscribe/Unsubscribe only for an ordinary resource on a connected server that advertised support. Resource templates remain excluded. Successful changes preserve OAuth client updates, append event evidence, refresh connection-local state, and remain account-free.
- Persistent STDIO now has one dedicated output dispatcher. It routes matching JSON-RPC responses to request waiters, registers reviewed server requests before emission, answers roots, processes server cancellation, emits idle notifications, preserves a bounded fallback queue only when live channel delivery fails, and propagates fatal parse/read/write state to every waiter and the renderer.
- Unexpected idle transport failure immediately clears matching renderer connection/subscription state. Native registry checks treat the failed entry as disconnected and replace it before the next operation; intentional close suppresses a false transport-error event.
- Native STDIO accepts `resources/subscribe` and `resources/unsubscribe`, retains monotonically increasing IDs, and returns negotiated server capabilities with every operation. Existing cancellation, concurrent server-response, roots, stderr, process replacement, and fatal cleanup behavior remains intact.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused MCP subscription suites | Passed: 3 frontend files, 22 tests; 2 real-child idle-dispatch/fatal-replacement regressions |
| Full Vitest suite | Passed: 80 files, 599 tests |
| Full native suite | Passed: 126 tests; 1 public-fixture test ignored |
| Packaged CLI template and runner smokes | Passed |
| Rust formatting, clippy, and check | Passed |
| Clean TypeScript/Vite/CLI production build | Passed: 530 modules; 177.47 kB CSS, 99.16 kB Integration workbench, 434.16 kB main, 16,449,664-byte CLI |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

The full frontend/native suites and packaged CLI smokes ran with loopback access because their disposable MCP, HTTP, and protocol fixtures bind local sockets. The real STDIO fixtures prove idle notification and reviewed-request routing, exact subscription calls, unexpected idle parse-failure reporting, immediate disconnected state, stale-child replacement, and intentional-close suppression. The HTTP fixture proves negotiated subscription calls retain the same live session. The generated CLI remains byte-identical at SHA-256 `2ec54c299ee0b366e88d061454cd6745df3e425bfe787bb4b8938d002d671fe9` because this milestone changes desktop MCP transport and renderer integration only.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. Deterministic native-channel, real-child, and raw-loopback fixtures verify negotiation, exact methods, state transitions, session reuse, disconnect cleanup, and post-operation idle delivery without external MCP credentials.

## Remote gate

Main commit `3a47a3836d4b10245dab899c9bb061820b753596` completed verify and publish in [Actions run 29714930962](https://github.com/sherwoodlee/Brunomnia/actions/runs/29714930962). Node 22 rebuilt the generated CLI, passed freshness plus non-root/no-network trust smokes, and published AMD64/ARM64 provenance/SBOM manifests at:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:30bcf49cdf6bfac9fac99915b8b032cf0576497892cd11bce5a110b82cbdac9c
```

Independent manifest inspection resolved AMD64 `sha256:f8b5252995278e74b4b9019b7c0f6c048dd9ed5a5cb01fa54d2d18db52654678`, ARM64 `sha256:bf9f84c4af63f42d0242c2f08eff2d872eac2ac59da059c2913326d99876183c`, and their attached attestation manifests. Independent `cosign verify` passed issuer `https://token.actions.githubusercontent.com` and exact identity `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, validated the M237 commit and published digest claims plus the trusted certificate chain, and found transparency-log entry `2204742679`.

## Acceptance boundary

M237 closes the named MCP resource-subscription and idle-STDIO-notification gaps and corrects the false authorization-server failover/DPoP requirements. Persistent MCP response/timeline/notification history, dedicated event filtering, live third-party compatibility evidence, and OS-keychain-wrapped runtime credentials remain. MCP clients stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
