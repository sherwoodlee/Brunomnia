# Milestone 93 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: negotiate MCP OAuth from a protected endpoint, discover RFC 9728/RFC 8414/OIDC metadata, dynamically register a local client, retry protected JSON-RPC calls, and handle scope escalation.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` delegates MCP HTTP `401` handling to the MCP SDK, extracts `resource_metadata` and scope from `WWW-Authenticate`, discovers protected-resource and authorization-server metadata, optionally registers a client, opens the default browser, exchanges the code, and retries the original request.
- Its provider persists registered client information on the MCP request and access/refresh/identity/expiry separately; its wrapped fetch logs OAuth requests without treating registration/token state as ordinary MCP headers.
- Brunomnia implements the same observable authorization-code/refresh/PKCE sequence through its existing shared OAuth and native callback paths, while keeping generated registration credentials inside its device-local runtime boundary.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 49 files, 312 tests |
| Focused MCP/OAuth/security/storage/import suites | Pass — 6 files, 71 tests |
| Vite production build | Pass — 182 modules; OAuth 3.77 kB; Integration workbench 43.80 kB; main JavaScript 498.95 kB with no warning |
| Bundled CLI build/startup | Pass — isolated 510.2 kB CommonJS artifact and help startup |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 66 tests |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Quoted/unquoted Bearer challenge parsing extracts protected-resource URL, scope, and error without accepting a non-Bearer challenge.
- Discovery tries the challenge URL, path-aware RFC 9728 URL, root protected-resource fallback, path-aware RFC 8414, and both OIDC path forms in deterministic order.
- URL validation rejects embedded credentials, fragments, remote plain HTTP, unrelated protected-resource identifiers, issuer mismatches, and advertised flows without authorization code or PKCE S256.
- A complete mocked sequence proves unauthenticated initialize, `401`, resource metadata, authorization-server metadata, dynamic registration, local client persistence, OAuth token acquisition, authenticated initialize retry, session propagation, and capability discovery.
- Registered client ID/secret/issued/expiry/auth-method state is persisted immediately, omitted from project/sync payloads, restored only to the matching local OAuth client, and cleared on untrusted import or authentication changes.
- A `403` Bearer `insufficient_scope` challenge clears stale token state, uses the server-requested scope for one reauthorization, retries once, and returns the updated client.
- Metadata and registration traffic carries no MCP authentication, cookies, response chain, or plugin hooks; follows no redirects; retains authentication TLS/proxy settings; and caps parsed JSON at 1 MiB after transport buffering.

## Manual/rendered QA

Rendered QA and live provider/MCP interaction were not run because this task's standing direction prohibits the in-app Browser and no third-party OAuth or MCP credentials are stored in the repository. The flow is verified through deterministic transport fixtures, native callback tests, type safety, production bundling, and desktop packaging.

## Acceptance boundary

MCP OAuth metadata discovery and dynamic registration are a complete baseline. URL-based client-ID metadata documents, discovery redirects, multiple authorization-server failover, DPoP, live third-party interoperability fixtures, and OS-keychain-wrapped runtime credential storage remain open.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
