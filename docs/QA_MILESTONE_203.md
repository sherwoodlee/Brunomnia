# Milestone 203 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned Inso `run collection` and `run test --requestTimeout <duration>` compatibility as a per-invocation default for primary, dependent, and saved suite HTTP/GraphQL sends.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` registers `--requestTimeout <duration>` on both run commands and passes `Number.parseInt(value, 10)` as the send callback's timeout option when supplied.
- Pinned `packages/insomnia-inso/src/cli.test.ts` verifies a two-second request succeeds with `--requestTimeout 3000` and exits nonzero with `--requestTimeout 1000`.
- Brunomnia applies the parsed override as the existing global timeout input, so request-level `timeoutMode: custom` remains higher precedence and `timeoutMode: global` receives the CLI value. This matches the desktop transport hierarchy while preserving pinned invocation behavior.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused request-timeout regressions | Pass — 1 file, 7 tests |
| Full Vitest suite | Pass — 77 files, 560 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 528 renderer modules; 175.18 kB stylesheet; 71.41 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,349,239-byte CLI bundle |
| Bundled CLI startup/help | Pass — request timeout documented on collection and test commands |
| Bundled Runner preview timeout smoke | Pass — inherited 120 ms request succeeds at 500 ms and records status-zero failure at 20 ms |
| Bundled localhost CLI template smoke | Pass — denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- An omitted flag retains the normalized workspace timeout; ordinary milliseconds and pinned integer-prefix strings parse successfully.
- `0` disables the inherited deadline, negative values clamp to zero, and oversized values clamp to the existing 32-bit desktop maximum.
- Non-numeric input fails visibly before any request; `--request-timeout` remains a kebab-case convenience alias.
- The packaged loopback sends the same 120 ms inherited-timeout request with a 500 ms override and receives HTTP 200, then with 20 ms and records a failed status-zero attempt plus nonzero process exit.
- The override flows through the shared `executeAndStore` path used by collection requests, dependent response tags, standalone saved-request sends, and granted secondary sends. Request-level custom deadlines remain authoritative.
- No report schema, persisted project, renderer, script, file, network, vault, TLS, cloud, account, subscription, telemetry, entitlement, or plugin authority changes.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 203 accepts pinned per-invocation request timeouts without weakening per-request controls. Interactive prompts, plugin tags, desktop local-vault access, remaining Inso commands/flags/configuration discovery, TLS exceptions/material, stronger portable script isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 204.
