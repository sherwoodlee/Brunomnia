# Milestone 154 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: match pinned final-tab and Close All routing with an intentional zero-tab state, persistent project dashboard, closed-tab continuity, and explicit request reopen paths.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `insomnia-tab-context.tsx` records ordinary and batch-closed tabs before mutation. Closing the sole active tab or batch-closing every current tab clears `tabList` and `activeTabId`, emits the close event, and navigates non-scratchpad organizations to `/organization/:organizationId/project/:projectId`.
- `closeAllTabs` sends every current tab ID through that batch-close path. `tab-list.tsx` exposes the exact `Close All` and `Close Other Tabs` context commands.
- The project index route renders the selected project's local/remote workspace files and uses tab-aware navigation when a resource opens. Brunomnia adapts that route to its account-free local project model and supported collection, API-design, and mock-server resources.
- The pinned source retains recently closed tabs in memory. Brunomnia keeps its established bounded per-project device-local closed-ID persistence, which is more durable without entering project/export/sync data.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused request-tab regressions | Pass — 1 file, 7 tests |
| Full Vitest suite | Pass — 65 files, 464 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 509 renderer modules; 149.46 kB stylesheet; 370.09 kB main renderer; 5,283,187-byte CLI bundle |
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

- Parsed tab state accepts the dashboard marker only with an empty tab list; older/malformed empty state remains ordinary initialization and still receives a valid temporary fallback.
- Reconciliation preserves intentional dashboard state across request collection changes and restarts without reopening the retained workspace active request.
- Closing the final request and closing all requests both clear tabs, active ID, and active history while appending deduplicated IDs to the bounded closed list in visible order.
- Newest-valid reopen leaves dashboard mode, removes the reopened ID from closed history, restores a permanent request tab, and updates the internal workspace active request only when a tab exists.
- The close button can close the final tab. The focusable tab context menu exposes exact Close All/Close Other Tabs labels and retains the existing right-click, Shift+F10/Menu, outside-pointer, and Escape behavior.
- Dashboard mode suppresses hidden-request send/edit/generation shortcuts and sidebar selection while keeping the collection tree available. Sidebar/history selection, collection cards, new request, automation collection opening, and Command/Ctrl+Shift+T reopen request work.
- The source-backed dashboard reports project resource totals and exposes local collection, API-design, and mock-server cards with responsive desktop layouts.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. M154 makes no screenshot, observed-menu, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed roles/labels, strict compilation, pure state evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 154 accepts pinned final-tab routing and true Close All semantics for Brunomnia's request documents, with an account-free project-dashboard adaptation and durable closed-tab history. Folder/environment/mock/spec/runner resources still do not share the document-tab strip. Collections stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 155.
