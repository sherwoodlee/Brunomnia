# Milestone 195 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: replace immediate Runner History deletion with the pinned per-entry two-click confirmation and two-second expiry while preserving exact local report removal and selected-result continuity.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/ui/components/panes/runner-result-history-pane.tsx` wraps each delete action in `PromptButton` with empty confirmation/done text.
- Pinned `packages/insomnia/src/ui/components/base/prompt-button.tsx` consumes the first click, renders a warning with `Click again to confirm`, resets after 2,000 ms, and invokes the delete callback only on a second click while armed.
- Brunomnia previously invoked `discardRunnerReport` on the first History delete click, making the device-local deletion less guarded than the pinned interaction.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner delete-decision regression | Pass — 1 file, 10 tests |
| Full Vitest suite | Pass — 76 files, 550 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 527 renderer modules; 174.46 kB stylesheet; 69.00 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,344,289-byte CLI bundle |
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

- The first click arms only the clicked report, clicking another report transfers confirmation, and a second click on the same report confirms deletion.
- Arming clears after 2,000 ms; component cleanup cancels a pending timer when the Runner document unmounts.
- The armed button exposes `Click again to confirm`, an amber warning, and a `Confirm delete` accessible label; no report is removed until confirmation.
- Confirmed removal still uses the existing exact-ID bounded report helper and clears selection only when the selected report was deleted.
- Report contents, History accounting, exports, Console evidence, account-free storage, and all execution behavior are unchanged.
- No cloud, account, subscription, telemetry, entitlement, network, filesystem, or persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M195 therefore makes no screenshot, observed-confirmation, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond source-backed state logic, focused pure regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 195 accepts the pinned guarded Runner History deletion flow through an accessible local implementation. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 196.
