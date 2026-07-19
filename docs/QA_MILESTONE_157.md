# Milestone 157 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: retain unsaved Runner controls independently for every open workspace/folder Runner synthetic document, rehydrate them across tab switches, and discard only drafts whose Runner documents close or become invalid.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Runner context is indexed by the active Runner tab ID. Its selectors and mutations keep collection, environment, iterations, delay, and request-list state distinct between workspace and folder Runner routes.
- M156 already matched synthetic identity, route/tab lifecycle, target scope, and run promotion. M157 closes its explicit remount gap by applying the same per-synthetic-document context boundary to Brunomnia's existing account-free Runner controls.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused tab and Runner-draft regressions | Pass — 2 files, 25 tests |
| Full Vitest suite | Pass — 65 files, 468 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 509 renderer modules; 150.89 kB stylesheet; 384.38 kB main renderer; 5,283,187-byte CLI bundle |
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

- Draft keys combine workspace identity and the synthetic Runner document ID, preventing collisions between projects or workspace/folder Runner tabs.
- Every draft retains collection, environment, iterations, retries, bail, delay, protocol stream window, iteration data, and ordered request enablement.
- Runner workbenches remount by draft key and initialize once from the matching draft, so switching tabs cannot leak the previously mounted Runner's local controls into the newly active document.
- Workspace edits reconcile stale request-plan entries and add newly available requests; missing saved collections or environments fall back to valid current resources.
- Single close, Close All, and Close Other Tabs remove only affected Runner drafts. Deleted-folder reconciliation removes its invalid synthetic draft while preserving unrelated Runner/workspace entries.
- Persisted reports, execution results, cancellation/OAuth state, target filtering, and temporary-tab run promotion remain separate from unsaved control drafts and retain M156 behavior.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. M157 makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed keyed remount semantics, strict compilation, pure cleanup evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 157 accepts session-memory Runner control continuity for currently open synthetic documents. Closing a Runner intentionally discards its unsaved draft; reports remain workspace-persistent through the existing report model. Environment, collection/design, mock-server/route, and test-suite resources still do not share the strip. Collections and Collection runner remain `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 158.
