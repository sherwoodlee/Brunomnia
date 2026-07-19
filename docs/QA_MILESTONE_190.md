# Milestone 190 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: replace Brunomnia's fixed Runner configuration/results split with a bounded, pointer-resizable, keyboard-accessible separator in horizontal and forced-vertical layouts while preserving responsive stacking and account-free local execution.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner.tsx` renders Runner configuration as a `Panel` with `minSize={35}` and `maxSize={90}`, followed by `PanelResizeHandle` and the Results `Panel`.
- The pinned handle changes from a full-height vertical divider in horizontal mode to a full-width horizontal divider in vertical mode. Its `react-resizable-panels` implementation supplies pointer resizing and separator keyboard behavior.
- Brunomnia adapts that contract to its CSS grid without adding a panel dependency. It preserves the 35–90% bound, both axes, explicit separator semantics, and responsive narrow-screen fallback.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused splitter/geometry regressions | Pass — 2 files, 9 tests |
| Full Vitest suite | Pass — 75 files, 545 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 526 renderer modules; 174.37 kB stylesheet; 68.36 kB automation workbench; 71.61 kB interchange dialogs; 433.51 kB main renderer; 5,343,153-byte CLI bundle |
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

- Pointer geometry derives the first-pane percentage from the active axis and parent bounds, clamps finite values to 35–90%, and falls back safely when geometry is invalid.
- Horizontal layouts respond to Left/Right; vertical layouts respond to Up/Down. Arrow changes use 2%, Shift+Arrow uses 10%, Home selects 35%, End selects 90%, and unrelated keys leave the value unchanged.
- The focusable separator exposes `role="separator"`, controlled pane IDs, axis-correct ARIA orientation, and current/minimum/maximum values. Pointer capture keeps drag updates associated with the handle until release.
- Horizontal wide layouts render three grid tracks: configuration, separator, and Results. Forced vertical layouts render the same tracks as rows. Automatic narrow horizontal layout hides the splitter and retains the existing stacked fallback.
- Pane size remains transient presentation state for the open Runner, not workspace data, sync data, report evidence, CLI input, or an execution option.
- No cloud, account, subscription, telemetry, entitlement, network, filesystem, or additional persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M190 therefore makes no screenshot, observed-drag, observed-keypress, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond pure geometry, static ARIA rendering, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 190 accepts pinned Runner split resizing, axis changes, and 35–90% bounds with an accessible local implementation. Brunomnia does not claim byte-identical `react-resizable-panels` pointer heuristics or persisted panel size, neither of which is an upstream Runner feature contract. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 191.
