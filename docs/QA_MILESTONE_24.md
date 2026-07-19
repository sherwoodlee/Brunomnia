# Milestone 24 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: persistent mixed collection-resource ordering, native sidebar drag targets, request/folder reparenting, cross-collection folder-subtree transfer, and migration safety.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 24 files, 131 tests |
| Vite production build | Pass — 153 modules; 475.03 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 480,049-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 20 tests passed; the unchanged loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build, native checks, and packaging used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled. The native source did not change in this milestone. The sandbox result remains 20/21: only the unchanged integration that opens a loopback listener was denied. No 21/21 claim is made.

## Focused coverage

- A persisted order list interleaves request and folder siblings while child filtering preserves folder ancestry.
- Requests reorder around either resource kind and reparent into a folder without changing identity; the target folder opens automatically.
- A folder and its complete descendant folder/request subtree transfer between collections while preserving IDs and internal parents.
- A folder move into its own descendant returns the original workspace object without mutation.
- Collections reorder before or after the requested collection target.
- Workspace migration drops missing, duplicate, and non-string order entries, then appends every omitted valid resource exactly once.
- Merged artifact imports remap resource-order IDs through the same collision-safe batch IDs used for folders and requests.
- Search-filtered trees disable drag starts rather than applying an order derived from hidden siblings.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The drag targets, cursor/opacity states, before/after lines, center-drop highlight, and title guidance are typechecked and production-built, but pointer geometry, scrolling during drag, visual polish, and assistive-technology behavior are not claimed as manually validated.

## Acceptance boundary

This evidence accepts persistent native pointer drag/drop for collections, folders, and requests. It does not claim keyboard-equivalent tree reordering, multi-select or bulk moves, drag behavior while search is active, environment-tree ordering, or lossless arbitrary mixed sibling order in every third-party compatibility format. Other gaps remain in [PARITY.md](PARITY.md).

Milestone 152 later closes mixed nested request/folder order for Brunomnia's supported hierarchical Insomnia v4 and v5 import/export formats through their native sort-key fields. Formats that do not carry the same hierarchy remain bounded by their own schemas rather than a universal cross-format ordering claim.
