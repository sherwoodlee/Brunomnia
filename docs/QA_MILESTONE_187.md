# Milestone 187 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align Brunomnia's Runner numeric controls and empty-selection run guard with the pinned editable-input contract while preserving bounded execution values, isolated Runner drafts, and account-free local execution.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner.tsx` keeps separate visible `zeroableIterationCount` and `clearableDelay` strings beside valid internal iteration/delay numbers. A field can be cleared for editing without replacing the internal value, base-10 `Number.parseInt` supplies valid updates, and blur restores the internal value.
- Pinned uploaded data adopts its nonempty row count as the internal iteration count, whose effect synchronizes the visible draft. Pinned Run and Run via CLI controls share `isDisabled`, which is true while active or when the selected request set is empty.
- Brunomnia extends the same draft/value boundary to its bounded retries and stream-window controls. Its existing explicit iteration, retry, delay, and stream limits remain safety constraints rather than a claim that pinned Insomnia exposes identical maxima.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused numeric-draft/Runner regressions | Pass — 2 files, 42 tests |
| Full Vitest suite | Pass — 74 files, 540 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 525 renderer modules; 173.63 kB stylesheet; 66.46 kB automation workbench; 71.61 kB interchange dialogs; 433.50 kB main renderer; 5,343,153-byte CLI bundle |
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

- `parseRunnerNumberDraft` treats blank, nonnumeric, below-minimum, and above-maximum drafts as non-executable while using the pinned base-10 `Number.parseInt` behavior for accepted values, including truncating decimal text.
- Iterations, retries, delay, and stream window each retain a visible string draft independently from their last valid numeric execution value. Accepted edits update both; invalid edits cannot inject `NaN`, zero iterations, excessive retries, negative delay, or an unsafe stream window into Runner state.
- Blur restores the last valid value so unresolved drafts cannot remain visually authoritative after editing ends. Applying iteration data updates both the internal iteration count and visible input immediately.
- Run now shares Run via CLI's existing zero-selection guard. An empty plan cannot start a misleading zero-request report, while aggregate and row selection continue to determine exact execution order.
- Existing active-run locking, isolated per-document draft persistence, data parsing, CLI preview, request execution, reports, and cancellation semantics remain unchanged.
- No cloud, account, subscription, telemetry, entitlement, network, filesystem, or additional persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M187 therefore makes no screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond source-backed state transitions, focused regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 187 accepts pinned clearable Runner numeric editing, last-valid blur restoration, upload-driven iteration synchronization, and empty-selection Run locking. Brunomnia retains explicit safety maxima, retries, a realtime stream-window extension, and its compact sidebar adaptation. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 188.
