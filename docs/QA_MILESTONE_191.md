# Milestone 191 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align Brunomnia's active Runner cards with the pinned rendered-URL contract before slow transports complete while preserving pre-request mutation, effective-response URLs, query-secret redaction, and account-free local execution.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/ui/components/panes/request-result-card.tsx` renders a live `requestUrl` containing template syntax through `RenderedText` with the request ID rather than showing the raw template.
- Pinned `packages/insomnia-smoke-test/tests/smoke/runner.test.ts` starts a ten-second request and asserts that its RUNNING card already contains the rendered `127.0.0.1:4010/delay/seconds/10` URL and no `{{` text before cancellation.
- Brunomnia already replaced prepared URLs with a transport-provided effective URL after completion. Before M191, the RUNNING card retained the raw saved URL until that response or failure settled.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner live-evidence regressions | Pass — 1 file, 38 tests |
| Full Vitest suite | Pass — 75 files, 545 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 526 renderer modules; 174.37 kB stylesheet; 68.36 kB automation workbench; 71.61 kB interchange dialogs; 433.69 kB main renderer; 5,343,798-byte CLI bundle |
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

- Each attempt now applies collection configuration and resolves the initial URL from the configured environment before publishing RUNNING, including the bounded pre-send delay interval.
- After the pre-request script updates the request and scope state, the Runner rebuilds and republishes the URL from complete global, collection, folder, iteration, and local variables before transport dispatch.
- Named sensitive query values are redacted before either prepared URL reaches live state. The regression proves a templated host resolves while a templated `token` value becomes the encoded `[redacted]` marker.
- Pre-request script skips, active skip/cancel, transport failures, retry state, and responses without an explicit effective URL retain the latest prepared rendered URL. A response-provided URL remains authoritative when present.
- Request snapshots, result cards, reports, History, Console, CLI execution, and URL/body retention budgets are unchanged.
- No cloud, account, subscription, telemetry, entitlement, network, filesystem, or additional persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M191 therefore makes no screenshot, observed-live-card, observed-cancel, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond source-backed rendering flow, focused state regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 191 accepts pinned rendered URL evidence while an attempt is active, including post-script refresh and bounded redaction. Brunomnia computes and stores the already-redacted visible string instead of mounting upstream's request-context `RenderedText` component, avoiding later access to secrets through retained raw live evidence. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 192.
