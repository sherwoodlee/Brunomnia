# Milestone 193 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: keep the pinned Runner Results pane active throughout execution so live progress, skip, and cancellation controls cannot be hidden by a previously selected History or Console pane, while restoring that inactive selection after the run.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner.tsx` derives `activeTab` as `isRunning ? 'results' : selectedTab` and supplies that controlled key to the Results/History/Console tab set.
- The selected inactive tab is not overwritten. While active, Results remains selected and renders `RunnerLiveProgressPane`; after settlement, the prior History or Console selection can become active again.
- Brunomnia previously rendered its raw selected pane throughout execution, allowing a run started from History or Console, or a mid-run tab click, to hide live cards and the Cancel all control.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner pane-selection regression | Pass — 1 file, 9 tests |
| Full Vitest suite | Pass — 75 files, 547 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 526 renderer modules; 174.37 kB stylesheet; 68.35 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,344,289-byte CLI bundle |
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

- A shared pure selector forces Results only while an execution is active.
- History and Console remain valid selected panes while idle and are restored without overwriting the user's selection after execution.
- The controlled active pane drives both visible content and `aria-pressed` state, keeping live progress, per-item Skip, and Cancel all reachable throughout a run.
- Canceled-run continuity, saved History selection, Console evidence, report persistence, and account-free local execution are unchanged.
- No cloud, account, subscription, telemetry, entitlement, network, filesystem, or persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M193 therefore makes no screenshot, observed-tab, observed-cancel, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond source-backed controlled-state logic, focused regression coverage, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 193 accepts the pinned active Runner pane-selection contract while preserving post-run inactive selection. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 194.
