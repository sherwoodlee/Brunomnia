# Milestone 150 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align ordinary saved-response collected data and request-version restoration with the pinned Insomnia response model across every Brunomnia persistence path, while removing legacy request reconstruction as a false parity requirement.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia-data/src/models/response.ts` stores `requestTestResults`, `settingSendCookies`, `settingStoreCookies`, collection-environment identity in `environmentId`, global-environment identity in `globalEnvironmentId`, and `requestVersionId` beside ordinary response evidence.
- `packages/insomnia-data/node-src/services/request-version.ts` explicitly ignores identity/type/timestamps/sort metadata plus `name`, `description`, and `parentId` when restoring a request version.
- `response-pane.tsx` derives the selected response's passing/total test count and renders saved send/store policy in its Cookies pane.
- `response-history-dropdown.tsx` marks responses without `requestVersionId` as non-restorable because they predate request-version capture. Pinned Insomnia does not reconstruct a missing version from response evidence.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused history/storage/runner/script regressions | Pass — 4 files, 74 tests |
| Full Vitest suite | Pass — 65 files, 461 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 509 renderer modules; 7.64 kB lazy StreamConsole chunk; 364.69 kB main renderer; 5,283,187-byte CLI bundle |
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

- Direct sends persist bounded pre-request and after-response assertions together; historical selection and delete fallback restore the selected saved assertion list without carrying stale console output.
- Collection runs attach assertions only after the matching response's scripts finish. Failed sends cannot accidentally attach results to a prior response, and zero-history mode remains a no-op for persistence.
- Desktop and headless direct, dependent response-tag, runner, script-subrequest, and plugin-dependent response writers persist effective send/store cookie policy and separate global/collection environment identities.
- Storage admits at most 1,000 test results, bounds names/errors and environment IDs, accepts only boolean policy values, and preserves legacy response-only records without inventing a snapshot.
- Historical restore preserves the current request ID, name, documentation, source linkage, and folder position while restoring executable request fields. Ordinary and realtime history use the same contract.
- History choices include bounded assertion counts and label legacy entries as non-restorable. The Cookies pane reports the selected historical response's saved policy.
- Response history remains device-local and excluded from split-YAML projects and encrypted-sync payloads.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. This milestone makes no screenshot, DOM, console, observed-click, focus, screen-reader, or visual-layout claim beyond source-backed labeled controls, strict compilation, focused/full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 150 accepts the pinned ordinary-response collected fields, combined assertion continuity, cookie-policy evidence, global/collection environment identity, current-name/documentation/source/tree restore semantics, and explicit response-only legacy behavior. It does not claim raw wire headers/chunks, duplicate header ordering, redirect/TLS traces, compressed transfer bytes, or arbitrary mixed-order third-party compatibility exports. Collections stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 151.
