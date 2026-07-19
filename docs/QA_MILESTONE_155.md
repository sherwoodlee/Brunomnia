# Milestone 155 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: extend Brunomnia's persistent document strip from request-only tabs to shared request and folder tabs with pinned temporary/permanent, navigation, close, and full folder-pane behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `tab.tsx` defines `request` and `folder` in the same `BaseTab` union. Its shared tab component renders folder identity, promotes a temporary tab on double-click, opens the exact Close All/Close Other Tabs menu, and closes any tab on middle-click.
- `use-insomnia-tab.ts` infers a request group as `folder`, builds it from the same resource navigation path, creates one temporary tab when the current route has no match, and uses the ordinary permanent-tab path for explicit tab navigation.
- The request-group route loads a folder as the active routed resource and redirects safely if it no longer exists.
- `request-group-pane.tsx` exposes Auth, Headers, Scripts, Environment, and Docs tabs. Folder settings remain a separate modal/action surface.
- The project-navigation request node selects either a request or request-group route while keeping folder expansion on its separate chevron control.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused document-tab regressions | Pass — 1 file, 8 tests |
| Full Vitest suite | Pass — 65 files, 465 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 509 renderer modules; 150.58 kB stylesheet; 373.52 kB main renderer; 5,283,187-byte CLI bundle |
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

- Legacy persisted tab objects without a type parse as request tabs; typed folder tabs survive bounded parse/reconciliation only while the referenced folder exists.
- Requests and folders share one temporary slot. Selecting an unopened resource replaces the prior temporary document, while Command/Ctrl-click, middle-click, double-click, explicit keep, inline rename, or folder edits retain a permanent tab.
- Mixed request/folder tabs share active history, keyboard cycling, drag ordering, close, Close All, Close Other Tabs, final-tab dashboard routing, newest-valid reopen, and restart persistence.
- Reopening a folder restores its folder type and full pane instead of treating its ID as a request. Deleted folders are removed during the same reconciliation that repairs deleted requests.
- Folder-name selection and selected-row styling follow the active folder document; the chevron still expands/collapses hierarchy, and the settings action still reaches duplicate/delete/parent controls.
- The folder workbench edits inherited Variables, Headers, Auth, pre-request/after-response Scripts, Docs, name, and parent. The request strip preserves request tag, inline rename, pin, parent-folder selector, response pane, and request-only shortcuts.
- Activating a folder retains the workspace's internal last request for data continuity but suppresses request send/duplicate/delete/focus/generate shortcuts and clears request-row selection.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. M155 makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed roles/labels, strict compilation, pure state evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 155 accepts pinned shared request/folder document behavior and a full account-free folder pane. Environment, collection/design, mock-server/route, runner, and test-suite resources still do not participate in the strip. Collections stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 156.
