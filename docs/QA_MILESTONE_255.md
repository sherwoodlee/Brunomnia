# Milestone 255 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: correct the Local projects and persistence ledger boundary after Git provider onboarding completed, removing cloud-only organization discovery from the local-storage row without claiming Cloud Sync capabilities.

## Source and documentation audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia/src/ui/components/project/project-type-select.tsx` declares three independent project types: `local` (**Local Vault**), `remote` (**Cloud Sync**), and `git` (**Git Sync**). Storage rules enable or disable each type independently.
- Pinned `project-create-form.tsx` owns Git credential/repository/folder onboarding only when `storageType === 'git'`. Milestone 254 completed that provider workflow, so it is no longer a gap in this or the Git row.
- Pinned `organization.sync-organizations-and-projects.tsx` requires a user-session ID and account ID before synchronizing organizations or projects. Its first-project redirect occurs only after the explicit Cloud Sync task, proving that organization/project discovery is cloud behavior.
- Pinned `untracked-projects.tsx` finds legacy database projects/workspaces that are not parented to a locally cached organization. It is local migration/recovery logic, not remote project discovery; Brunomnia's aggregate-to-catalog and physical-record migrations already cover its user-visible recovery role.
- Official Insomnia storage documentation commit `73995e32ed758882a290c945807225d7442b483e` defines Local Vault and Scratch Pad as local, offline, no-cloud storage; Cloud Sync as remote access, E2EE, real-time sync, and collaboration; and Git Sync as independent third-party repository storage.

## Existing implementation evidence

- Milestones 96, 246, 247, 250, 251, and 252 cover guarded project deletion/recovery, five typed project-file scopes, identity-preserving duplication/moves, genuinely empty projects, per-file cookies/certificates, and authoritative browser/native physical records.
- Native and browser catalogs support account-free create, switch, rename, duplicate, reorder, delete, trash restore/purge, immutable snapshots, rotating backups, corruption recovery, project-scoped vaults, and legacy aggregate migration.
- Destination-first typed-file moves preserve identities and file-owned evidence with rollback. Physical manifests and records remain bounded, symlink-safe, CLI-readable, and recoverable from the last valid backup.
- Milestone 254 completes reusable Git credentials, provider validation/discovery, guided branch/tree onboarding, and credential-aware Git operations without adding an account or hosted broker.
- Cloud organization discovery, real-time presence/collaboration, comments, object-specific cloud branches/history, per-user key wrapping, and offline merge UI remain only in **Cloud sync and collaboration**. No cloud capability is claimed here.

## Reproducible evidence

With `INSOMNIA_PIN` at the pinned source commit and `INSOMNIA_DOCS_PIN` at the pinned documentation commit:

```sh
git -C "$INSOMNIA_PIN" rev-parse HEAD
rg -n "type: 'local'|type: 'remote'|type: 'git'|Local Vault|Cloud Sync|Git Sync" "$INSOMNIA_PIN/packages/insomnia/src/ui/components/project/project-type-select.tsx"
rg -n "storageType === 'git'|GitCredentialSelect|GitRepoForm|GitRepoScanResult" "$INSOMNIA_PIN/packages/insomnia/src/ui/components/project/project-create-form.tsx"
rg -n "userSession|get.*accountId|SyncOrganization|SyncProjects|syncOrganizations|syncProjects" "$INSOMNIA_PIN/packages/insomnia/src/routes/organization.sync-organizations-and-projects.tsx"
rg -n "Local Vault|No cloud interaction|Work offline|Cloud Sync|Real-time synchronization|Git Sync|independent of cloud" "$INSOMNIA_DOCS_PIN/app/insomnia/storage.md"
```

Expected evidence is the exact pinned hashes; independent local/remote/git project types; Git-only provider onboarding; session/account-gated organization/project synchronization; and documentation that places cloud discovery/collaboration outside Local Vault.

## Validation

| Gate | Result |
| --- | --- |
| Pinned source identity and project-type scan | Passed: exact source commit and independent Local Vault, Cloud Sync, and Git Sync types |
| Pinned cloud-route scan | Passed: organization/project synchronization requires authenticated session/account context and an explicit Cloud Sync task |
| Official storage documentation scan | Passed: exact docs commit separates local no-cloud/offline behavior from remote Cloud Sync and independent Git Sync |
| Existing local implementation audit | Passed: linked milestone evidence covers every named local lifecycle, migration, ownership, physical persistence, recovery, and CLI behavior |
| Parity-row count | Passed: exactly 11 rows remain incomplete (10 `Baseline`, 1 `Early baseline`) |
| Changed-path whitespace check | Passed |

No application test/build gate was repeated because no executable, dependency, generated bundle, fixture, or configuration file changed. Milestone 254's 655-test frontend suite, 156-test native suite, strict build/lint/audit, CLI/container smokes, Tauri bundle, and signed image remain the latest product-code gates.

## Acceptance boundary

M255 removes a false cross-row requirement; it does not implement or claim Cloud Sync. **Local projects and persistence** is now `Complete`. **Cloud sync and collaboration** remains `Baseline` with every hosted/collaborative gap intact. Exactly 11 parity rows remain incomplete, so Brunomnia is not feature-complete.
