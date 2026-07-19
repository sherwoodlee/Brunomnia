# Milestone 182 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: replace Brunomnia's local Runner-card status and response-stat approximations with the pinned shared feedback contract for lifecycle labels, HTTP reason fallback, status tones, rounded duration, long byte units, unit thresholds, and absent/negative values.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/common/runner-feedback.ts` fixes PENDING/RUNNING/CANCELED/SKIPPED labels, combines positive response codes with an explicit message or the standard reason table, falls back to `ERROR` when completed/failed feedback has neither, and assigns success/warning/error treatment to 2xx/3xx/other codes.
- The same helper rounds nonnegative response time to integer `ms`, formats nonnegative response size through long `bytes`/`kilobytes`/`megabytes`/`gigabytes` names, changes units at twice each binary boundary, rounds the scaled value to one decimal, joins available fields with ` - `, and omits absent/negative fields.
- Pinned `packages/insomnia/src/common/__tests__/runner-feedback.test.ts` records the representative `200 OK`, `404 Not Found`, `37ms - 212 bytes`, `1ms - 4 kilobytes`, 2xx/3xx/5xx tone, and missing-code `ERROR` examples.
- Pinned `packages/insomnia/src/ui/components/panes/request-result-card.tsx` consumes those helpers for every live and saved request card. Brunomnia now does the same through one account-free renderer helper.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused feedback/card regressions | Pass — 2 files, 7 tests |
| Full Vitest suite | Pass — 72 files, 531 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 523 renderer modules; 171.50 kB stylesheet; 66.17 kB automation workbench; 71.61 kB interchange dialogs; 430.73 kB main renderer; 5,343,117-byte CLI bundle |
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

- Status labels prefer an explicit message, use the complete pinned standard-reason inventory when it is absent, preserve a bare message without a positive code, and leave unknown positive codes visible as the code alone.
- Pending/running/canceled/skipped tags remain fixed regardless of HTTP fields. Completed/failed tags use 2xx success, 3xx warning, all-other error treatment, with `ERROR` when no label can be formed.
- Response time rounds to integer milliseconds. Size first rounds raw bytes to one decimal, stays in bytes below 2 KiB, then uses KiB/MiB/GiB divisors with long pinned unit names at the 2 KiB/2 MiB/2 GiB boundaries and one-decimal scaled rounding.
- Undefined and negative time/size values contribute no placeholder or separator. Card summaries therefore expose only available valid feedback while request attempts, assertions, snapshots, history, aggregate counts, and exports remain unchanged.
- The card static-render regression confirms the shared `12ms - 42 bytes` output together with status, expanded evidence, request/response snapshots, assertion rows, and accessible expansion state.
- The helper introduces no network call, filesystem authority, account, subscription, telemetry, entitlement branch, or persisted data.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M182 therefore makes no screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond pure/static-render regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 182 accepts the pinned Runner status-label, standard-reason, lifecycle-tag, code-tone, response-time, response-size, threshold, separator, and absent/negative-value contract in every active/latest/history attempt card. It does not replace Brunomnia's bounded request/response snapshot adaptation or claim pixel-identical tag colors. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 183.
