# Resource hierarchy and environments

Milestone 10 adds nested request resources and inherited environments without an account, hosted workspace, or paid entitlement.

## Collections and folders

Use the **+** action on a collection or folder to create a folder. Open a folder's settings to rename or move it and to configure variables, headers, authentication, pre-request scripts, after-response scripts, or documentation. Requests can be assigned from the folder selector above the request tabs.

**Duplicate folder** in folder settings copies the complete descendant folder/request subtree beside the original. Every folder, request, editable row, gRPC metadata row, Socket.IO argument, and Socket.IO listener receives a fresh ID while names, request behavior, configuration, and internal order remain intact. Imported or Konnect-managed source metadata is removed from the copies so later synchronization cannot treat user-created duplicates as remote-owned resources.

### Ordering and moving resources

Milestone 24 adds persistent pointer drag/drop to the collection tree:

- drag a collection above or below another collection to reorder it;
- drag a request or folder to the top or bottom edge of any request/folder row to place it before or after that mixed sibling;
- drop a request or folder in the center of a folder row to move it inside the folder; and
- drop a request or folder on a collection title to move it to that collection's root.

Milestone 144 adds focusable keyboard-equivalent moves on each request row, folder-name control, and collection-name control. Clear sidebar search, focus the resource, then use:

- **Option/Alt + Arrow Up/Down** to move before or after the adjacent mixed sibling;
- **Option/Alt + Home/End** to move first or last among siblings;
- **Option/Alt + Arrow Right** to indent into the preceding sibling when it is a folder; and
- **Option/Alt + Arrow Left** to outdent after the current parent folder.

Collections support Option/Alt + Arrow Up/Down/Home/End. Boundary, missing-resource, impossible-indent, root-outdent, and collection indent/outdent operations are no-ops. The focused keyed control remains the same resource after a successful move.

Pinned Insomnia's current project navigation tree and legacy collection tree are single-select. Request and folder dropdowns receive one resource, so Brunomnia does not fabricate collection-tree multi-select or bulk actions as a parity feature. Existing bulk query/header editors and runner request selection are separate documented surfaces.

Moving a folder across collections carries its complete descendant folder/request subtree and preserves every resource ID. A folder cannot be moved into itself or one of its descendants. Missing destinations and cross-collection ID collisions are rejected without a partial move. Destination collections and folders expand so the result remains visible.

Order is stored in the native workspace and split-YAML project representation. Older workspaces are upgraded by retaining every valid folder/request once, discarding stale or duplicate order IDs, and appending valid resources that were absent from the saved order. Brunomnia compatibility imports remap saved order IDs with the imported resources.

Drag/drop and keyboard moves are intentionally disabled while sidebar search is active because hidden siblings make an apparent filtered order ambiguous. Clear the search field before reordering. Arbitrary mixed-order guarantees in third-party compatibility exports remain open parity work.

Configuration is composed for every execution path:

1. the selected global environment is resolved from base to sub-environment;
2. collection variables override the resolved global values;
3. folder variables, headers, and pre-request scripts apply from the root folder toward the request;
4. request values and scripts apply last;
5. after-response scripts unwind from the request toward the root folder.

Headers override by case-insensitive name. A request inherits authentication only when **Inherit authentication from folder** is enabled; the nearest configured ancestor wins. Deleting a folder moves its child folders and direct requests to the deleted folder's parent rather than deleting those resources.

Collection, folder, and request documentation is stored as Markdown source. This milestone provides a safe plain-text preview; rendered Markdown and attachment handling remain open parity work.

## Request tabs

Selecting a request normally opens one temporary tab; selecting another unopened request replaces that temporary tab. Command/Ctrl-click, middle-click, or double-click opens a permanent tab, while double-clicking a temporary tab or using its check control keeps it open. Editing or sending a temporary request also promotes it. Tabs persist per local project, follow request renames/methods directly from the workspace, support pointer drag ordering, and reconcile deleted request IDs without entering workspace data.

Folders participate in the same temporary/permanent strip and single temporary slot. Select a folder name to open its full Variables, Headers, Auth, Scripts, and Docs pane; Command/Ctrl-click, middle-click, or double-click opens it permanently. Folder edits promote temporary tabs, and the settings control retains duplicate, delete, and parent-management actions. Request and folder tabs can be mixed, reordered, closed, reopened, and restored after restart without changing collection hierarchy.

