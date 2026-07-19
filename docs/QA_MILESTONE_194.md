# Milestone 194 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: close M188's explicit Runner presentation boundary by showing the active configurable Send shortcut in the initial Results guidance while preserving the distinct saved empty-run state.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/ui/components/panes/runner-test-result-pane.tsx` renders `Run results will appear here`, then `Select requests and press`, the current `request_send` Hotkey, and `to run` when no execution result exists.
- The same pinned component renders `No results from this run` plus script-test guidance when a saved result exists but contains no iteration results; that state intentionally has no shortcut prompt.
- M188 wired the configurable capture-phase shortcut and exposed it in Brunomnia's Run tooltip, but explicitly deferred the empty-state Hotkey presentation.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner empty-state render regressions | Pass — 2 files, 11 tests |
| Full Vitest suite | Pass — 76 files, 549 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 527 renderer modules; 174.37 kB stylesheet; 68.51 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,344,289-byte CLI bundle |
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

- Initial Results guidance renders the normalized current Send binding in a semantic `kbd` element between the pinned instruction fragments.
- User-edited modifier combinations reuse the same shared normalization as execution and the Run tooltip; no fixed or second shortcut is introduced.
- Saved executions with no retained result rows keep `No results from this run` and script-test guidance without an inappropriate shortcut prompt.
- Live, canceled, latest, selected-history, report, Console, and account-free local execution behavior are unchanged.
- No cloud, account, subscription, telemetry, entitlement, network, filesystem, or persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M194 therefore makes no screenshot, observed-shortcut, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond source-backed component structure, focused static-render regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 194 accepts the pinned initial Runner Results Hotkey guidance and preserves the separate saved empty-run state. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 195.
