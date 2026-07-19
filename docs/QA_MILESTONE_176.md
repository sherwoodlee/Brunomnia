# Milestone 176 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align Runner delay placement with pinned Insomnia by applying one bounded, interruptible delay before every transport attempt instead of after completed attempts, while preserving retries, skip/cancel, flow control, reports, CLI continuity, and account-free operation.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Runner marks the live item running, updates its execution step, awaits the configured delay, checks skip/cancel once more, and only then invokes the shared send action. The first request is delayed and no trailing wait follows the final request.
- Pinned `useRunnerRequestList` includes only documents accepted by `models.request.isRequest`, and the loop invokes ordinary `sendActionImplementation`. WebSocket, Socket.IO, and gRPC resources are not hidden Runner parity requirements; Brunomnia's bounded realtime samples are additive.
- Brunomnia extends the source loop with up to ten retries. Applying the same pre-send delay to each retry preserves one delay per actual transport attempt and keeps first-attempt behavior source-compatible.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner regressions | Pass — 1 file, 37 tests |
| Full Vitest suite | Pass — 68 files, 516 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 515 renderer modules; 167.31 kB stylesheet; 61.87 kB automation workbench; 71.61 kB interchange dialogs; 420.39 kB main renderer; 5,317,654-byte CLI bundle |
| Bundled CLI startup/help | Pass — unchanged collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled Runner preview smoke | Pass — split-YAML project input, selected request order, data, and pre-send delay |
| Bundled localhost CLI template smoke | Pass — denial, File grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Every attempt transitions to running and waits the normalized 0–30,000 ms delay before collection configuration, pre-request scripts, authentication, or transport execution. Result duration continues to measure the attempt itself rather than configuration wait time.
- A retry receives its own pre-send delay. Focused fake-timer evidence proves neither first nor second transport starts one millisecond early and confirms the recovered retry report remains ordered.
- The shared runner normalizes programmatic values to 0–30,000 ms; focused evidence proves a 60-second input starts transport at exactly the 30-second ceiling.
- Skip during an active delay aborts its timer, starts no transport, marks the item skipped, and does not set the run-level canceled flag. Cancel uses the same abortable wait and retains its separate report state.
- Trailing per-item and post-final waits are removed, so completed runs finish immediately after their last result and report callback.
- Desktop and bundled collection CLI execution continue through the same shared runner. Run via CLI generation, `--delay-request`/`--delay`, split-YAML input, data rows, request ordering, and trust grants remain unchanged.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M176 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed timing semantics, strict compilation, deterministic fake-timer regressions, full suites, and packaged-app verification.

## Acceptance boundary

Milestone 176 accepts pinned pre-send delay placement, first-request coverage, no trailing wait, per-retry extension behavior, and skip/cancel interruption before transport. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner and Headless CLI stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 177.
