# Milestone 200 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned Inso `run collection -t, --requestNamePattern <regex>` compatibility across the full collection or an explicitly selected request plan while retaining the subject-specific `run test -t, --testNamePattern` contract.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` registers `-t, --requestNamePattern <regex>` only on `run collection`, resolves the selected item list or full workspace first, filters request names through a JavaScript `RegExp`, and then applies the selected-request order.
- When the filter removes every candidate, pinned Inso exits with `No requests identified; nothing to run.` rather than producing a successful empty report.
- Pinned `run test` independently uses the same `-t` short flag for `--testNamePattern`; Brunomnia now resolves that short flag by command subject and rejects either long flag on the wrong command.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused CLI request-filter regressions | Pass — 1 file, 5 tests |
| Full Vitest suite | Pass — 77 files, 558 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 528 renderer modules; 175.18 kB stylesheet; 71.40 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,346,537-byte CLI bundle |
| Bundled CLI startup/help | Pass — collection `-t`/`--requestNamePattern <regex>` documented alongside the separate test-name contract |
| Bundled Runner preview request-filter smoke | Pass — selected-order filtering, exact outgoing URLs, zero-match failure, wrong-command rejection, data, overrides, delay, and assertions |
| Bundled localhost CLI template smoke | Pass — denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- A full collection filters in collection order; a selected plan filters after ID/name resolution and retains the user's order.
- Missing selected IDs are inert at the pure boundary, while a zero-match CLI plan returns pinned visible failure text instead of running an empty report.
- Invalid regular expressions and patterns over 1,000 characters fail before transport; ordinary grouping and anchors pass unchanged.
- The packaged loopback selects Third, Second, First, filters to Third and First, and proves the exact two-request order across two CSV iterations while preserving environment overrides, delay, and assertions.
- `run test --requestNamePattern` returns a visible collection-only error; `run test -t` remains assigned to test-name filtering.
- No cloud, account, subscription, telemetry, entitlement, script, file, network, vault, TLS, or plugin authority is introduced.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 200 accepts pinned collection request-name regex filtering and preserves Brunomnia's explicit authority model. Interactive prompts, plugin tags, desktop local-vault access, remaining Inso commands/flags/configuration discovery, TLS exceptions/material, stronger portable script isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 201.
