# Milestone 7 verification

Verified on 2026-07-16 on macOS against the Phase 7 encrypted-secrets, shared-file collaboration, and local-governance baseline.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript project check | Pass |
| Vitest single-worker suite | Pass — 13 files, 59 tests |
| Vite production bundle | Pass — 139 modules transformed |
| Bundled CLI build and local smoke run | Pass — 295.2 KB CommonJS executable; 1 request and 2 assertions passed |
| `cargo fmt --all` | Pass |
| `cargo check` | Pass |
| `cargo test --all-targets` | Pass — 18 native tests |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Tauri debug app bundle | Pass — `src-tauri/target/debug/bundle/macos/Brunomnia.app` |

The final TypeScript, Vite, Vitest, CLI, and Tauri CLI gates used the bundled Node.js 24.14 runtime directly because the local shell's Node.js 26 process intermittently slept during tool startup. This changes only the executable used to run the checked-in packages. The Rust suite's loopback-only mock-server integration ran outside the filesystem/network sandbox; all 18 tests then passed.

## Focused security evidence

- Local-vault tests prove plaintext is absent from the envelope, a correct passphrase round-trips the value, and a wrong passphrase fails authenticated decryption.
- Encrypted-sync tests prove revision 1 creation, stale-base rejection before overwrite, and successful pull of the unchanged remote revision.
- External-vault tests parse AWS string and HashiCorp KV v2 values without invoking network services.
- Frontend tests cover device-local share filtering, pull merge behavior, vault lock visibility, audit retention, plaintext candidate blocking, complete-tuple external-reference authorization, and malformed v7 governance migration.
- Rust commands use argument arrays rather than a shell; provider references reject option-shaped input, child processes have a 30-second limit, and bounded stdout/stderr readers prevent pipe deadlock while enforcing the 10 MB output ceiling.
- The final production UI and native app bundle include the Security & Sync workbench. This milestone does not claim a fresh interactive rendered-QA pass; its UI evidence is the type-safe production/native build plus focused state and boundary tests above.

## Deliberate bounds

- The encrypted shared file uses a team passphrase, not per-user public-key wrapping or revocation.
- Synchronization is explicit pull/push with optimistic revision checking, not real-time presence/comments or an automatic offline merge UI.
- Local actors and roles are policy metadata plus selected action checks, not authenticated identities.
- External provider adapters rely on installed official CLIs and existing credential chains; provider-native browser login and SDK configuration UI are not claimed.
- Private environment hierarchy, script vault access, headless provider adapters, SAML/OIDC, SCIM, complete RBAC enforcement, and tamper-evident remote audit remain tracked in [PARITY.md](PARITY.md).
