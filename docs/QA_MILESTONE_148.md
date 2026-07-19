# Milestone 148 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: replace the single decorative request tab with pinned-source-backed temporary/permanent request document state without storing UI navigation in shared workspace data.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `insomnia-tab-context.tsx` persists per-organization tab lists, active IDs, active history, and closed tabs in local storage; one temporary tab is replaced until promoted.
- `tab.tsx` renders temporary names in italics, promotes on double-click, closes tabs, and participates in drag ordering; `tab-list.tsx` implements selection, cycling, reopen, and before/after reorder.
- `use-insomnia-tab.ts` creates a temporary tab for ordinary route navigation, while explicit `withTab` navigation creates a permanent tab. Request editing/sending promotes a temporary request tab.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused request-tab regressions | Pass — 1 file, 5 tests |
| Full Vitest suite | Pass — 65 files, 460 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 509 renderer modules; 7.64 kB lazy StreamConsole chunk; 362.53 kB main renderer; 5,281,322-byte CLI bundle |
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

- Parsing bounds tab/history/closed collections, removes duplicate IDs, rejects malformed storage, and permits at most one temporary tab.
- Ordinary navigation replaces the existing temporary tab; explicit opens append permanent tabs; promotion keeps an existing tab and changes only temporary state.
- Activation records recent valid tabs without duplicates so closing the active tab restores history before positional fallback.
- Close records bounded recently closed IDs, reopen selects the newest still-valid request as permanent, and the last request-workbench tab remains open.
- Next/previous cycling wraps, and before/after drag order preserves active and temporary state.
- Reconciliation removes deleted/stale tabs and histories, retains valid closed IDs, and creates one temporary fallback when no open tab survives.
- Per-project storage is separate from workspace, project, export, collaboration, and compatibility payloads; request names/methods/protocols remain live projections rather than duplicated tab metadata.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. This milestone makes no screenshot, DOM, console, observed-click, drag, keyboard, focus, screen-reader, or visual-layout claim beyond source-backed labeled controls, strict compilation, pure lifecycle evidence, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 148 accepts persistent temporary/permanent request document tabs, active history, close/reopen, keyboard cycling, and drag order. The final-tab dashboard difference and broader non-request tab types remain explicit adaptations. Multi-select/bulk actions, richer collected data, explicit legacy response-only labeling, byte-exact wire diagnostics, and arbitrary mixed-order third-party exports remain. Collections stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 149.
