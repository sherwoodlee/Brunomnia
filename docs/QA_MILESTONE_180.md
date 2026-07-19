# Milestone 180 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: replace Brunomnia's attempt-level Runner result-filter approximation with pinned assertion-row status/name filtering, share the same behavior with direct response Tests, and preserve every attempt plus all aggregate and saved evidence.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/ui/components/panes/runner-test-result-pane.tsx` always maps every request result into a card and passes the global All/Passed/Failed/Skipped and name values into each card.
- Pinned `packages/insomnia/src/ui/components/panes/request-result-card.tsx` keeps the request card visible and delegates only its assertion rows to `RequestTestResultRows`; response/error/card visibility is not filtered.
- Pinned `packages/insomnia/src/ui/components/panes/request-test-result-pane.tsx` applies exact assertion status first, then `fuzzyMatch(resultFilter, result.testCase, { splitSpace: false, loose: true })`. Request names, URLs, response status, and errors are not search fields.
- Pinned `packages/insomnia-data/common-src/search.ts` uses `fuzzysort` with a `-8000` garbage-match floor. Its package pins the compatible `^1.9.0` line; Brunomnia uses exact `fuzzysort` 1.9.0.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused row-filter/result-resolution regressions | Pass — 3 files, 44 tests |
| Full Vitest suite | Pass — 70 files, 524 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 521 renderer modules; 170.65 kB stylesheet; 63.84 kB automation workbench; 71.61 kB interchange dialogs; 430.72 kB main renderer; 5,343,117-byte CLI bundle |
| Bundled CLI startup/help | Pass — unchanged collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled Runner preview smoke | Pass — split-YAML input, selected order, data, delay, awaited skip/pass scripts, category, and timing evidence |
| Bundled localhost CLI template smoke | Pass — denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities, including pinned `fuzzysort` 1.9.0 |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- One pure filter resolves current or legacy assertion status, preserves saved order, accepts blank queries, performs case-insensitive subsequence matching through pinned fuzzysort, and rejects scores below `-8000`.
- Runner All/Passed/Failed/Skipped and name controls no longer remove request attempts or treat request/URL/status/error text as assertion names. Active, latest, and historical attempt tables remain complete.
- The selected attempt applies both controls only to retained assertion rows. PASS/FAIL/SKIP, category, duration, error, request snapshot, response snapshot, and Console evidence remain unchanged.
- Direct response Tests exposes the same four pressed-state controls and bottom name field; filtering never hides the response and controls stay absent for truly empty assertion sets.
- Latest keyed and legacy keyless Runner-result resolution remains newest-first after removing the old attempt-filter helper.
- The dependency is runtime-only, exact-versioned, lockfile-pinned, and introduces no account, network authority, script capability, cloud service, or entitlement check.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M180 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond static-render regressions, strict compilation, full suites, real CLI loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 180 accepts pinned assertion-row status and fuzzy-name filtering semantics in direct response and Collection Runner evidence. Brunomnia's flat attempt table still exposes one selected attempt's assertion rows rather than rendering every upstream request card expanded at once; aggregate attempt summaries and request/response evidence are Brunomnia's retained adaptation. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result presentation edges, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 181.
