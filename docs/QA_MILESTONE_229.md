# Milestone 229 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: retain one reusable project-scoped MCP HTTP connection across discovery and invocation, expose explicit termination, and recover one server-rejected session without persisting transport state.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `activeConnectionContexts` owns one long-lived client per MCP request resource. Primitive list/call/read functions retrieve and reuse that client instead of initializing one transport for every action.
- Insomnia's lockfile resolves `@modelcontextprotocol/sdk` `1.29.0`. Its exact `StreamableHTTPClientTransport` retains the optional session ID, sends `Mcp-Session-Id` and the negotiated `Mcp-Protocol-Version`, and keeps a logical client when the server is stateless.
- The locked SDK's `terminateSession()` sends `DELETE`, treats protocol-defined `405 Method Not Allowed` as a valid unsupported-termination result, and clears its local ID. Pinned disconnect calls termination when available and closes the client even if termination fails.
- The same transport opens an optional long-lived GET event stream and applies two bounded event-ID reconnection attempts. M229 does not claim that separate streaming lifecycle.

## Implementation

- HTTP initialization is retained in a 100-entry least-recently-used in-memory registry keyed by catalog project plus MCP client. Session IDs never enter workspace, folder/Git, encrypted-sync, or browser storage.
- Both stateful and stateless servers reuse the initialized logical connection. Session IDs are capped at 4,096 bytes and reject NUL/CR/LF before caching; all post-initialize, cancellation, and termination requests carry protocol version `2025-06-18`.
- A stateful operation receiving HTTP `404` discards the rejected session, initializes one replacement, and retries that operation once. A second failure remains visible rather than looping.
- **Disconnect** clears local state before a five-second credential-preserving `DELETE`. `404`, `405`, other statuses, and transport failure stay visible in the event console but cannot leave a stale local connection.
- Disabling or deleting a client and changing its endpoint, transport, headers, or authentication configuration trigger the same best-effort disconnect. Catalog project IDs scope sessions so imported duplicate client IDs cannot cross project boundaries.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused MCP/session frontend suites | Passed: 4 files, 22 tests |
| Full Vitest suite | Passed: 80 files, 582 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 69.51 kB Integration workbench, 433.89 kB main, byte-identical 16,449,585-byte CLI |
| Session lifecycle coverage | Passed: deterministic stateful/stateless reuse, project isolation, protocol/session headers, explicit DELETE, 404 replacement, oversized-ID rejection, and a real loopback lifecycle |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors; generated CLI unchanged |

No Rust/native or generated CLI behavior changed. Milestone 228 remains the latest full native gate.

## Manual/rendered QA

The local browser restriction prevents a rendered interaction claim. Deterministic fixtures plus a disposable real loopback server cover the complete state machine without external MCP credentials or providers.

## Remote gate

Main commit `08e143ed64fc8dfe97596ccd6a6222e8d939853f` completed verify and publish in [Actions run 29709192682](https://github.com/sherwoodlee/Brunomnia/actions/runs/29709192682). Node 22 rebuilt the generated CLI, passed the freshness and non-root no-network trust smoke, and published AMD64/ARM64 provenance/SBOM manifests at:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:a9fab0de523d3efc080ce0107e855754a54a91b654a45f662b011ef27f06ee75
```

Independent `cosign verify` passed issuer `https://token.actions.githubusercontent.com` and the exact `cli-container.yml@refs/heads/main` identity, validated the M229 commit and digest claims plus the trusted certificate chain, and found transparency-log entry `2204537846`.

## Acceptance boundary

M229 closes reusable HTTP initialization, project-scoped session/protocol headers, explicit termination, and bounded server-rejected session replacement. Recursive/conditional schema forms, long-lived GET/POST SSE resumption/reconnect, elicitation and reviewed sampling UI, notification response UI, persistent STDIO sessions, multiple authorization-server failover, DPoP, live third-party fixtures, and OS-keychain-wrapped runtime credentials remain. MCP clients stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
