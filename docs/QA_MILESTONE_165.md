# Milestone 165 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned-compatible collection-runner live progress, queued/active skip, cancel-all, and real HTTP/stream interruption while preserving retries, bail, reporters, and Brunomnia's account-free local execution.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned runner feedback preallocates one stable `iteration-index-requestId` item for every planned request and uses `pending`, `running`, `completed`, `failed`, `canceled`, and `skipped` states.
- Pinned live cards expose request URL, HTTP status/message, response time/size, tests, errors, per-item Skip, and aggregate finished/skipped/canceled counts.
- Pinned active Skip and Cancel all route through request cancellation; Cancel all also marks every unfinished item canceled, while queued Skip avoids execution.
- Brunomnia preserves its retry-attempt report model and stores the pinned-shaped planned-item lifecycle alongside it, so retries, bail, JSON/JUnit/TAP/text reporters, and historical attempt evidence remain compatible.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused runner/report/HTTP/stream regressions | Pass — 4 files, 62 tests |
| Full Vitest suite | Pass — 67 files, 491 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 512 renderer modules; 160.62 kB stylesheet; 49.16 kB automation workbench; 406.16 kB main renderer; 5,307,466-byte CLI bundle |
| Bundled CLI startup/help | Pass — collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled direct suite and API-spec-prefix runs | Pass — 1/1 test and 1/1 matched assertion for both selectors |
| Bundled localhost CLI template smoke | Pass — denial, File grant, saved `insomnia.send()`, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 107 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Live items publish pending → running → terminal transitions with stable keys, iteration/attempt identity, redacted resolved URL, HTTP metadata, timing, bytes, tests, and errors.
- Queued Skip never executes the request; active Skip aborts the current transport and continues the queue without becoming a failed attempt.
- Cancel all aborts the active transport, marks every unfinished item canceled, and preserves already completed items.
- Native HTTP uses a bounded cancellation registry and drops the active reqwest future; browser HTTP composes the runner signal with the request timeout.
- WebSocket, Socket.IO, GraphQL subscription, and SSE runner samples disconnect on abort, including cancellation while connecting or waiting for the sample window.
- Retry recovery, exhausted retry-aware bail, delayed interruption, test-name filtering, saved attempt snapshots, and reporter output remain intact; skipped/canceled planned items become JUnit/TAP skips rather than failures.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M165 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed roles/labels, strict compilation, focused lifecycle evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 165 accepts pinned-shaped collection-runner live progress, skip/cancel controls, transport interruption, persisted lifecycle evidence, and reporter continuity. Script-directed request-plan jumps, full transport-added request/response console fidelity, remaining collection-run protocol semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 166.
