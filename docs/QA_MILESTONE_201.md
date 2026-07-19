# Milestone 201 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: accept pinned Inso collection option names `-i, --item`, `-n, --iteration-count`, `-d, --iteration-data`, and `-b, --bail`, and make the desktop Run via CLI preview emit the pinned long spellings without removing Brunomnia's earlier aliases.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` registers repeatable `-i, --item <requestid>`, `-n, --iteration-count <count>`, `-d, --iteration-data <path/url>`, and boolean `-b, --bail` on `run collection`.
- Brunomnia already implemented the corresponding request-plan, bounded iteration, local JSON/CSV data, and retry-aware bail behavior under `--request`, `--iterations`, `--data`, and long `--bail`; this milestone closes the safe command-spelling gap while retaining those existing aliases.
- Pinned `--item` can also select a folder. Brunomnia accepts request IDs or unambiguous request names through this alias; folder-item expansion remains part of the broader Inso gap and is not claimed here.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused generated-command regressions | Pass — 1 file, 5 tests |
| Full Vitest suite | Pass — 77 files, 558 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 528 renderer modules; 175.18 kB stylesheet; 71.41 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,346,654-byte CLI bundle |
| Bundled CLI startup/help | Pass — pinned item, iteration-count, iteration-data, and bail spellings documented |
| Bundled Runner preview alias/bail smoke | Pass — selected order, two data iterations, exact URLs, overrides, delay, assertions, controlled failure, and short-flag bail |
| Bundled localhost CLI template smoke | Pass — denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Generated commands use repeated `--item` IDs in exact selected order, bounded `--iteration-count`, `--iteration-data`, long `--bail`, and unchanged POSIX shell quoting.
- Default and out-of-range controls continue to omit or clamp exactly as the desktop Runner does.
- The packaged loopback uses all three pinned value aliases while preserving request-name filtering, two CSV iterations, later-wins environment overrides, exact selected request order, delay, and assertion evidence.
- A second packaged run uses `-b` with a controlled HTTP 500 first item and proves the report is bailed before its selected second request executes.
- Existing `--request`, `--iterations`, and `--data` aliases remain accepted; no persisted project, report schema, renderer, script, file, network, vault, TLS, or plugin authority changes.
- No cloud, account, subscription, telemetry, or entitlement behavior is introduced.

## Manual/rendered QA

This milestone changes generated command text and the headless CLI. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted. No rendered copy-dialog or clipboard claim is made beyond the pure command regression and packaged execution.

## Acceptance boundary

Milestone 201 accepts pinned collection option spellings for request items, iterations, data, and bail while preserving earlier Brunomnia aliases. Folder `--item` expansion, interactive prompts, plugin tags, desktop local-vault access, remaining Inso commands/flags/configuration discovery, TLS exceptions/material, stronger portable script isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 202.
