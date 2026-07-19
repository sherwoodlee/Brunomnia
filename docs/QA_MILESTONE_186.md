# Milestone 186 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align Brunomnia's Runner Request Order pane with the pinned multi-selection, request context/navigation, drag ordering, and active-execution disabled-state contract while preserving isolated Runner drafts and account-free local execution.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner.tsx` renders Select All when none or some requests are selected, Unselect All only when every request is selected, and uses one multi-select GridList as the exact execution set.
- Each pinned row exposes a drag handle, selection checkbox, complete parent-folder ancestry, HTTP method, and clickable request name that navigates to the request.
- The GridList receives every request as disabled while execution is active. Iterations, delay, data upload/view, keep-log, bail, and run options are also disabled; active execution is therefore visually and behaviorally frozen except for dedicated live Skip/Cancel actions.
- Brunomnia additionally retains labeled up/down controls as the accessible keyboard-equivalent ordering path already accepted in its request-plan adaptation.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused plan/ancestry regressions | Pass — 2 files, 16 tests |
| Full Vitest suite | Pass — 74 files, 539 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 525 renderer modules; 173.63 kB stylesheet; 65.94 kB automation workbench; 71.61 kB interchange dialogs; 433.50 kB main renderer; 5,343,153-byte CLI bundle |
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

- Empty and all-disabled plans resolve to none, mixed enabled state resolves to partial, and complete enabled state resolves to all. Toggling complete selection disables every row; toggling none/partial enables every row; empty plans stay empty.
- Request Order shows selected/total state and labels the aggregate action Select All or Unselect All from that pure state. Individual checkboxes continue to determine the ordered execution IDs and CLI preview.
- Rows show uppercase HTTP/custom methods and full root-to-leaf folder names. Existing folder-ancestry regressions prove stable ancestor order and nested resolution.
- Request names are real buttons. Selecting one promotes the synthetic Runner document before opening the ordinary request document, preserving the Runner's isolated collection/environment/options/data/request-plan draft instead of replacing a temporary Runner tab.
- Active runs disable collection/environment selection, aggregate and row selection, request navigation, drag/drop, up/down controls, iterations, retries, bail, keep-log, delay, stream window, raw data, and upload/view actions. Dedicated live Skip and Cancel all controls remain unaffected.
- Drag/drop and up/down continue to change only the Runner plan, never collection resource order. Newly added/removed requests still reconcile into the draft through the existing target effect.
- No cloud, account, subscription, telemetry, entitlement, network, filesystem, or additional persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M186 therefore makes no screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond pure/ancestry regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 186 accepts pinned Request Order aggregate selection, row identity/context/navigation, drag selection ordering, and active-run locking. Brunomnia retains separately labeled up/down controls, a compact sidebar instead of the upstream split Request Order/Advanced tabs, and its realtime stream-window extension. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 187.
