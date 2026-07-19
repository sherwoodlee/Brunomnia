# Milestone 124 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: reproduce Insomnia's default request User-Agent and per-request suppression semantics across native HTTP and realtime transports, preserve the policy through authoring and interchange, and keep browser Fetch within web-platform constraints.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/common/render.ts` finds authored User-Agent rows before disabled rows are removed and sets `suppressUserAgent` when the request opts out or every authored User-Agent is disabled.
- `packages/insomnia/src/ui/components/editors/request-headers-editor.tsx` shows a disable-capable read-only `insomnia/<version>` row only when no authored User-Agent exists; removing the final authored row writes `disableUserAgentHeader: true`, including bulk edits.
- `packages/insomnia/src/main/network/websocket.ts` and `socket-io.ts` add the product header only when suppression is false and no authored row exists.
- HTTP, WebSocket, Socket.IO, MCP, and gRPC request models expose the optional field at the request root. Brunomnia has no MCP request-resource model, so this milestone applies the field to its shared request model and all supported request protocols.
- Pinned realtime connect rendering bypasses plugin request/response hooks. Streaming hooks are therefore removed from the parity gap list rather than invented in Brunomnia.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 58 files, 385 tests |
| Focused User-Agent regressions | Pass — 8 files, 101 tests |
| Native test suite | Pass — 97 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 198 modules; 310.15 kB main, 192.35 kB React vendor, and 66.74 kB interchange JavaScript with no warning |
| Bundled CLI build/startup | Pass — 532.0 kB CommonJS executable |
| macOS Tauri debug `.app` bundle | Pass — app-only bundle, arm64 executable, and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- One immutable helper adds `brunomnia/0.1.0` only when neither the request flag nor any case-insensitive authored User-Agent row blocks it. Disabled authored rows remain present and prevent fallback insertion.
- Native Tauri HTTP/GraphQL inputs gain the default after request hooks/authentication are prepared. Browser-development Fetch receives no synthetic User-Agent. CLI Node Fetch uses the same helper.
- WebSocket, GraphQL subscription, SSE, and Socket.IO connect inputs share the default/custom/suppressed behavior; cookies, authentication, required GraphQL subprotocols, and transport policy remain unchanged.
- Regular and bulk header authoring expose the read-only default toggle when appropriate. Both update paths detect removal of the last authored User-Agent and persist opt-out.
- Workspace v33 promotes the v32 nested gRPC flag to the request root, strips the legacy nested property, and defaults older requests safely.
- Insomnia v4 JSON and v5 YAML preserve top-level suppression on HTTP, WebSocket, Socket.IO, and gRPC resources. Buf registry reflection consumes the same request field.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes the pinned default/suppressed User-Agent behavior for Brunomnia's supported request protocols. Browser Fetch remains browser-controlled. Existing `Baseline` and `Early baseline` rows remain; Brunomnia is not declared feature-complete.
