# Milestone 156 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: move workspace-wide and folder-scoped collection Runner routes into Brunomnia's persistent shared document strip with pinned synthetic IDs, target filtering, run promotion, and dashboard continuity.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `use-insomnia-tab.ts` builds a workspace Runner ID as `runner_<workspaceId>` and a folder Runner ID as `runner_<folderId>`, assigns the `runner` tab type/name, and routes both through ordinary tab navigation.
- Route synchronization creates a temporary Runner tab when no matching tab exists. The Runner route promotes its synthetic tab before execution.
- The folder actions dropdown launches Runner with the folder resource; workspace actions launch the workspace Runner. Both navigate to the same Runner route with an optional folder query.
- Pinned Runner context keys unsaved selection, delay, iteration, and request-list state by Runner ID. Brunomnia now matches resource identity and execution scope; unsaved control remount continuity remains explicitly open.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused tab and runner regressions | Pass — 2 files, 24 tests |
| Full Vitest suite | Pass — 65 files, 467 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 509 renderer modules; 150.89 kB stylesheet; 374.41 kB main renderer; 5,283,187-byte CLI bundle |
| Bundled CLI startup/help | Pass |
| Bundled localhost CLI template smoke | Pass — denial, File grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 105 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Legacy request/folder tab storage remains readable, while bounded typed Runner tabs survive parse/reconciliation with the shared one-temporary-tab invariant.
- Workspace and folder Runner IDs coexist as distinct documents and share promotion, active history, cycling, pointer ordering, close/reopen, Close All/Others, and final-tab dashboard behavior.
- Activity-rail and command-palette actions open or activate the workspace Runner instead of bypassing document state. Folder panes expose a separate Run folder action.
- Folder target resolution locks the owning collection, includes direct and nested descendants in source order, excludes unrelated/root requests, and resolves missing folders to an empty plan rather than the full collection.
- The embedded account-free Runner retains environment selection, ordered inclusion, iteration data, iterations, retries, delay, bail/cancel, OAuth status, protocol sampling, detailed request/response evidence, saved reports, and JSON/JUnit downloads.
- Starting execution promotes a temporary Runner tab. Deleting a folder removes its folder Runner reference through the same reconciliation used for deleted request/folder documents.
- Request-only send/edit/generate shortcuts remain suppressed while Runner is active; the last internal request stays available for data continuity without appearing selected.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. M156 makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed roles/labels, strict compilation, pure state/target evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 156 accepts pinned workspace/folder Runner document identity, target scope, run promotion, and shared tab lifecycle. Unsaved Runner controls currently remount after leaving the pane, and environment, collection/design, mock-server/route, and test-suite resources still do not share the strip. Collections and Collection runner remain `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 157.
