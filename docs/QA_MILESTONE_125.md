# Milestone 125 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: reproduce Insomnia's calculated HTTP Accept/Host authoring baseline and default Accept execution while preserving authored-only bulk editing and browser-managed Fetch behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/ui/components/editors/request-headers-editor.tsx` defines read-only HTTP rows for `Accept: */*`, `Host: <calculated at runtime>`, and conditional `User-Agent: insomnia/<version>`.
- The same editor returns its bulk code editor before rendering read-only pairs. Calculated rows therefore never enter bulk text or persisted request headers.
- `packages/insomnia/src/network/parse-header-strings.ts` adds `Accept: */*` only when the rendered enabled header set has no Accept row. Disabled authored rows have already been removed and therefore reveal the default.
- Host remains a transport-calculated HTTP authority unless an authored Host header overrides it. No persisted suppression field exists for Accept or Host.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 59 files, 388 tests |
| Focused calculated-header regressions | Pass — 4 files, 29 tests |
| Native test suite | Pass — 97 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 199 modules; 310.34 kB main, 192.35 kB React vendor, and 66.74 kB interchange JavaScript with no warning |
| Bundled CLI build/startup | Pass — 532.7 kB CommonJS executable |
| macOS Tauri debug `.app` bundle | Pass — app-only bundle, arm64 executable, and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Native Tauri and CLI HTTP/GraphQL inputs append `Accept: */*` only when no enabled case-insensitive authored Accept exists.
- Enabled custom and empty Accept rows remain authoritative. Disabled authored rows remain saved but are omitted from execution and no longer block the default.
- Regular HTTP/GraphQL editing displays non-disableable Accept and calculated Host rows plus the conditional User-Agent toggle. These descriptors never mutate the authored list.
- Bulk editing contains only authored enabled rows. Removing the final User-Agent still persists opt-out through the shared update path.
- Browser Fetch receives no explicit calculated Accept because the browser owns that default.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes calculated HTTP Accept/Host authoring and default Accept execution. WebSocket and Socket.IO calculated handshake rows remain unclaimed until transport-level extension behavior is compatible. Existing `Baseline` and `Early baseline` rows remain; Brunomnia is not declared feature-complete.
