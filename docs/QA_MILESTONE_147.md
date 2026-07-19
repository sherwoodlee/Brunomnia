# Milestone 147 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: match pinned request metadata and pinned-list behavior while keeping pins out of shared workspace data and deferring the separate document-tab lifecycle.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `request-meta.ts` defines `pinned`, sets `canSync = false`, and does not allow metadata duplication.
- `request-actions-dropdown.tsx` exposes Pin/Unpin; `debug.tsx` renders a separate filtered **Pinned Requests** grid above the ordinary request collection.
- Insomnia's temporary/permanent document tabs live in a different local-storage context. This milestone deliberately does not conflate that lifecycle with request pins.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused request-pin regressions | Pass — 1 file, 3 tests |
| Full Vitest suite | Pass — 64 files, 455 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 508 renderer modules; 7.64 kB lazy StreamConsole chunk; 354.70 kB main renderer; 5,281,322-byte CLI bundle |
| Bundled CLI startup/help | Pass |
| Bundled localhost CLI template smoke | Pass — denial, File grant, Node OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 105 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Device-local JSON parsing accepts only bounded unique string IDs and safely rejects malformed or wrong-shaped values.
- Reconciliation retains only requests that exist in the current project workspace and removes duplicates, stale IDs, and deleted requests.
- Toggle adds one valid request, removes an existing pin, and refuses missing requests without mutating workspace data.
- Pinned rows follow persisted per-collection resource order rather than pin-click order and retain collection context.
- Sidebar search applies the same name/method/protocol/URL matching to the pinned projection.
- Active request and pinned-list controls mutate only per-project device metadata; project/export/sync payload code is unchanged.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. This milestone makes no screenshot, DOM, console, observed-click, focus, screen-reader, or visual-layout claim beyond source-backed labeled controls, strict compilation, pure pin-state evidence, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 147 accepts device-local request pinning and the separate filtered pinned-request list. Multi-select/bulk actions, persistent temporary/permanent document tabs, richer collected data, explicit legacy response-only labeling, richer libcurl-style header/text timeline evidence, and arbitrary mixed-order third-party exports remain. Collections stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 148.
