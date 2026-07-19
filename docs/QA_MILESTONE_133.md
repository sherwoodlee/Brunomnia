# Milestone 133 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: correct Milestone 131's incomplete local-template-tag claim and verify exact pinned timestamp, OS, hash, prompt, request, response, gRPC, and realtime behavior across account-free execution paths.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/common/templating/local-template-tags.ts` uses date-fns custom formats; seven Node OS values; MD5 plus SHA digests; a six-argument prompt with preview, storage, masking, and last-value rules; current-request fields; and response raw/header/url/body extraction.
- The pinned response tag uses JSON BigInt string preservation, JSONPath multi-result serialization, XPath, active-environment history, resend modes, send-only triggers, and request-chain recursion prevention.
- Pinned realtime connection and WebSocket/Socket.IO payload paths call the same interpolation layer as ordinary requests. Pinned gRPC schema, call, and interactive-message paths also interpolate before native execution.
- Brunomnia pins date-fns 3.6.0, json-bigint 1.0.0, and xpath 0.0.34. It uses `@xmldom/xmldom` 0.8.13 rather than vulnerable 0.9.8/0.8.11 releases while preserving the required DOM/XPath behavior. `npm audit --omit=dev` reports zero vulnerabilities.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Focused template/HTTP/gRPC/realtime/builder/resource regressions | Pass — 7 files, 85 tests |
| Full Vitest suite | Pass — 60 files, 422 tests |
| Native test suite | Pass — 99 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| Vite production and bundled CLI build | Pass — 351 modules transformed and CLI bundled |
| Bundled CLI startup | Pass — help exits successfully |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Custom date-fns output, all seven OS keys, JSON-valued OS output, MD5 hex/Base64, SHA output, and timestamp aliases execute through the shared async renderer.
- The queued prompt UI masks requested values, suppresses send prompts during preview, coalesces explicit storage keys, supports implicit request-scoped last values, and clears request/all caches.
- Current-request tags cover URL/query/header/cookie/folder and OAuth token fields. Response tags cover raw body, headers, request URL, large integers, JSONPath multiple matches, XPath, active-environment selection, preview suppression, guarded dependency execution, and immediate parent-send visibility of dependent responses/cookies.
- Direct gRPC schema loading, unary calls, interactive session setup, and later client-stream messages resolve local tags before native commands.
- WebSocket, GraphQL subscription, SSE, and Socket.IO connections resolve full local/plugin tags without running realtime request hooks; WebSocket text frames, Socket.IO event arguments, and live listener names use the same renderer.
- Collection-run stream sampling receives cookies, responses, vault, File, external-secret, prompt, plugin, ancestry, and dependent-response contexts.
- The fourteen-family Tags dialog covers OS, MD5, custom time, complete prompt/request/response arguments, WebSocket payloads, Socket.IO path/events/arguments/listeners, Buf registry fields, and ordinary HTTP/gRPC destinations.
- The native OS command returns bounded source-shaped architecture, platform, release, hostname, free-memory, CPU, and user-information data without accepting command input.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

Milestone 133 supersedes Milestone 131 for exact completion evidence of the Cookies, chaining, and dynamic variables ledger row. File tags remain desktop-only under the explicit 5 MB approved-root ceiling, and the portable CLI does not resolve File or external-vault tags. Existing unrelated `Baseline` and `Early baseline` rows remain; Brunomnia is not declared feature-complete.
