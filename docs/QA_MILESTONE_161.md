# Milestone 161 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: map each Brunomnia collection to a persistent `collection` workspace resource in the shared document strip and embed collection-level environment/documentation configuration in that document.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `TabType` includes `collection`; `inferTabType` returns it for an ordinary workspace after excluding design, mock-server, environment, and MCP scopes.
- Ordinary workspace navigation builds the tab from the workspace ID/name/route and shares the same temporary/permanent context as request, folder, Runner, design, environment, mock-server, and mock-route resources.
- Brunomnia stores multiple collections inside one account-free local project. Each collection ID therefore maps to one compatible workspace document while its request/folder resources remain independently addressable tabs.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused tab and collection-resource regressions | Pass — 2 files, 25 tests |
| Full Vitest suite | Pass — 65 files, 472 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 509 renderer modules; 151.95 kB stylesheet; 386.88 kB main renderer; 5,283,187-byte CLI bundle |
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

- Typed tab parsing preserves the pinned `collection` discriminator while every prior type and legacy request-only storage remain compatible.
- Collection documents share temporary replacement/promotion, active history, keyboard cycling, pointer order, middle/final/all/other close, reopen, persistence, and final-tab dashboard behavior.
- Sidebar Configure, project-dashboard collection cards, and new-collection creation open the exact collection document; collections with no requests remain valid targets.
- The former modal retains collection naming, base variables, selected sub-environment switching/creation/rename/delete, variable editing, and Markdown documentation/preview as a full document pane.
- Every collection mutation promotes a temporary document. Current names and request/folder totals derive from workspace data rather than persisted display metadata.
- Request/folder tabs and generated-request handoff remain unchanged, so collection workspace navigation does not collapse or duplicate child resource state.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. M161 makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed roles/labels, strict compilation, pure typed-tab evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 161 accepts collection workspace identity and lifecycle adapted to Brunomnia's multi-collection project model. Standalone unit-test-suite resources and raw-JSON environment editing remain absent. Collections stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 162.
