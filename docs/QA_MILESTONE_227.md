# Milestone 227 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: follow pinned MCP OAuth metadata redirects through an explicit bounded policy and remove URL-based client-ID metadata documents from the parity backlog after auditing the exact provider/SDK call path.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- The lockfile resolves `@modelcontextprotocol/sdk` `1.29.0`. Its OAuth client uses Insomnia's wrapped Node fetch, so successful HTTP redirects follow Fetch's twenty-redirect ceiling before metadata parsing.
- SDK `authInternal` can choose SEP-991 URL-based client IDs only when authorization-server metadata advertises `client_id_metadata_document_supported` and the provider supplies an HTTPS non-root `clientMetadataUrl`.
- Pinned `McpOAuthClientProvider` defines redirect URL, client metadata, client information, token, state, PKCE, and browser callbacks but no `clientMetadataUrl`. The SDK branch is therefore unreachable in Insomnia and was a false parity requirement, not a missing user-facing feature.

## Implementation

- Protected-resource, RFC 8414, and OIDC metadata GETs follow at most twenty explicit redirects, matching the pinned Fetch ceiling. Relative and absolute `Location` values are accepted only after every hop passes the existing credential-free, fragment-free HTTPS/loopback-HTTP URL policy.
- Native automatic redirects remain disabled so no hop bypasses validation. Missing `Location`, redirect loops, and overflow fail before metadata parsing or client registration.
- Every request/response hop is retained in the MCP event trace. Final metadata still passes the existing 1 MiB, resource/issuer, endpoint, authorization-code, and PKCE checks.
- Dynamic-registration POSTs do not follow redirects and retain their no-cookie, no-MCP-auth, no-plugin, 30-second request boundary.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused MCP OAuth suite | Passed: 1 file, 7 tests |
| Full Vitest suite | Passed: 79 files, 575 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 62.02 kB Integration workbench, 433.88 kB main, byte-identical 16,449,585-byte CLI |
| Redirect policy coverage | Passed: relative 302/307 chains, visible hop traces, native-follow denial, remote HTTP refusal, loop rejection, and twenty-hop overflow |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

No Rust/native or CLI behavior changed. Milestone 220 remains the latest full native and macOS app-bundle gate.

## Manual/rendered QA

This milestone changes transport negotiation and event evidence without adding an interaction. No live provider credential or rendered Browser claim is made; deterministic transport fixtures cover the complete redirect boundary.

## Acceptance boundary

M227 closes metadata redirects and removes the unreachable URL-based client-ID branch from the parity backlog. Multiple authorization-server failover after valid resource metadata, DPoP, recursive/conditional schema forms, long-lived streaming, cancellation, reviewed sampling/elicitation, notification response UI, persistent STDIO sessions, live third-party fixtures, and OS-keychain-wrapped runtime credentials remain. MCP clients stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
