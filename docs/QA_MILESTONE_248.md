# Milestone 248 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: complete the local-project deleted-copy lifecycle with explicit irreversible deletion controls and catalog timestamp-preserving restoration across native and browser stores.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia/src/ui/components/dropdowns/sidebar-project-dropdown.tsx` labels ordinary project deletion as permanent, requires a danger confirmation, and separately explains that deleting a Git project leaves its remote repository while losing local changes.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.delete.tsx` removes project-owned local records immediately after any required remote and managed-repository cleanup. It does not expose an ordinary project trash or undo route.
- Pinned `workspace-card-dropdown.tsx` likewise says workspace deletion is permanent and cannot be undone. Brunomnia retains its safer device-local recovery-copy default, but the final permanent action must remain available without an account or subscription.

## Implementation

- Every new deleted-project group receives a bounded metadata record containing its catalog identity, display name, and original creation/update/open timestamps. Existing trash groups without metadata remain restorable.
- Restoration reuses valid original `createdAt` and `updatedAt` values, derives the display name from the workspace copy actually restored, and records the restoration as the new open time. Invalid optional metadata cannot block a valid workspace/backup restore and is preserved with the other invalid recovery artifacts.
- Exact permanent deletion validates the project ID and deletion timestamp, targets only that group's workspace, backup, encrypted vault, and metadata records, refuses non-regular native filesystem objects, and reports an already-removed group instead of broadening scope.
- Empty Recently Deleted removes only recognized regular recovery artifacts. Unrecognized files, browser keys, and the separate invalid-recovery area remain untouched.
- Recently Deleted exposes Restore and Delete for each item plus a confirmed Empty action. Both irreversible paths state that they cannot be undone, remain locked during active requests/project work, and refresh the list after completion.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused browser/native project-catalog matrix | Passed: all 40 storage tests and 10 native catalog tests, including original timestamp retention, exact purge, all-trash emptying, unrecognized-item preservation, malformed optional-metadata fallback, vault continuity/removal, corrupt-primary recovery, and ID-reuse refusal |
| Strict TypeScript project check | Passed with no diagnostics |
| Full Vitest coverage | Passed outside the listener-restricted sandbox: 86 files and 631 tests; 1 public-matrix file and 3 tests remained skipped |
| Full native coverage | Covered all 143 local tests outside the listener-restricted sandbox across the full run plus the exact established login-shell timing rerun; 4 public/live fixtures remained ignored by default |
| Packaged CLI template and runner smokes | Passed, including file/root trust, retained test source, templates/scripts/plugins/config, selection/environments, Spectral refs/rulesets, reports, proxy/TLS, and assertion evidence |
| Non-root/no-network CLI container | Passed with exact version, read-only workspace, self-contained Spectral local-reference lint, suite execution, and explicit-grant TypeScript config/plugin tags |
| Rust formatting, check, and all-target clippy | Passed with warnings denied |
| Production dependency audit | Passed: 0 npm production vulnerabilities |
| Clean TypeScript/Vite/CLI production build | Passed: 1,516 modules; 183.76 kB CSS, 13.79 kB Workspace switcher, 24.62 kB catalog, 441.58 kB main renderer, 3,274.00 kB lazy Spectral chunk, and 23,389,298-byte CLI bundle |
| Tauri debug macOS app bundle | Passed: 94,247,928-byte native binary in a 92,044 KiB `Brunomnia.app` filesystem allocation |
| Parity-row and changed-path checks | Passed: exactly 15 incomplete rows (14 `Baseline`, 1 `Early baseline`) and no whitespace errors |

The generated CLI SHA-256 remains `5ac96310ca6504b87cf4ab21a72b414ed0b5fdc27dd6c60a3c5b3fca3ab138de` because this desktop-only change does not alter the CLI bundle.

The sandbox denies localhost listeners and Docker access. The exact frontend/native suites and CLI/container smokes were rerun outside it rather than weakening fixtures or production policy. The full native run also observed the established login-shell timing fallback; its exact fixture passed on immediate rerun. No failure involved changed project-lifecycle paths.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. No screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim is made. Source-backed React controls, strict compilation, deterministic browser/native model regressions, and the production renderer cover this milestone without credentials or user data.

## Remote gate

Remote workflow, multi-architecture GHCR, Cosign, and Rekor evidence will be appended after the implementation commit reaches `main`.

## Acceptance boundary

M248 closes original catalog creation/update timestamp restoration and explicit exact/all permanent deletion for device-local project recovery copies. Brunomnia intentionally keeps recoverable deletion as the first action while exposing pinned-compatible irreversible deletion as a confirmed second action. Separate per-file physical records, truly empty projects, per-file cookie/certificate isolation, multi-version snapshots, cloud discovery, and provider onboarding remain; exactly 15 parity rows are incomplete, so Brunomnia is not feature-complete.
