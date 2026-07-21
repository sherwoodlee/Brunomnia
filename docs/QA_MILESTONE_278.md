# Milestone 278 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: close the finite pinned cloud-sync and collaboration contract with an account-free encrypted object repository, explicit offline merge UI, automatic clean remote refresh, and OS-protected per-device recipient keys whose removal rotates future revision authority.

## Source reconciliation

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned collaboration is encrypted commit/push plus resource-scoped branches, history/rollback, merge, and synchronization. The pinned desktop source mounts no product comments or real-time presence surface, so those prior ledger entries were false requirements.
- Pinned Cloud Sync discovers hosted account/organization projects through an authenticated session. Brunomnia preserves the user-visible storage and collaboration workflows through a reviewed user-selected filesystem, mounted WebDAV, or synchronization-folder path without introducing an account, hosted broker, entitlement, or subscription.
- Pinned end-to-end encryption distributes project key authority per user. Brunomnia implements the equivalent account-free boundary with OS-protected X25519 device identities, public invitation codes, independently wrapped content keys, and explicit future-revision revocation.

## Implementation

- Workspace v50 adds a bounded object-scoped collaboration repository for Collections, root Environment branches, API Designs, Mock Servers, and MCP Clients. Shareable snapshots remove private environments, Secret authority, and OAuth runtime credentials.
- Resource staging and dirty detection feed 200-commit history and 50 branches per resource. Users can commit, restore history as a new commit, create/check out/delete branches, preview three-way JSON merges, and resolve each conflict with mine, theirs, or manually validated JSON.
- The encrypted shared-file payload now includes repository state. Pull preserves device-local private environments, runtime credentials, responses, cookies, reports, paths, plugins, preferences, vault contents, and certificates; project writes and imports cannot carry collaboration path, staging, branch, or commit authority.
- Clean workspaces can check every five seconds and pull a newer revision automatically. Staged or dirty resources block automatic replacement with visible commit-or-restore guidance; ordinary optimistic revision rejection and explicit force push remain.
- Recipient envelope v2 stores one device identity private key through macOS Keychain, Windows Credential Manager, or Linux Secret Service. Public `brunomnia-sync-recipient-v1` invitations add up to 100 recipients. Every push creates a fresh random AES-256-GCM content key, derives per-recipient X25519/HKDF-SHA256 wrapping keys, authenticates the complete sorted roster as payload metadata, and zeroes temporary key buffers after use.
- Removing a recipient takes effect when the next revision rotates its data key. Recipient-encrypted files cannot silently downgrade to a shared passphrase, the rotating device must retain itself, tampered roster metadata fails authenticated decryption, and the UI states that older ciphertext copies retained outside Brunomnia cannot be erased.

## Automated gates

| Gate | Result |
| --- | --- |
| Pinned source identity and contract audit | Pass — encrypted repository operations, hosted discovery adaptation, key distribution, and the absence of comments/presence were reconciled against the exact pinned commit |
| Focused M278 regressions | Pass — 79 collaboration model/UI, sync boundary, project, migration/interchange, recipient envelope, tamper, rotation, and revocation tests passed |
| TypeScript | Pass — `tsc -b` completed without diagnostics after the v50 catalog defaults and collaboration type edges were repaired |
| Full frontend suite | Pass in required partition — the aggregate observed 104 files/732 tests passing, 2 opt-in files/4 tests skipped, and five cold dynamic-import tests exceeding the five-second aggregate timeout. The three affected files then passed all 48 tests in isolated or diagnostic-timeout runs, so all 107 regular files/737 active tests were observed passing |
| Production and CLI build | Pass — Vite transformed 1,549 modules and the generated 23,690,088-byte CLI bundle completed; CLI SHA-256 is `007d0953395e6a1e46bd4126ca6d560180552824fa5ddf4e10fbfdee1c1e76bc` |
| Packaged CLI smokes | Pass outside the localhost sandbox — template/file grants, authoritative physical store, complete Runner/config/plugin/transport/report matrix, and pinned non-root/no-network/read-only container all passed |
| Native aggregate suite | Pass outside the localhost sandbox — 192 tests passed and 4 opt-in public/model fixtures were ignored |
| Native formatting, check, and lint | Pass — `cargo fmt --check`, locked all-target/all-feature Cargo check, and strict Clippy completed without diagnostics with `CARGO_INCREMENTAL=0` |
| Parity and changed-path checks | Pass — exactly two incomplete rows remain (one `Baseline`, one `Early baseline`), all intended files were inventoried, and `git diff --check` reported no whitespace errors |

## Manual/rendered QA

Rendered/manual and assistive-technology QA remain omitted under the standing project direction. M278 makes no pixel-identical claim beyond source-backed controls, executable static UI coverage, builds, packaged gates, and the complete automated partition.

## Remote gate

Implementation commit `ce2592cd5e8cb841b5beac9f5616ce64a89b2c04` completed both jobs in [CLI container workflow 29865972231](https://github.com/sherwoodlee/Brunomnia/actions/runs/29865972231) and all three platform jobs in [Desktop bundles workflow 29865972223](https://github.com/sherwoodlee/Brunomnia/actions/runs/29865972223).

The CLI verify job rebuilt the committed bundle without a diff, built the verification image, matched the package version, and passed the pinned-image, non-root, no-network, read-only, local-reference lint, standalone-suite, config, and plugin-tag smoke. Publication emitted AMD64/ARM64 provenance and SBOM attestations, then keylessly signed `ghcr.io/sherwoodlee/brunomnia-cli@sha256:3f4677adedfb31c1492008b22e87870027973927d1585c460e122b83b272e216`; the Cosign transparency-log entry is Rekor index `2214227725`.

The desktop workflow rebuilt and attested the unsigned macOS ARM64 DMG, Windows x64 NSIS/MSI, and Linux x64 AppImage/DEB/RPM artifacts successfully. Its tag-only release job correctly remained skipped for this `main` push.

## Acceptance boundary

M278 closes the pinned encrypted commit/push, object branch/history/rollback, merge, synchronization, and per-user key-distribution contract through a bounded account-free implementation. It does not claim that revocation erases old ciphertext retained by an external storage provider, or that local governance metadata is strong user authentication. Comments and presence are not deferred because they are not mounted pinned product capabilities. `Cloud sync and collaboration` is now `Complete`; exactly two parity rows remain incomplete—one `Baseline` and one `Early baseline`—so Brunomnia is not yet declared feature-complete.
