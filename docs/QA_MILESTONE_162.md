# Milestone 162 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned-compatible standalone unit-test suites as persisted, account-free Tauri documents with CRUD, ordering, request selection, JavaScript/Chai execution, `insomnia.send()`, and saved results.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `UnitTestSuite` contains `name` and `metaSortKey`; `UnitTest` contains `name`, `code`, `requestId | null`, and `metaSortKey`.
- Pinned tab type is `testSuite`; its route exposes suite/test creation, rename, delete, ordering, request selection, JavaScript editing, individual/all execution, and result status.
- Pinned standalone scripts call `insomnia.send()` for the selected request or `insomnia.send(requestId)` and receive `{ status, statusMessage, data, headers, responseTime }`.
- Pinned source warns that standalone tests are expected to be deprecated in favor of request scripts during 2026, but they remain present in the pinned build and therefore remain a parity requirement.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused model/tab/sandbox/storage/interchange regressions | Pass — 5 files, 73 tests |
| Full Vitest suite | Pass — 66 files, 477 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 511 renderer modules; 157.99 kB stylesheet; 16.32 kB lazy unit-test workbench; 393.64 kB main renderer; 5,287,735-byte CLI bundle |
| Bundled CLI startup/help | Pass |
| Bundled localhost CLI template smoke | Pass — denial, File grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 105 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Workspace v35 normalizes bounded unique suite/test IDs, names, scripts, finite ordering, valid live request references, bounded local run evidence, and drops orphan results.
- Suite resources share the existing temporary/permanent tab parser, replacement, promotion, close/reopen/history/cycling/order/dashboard behavior, and removed suites reconcile from all tab state.
- Suite and test creation follow pinned defaults, ordering remains deterministic across drag and explicit controls, and deleting a request clears only the current test reference.
- The Worker bridge distinguishes ordinary `insomnia.sendRequest(input)` from default/ID-targeted `insomnia.send()`, shares the twenty-request ceiling, bounds response bytes, and emits pinned-shaped lowercase-header responses.
- The workbench runs one or every ordered test through the existing Chai-compatible sandbox and complete HTTP/GraphQL renderer with active environment inheritance, plugins, OAuth, cookies, response chaining/history, and separately granted file/vault/arbitrary secondary-request capabilities.
- Saved local result history records pass/fail, duration, request identity, bounded error text, and logs; project dashboard, activity rail, command palette, suite list, and new-suite controls converge on the same shared document.
- Brunomnia JSON and local project/sync persistence retain suite definitions while device-local sharing paths omit execution results; Insomnia v4/v5 suite interchange and CLI suite selection remain explicit gaps.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. M162 makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed roles/labels, strict compilation, pure model/tab/sandbox evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 162 accepts standalone unit-test-suite identity, editing, execution, results, and shared document lifecycle for the packaged Tauri app. Raw-JSON environment editing, suite interchange/CLI selection, and other row-specific bounds remain. Collections and Collection runner stay `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 163.
