# Milestone 97 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: close inactive-project duplication and within-catalog manual-ordering gaps with native/browser persistence plus drag and keyboard controls.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes **Duplicate / Move** from each non-MCP workspace card rather than requiring the workspace to be active.
- `workspace-duplicate-modal.tsx` asks for a new name, organization, and project; `workspace.move.tsx` exports the source as Insomnia v5 with private environments, imports a new workspace, and navigates to the result.
- `use-sidebar-drag-and-drop.tsx` treats workspaces as draggable and supports before/after reordering within a project plus eligible collection/design moves between local/Git projects.
- Brunomnia closes the behavior representable by its current single-level local catalog with no account, organization, storage-policy, or entitlement branch. Cross-project workspace moves require the still-open typed project/workspace hierarchy.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 51 files, 322 tests |
| Focused browser storage suite | Pass — 26 catalog/migration/recovery tests |
| Vite production build | Pass — 184 modules; WorkspaceSwitcher 7.80 kB; workspace catalog 11.94 kB; main JavaScript 499.35 kB with no warning |
| Bundled CLI build/startup | Pass — isolated 510.6 kB CommonJS artifact and help startup |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native project-store suite | Pass — 6 tests |
| Native test suite | Pass — 68 tests, including loopback fixtures outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Reading an inactive native/browser project validates catalog membership and returns its valid primary or backup without changing the active project.
- Duplicate creation deep-clones collections, folders, requests, environments including private entries, designs, mocks, integrations, governance, plugins, and other project resources under a fresh catalog ID and caller-selected name.
- Local activity, saved responses, runner reports, Git/folder targets, and encrypted shared-file targets are reset so the copy cannot mutate or present execution evidence from the source; current device preferences are applied.
- Native and browser before/after movement validate both IDs, preserve every entry exactly once, keep active workspace data unchanged, and persist the resulting catalog sequence.
- The lazy manager permits duplication from active, inactive, or backup-recoverable projects and disables only unreadable sources.
- A dedicated drag handle reports before/after midpoint targets and visible insertion feedback; Arrow Up/Down/Home/End provide focusable keyboard-equivalent ordering.
- Ordering saves the active document without stopping streams/mocks or resetting workbench state, while duplication uses the guarded switch/create lifecycle and opens the new copy.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. Upstream source inspection, semantic controls, event wiring, type safety, persistence fixtures, warning-free bundle splitting, and desktop packaging provide the acceptance evidence.

## Acceptance boundary

Inactive duplication and within-catalog ordering are complete baselines. Brunomnia has not yet introduced Insomnia's project containing separately typed workspaces, so duplicate/move cannot target another project or organization and eligible cross-project move rules remain open. The copy intentionally resets local execution history and external write targets while retaining authored resources and private environments.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
