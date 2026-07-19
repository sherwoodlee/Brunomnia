# Milestone 184 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align Brunomnia's active and manually canceled Runner Results mode with the pinned live-progress pane, including exact aggregate wording, Cancel all placement, finished-state accounting, canceled-card continuity, assertion-toolbar suppression, source empty states, and isolation from a prior saved report during startup.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/ui/components/panes/runner-live-progress-pane.tsx` computes finished items through the shared finished-state helper, subtracts skipped and canceled items from its numerator, renders `${isRunning ? 'Running' : 'Finished'} finished / total requests (skipped skipped, canceled canceled)`, and exposes Cancel all only while active.
- The same pane groups every live item by iteration, keeps cards collapsed while active, remounts them expanded after execution, and has no assertion filter toolbar.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner.tsx` keeps `RunnerLiveProgressPane` mounted while `isRunning || canceledRun`; a normal completed run switches to `RunnerTestResultPane`, while a manually canceled run remains in finished live mode.
- Pinned `packages/insomnia/src/ui/components/panes/runner-test-result-pane.tsx` distinguishes `Run results will appear here` before any result from `No results from this run` when a saved execution contains no iteration results.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused live-feedback/runner-core regressions | Pass — 2 files, 43 tests |
| Full Vitest suite | Pass — 73 files, 535 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 524 renderer modules; 172.06 kB stylesheet; 64.46 kB automation workbench; 71.61 kB interchange dialogs; 433.41 kB main renderer; 5,343,153-byte CLI bundle |
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

- The shared finished-state helper recognizes completed, failed, skipped, and canceled, but not pending/running. Core live-item update and finish-unfinished paths now consume that one rule.
- Live summary Total is every item; Finished is completed plus failed; Skipped and Canceled remain separate. The exact active and settled labels are covered with mixed completed/failed/skipped/canceled/running input.
- Results uses live mode while active or manually canceled. It shows one sticky summary and Cancel all while active, removes the action after settlement, omits assertion status/name controls in both live states, and continues rendering every iteration/card.
- Manual cancellation sets live mode before aborting the active transport/OAuth flow and marking unfinished items. When the runner settles, the same live items remount with `isRunning=false`, completed/failed cards expand, and canceled/skipped cards remain visible.
- Starting another run, changing collections, or opening a History row clears canceled mode. Current-run selection is explicit while running/canceled, so an old latest report cannot fill the empty interval before the new run publishes its planned items.
- Normal completed runs still expose saved assertion filters. Empty Results now distinguishes the pinned pre-run and empty-run messages without changing report retention, exports, Console, or History.
- No new network, filesystem, cloud, account, telemetry, entitlement, or persisted-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M184 therefore makes no screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond pure regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 184 accepts pinned live-progress accounting/text, active Cancel all action, active/canceled pane selection, filter absence, card transition, and Results empty-state semantics. Brunomnia retains its separate aggregate header, History/Console tabs, bounded snapshots, and immediate post-cancel export/run controls as local adaptations. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 185.
