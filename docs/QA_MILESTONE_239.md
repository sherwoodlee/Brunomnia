# Milestone 239 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: protect device-local request, folder, and MCP OAuth runtime credentials with a macOS Keychain-backed authenticated catalog envelope without publishing or silently losing those values.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `main/ipc/secret-storage.ts` exposes Electron `safeStorage` encryption/decryption plus keyed secret helpers and falls back to raw text when OS encryption is unavailable. Brunomnia deliberately fails closed instead of adopting that plaintext fallback.
- Pinned `main/mcp/oauth-client-provider.ts` stores dynamically registered client information on MCP authentication and access/refresh/identity tokens in the request-owned OAuth token model. Brunomnia preserves the owner-visible behavior while extending OS-backed protection to request, folder, and MCP OAuth runtime state.

## Implementation

- The packaged macOS app generates one random 256-bit workspace-runtime master key, stores it as a generic-password item in macOS Keychain, and caches it only for the process lifetime. Missing-item creation is distinguished from denied or invalid Keychain access, so an unreadable existing key is never overwritten.
- Catalog persistence extracts request/folder authorization codes, PKCE verifiers, access/identity/refresh tokens and expiry plus MCP tokens and dynamic-registration credentials. Ordinary JSON receives blank runtime fields and one versioned AES-256-GCM envelope with a fresh 96-bit nonce, a 5 MB plaintext cap, strict algorithm/provider/version parsing, and the workspace ID as authenticated associated data.
- Primary, rotating backup, legacy, and deleted-project workspace copies migrate before use. Legacy commands, catalog create/save/open/read/rename, backup restore, delete/list/restore, and startup migration all retain transparent renderer hydration while raw stored copies remain scrubbed.
- Runtime fields hydrate only into the same collection/request, collection/folder, or MCP-client owner while that owner still uses OAuth. Authentication-family changes, unknown owners, tampering, workspace swapping, malformed/oversized envelopes, and Keychain failure cannot inject or expose credential values.
- Browser development remains explicitly browser-local. Folder/Git, import, and encrypted-sync omission boundaries are unchanged.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused credential-envelope and catalog migration suites | Passed: 5 native tests |
| Full Vitest suite | Passed: 81 files, 602 tests |
| Full native suite | Passed across full plus isolated rerun: all 131 local tests covered; 1 public-fixture test ignored |
| Packaged CLI template and runner smokes | Passed |
| Rust formatting, clippy, and check | Passed with warnings denied |
| Clean TypeScript/Vite/CLI production build | Passed: 531 modules; 179.74 kB CSS, 106.25 kB Integration workbench, 439.59 kB main, 16,453,575-byte CLI |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app`; native binary links `Security.framework` |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

The full frontend suite and packaged CLI smokes ran with loopback access because their disposable MCP, HTTP, and protocol fixtures bind local sockets. The native run passed 130 local tests and ignored the opt-in public gRPC fixture; the unchanged five-second login-shell test observed its known timing fallback under full-suite contention and passed immediately in an exact isolated rerun. All five new authenticated-storage tests passed in focused and full execution. The generated CLI is unchanged at SHA-256 `c21ae16fef386e0997f39f2f040480b33edadd132d6a44786edf16d07bdf7d35`.

Tauri compiled and bundled the fresh 87,848,504-byte `Brunomnia.app` with a `Security.framework` linkage. After that successful app gate, the all-target debug command continued to an optional unsigned DMG wrapper that failed; M239 makes no DMG artifact claim.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. Deterministic authenticated-encryption, owner-matching, migration, backup, legacy, trash, tamper, strict-compilation, and packaged-app gates verify the storage contract without using or modifying the user's real Keychain during unit tests.

## Remote gate

Pending implementation workflow and signed publication evidence.

## Acceptance boundary

M239 closes packaged-macOS OS-keychain wrapping for request, folder, and MCP OAuth runtime credentials. Live third-party MCP compatibility evidence remains. MCP clients and Request authentication stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
