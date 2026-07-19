# Milestone 204 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned Inso HTTP(S) URL support to `run collection --iteration-data` while applying the existing desktop Runner's bounded UTF-8 JSON/CSV input policy to both remote and local CLI data.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` sends iteration-data strings beginning with `http` through `fetch(...).text()` and otherwise reads them as UTF-8 files, then parses JSON or CSV and merges `--env-var` values over every row.
- Brunomnia recognizes explicit case-insensitive HTTP(S) URLs instead of every `http` prefix, requires a successful status, applies a 30-second acquisition deadline, and streams no more than the desktop Runner's 5 MB byte limit before UTF-8 decoding.
- The existing content-driven `parseRunnerData` accepts JSON arrays or CSV regardless of URL query strings or extension, preserving more robust behavior than pinned extension-only selection without changing row semantics.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused iteration-data loader regressions | Pass — 1 file, 8 tests |
| Full Vitest suite | Pass — 77 files, 561 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 528 renderer modules; 175.18 kB stylesheet; 71.41 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,350,610-byte CLI bundle |
| Bundled CLI startup/help | Pass — pinned iteration-data option remains documented |
| Bundled Runner preview remote-data smoke | Pass — localhost CSV fetch, two rows, four exact request URLs, later override, delay, timeout, bail, and assertions |
| Bundled localhost CLI template smoke | Pass — denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Ordinary paths and names beginning with `http` but lacking an HTTP(S) URL prefix use the injected local reader.
- Explicit HTTPS loads return streamed UTF-8 text; non-success status fails with visible HTTP evidence.
- Declared or streamed remote overflow and oversized local UTF-8 text fail under the same 5 MB policy before parsing.
- The packaged loopback retrieves its two-row CSV from an explicit localhost URL, merges a later CLI environment override over the file's region, and proves four exact outgoing URLs in selected request order.
- Remote data remains explicit command input; no automatic network discovery, persisted URL, script/file authority, new protocol handler, cloud, account, subscription, telemetry, entitlement, vault, TLS, or plugin authority is introduced.
- Existing local JSON/CSV paths and the `--data` compatibility alias remain functional.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 204 accepts explicit remote iteration-data inputs with stricter bounded acquisition. Interactive prompts, plugin tags, desktop local-vault access, remaining Inso commands/flags/configuration discovery, TLS exceptions/material, stronger portable script isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 205.
