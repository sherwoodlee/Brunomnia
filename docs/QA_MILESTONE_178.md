# Milestone 178 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: expose assertion-level evidence in the selected Collection Runner attempt while preserving saved-report continuity, bounded local evidence, account-free operation, and an honest boundary around fields Brunomnia does not retain.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/ui/components/panes/request-test-result-pane.tsx` presents each selected request assertion with outcome, test name, error, category, and execution time.
- Brunomnia's saved `ScriptTestResult` model contains only `name`, `passed`, and optional `error`. M178 renders those retained fields and does not invent category or per-assertion timing.
- Active, latest, and reopened historical attempt panes already resolve through one saved `RunnerItemResult`; the assertion list consumes that same immutable evidence rather than adding a parallel store.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused assertion-evidence regressions | Pass — 1 file, 2 tests |
| Full Vitest suite | Pass — 69 files, 519 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 516 renderer modules; 169.47 kB stylesheet; 63.60 kB automation workbench; 71.61 kB interchange dialogs; 421.09 kB main renderer; 5,317,654-byte CLI bundle |
| Bundled CLI startup/help | Pass — unchanged collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled Runner preview smoke | Pass — split-YAML project input, selected request order, data, and pre-send delay |
| Bundled localhost CLI template smoke | Pass — denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- The pure assertion component preserves saved order and reports aggregate assertion, pass, and fail counts.
- Every retained assertion shows an explicit PASS or FAIL state and its saved name. Recorded multiline errors remain visible, while a failed assertion without an error gets a truthful missing-error state.
- An attempt without script assertions gets an explicit empty state instead of a blank pane.
- Static rendering verifies status multiplicity, names, safely escaped error text, missing-error behavior, and the empty state without requiring a browser or full workbench mount.
- The selected-attempt integration appears before bounded request/response snapshots and works unchanged for active, latest, and reopened historical results.
- No account, cloud service, upload, entitlement, or new script authority is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M178 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond static-render regressions, strict compilation, full suites, and packaged-app verification.

## Acceptance boundary

Milestone 178 accepts selected-attempt assertion outcome/name/error inspection through Brunomnia's retained result model. It does not claim upstream category or per-assertion execution-time parity until those fields are produced and persisted end to end. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 179.
