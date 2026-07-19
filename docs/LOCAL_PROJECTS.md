# Local projects and recovery

Brunomnia stores multiple local projects without an account, organization, subscription, or hosted service. The project button in the top bar opens the device-local manager.

## Lifecycle

- **New local project** creates a blank request collection and base environment while retaining device preference choices.
- Selecting a healthy project persists current edits, stops running mocks and streams, clears transient protocol/script/vault state, and opens the selected project.
- **Rename** updates both catalog metadata and the project document.
- **Duplicate** works from any healthy project without opening it first, asks for the new name, copies its complete resource tree and private environments, clears response/run history, and resets Git/encrypted-sync configuration so the copy cannot silently write to the original target.
- **Reorder** drags projects before or after one another. The reorder handle also supports Arrow Up, Arrow Down, Home, and End for keyboard-equivalent placement, and catalog order persists across launches.
- **Delete** is unavailable for the last project. Project, backup, and encrypted-vault files are moved to device-local trash rather than immediately erased.
- **Recently deleted** lists the newest 1,000 device-local deletion snapshots and restores any snapshot with a valid workspace or backup. A restored project keeps its original ID, becomes active, and recovers its encrypted vault when one exists.

Project changes are disabled while a request or scheduled run is active. Global-looking device preferences are carried into the next project and saved there, while project resources, histories, permissions, integrations, and encrypted secrets remain isolated.

## Native storage

Desktop data uses an application-data `workspaces` directory:

```text
workspaces/
  catalog.json
  catalog.backup.json
  <project-id>.json
  <project-id>.backup.json
  vaults/<project-id>.enc.json
  recovery/*.invalid.json
  trash/*.{workspace,backup,vault}.json
```

Writes create and sync a same-directory temporary file, retain the prior valid primary as the rotating backup, replace through a rollback-safe rename, and then update catalog metadata. IDs are path-safe and bounded; names and catalog size are bounded.

The old single `workspace.json` migrates to `local-workspace` on first catalog load. Its legacy encrypted vault is copied only into that project. The original legacy workspace remains available as migration evidence unless it is unreadable, in which case it is moved to `recovery`.

## Recovery

- A missing or malformed primary catalog falls back to `catalog.backup.json`.
- If both catalog copies are unavailable, Brunomnia reconstructs entries from valid project files.
- A malformed project primary with a valid project backup opens in recovery mode with autosave disabled.
- Recovery mode blocks editing and requires **Restore latest valid backup** or opening another healthy project.
- The malformed primary is preserved before restore.
- Deleted workspace, backup, and vault files are grouped by project ID and deletion timestamp, ordered newest first, and shown as workspace-backed, backup-backed, or unreadable.
- Deleted-project restore refuses current-ID and orphan-file conflicts, validates a usable workspace before writing, rolls back newly created files if the catalog update fails, and preserves invalid deleted JSON under `recovery`.
- If no stored project can be opened, Brunomnia creates a fresh project without deleting damaged files.

Browser development follows the same primary/backup/catalog, recently deleted, conflict, and invalid-file-preservation behavior with namespaced `localStorage` keys. Native files remain the production authority.

## Current boundary

Brunomnia's catalog project contains collections, designs, mocks, environments, and MCP resources in one versioned document. Current Insomnia models a project with separately typed workspace records and can duplicate or move those workspaces between eligible projects. Cross-project workspace moves, permanent trash purge/retention controls, preservation of original catalog timestamps across restore, multi-version backup browsing, project discovery, and cloud/provider onboarding remain parity work.
