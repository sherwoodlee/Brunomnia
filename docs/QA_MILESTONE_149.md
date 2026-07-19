# Milestone 149 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: remove a stale collection-tree multi-select/bulk-action requirement that is contradicted by the pinned source, without changing product behavior or broadening the Collections parity status.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `project-navigation-sidebar.tsx` derives one `selectedItemId`, produces zero or one selected key, and sets the project navigation `GridList` to `selectionMode="single"`.
- The legacy `debug.tsx` collection view routes one document per row, keeps one active request ID, and configures its separate pinned-request grid as single-select.
- `request-actions-dropdown.tsx` accepts one request; `request-group-actions-dropdown.tsx` accepts one request group. Their actions are singular.
- Repository-wide multi-selection exists in unrelated tables and settings, so the correction is narrowly scoped to collection-tree resources.

## Verification gates

| Gate | Result |
| --- | --- |
| Pinned current-tree source scan | Pass — explicit single selection and one selected route item |
| Pinned legacy-tree source scan | Pass — one active request/resource contract |
| Pinned request/folder action signatures | Pass — singular resource props and operations |
| Brunomnia product-code delta | Pass — no product source changed |
| Full Vitest suite | Pass — unchanged M148 product tree, 65 files and 460 tests |
| Production build | Pass — unchanged M148 product tree, 509 renderer modules and 5,281,322-byte CLI bundle |
| Native test suite | Pass — unchanged M148 native tree, 105 tests and 1 opt-in fixture ignored |
| macOS Tauri debug `.app` bundle | Pass — unchanged arm64 `dev.brunomnia.desktop` M148 artifact |
| Changed-path whitespace checks | Pass |

## Acceptance boundary

Milestone 149 removes only the false collection-tree multi-select/bulk-action gap. It does not turn unrelated multi-select tables into single-select surfaces and does not claim broad Collections completion. Collected-data breadth, explicit legacy response-only labeling, byte-exact wire diagnostics, and arbitrary mixed-order third-party exports remain. Collections stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 150.
