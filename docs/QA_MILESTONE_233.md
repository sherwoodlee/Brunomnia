# Milestone 233 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: replace the Insomnia MCP-to-HTTP downgrade with first-class v4/v5 MCP client import/export, collision-safe application, and explicit integration-authority stripping.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `insomnia-data/src/models/mcp-request.ts` defines one `McpRequest` with `stdio` or `streamable-http` transport, command/URL text, headers, generic request authentication, ordered text environment rows, roots, STDIO approval, subscriptions, connection state, and TLS/User-Agent controls.
- Pinned v4 import/export recognizes `_type: mcp_request` under an MCP-scoped workspace. Pinned v5 uses one `mcpClient.insomnia/5.0` document per MCP workspace, with one `mcpRequest`, environments, headers, authentication, transport, env rows, and roots.
- Pinned STDIO execution parses the stored command text with `shell-quote` and rejects operator objects. Brunomnia's separate executable/argument model therefore requires reversible quoting without ever interpreting imported shell operators.
- Pinned MCP auth UI supports Basic, OAuth 2/MCP auth flow, Bearer, and API-key headers. Runtime connection state, dynamic registration credentials, access/refresh/identity tokens, subscriptions, and STDIO approval are local authority rather than portable project configuration.

## Implementation

- Interchange artifacts now carry bounded first-class `McpClient` resources. Applying an artifact collision-safely rekeys client, header, and environment-row IDs before appending clients to the project; repeated imports remain distinct.
- V4 import extracts `mcp_request` resources instead of placing them in collection request trees, excludes MCP-only workspaces from fake collection creation, imports their public environment trees, and preserves ordinary mixed workspaces. V4 export emits one `scope: mcp` workspace, one native `mcp_request`, and one self-contained public environment tree per project client.
- V5 detection accepts `mcpClient.insomnia/5.0`; valid top-level documents and legacy nested MCP-shaped entries map to clients rather than HTTP placeholders. V5 export emits one schema-5.1 MCP document per project client with its own public environment copy. Identical imported environment trees deduplicate into Brunomnia's shared project environment model.
- HTTP/STDIO transport, URL, reversible quoted executable/arguments including spaces, apostrophes and empty arguments, enabled/disabled text env rows, headers, public OAuth configuration, API-key headers, and roots round-trip. MCP client imports are capped at 100.
- Imported clients are always disabled. Bearer/Basic/OAuth credential fields and runtime tokens are cleared; plaintext sensitive header/environment values are cleared while complete protected references survive. API-key plaintext is cleared. Unknown authentication warns and falls back to none.
- Imported STDIO control operators, substitutions, comments, redirections, newlines, malformed quotes, or oversized token arrays are never parsed as commands. The original bounded text is retained as one disabled executable value with a warning for manual repair.
- Full-project exports include MCP clients; collection/design-only exports omit project-scoped clients with an explicit warning. OAuth runtime tokens, refresh/identity tokens, dynamic-registration IDs/secrets, discovery caches, connection state, subscriptions, and STDIO approval are never exported.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused interchange/storage suites | Passed: 3 files, 64 tests |
| Full Vitest suite | Passed: 80 files, 588 tests |
| Full native suite | Passed: 118 tests; 1 public-fixture test ignored |
| Packaged CLI template and runner smokes | Passed |
| Rust formatting, clippy, and check | Passed |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 78.02 kB Interchange dialogs, 434.07 kB main, 16,449,664-byte CLI |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

The full frontend/native suites and packaged CLI smokes ran with loopback access because their disposable MCP, HTTP, and protocol fixtures bind local sockets. Interchange remains renderer-only, so the generated CLI stays byte-identical at SHA-256 `2ec54c299ee0b366e88d061454cd6745df3e425bfe787bb4b8938d002d671fe9`.

## Manual/rendered QA

No rendered interaction claim is required for this data adapter. Deterministic v4/v5 full-project round trips prove two-client HTTP/STDIO preservation, quoting, disabled rows, roots, public OAuth configuration, protected references, runtime-secret omission, native resource shapes, scoped warnings, collision-safe repeated application, and sensitive plaintext clearing. A direct adversarial v5 fixture proves shell operators remain inert disabled text.

## Remote gate

Main commit `e6692805924e7385375c0bb790025aa78993b919` completed verify and publish in [Actions run 29711349239](https://github.com/sherwoodlee/Brunomnia/actions/runs/29711349239). Node 22 rebuilt the generated CLI, passed the freshness and non-root no-network trust smoke, and published AMD64/ARM64 provenance/SBOM manifests at:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:5a440dc97eca51d7e1d0af68f9aba0e9bd871c7d144c63dc61321013a6551078
```

Independent `cosign verify` passed issuer `https://token.actions.githubusercontent.com` and the exact `cli-container.yml@refs/heads/main` identity, validated the M233 commit and digest claims plus the trusted certificate chain, and found transparency-log entry `2204667024`.

## Acceptance boundary

M233 closes first-class Insomnia v4/v5 MCP-resource interchange and the prior MCP-to-HTTP downgrade. Recursive/conditional schema forms, long-lived GET/POST SSE resumption/reconnect, elicitation and reviewed sampling UI, notification/server-request response UI, multiple authorization-server failover, DPoP, live third-party fixtures, OS-keychain-wrapped runtime credentials, v5 embedded proto contents, broader partial/deprecated scripts, external files, WSDL fidelity, and binary embedding remain. MCP clients and Import/export stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
