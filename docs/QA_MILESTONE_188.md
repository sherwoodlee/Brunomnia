# Milestone 188 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align Brunomnia's open Runner with the pinned configurable Send shortcut while preserving active/empty execution guards, device-local preferences, and account-free local execution.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner.tsx` registers `request_send` through `useDocBodyKeyboardShortcuts` and calls Run only when `isDisabled` is false. That guard is true while execution is active or the selected request set is empty.
- Pinned `packages/insomnia/src/ui/components/keydown-binder.ts` attaches document shortcuts to `window` in the capture phase so focused React Aria controls cannot swallow them. The pinned empty Results state also renders the current Send hotkey beside its run instruction.
- Brunomnia uses the same editable device-local Send shortcut already shared by ordinary request execution. It retains the app-wide non-repeating key policy and exposes the active binding in the Run button tooltip rather than duplicating a second shortcut preference.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused shortcut regressions | Pass — 2 files, 7 tests |
| Full Vitest suite | Pass — 74 files, 541 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 525 renderer modules; 173.63 kB stylesheet; 66.86 kB automation workbench; 71.61 kB interchange dialogs; 433.51 kB main renderer; 5,343,153-byte CLI bundle |
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

- The open Runner listens for its current `workspace.preferences.shortcuts.send` binding on `window` in the capture phase, matching the pinned document-level interception point even while an input, select, textarea, or dialog control has focus.
- Exact shortcut matching reuses Brunomnia's normalized Mod/Meta/Control, Alt, Shift, and key semantics. A changed Send preference therefore affects ordinary requests and Runner execution together without introducing a hidden fixed binding.
- Active runs, empty selections, mismatched combinations, and repeating keydown events do not start another run. A valid event prevents the browser default and enters the same `start()` path as the visible button, preserving draft promotion, stale-report clearing, request order, and execution validation.
- The Run button tooltip renders the current normalized binding with the existing `⌘/Ctrl` platform-neutral Mod label. Run and Run via CLI retain their zero-selection disabled state.
- No cloud, account, subscription, telemetry, entitlement, network, filesystem, or additional persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M188 therefore makes no screenshot, observed-keypress, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond source-backed event wiring, pure shortcut regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 188 accepts pinned open-Runner Send-shortcut execution, capture-phase interception, and active/empty guards. At this milestone Brunomnia displayed the shortcut in the Run tooltip rather than reproducing the pinned empty-state Hotkey component; Milestone 194 closes that presentation boundary. Brunomnia retains its app-wide repeat suppression. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 189.
