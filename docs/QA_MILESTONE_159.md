# Milestone 159 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: map every Brunomnia API design to a persistent `document` resource in the shared tab strip and bind OpenAPI editing, switching, and generation to that active design document.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `TabType` includes `document`; `inferTabType` returns it for a design-scoped workspace, and ordinary resource navigation builds the tab from that workspace's ID/name/route.
- The pinned specification route loads the API spec belonging to its active design workspace and exposes document editing, preview, linting/ruleset actions, and request-collection generation under the ordinary organization tab list.
- Brunomnia stores multiple `ApiDesign` resources inside one local project, so each design ID maps directly to one compatible shared document rather than fabricating upstream workspace records.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused tab and OpenAPI regressions | Pass — 2 files, 14 tests |
| Full Vitest suite | Pass — 65 files, 470 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 509 renderer modules; 151.87 kB stylesheet; 385.70 kB main renderer; 5,283,187-byte CLI bundle |
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

- Typed tab parsing preserves the pinned `document` discriminator while legacy request/folder/Runner/Environment storage and the one-temporary-tab invariant remain unchanged.
- Multiple API designs coexist with every existing document type and share temporary replacement/promotion, active history, keyboard cycling, pointer ordering, middle/final/all/other close, reopen, and dashboard recovery.
- Activity-rail, command-palette, and project-dashboard design actions open the targeted design document. If none exists, the activity path creates and opens a valid starter OpenAPI 3.1 document.
- The design selector navigates to another design tab; it no longer changes hidden component-local identity under the current tab.
- Design name, document, ruleset, formatting, and generation actions promote a temporary tab. Generated requests open only after the promoted design state is composed, so generation cannot replace its source temporary tab.
- Removed designs reconcile out of persisted open, active, history, and closed state; surviving design tabs retain their names from current workspace data.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. M159 makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed roles/labels, strict compilation, pure typed-tab evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 159 accepts pinned design-document navigation for Brunomnia's existing OpenAPI engine. Full Spectral behavior, package/remote ruleset extension, multi-file references, richer design tooling, mock-server/route and test-suite shared documents, and raw-JSON environment editing remain. Collections and API specification design stay `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 160.
