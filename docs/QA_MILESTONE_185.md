# Milestone 185 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add the pinned Runner Results `passed / total` assertion badge and saved-execution duration tag while preserving the distinct History icon rule, live-progress isolation, current/legacy assertion status, and account-free local reports.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner.tsx` traverses every assertion only when the runner is not active, increments Passed only for `status === 'passed'`, increments Total for passed/failed/skipped alike, and always renders `${passedTestCount} / ${totalTestCount}` in the Results tab.
- The route gives the badge a neutral treatment at zero, success only when Total is nonzero and Passed equals Total, and failure otherwise. A skipped assertion therefore makes the Results badge non-green even though the separate History row icon fails only on a failed assertion.
- The same route renders a total-duration tag only when the selected execution has nonzero duration and formats it through the shared strict ms/s/m helper audited in M183.
- Active Results remains pinned to `0 / 0`; active and manually canceled live mode must not borrow a duration from an older saved execution.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Results/History summary regressions | Pass — 1 file, 4 tests |
| Full Vitest suite | Pass — 73 files, 536 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 524 renderer modules; 172.53 kB stylesheet; 64.95 kB automation workbench; 71.61 kB interchange dialogs; 433.41 kB main renderer; 5,343,153-byte CLI bundle |
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

- One shared assertion summary traverses all retained results, resolves current passed/failed/skipped status before legacy booleans, and returns exact Passed, Failed, Skipped, and Total values.
- Empty evidence returns `0 / 0` with neutral tone. All-passed evidence returns success. Any failed or skipped assertion returns failure, matching the pinned Results badge rather than History's failed-assertion-only icon.
- Active execution forces neutral `0 / 0`. Settled latest, selected historical, and manually canceled current evidence use their retained assertion rows without changing card visibility, filters, report aggregates, exports, or Console.
- Completed latest and selected historical reports reuse the exact M183 duration helper and expose raw milliseconds as a tooltip. Duration stays absent while active or in manually canceled live mode so no prior saved execution can leak into current progress.
- Badge and duration styling is local, keyboard-tab labels remain ordinary buttons, and the assertion-count title gives an explicit `passed of total assertions passed` accessible description.
- No new network, filesystem, cloud, account, telemetry, entitlement, or persisted-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M185 therefore makes no screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond pure regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 185 accepts pinned Results assertion totals/tone and saved-execution duration display. It preserves the intentionally different pinned History rule and Brunomnia's additive retry evidence, raw-duration tooltip, aggregate attempt header, bounded snapshots, and export formats. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 186.
