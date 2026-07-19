# Milestone 199 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned Inso `run collection --env-var key=value` compatibility with repeated later-wins URL-query decoding and highest-precedence application to every iteration-data row.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` exposes repeatable `--env-var <key=value>` only on `run collection` and feeds the collected strings to `pathToIterationData`.
- Pinned parsing runs each argument through `URLSearchParams`, merges objects in command order so later values win, then spreads the result over every parsed JSON/CSV row. Without iteration data it creates one override row.
- Pinned `run test` does not register the option; Brunomnia now rejects that combination explicitly instead of silently accepting an ineffective flag.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused CLI override regressions | Pass — 1 file, 4 tests |
| Full Vitest suite | Pass — 77 files, 557 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 528 renderer modules; 175.18 kB stylesheet; 71.40 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,344,893-byte CLI bundle |
| Bundled CLI startup/help | Pass — collection-only repeatable `--env-var key=value` documented; existing collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled Runner preview override smoke | Pass — split-YAML input, selected order, CSV data, repeated environment overrides, exact outgoing URLs, delay, assertion evidence, and test-command rejection |
| Bundled localhost CLI template smoke | Pass — denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Repeated keys use later-wins order; percent encoding decodes, plus signs become spaces, values may contain encoded plus signs, and bare keys become empty strings like `URLSearchParams`.
- Overrides replace matching fields in every existing data row while preserving nonmatching row fields and row order.
- With no data file, one override row is created and cycles through the requested iteration count; with no override flags, the original data array identity is preserved.
- Collection execution receives the merged rows through the existing highest-precedence iteration-data scope shared by rendering and scripts.
- The packaged loopback proves two CSV rows retain their row value while one repeated CLI override replaces the file's region in four exact outgoing URLs.
- `run test --env-var` returns a visible collection-only error. No new script, file, network, vault, TLS, or plugin authority is granted.
- No cloud, account, subscription, telemetry, entitlement, network discovery, filesystem expansion, or persisted-sensitive-data behavior is introduced.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 199 accepts pinned collection environment overrides and preserves Brunomnia's explicit authority model. Interactive prompts, plugin tags, desktop local-vault access, remaining Inso commands/flags/config discovery, TLS exceptions/material, stronger portable script isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 200.
