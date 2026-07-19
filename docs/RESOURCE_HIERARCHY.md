# Resource hierarchy and environments

Milestone 10 adds nested request resources and inherited environments without an account, hosted workspace, or paid entitlement.

## Collections and folders

Use the **+** action on a collection or folder to create a folder. Open a folder's settings to rename or move it and to configure variables, headers, authentication, pre-request scripts, after-response scripts, or documentation. Requests can be assigned from the folder selector above the request tabs.

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

## Environments

Open the environment editor from the top bar. Base environments have no parent. Sub-environments inherit enabled and disabled variable rows from their parent chain, with a closer value replacing an earlier value with the same name. Editing a script stores only changed or newly created values in the selected sub-environment instead of flattening all inherited values into it.

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

Brunomnia v12 exports preserve the complete hierarchy. Insomnia v4 and v5 compatibility adapters preserve nested folders, request placement, environment ancestry, folder headers, authentication, variables, scripts, and documentation inside their supported schemas. Imported folder and environment IDs are remapped as one batch so parent and request references remain collision-safe.

External file bytes, unsupported protocol details, and format-specific fields that have no executable Brunomnia equivalent continue to produce explicit conversion warnings instead of silent parity claims.
