# Milestone 198 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align Runner History timestamps with the pinned fixed local `yyyy-MM-dd HH:mm:ss` presentation across row text, tooltips, and guarded delete labels instead of device-locale-dependent output.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/ui/components/panes/runner-result-history-pane.tsx` formats `runnerResult.created` through date-fns as `yyyy-MM-dd HH:mm:ss` and uses that fixed value in the Source tooltip.
- The format uses local date/time fields but has stable zero-padded order and punctuation across operating-system locale settings.
- Brunomnia previously rendered `startedAt` with `toLocaleString()`, allowing field order, separators, 12/24-hour mode, seconds, and punctuation to vary by device locale.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner History presentation regressions | Pass — 1 file, 6 tests |
| Full Vitest suite | Pass — 77 files, 556 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 528 renderer modules; 175.18 kB stylesheet; 71.40 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,344,289-byte CLI bundle |
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

- Local year, month, day, hour, minute, and second fields receive exact zero padding and pinned punctuation.
- ISO strings and Date instances representing the same instant produce the same local presentation. Invalid legacy values receive an explicit stable `Invalid date` label.
- History row text and title use the shared value; Delete/Confirm delete accessible labels reference the identical timestamp.
- Report storage remains ISO-based. No timezone conversion, persistence migration, report mutation, export change, or CLI change is introduced.
- No cloud, account, subscription, telemetry, entitlement, network, filesystem, or persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M198 therefore makes no screenshot, observed-date, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond source-backed formatting, focused pure regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 198 accepts pinned fixed local Runner History timestamps while retaining Brunomnia's more descriptive source names and visible date subline. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 199.
