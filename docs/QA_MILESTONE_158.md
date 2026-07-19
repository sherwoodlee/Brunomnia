# Milestone 158 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: move Brunomnia's project-global environment editor from a modal into one persistent Environment document that shares request, folder, and Runner tab lifecycle and dashboard recovery.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `TabType` includes `environment`. `inferTabType` maps an environment-scoped workspace resource to that type, while ordinary navigation builds the tab from the resource ID/name and the shared tab context owns temporary/permanent lifecycle.
- The pinned environment route keeps its selected environment synchronized when navigating between environment workspaces/tabs and exposes base/private sub-environment selection, editing, ordering, duplication, deletion, and table/raw modes.
- Brunomnia has one global environment tree per local project rather than multiple typed workspaces, so its compatible document uses `environment_<projectId>` internally and reuses the existing structured key/value editor without claiming the absent raw-JSON mode.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused tab and environment-resource regressions | Pass — 2 files, 22 tests |
| Full Vitest suite | Pass — 65 files, 469 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 509 renderer modules; 151.87 kB stylesheet; 384.84 kB main renderer; 5,283,187-byte CLI bundle |
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

- Typed tab parsing preserves the new Environment discriminator while legacy untyped request tabs and the one-temporary-tab invariant remain unchanged.
- The one project Environment document participates in temporary replacement/promotion, close/reopen, Close All/Others, final-tab dashboard, active history, keyboard cycling, pointer order, and cross-reload reconciliation through the shared pure state engine.
- Top-bar environment edit, the environment shortcut, command palette, and dashboard card all open or reactivate the same namespaced document instead of creating modal or duplicate state.
- The document workbench retains active selection, base/sub-environment creation, public/private inheritance rules, name/parent/color/variable editing, inherited-value evidence, sibling drag and Option/Alt-keyboard order, collision-safe duplication, and guarded deletion.
- Mutating controls promote a temporary Environment tab. Active-environment selection continues to drive request execution and the top-bar selector immediately.
- Synthetic Runner and Environment tabs now use fixed labels/icons; only request and folder resources expose inline tab-name editing.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. M158 makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed roles/labels, strict compilation, pure typed-tab evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 158 accepts one project-global Environment document with the pinned shared-tab lifecycle. Collection environments remain collection-scoped, and Brunomnia does not yet provide pinned raw-JSON environment editing or shared mock/spec/test-suite documents. Collections remains `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 159.
