# Milestone 240 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: close the final MCP parity gap with reproducible credential-free discovery and invocation evidence across independent public Streamable HTTP implementations and Brunomnia's shared plus native Tauri paths.

## Source and endpoint audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Credential-free initialization on 2026-07-19 identified DeepWiki 2.14.3 at `https://mcp.deepwiki.com/mcp`, Context7 3.2.3 at `https://mcp.context7.com/mcp`, and Cloudflare Docs 0.4.9 at `https://docs.mcp.cloudflare.com/mcp`.
- The matrix intentionally spans stateless Uvicorn HTTP/2 SSE, stateful Express HTTP/1.1 SSE with `Mcp-Session-Id`, and stateless Cloudflare HTTP/2 SSE. Context7 also advertises protected-resource metadata while allowing the tested public documentation operations without credentials.
- Tests send no authorization, cookies, private repository names, source text, or user data. Inputs are limited to `Kong/insomnia`, `React`, and a public Workers KV documentation query.

## Implementation and evidence

- `src/lib/mcpPublic.integration.test.ts` is skipped unless `BRUNOMNIA_MCP_LIVE=1`. It runs each endpoint through `discoverMcpClient`, exercises all four paginated discovery families, validates the expected named tool, invokes it, checks bounded content, proves retained client state, and distinguishes Context7's successful explicit session termination from the two stateless disconnects.
- `src-tauri/src/mcp_http.rs` adds a separately ignored public fixture at the native transport boundary. It verifies protocol `2025-06-18`, SSE response parsing, negotiated HTTP/1.1 or HTTP/2, Context7's session header, tool discovery, and tool invocation through the same request/response bridge used by the packaged app.
- DeepWiki invoked `read_wiki_structure` for `Kong/insomnia`; Context7 invoked `resolve-library-id` for React; Cloudflare invoked `search_cloudflare_documentation` for Workers KV. The tests assert compatible capability/tool/result shapes rather than unstable byte-identical third-party content.
- The ordinary suite remains deterministic and offline: three renderer-path tests and one native-path test are opt-in only. Each live request retains the existing 30-second transport deadline and MCP body/event/session safety bounds.

## Automated gates

| Gate | Result |
| --- | --- |
| Public shared-client compatibility matrix | Passed: 3 endpoints, 3 discovery/invocation/disconnect tests |
| Public native Tauri transport matrix | Passed: 3 endpoints in 1 ignored opt-in native test |
| Full Vitest suite | Passed: 81 files and 602 tests; 1 public-matrix file and 3 tests skipped by default |
| Full native suite | Passed across full plus isolated/live reruns: all 131 local tests covered; public MCP matrix passed; 1 public gRPC fixture ignored |
| Packaged CLI template and runner smokes | Passed |
| Rust formatting, clippy, and check | Passed with warnings denied |
| Clean TypeScript/Vite/CLI production build | Passed: 531 modules; 179.74 kB CSS, 106.25 kB Integration workbench, 439.59 kB main, 16,453,671-byte CLI |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 18 incomplete rows; no whitespace errors |

The shared-client public matrix completed all three endpoints in 8.66 seconds of live test time; the native matrix completed the same three in 7.25 seconds. The ordinary full frontend suite kept those external calls skipped and ran its disposable local MCP, HTTP, and protocol fixtures with loopback access. The native full run passed 130 local tests and skipped both public fixtures; the unchanged five-second login-shell fixture observed its known timing fallback under full-suite contention and passed immediately in an exact isolated rerun, while the public MCP fixture passed in its explicit live run. The generated CLI has SHA-256 `808bdb92d70d791ff1413b597cc7df0ace4079e2e1235589675e574b04c0f72b`.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. The live shared-client and native transport matrices, local deterministic protocol fixtures, strict builds, and packaged-app gate cover the compatibility claim without public credentials or user data.

## Remote gate

Pending implementation workflow and signed publication evidence.

## Acceptance boundary

M240 closes live third-party MCP compatibility evidence. With the false URL-client-metadata, authorization-server-failover, and DPoP requirements already removed by pinned SDK/provider audits and OS-protected runtime credentials closed in M239, MCP clients is now `Complete`. Exactly 18 parity rows remain incomplete, so Brunomnia is not feature-complete.
