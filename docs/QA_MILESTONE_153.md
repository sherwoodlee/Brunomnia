# Milestone 153 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned Close Other Tabs behavior to Brunomnia's persistent request document tabs without disguising the missing project-dashboard-dependent Close All action.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `tab-list.tsx` defines exactly two tab context commands: `Close All` and `Close Other Tabs`.
- The context-menu event sends the current tab ID to `closeOtherTabs`; the context state finds that reserved tab, batch-closes every other ID, and navigates/activates the reserved tab when it was not active.
- Batch close records closed tabs by default. If every tab closes, pinned Insomnia clears the list and navigates to the project route.
- Brunomnia's established request-workbench adaptation retains one request tab because it has no separate project-dashboard route. M153 implements only the behavior that can remain exact under that boundary.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused request-tab regressions | Pass — 1 file, 6 tests |
| Full Vitest suite | Pass — 65 files, 463 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 509 renderer modules; 146.46 kB stylesheet; 366.11 kB main renderer; 5,283,187-byte CLI bundle |
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

- Closing others preserves the selected tab object and its temporary/permanent status, activates it, and leaves exactly one open tab.
- Every removed tab enters bounded closed history in visible tab order; a preexisting duplicate is removed before append.
- Active history clears because no prior tab remains open, while the reserved ID is removed from closed history.
- Missing target and already-single-tab operations return the original state by identity.
- The per-tab context menu clamps to the desktop viewport, opens by right-click or Shift+F10/Menu on the focusable tab, exposes a labeled menu item, disables it with one tab, and dismisses on outside pointer input or Escape.
- The action shares existing workspace-local persistence, active-request synchronization, and reopen behavior without entering project/export/sync data.

## Manual/rendered QA

Rendered interaction and assistive-technology QA are omitted by standing direction. M153 makes no screenshot, observed-right-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed roles/labels, strict compilation, pure state evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 153 accepts pinned Close Other Tabs semantics for request documents. True Close All remains coupled to a project dashboard that Brunomnia does not yet implement; broader folder/environment/mock/spec/runner document tabs also remain. Collections stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 154.
