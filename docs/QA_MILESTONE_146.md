# Milestone 146 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: match pinned sub-environment sibling ordering and duplication without broadening the Collections parity claim or inventing cross-parent drag behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `workspace-environments-edit-modal.tsx` uses ordered before/after drag targets for sub-environments while its base environment cannot be reordered.
- `environment.duplicate.tsx` delegates to the environment service; that service names the copy `Name (Copy)` and assigns it an ordering key immediately after the source.
- Brunomnia already persisted a bounded nested global environment array and explicit parent changes. The missing surface was validated sibling ordering plus pinned duplication.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused environment regressions | Pass — 1 file, 12 tests |
| Full Vitest suite | Pass — 63 files, 452 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 507 renderer modules; 7.64 kB lazy StreamConsole chunk; 351.79 kB main renderer; 5,281,322-byte CLI bundle |
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

- The pure move operation accepts before/after placement only between distinct siblings under the same non-empty parent.
- Base-environment, self, missing-target, and cross-parent moves return the original workspace unchanged.
- Pointer drag and Option/Alt + Arrow Up/Down/Home/End keyboard planning call the same validated move operation; focusable rows advertise the shortcuts.
- Reordering one sibling leaves nested descendants attached to their original parent and persists through the workspace environment array.
- Duplication creates a sibling with the pinned `(Copy)` suffix immediately after its source while preserving values, color, parent, and private state.
- Environment and variable-row identities regenerate, imported source metadata is removed, and descendants are not copied.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. This milestone makes no screenshot, DOM, console, observed-drag, keyboard, focus, screen-reader, or visual-layout claim beyond source-backed controls, strict compilation, pure operation evidence, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 146 accepts pinned-compatible sub-environment ordering and duplication. Multi-select/bulk actions, request pinning/new-tab state, richer collected data, legacy history reconstruction, byte-exact wire diagnostics, and arbitrary mixed-order third-party exports remain. Collections stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 147.
