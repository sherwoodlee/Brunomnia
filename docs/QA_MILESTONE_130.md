# Milestone 130 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: close pinned Insomnia's remaining generated-request preparation behavior by sharing complete template rendering, applying request plugins in source order, including matching cookie-jar values, and adding the Node-native Content-Length exception.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `main/har.ts` calls `getRenderedRequestAndContext`, then `network.applyRequestHooks`, then GraphQL normalization and `exportHarWithRenderedRequest`. Request hooks therefore receive the rendered request before HAR conversion.
- `common/render.ts` renders inherited headers/authentication and the workspace cookie jar together, removes disabled rows, resolves path parameters, and returns the rendered jar with the request.
- `main/har.ts#getRequestCookies` selects URL-matching cookies from that rendered jar and maps them into HAR cookies. HTTPSnippet 3.0.10 URI-encodes their names/values and constructs the outgoing Cookie representation.
- `generate-code-modal.tsx` enables `addContentLength` only for target `node` and client `native`. `exportHarWithRenderedRequest` leaves an authored case-insensitive Content-Length untouched.
- The modal still passes only HAR, target, and client to local HTTPSnippet conversion and never executes the generated program.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Focused code-generation/shared-HTTP regressions | Pass — 3 files, 40 tests; code generation 17 tests |
| Full Vitest suite | Pass — 59 files, 398 tests |
| Native test suite | Pass — 97 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production and bundled CLI build | Pass — 200 modules; 311.92 kB main, 192.35 kB React vendor, 66.74 kB interchange, 35.65 kB shared codegen, and 3.19 kB dialog JavaScript; 532.8 kB CLI |
| Bundled CLI startup | Pass — help output and reporter inventory |
| macOS Tauri debug `.app` bundle | Pass — app-only bundle, arm64 executable, and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- The shared renderer resolves environment and plugin template values before request hooks observe or mutate the request.
- Hook-added headers appear in generated output without sending the generated request.
- Only secure/path/domain-matching cookie-jar values are included, using pinned URI encoding; nonmatching values are absent and an authored Cookie header wins.
- Node native receives exact UTF-8 byte Content-Length while other clients do not, and an authored case-insensitive value remains unchanged.
- Existing OAuth 1, OAuth 2, Hawk, ASAP, full 39-client, multipart, binary, and raw HTTP regressions remain green.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone completes the pinned Client code generation ledger row. Digest, NTLM, Netrc, and IAM remain transport/challenge-managed rather than static HAR Authorization headers, matching the pinned export path. Existing unrelated `Baseline` and `Early baseline` rows remain; Brunomnia is not declared feature-complete.
