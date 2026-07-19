# Milestone 164 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned-compatible standalone-suite ownership, Insomnia v4/v5 interchange, and Inso-shaped suite/API-spec CLI selection while preserving Brunomnia's account-free local execution and explicit trust boundary.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `UnitTestSuite` is a workspace child with name and `metaSortKey`; each child `UnitTest` stores name, code, request ID, and `metaSortKey`.
- Pinned v4 interchange uses `_type: unit_test_suite` and `_type: unit_test`; v5 permits `testSuites` only on `spec.insomnia.rest/5.0` documents.
- Pinned Inso `run test [identifier]` selects one suite by name/full-or-prefix ID or every workspace suite through an API-spec/workspace identifier, then orders suites and tests by `metaSortKey`.
- Brunomnia collections are the local workspace adaptation, so each suite owns one collection and may target only that collection's HTTP/GraphQL requests.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused storage/unit-test/interchange regressions | Pass — 4 files, 67 tests |
| Full Vitest suite | Pass — 67 files, 484 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 512 renderer modules; 159.73 kB stylesheet; 16.80 kB unit-test workbench; 402.03 kB main renderer; 5,299,944-byte CLI bundle |
| Bundled CLI startup/help | Pass — suite/API-spec identifier contract present |
| Bundled direct suite and API-spec-prefix runs | Pass — 1/1 test and 1/1 matched assertion for both selectors |
| Bundled localhost CLI template smoke | Pass — denial, File grant, saved `insomnia.send()`, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 105 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Workspace v37 infers legacy suite ownership from valid referenced requests, falls back to the first collection, rejects missing owners, and clears cross-collection request references.
- Suite creation, owner changes, request selectors, and default/ID-targeted sends remain collection-scoped; owner changes preserve only still-valid references.
- V4 suite/test resources round-trip beneath the owning exported workspace with test request IDs remapped to exported request resources.
- V5 suites round-trip on linked API-specification documents with shared request-ID generation; collection-only exports emit an explicit representation warning.
- Imported suites/tests are collision-safe across repeated applications because collection, request, suite, and test identities rekey as one batch.
- CLI `run test` accepts suite and linked API-spec names/full-or-prefix IDs, preserves sort order, regex filtering, retries, bail, reporters, inherited environments, cookies, response chaining, File/script-network grants, and owner-confined saved sends.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M164 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed roles/labels, strict compilation, focused model evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 164 accepts collection-owned standalone-suite migration, editor scoping, supported Insomnia v4/v5 interchange, and portable CLI suite/API-spec execution. Insomnia v5 cannot encode suites on collection-only documents, so that downgrade remains explicit. Collection runner, Headless CLI, and Import/export remain `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 165.
