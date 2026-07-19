# Milestone 145 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned folder-duplication behavior as a deep, collision-safe local subtree copy without broadening the Collections parity claim.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `request-group-actions-dropdown.tsx` exposes **Duplicate** with a requested new root name.
- `request-group.duplicate.tsx` delegates to the data service's recursive request-group duplication and increments descendant creation evidence.
- Brunomnia already duplicates active requests with fresh nested row IDs. The missing resource action was equivalent recursive folder/request duplication.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused resource-duplication regressions | Pass — 1 file, 11 tests |
| Full Vitest suite | Pass — 63 files, 451 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 507 renderer modules; 7.64 kB lazy StreamConsole chunk; 349.17 kB main renderer; 5,281,322-byte CLI bundle |
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

- The pure operation rejects missing collection/folder IDs and blank names without mutating workspace identity.
- Root and descendant folders retain configuration, documentation, expansion, and parent relationships; only the duplicate root receives the reviewed new name.
- Descendant requests retain protocol/auth/body/transport/script/test configuration and point to copied folders.
- Folder header/environment rows, request path/query/header/form/multipart rows, gRPC metadata, Socket.IO arguments, and Socket.IO listeners receive fresh IDs.
- Folder and request source metadata is removed so imported or Konnect-managed copies become ordinary user-owned local resources.
- Persisted mixed-resource order reproduces the original subtree directly after the original while unrelated resources remain stable.
- Folder settings expose a labeled duplicate action and request the copied root name before applying one atomic workspace update.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. This milestone makes no screenshot, DOM, console, observed-dialog, keyboard, or visual-layout claim beyond source-backed labeled controls, strict compilation, pure duplication evidence, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 145 accepts deep local folder duplication. Multi-select/bulk actions, request pinning/new-tab state, environment-tree ordering, richer collected data, explicit legacy response-only labeling, byte-exact wire diagnostics, and arbitrary mixed-order third-party exports remain. Collections stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 146.