The activity rail and command palette open a workspace-wide **Runner** document in the same strip. **Run folder** opens a distinct synthetic Runner tab for that folder; its request plan includes direct and nested descendants only, locks the owning collection/folder target, and promotes the temporary tab when execution starts. Deleting the target folder removes both its folder and Runner documents during reconciliation.

Close uses recent active-tab history before falling back to the preceding tab. Middle-click closes a document tab. Closing the final tab or choosing **Close All** stores every closed document and opens the project resource dashboard; **Close Other Tabs** preserves and activates its selected tab. Command/Ctrl+Tab and Command/Ctrl+Shift+Tab cycle tabs, Command/Ctrl+W closes the active tab, and Command/Ctrl+Shift+T or the dashboard/history controls reopen the latest valid closed tab. Selecting a sidebar resource, project card, or new request leaves the dashboard and opens its document tab.

## Request pins

Use the pin control in the active request tab to add or remove that request from the separate **Pinned requests** list above the collection tree. The pinned list follows persisted collection resource order and the current sidebar search, while the ordinary hierarchy remains unchanged. Pin IDs are bounded device-local metadata, matching pinned Insomnia's non-sync `RequestMeta`; they are not added to workspace exports, split-YAML/Git projects, compatibility exports, or collaboration payloads. Missing and deleted requests are removed during reconciliation.

## Environments

Open the environment editor from the top bar. Base environments have no parent. Sub-environments inherit enabled and disabled variable rows from their parent chain, with a closer value replacing an earlier value with the same name. Editing a script stores only changed or newly created values in the selected sub-environment instead of flattening all inherited values into it.

Global base/sub-environments, collection base/sub-environments, and folder variables each persist their own **Table** or **Raw JSON** editor mode. Raw mode requires a JSON object at the root and rejects keys that begin with `$`, contain `.`, or use the reserved root names `_`, `vault`, and `__insomnia_vault`. Invalid raw JSON remains visible with an error and blocks switching back to Table mode. Switching Table to Raw asks before discarding disabled rows or all but the final enabled duplicate name.

Table rows support **String** and **JSON** values. Raw objects and arrays become JSON rows; scalar JSON values become strings, matching pinned Insomnia. JSON rows expose nested template/script names such as `service.host` while retaining the compact root value. Conversion is bounded to 1,000 top-level keys, 10,000 nested values, 50 levels, and one million source characters.

Drag a sub-environment before or after one of its siblings to persist that sibling order. Focused sub-environments expose the equivalent Option/Alt + Arrow Up/Down and Home/End controls. **Duplicate** creates a sibling named with the pinned `(Copy)` suffix immediately after the source, regenerates the environment and variable-row IDs, and removes import provenance so the copy is locally owned. Base environments are not reorderable or duplicable through these pinned-compatible actions.

The runner and bundled CLI resolve the same ancestry before applying collection and folder variables. Environment and folder ancestry is cycle-bounded during execution, while workspace migration removes malformed parent cycles and invalid references.

## Private sub-environments

A sub-environment can be marked **Private on this device**. Its entire descendant tree is treated as private. Private trees are omitted from:

- Brunomnia workspace exports;
- Insomnia v4/v5 compatibility exports;
- split-YAML folder and Git projects; and
- encrypted collaboration payloads.

If the active environment is private, publication selects a valid public fallback without changing the local selection. Pulling or reading a shared project preserves local private trees and avoids ID collisions with shared environments.

Private environments are an omission boundary, not encrypted storage. Use `{{ vault.name }}` or an approved external-vault tag for secrets that need encryption or managed retrieval. Plaintext-secret policy checks include collection variables and inherited folder variables, headers, and authentication.

## Import and export

Brunomnia v36 exports preserve the complete hierarchy, typed environment rows, and editor modes. Insomnia v4 compatibility exports preserve table/raw mode and disabled table rows through its environment KV-pair fields; Insomnia v4 and v5 both preserve object/array values as typed JSON data. The adapters also preserve nested folders, request placement, environment ancestry, folder headers, authentication, variables, scripts, and documentation inside their supported schemas. Imported folder and environment IDs are remapped as one batch so parent and request references remain collision-safe.

External file bytes, unsupported protocol details, and format-specific fields that have no executable Brunomnia equivalent continue to produce explicit conversion warnings instead of silent parity claims.
