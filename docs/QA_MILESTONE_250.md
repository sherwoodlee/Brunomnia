# Milestone 250 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: preserve genuinely empty account-free local projects, remove final-file move placeholders, and expose pinned-shaped first-file actions without requiring a persisted request or environment.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `organization.$organizationId.project.new.tsx` creates a local `Project` model and returns its ID without creating a workspace.
- Pinned `organization.$organizationId.project.$projectId._index.tsx` loads separate local files, lets its grid reach a true zero-item state, and renders `ProjectEmptyView` when no filter or file exists.
- Pinned `project-empty-view.tsx` exposes Welcome, Send a request, Create document, and Import actions. Send creates the first collection/request through the workspace-new route; document/import similarly create or add the first typed file only after explicit action.
- Pinned project-navigation regressions explicitly retain entries for projects with zero workspaces.

## Implementation

- Workspace v42 distinguishes explicit empty projects from malformed legacy documents. V42 zero-length Collection and Environment arrays survive migration with empty active IDs; v41 and older empty documents retain the established seed repair.
- Initial browser/native catalogs, newly named projects, recovery projects, and empty-project duplicates now store zero Collections, Environments, API designs, mock servers, MCP clients, or standalone suites. Snapshot history reports an exact zero typed-file count.
- Moving the final Collection, a Document with its generated Collection, or a root Environment no longer manufactures a replacement Requests or Base Environment file. Stale active IDs clear while destination-first persistence, rollback, identity preservation, and owned-evidence transfer stay unchanged.
- The renderer treats zero open valid tabs as the project dashboard. A genuinely empty project shows Welcome, Send a request, Create document, and Import; Send creates the first real Collection, while document/import paths create only their selected typed content.
- Requestless and design-only projects use an ephemeral `No Environment` execution context so the app shell, project tools, design editor, import flow, and preferences remain usable. The fallback is never serialized or counted as a project file.
- The manager's move disclosure now states that moving the final file leaves the source empty. Existing browser/native backup, snapshot, trash, restore, and catalog paths accept the v42 empty document unchanged.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused empty-project matrix | Passed: 55 storage, typed-project-file, and static dashboard-render tests, including initial/named empty creation, zero-file snapshots, v42 preservation, legacy repair, final Collection/Document/Environment source emptying, and all three welcome actions |
| Strict TypeScript project check | Passed with no diagnostics |
| Full Vitest coverage | Passed outside the listener-restricted sandbox: 88 files, 87 passed and 1 public-matrix file skipped; 637 tests passed and 3 remained skipped |
| Full native coverage | Covered all 145 local tests outside the listener-restricted sandbox across the full run plus the exact established login-shell timing rerun; 4 public/live fixtures remained ignored by default |
| Packaged CLI template and runner smokes | Passed, including file/root trust, retained test source, templates/scripts/plugins/config, selection/environments, Spectral refs/rulesets, reports, proxy/TLS, and assertion evidence |
| Non-root/no-network CLI container | Passed with exact version, read-only workspace, self-contained Spectral local-reference lint, suite execution, and explicit-grant TypeScript config/plugin tags |
| Rust formatting, check, and all-target clippy | Passed with warnings denied under the declared MSRV |
| Production dependency audit | Passed: 0 npm production vulnerabilities |
| Clean TypeScript/Vite/CLI production build | Passed: 1,516 modules; 186.06 kB CSS, 15.86 kB Workspace switcher, 20.05 kB catalog, 453.12 kB main renderer, 3,274.00 kB lazy Spectral chunk, and 23,389,423-byte CLI bundle |
| Tauri debug macOS app bundle | Passed with `--bundles app`: 94,587,736-byte native binary in a 92,376 KiB `Brunomnia.app` filesystem allocation |
| Parity-row and changed-path checks | Passed: exactly 15 incomplete rows (14 `Baseline`, 1 `Early baseline`) and no whitespace errors |

The generated CLI SHA-256 is `6fe7a9dc89cab97babb8fe09cdbd144c1d39dcdb16f061149de216d5e637c1ac`; the bundle changes because workspace migration code is shared with the headless artifact.

The sandbox denies localhost listeners and Docker access. The exact frontend/native suites and CLI/container smokes were run outside it rather than weakening fixtures or production policy. The full native run observed the established login-shell timing fallback; its exact fixture passed on immediate rerun. No failure involved changed empty-project paths.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. No screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim is made. Source-backed React controls, static server rendering, strict compilation, deterministic browser/native model regressions, and the production renderer cover this milestone without credentials or user data.

## Remote gate

Remote workflow, multi-architecture GHCR, Cosign, and Rekor evidence will be appended after the implementation commit reaches `main`.

## Acceptance boundary

M250 closes truly empty local projects and final-file source emptying without replacing Brunomnia's one-document local-project storage architecture. Separate physical workspace records and per-file cookie/certificate isolation remain; exactly 15 parity rows are incomplete, so Brunomnia is not feature-complete.
