# Milestone 192 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align Brunomnia's saved Runner duration with the pinned sum of completed response durations across History and every export reporter while preserving additive retry evidence, bounded values, and legacy report compatibility.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner.tsx` initializes `testCtx.duration` to zero and adds `resultCollector.duration` only after `sendActionImplementation` completes without throwing. The saved `RunnerTestResult.duration` receives that sum.
- Pinned failures caught before the completed path do not add duration. HTTP responses and assertion-bearing completed sends do; delay, script-only time, queued skips, cancellation, and pre-response transport failures do not.
- Pinned `packages/insomnia/src/ui/components/panes/runner-result-history-pane.tsx` formats `runnerResult.duration` directly. M183 matched its formatting thresholds but used Brunomnia report wall-clock timestamps as the source; M192 corrects that adaptation.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner duration/storage/report regressions | Pass — 4 files, 86 tests |
| Full Vitest suite | Pass — 75 files, 546 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 526 renderer modules; 174.37 kB stylesheet; 68.31 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,344,289-byte CLI bundle |
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

- New reports carry optional `durationMs` evidence accumulated only from finite, nonnegative, response-bearing attempts that complete without a runner/transport exception. The total is capped at JavaScript's safe integer maximum.
- Brunomnia's additive retry model sums every completed response attempt, including a response later retried for HTTP/assertion failure. Skipped, canceled, pre-request-skipped, and pre-response-failed attempts contribute zero.
- History prefers the explicit value, preserving the pinned unit thresholds and precision. Older reports without it retain their valid started/finished wall-clock result, then fall back to summed nonnegative attempt duration only when timestamps are invalid.
- Every text reporter summary, JSON report envelope, and JUnit suite time uses the same helper. Per-attempt testcase times remain unchanged.
- Existing report version, 30-report retention, selected History export, collection/folder scoping, request/assertion counts, and account-free local storage are unchanged.
- No cloud, account, subscription, telemetry, entitlement, network, filesystem, or additional persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M192 therefore makes no screenshot, observed-duration, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond source-backed accumulation, focused model/reporter regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 192 accepts pinned saved Runner duration source and shared presentation/export use. Brunomnia retains additive response-bearing retry duration, optional-field compatibility for existing version-1 report envelopes, and legacy wall-clock fallback rather than rewriting old device-local evidence. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 193.
