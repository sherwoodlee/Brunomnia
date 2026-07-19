# Milestone 87 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: replace single-workspace persistence and the decorative switcher with an account-free multi-project catalog, project-scoped encrypted vaults, rotating backups, and an explicit corruption-recovery workflow.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes project creation/settings/deletion, workspace creation/duplication, project/workspace switching, and project-level import/export actions.
- `local-project-bar.tsx` identifies Local Vault projects as locally stored with no cloud, while organization storage rules can disable that project type upstream.
- Brunomnia implements the local lifecycle without an organization-storage or commercial-entitlement branch and keeps cloud/provider discovery outside this baseline rather than gating local data.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 45 files, 277 tests |
| Focused browser storage suite | Pass — 22 migration/catalog/recovery tests |
| Vite production build | Pass — 178 modules; lazy catalog/manager/command/cookie chunks; main JavaScript 499.16 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native project-store suite | Pass — 4 tests |
| Native test suite | Pass — 63 tests with the loopback fixture outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- First launch creates a bounded catalog; an existing `workspace.json` migrates without changing project data.
- Create, open, rename, active-project duplicate, delete, active fallback, and last-project protection are executable.
- Project files and catalog files rotate valid backups and preserve invalid primaries before explicit restoration.
- Catalog reconstruction finds valid orphaned project files, while an all-invalid store opens a fresh project without deleting evidence.
- Browser development mirrors lifecycle, project backup, catalog backup, corruption status, restore, and trash semantics.
- Project switches save current edits, stop mocks/streams/schedules, reset transient protocol/script/vault state, and retain device preferences.
- Encrypted vault paths are project-specific; only the migrated legacy project receives the legacy vault; deletion moves its vault to trash.
- Recovery mode prevents autosave and blocks editing until the user restores the backup or opens another healthy project.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibits the in-app Browser. UI structure, labels, focus/escape/outside-close behavior, responsive project access, recovery blocking, lifecycle invocation, type safety, storage fixtures, bundle splitting, and app packaging are verified without rendered interaction in this phase.

## Acceptance boundary

The account-free local project lifecycle and latest-valid-backup recovery are complete baselines. Brunomnia still stores resource families inside one project document instead of separate typed workspaces beneath a project. Multi-version snapshots, automatic project discovery, cloud/provider onboarding, and rendered accessibility validation remain open; deleted-project restoration is closed by Milestone 96, while inactive duplication and within-catalog ordering are closed by Milestone 97.
