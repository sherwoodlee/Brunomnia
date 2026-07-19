# Milestone 92 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add manually configured MCP HTTP OAuth authorization-code/PKCE, propagate token lifecycle state through MCP sessions and operations, and keep MCP OAuth runtime credentials device-local.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` uses its MCP SDK OAuth provider for authorization code, refresh, PKCE, default-browser redirection, protected-resource/authorization-server metadata discovery, and optional dynamic client registration.
- Its provider stores access, refresh, identity, expiry, and token type separately from MCP request configuration and persists registered client metadata back to the MCP request.
- This milestone closes the manually configured authorization/refresh/runtime-isolation slice with Brunomnia's existing native callback and shared HTTP lifecycle. Metadata discovery and dynamic registration remain explicit follow-up work.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 49 files, 309 tests |
| Focused MCP/OAuth/security/storage/import suites | Pass — 6 files, 68 tests |
| Vite production build | Pass — 181 modules; OAuth 3.77 kB; Integration workbench 34.67 kB; main JavaScript 497.52 kB with no warning |
| Bundled CLI build/startup | Pass — isolated 509.3 kB CommonJS artifact and help startup |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 66 tests |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- MCP OAuth configuration maps to authorization code, mandatory PKCE S256, generated state, a loopback callback, and either public-client body credentials or protected confidential-client Basic credentials.
- Acquired/refreshed access, refresh, identity, expiry, and token-type values carry from initialization through initialized notification, paginated discovery, and operation invocation, then persist on the owning MCP client.
- The integration editor exposes authorization/token URLs, client ID/secret, scope, state, token status, and explicit local-token clearing while reusing the app-wide cancellable browser authorization dialog.
- Folder/Git and encrypted-sync payloads omit MCP OAuth runtime values without mutating local state; incoming values are sanitized before matching local client state is restored.
- New clients and changed authentication types do not inherit local tokens, and workspace imports clear OAuth client secrets plus all runtime token fields.
- Runtime tokens do not trigger plaintext-publication warnings, while a configured raw OAuth client secret is detected and rejected until it becomes a complete approved secret reference.

## Manual/rendered QA

Rendered QA and live provider/MCP interaction were not run because this task's standing direction prohibits the in-app Browser and no third-party OAuth or MCP credentials are stored in the repository. Type safety, mocked transport sequencing, native callback tests, persistence boundaries, production bundling, and desktop packaging are verified without rendered interaction.

## Acceptance boundary

Manually configured MCP OAuth is a complete baseline. A server that exposes only `WWW-Authenticate` protected-resource metadata still requires manual authorization/token endpoints and a pre-registered client ID. RFC 9728 protected-resource discovery, RFC 8414/OIDC authorization-server discovery, dynamic client registration, live provider fixtures, and OS-keychain-wrapped runtime token storage remain open.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
