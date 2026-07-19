# Milestone 160 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: map local mock servers and routes to distinct persistent `mockServer` and `mockRoute` resources in the shared document strip, with targeted editing and route lifecycle navigation.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `TabType` includes `mockServer` and `mockRoute`; `inferTabType` maps mock-server workspaces and route records separately, and route tab metadata carries the route method tag.
- The pinned mock-server route keeps the workspace/server route list visible, navigates route resources through `useTabNavigate`, supports explicit Open in New Tab, and shows no route editor when the server route has no `mockRouteId`.
- Brunomnia stores mock servers and their route arrays directly in one local project, so current server/route IDs map to those compatible resource tabs without fabricating hosted workspace records.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused tab and response-to-route regressions | Pass — 2 files, 22 tests |
| Full Vitest suite | Pass — 65 files, 471 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 509 renderer modules; 151.87 kB stylesheet; 386.93 kB main renderer; 5,283,187-byte CLI bundle |
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

- Typed tab parsing preserves `mockServer`/`mockRoute` discriminators and method-tag metadata is derived from current route data rather than persisted stale display state.
- Server and route resources coexist with every prior document type and share temporary replacement/promotion, active history, keyboard cycling, pointer order, middle/final/all/other close, reopen, and dashboard recovery.
- Activity rail, command palette, dashboard cards, server selector, route list, response-pane Go to mock, and AI/response/manual creation paths open the exact server or route document.
- A server tab leaves the route editor intentionally empty until a route document is selected. Route tabs bind name, method, path, status, delay, enablement, headers, body, latest-response overwrite, and live-native synchronization to their owning server.
- Editing promotes a temporary route. New route navigation follows shared temporary replacement, while deleting an active route activates its still-valid server and reconciliation removes the stale route from all tab histories.
- Mock runtime start/stop state remains keyed by server, so switching between its server and route tabs does not duplicate or orphan the native loopback process.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. M160 makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed roles/labels, strict compilation, pure typed-tab evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 160 accepts pinned mock server/route document navigation for Brunomnia's existing local engine. Exact LiquidJS/Faker runtime identity and hosted/self-host deployment workflows remain. Test-suite shared documents, a separate collection-workspace tab, and raw-JSON environment editing also remain. Collections and Mock servers stay `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 161.
