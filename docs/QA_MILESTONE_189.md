# Milestone 189 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align Brunomnia's Runner pane orientation with the pinned Use vertical layout preference while preserving its existing responsive fallback, compact sidebar adaptation, and account-free local execution.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner.tsx` initializes Runner direction to vertical when `settings.forceVerticalLayout` is enabled. Otherwise it tracks a `(max-width: 880px)` media query and changes both the panel-group orientation and separator axis.
- Brunomnia already stacks Runner configuration and Results under its narrower responsive breakpoint, but the device-local Use vertical layout preference previously affected only the ordinary request/response workbench on wide screens.
- Brunomnia's Runner does not expose a draggable split separator. M189 therefore applies the pinned orientation state to its existing grid/stack adaptation rather than claiming pixel-identical panel resizing.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner layout regression | Pass — 1 file, 6 tests |
| Full Vitest suite | Pass — 74 files, 542 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 525 renderer modules; 173.93 kB stylesheet; 66.95 kB automation workbench; 71.61 kB interchange dialogs; 433.51 kB main renderer; 5,343,153-byte CLI bundle |
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

- `runnerLayoutDirection` maps the persisted Use vertical layout preference to explicit horizontal/vertical Runner state, preventing the automation workbench from silently ignoring the preference.
- Forced vertical Runner state changes the request/results grid to a stacked block layout, removes the configuration pane's right divider, adds the horizontal divider, and preserves minimum configuration/results heights on wide screens.
- With the preference disabled, the normal side-by-side desktop grid remains unchanged. Existing narrow-screen media rules continue to stack the same panes without depending on JavaScript viewport listeners.
- Selection, ordering, numeric drafts, data upload, live controls, result cards, History, Console, shortcuts, and execution semantics are unchanged.
- No cloud, account, subscription, telemetry, entitlement, network, filesystem, or additional persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M189 therefore makes no screenshot, observed-resize, observed-preference-toggle, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond source-backed direction state, focused regression, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 189 accepts pinned forced Runner orientation and preserves responsive stacking. Brunomnia retains a fixed compact configuration/results split instead of the pinned draggable PanelGroup and uses its existing narrower automatic breakpoint. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 190.
