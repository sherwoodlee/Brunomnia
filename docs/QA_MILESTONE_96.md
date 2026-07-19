# Milestone 96 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: expose retained soft-deleted local projects, backups, and encrypted vaults through bounded recovery inventory and restore-and-open workflows on native and browser stores.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes project deletion in the project/workspace manager and identifies Local Vault projects as local storage whose upstream availability can be controlled by organization storage rules.
- Brunomnia Milestone 87 already moved deleted project, backup, and encrypted-vault files into device-local trash without an account or entitlement branch, but offered no user-visible way to recover them.
- This milestone closes that retained-data workflow with a free local Recently deleted manager; cloud discovery and exact upstream typed-workspace hierarchy remain separate parity work.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 51 files, 321 tests |
| Focused browser storage suite | Pass — 25 catalog/migration/recovery tests |
| Vite production build | Pass — 184 modules; WorkspaceSwitcher 6.47 kB; workspace catalog 10.38 kB; main JavaScript 499.42 kB with no warning |
| Bundled CLI build/startup | Pass — isolated 510.6 kB CommonJS artifact and help startup |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native project-store suite | Pass — 5 tests |
| Native test suite | Pass — 67 tests, including loopback fixtures outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Native inventory accepts exact regular-file trash suffixes only, groups artifacts by validated ID/timestamp, reports primary/backup/unavailable status plus vault evidence, sorts newest first, and caps returned groups at 1,000.
- Native restore validates a usable workspace before mutation, rejects project-count, catalog-ID, and orphan-file collisions, recreates the primary, retains a valid backup, restores exact encrypted-vault bytes, updates the active catalog entry, and consumes successful trash artifacts.
- A native restore failure before catalog commit removes newly created project/backup/vault files; malformed deleted JSON is retained under recovery when a valid counterpart permits restoration.
- Browser inventory and restore apply the same ID/timestamp/status/conflict contract to namespaced local-storage keys, promote a valid backup, preserve a malformed primary, and consume the restored snapshot.
- The lazy project manager reports deletion time, usable source, vault presence, unreadable/conflicting disabled states, and refreshes inventory after deletion or restore.
- Restore-and-open uses the existing guarded project transition, so active sends block it and successful restoration persists/stops/clears the prior project runtime before adopting recovered data.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. UI structure, labels, disabled states, lazy state ownership, type safety, native/browser storage fixtures, bundle splitting, and desktop packaging provide the acceptance evidence.

## Acceptance boundary

Recently deleted project restoration is a complete baseline. Restore keeps the original ID and refuses conflicts rather than offering rename-on-restore; original catalog timestamps are not retained; there is no permanent purge or retention-policy UI; and only the newest 1,000 groups are listed while older files remain on disk. Multi-version backup browsing and the broader project hierarchy/discovery/cloud gaps remain open.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
