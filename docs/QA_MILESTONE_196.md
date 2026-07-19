# Milestone 196 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: replace Brunomnia's single-row Request Order drag adaptation with the pinned selected-key block move, explicit before/after drop placement, and dedicated drag handle while preserving execution selection and accessible up/down controls.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner.tsx` uses one multi-select GridList and passes `event.keys` to `moveBefore` or `moveAfter` according to the drop position.
- Pinned `packages/insomnia/src/ui/utils.ts` sorts moving indices by current list order and repositions them together, preserving relative order even when selected rows are nonadjacent.
- A pinned row exposes a dedicated `Button slot="drag"`; dragging an unselected item supplies that item, while dragging a selected item supplies the selected key set through React Aria's collection drag contract.
- M186 added checkbox selection and HTML drag ordering but moved only one stored request ID and treated the entire row as the drag source.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner plan drag regressions | Pass — 1 file, 13 tests |
| Full Vitest suite | Pass — 76 files, 553 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 527 renderer modules; 174.61 kB stylesheet; 69.73 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,344,289-byte CLI bundle |
| Bundled CLI startup/help | Pass — unchanged collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled Runner preview smoke | Pass — split-YAML input, selected order, data, delay, and assertion evidence |
| Bundled localhost CLI template smoke | Pass — denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Dragging an included request selects every enabled plan ID in current order; dragging an excluded request selects only that row; missing IDs produce no drag set.
- Before/after block moves preserve the current relative order of nonadjacent moving requests and leave each request's enabled state unchanged.
- Empty, invalid-target, invalid-moving, and target-inside-moving-set drops are no-ops rather than corrupting or duplicating the plan.
- The explicit handle exposes a request-specific accessible label, selected-count tooltip, move data, and active-run disabled state. The row midpoint selects before versus after placement.
- Existing labeled up/down controls remain the single-row keyboard-equivalent path. Neither ordering path changes collection resource order or report evidence.
- No cloud, account, subscription, telemetry, entitlement, network, filesystem, or persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M196 therefore makes no screenshot, observed-drag, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond source-backed reorder logic, focused pure regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 196 accepts pinned selected-key Runner plan dragging through a native HTML before/after adaptation plus the existing accessible up/down controls. Exact React Aria drag-preview styling and pointer heuristics are not claimed as feature behavior. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 197.
