# Milestone 273 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: replace the single-string/hardcoded-tab shortcut split with a bounded account-free multi-binding registry for Brunomnia's current sixteen actions while preserving honest limits against the pinned 34-action inventory.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia-data/common-src/settings.ts` names 34 `KeyboardShortcut` actions; `hotkeys.ts` maps each action to separate macOS and Windows/Linux combination lists and supplies defaults.
- `ui/components/settings/shortcuts.tsx` adds combinations only after a registry-wide duplicate check, removes individual combinations, resets one action, and resets the complete registry.
- `ui/components/keydown-binder.ts`, `ui/hooks/use-insomnia-tab.ts`, and `ui/components/tabs/tab-list.tsx` route close/next/previous/reopen through the same registry. Brunomnia previously exposed eleven one-string actions while keeping four tab actions hardcoded in one listener.

## Implementation

- Workspace v47 stores up to eight normalized strings per current shortcut action. Legacy strings migrate to one-element lists, malformed missing values receive defaults, duplicates inside one list collapse, and explicit empty strings/lists remain unassigned after reload.
- Defaults are deep-cloned so one action cannot mutate another workspace or the module registry. Special keys and function keys receive stable display casing.
- The Preferences editor renders all combinations, captures a new key combination, refuses any registry-owned duplicate, removes bindings independently, resets one action, or resets all actions. Bounded legacy collisions remain visible instead of being silently rewritten.
- Close active tab, next tab, previous tab, reopen closed tab, and keep the current request in a permanent tab join the eleven existing editable actions. Their prior hidden tab listener is removed.
- First matching action wins deterministically for legacy collisions. The Runner's capture-phase Send listener now checks the same owner before starting, so it cannot bypass palette or another earlier action.
- Runner hints and execution accept every configured Send binding while displaying the first one. The top-bar quick-search hint uses the same list-aware display path.
- No account, plan, license, hosted preference service, telemetry, or entitlement check is involved.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused shortcut suites | Pass — 5 files/72 tests cover normalization, legacy/cleared/bounded migration, deep cloning, any-binding matching, owner precedence, Runner use, static multi-binding controls, and catalog persistence |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics from the fresh-source isolated mirror |
| Full frontend suite | Pass in required partition — 103 regular files/716 tests passed with 2 opt-in integration files/4 tests skipped; the real MCP loopback file passed separately, so all 717 active tests were observed passing |
| Production and CLI build | Pass — TypeScript, Vite renderer, 1,547 transformed modules, and the 22.6 MB bundled CLI completed; CLI size is 23,682,904 bytes with SHA-256 `11603356edc5b0e9cfb4eebfd77b6bd9fd40759f6b594922514e2842e3276478` |
| Packaged CLI smokes | Pass outside localhost sandbox — template/file grants, authoritative physical store, and full runner/config/plugin/transport/report smoke matrices passed |
| Native aggregate suite | Pass in complete partition — the unrestricted aggregate passed 188 tests with 4 opt-in public/live fixtures ignored and the login-shell fixture filtered; that fixture passed separately, so all 189 active native tests were observed passing |
| Native formatting and lint | Pass — `cargo fmt --check`, locked all-target/all-feature Cargo check, and strict Clippy completed without diagnostics |

## Focused coverage

- Pure preference regressions prove case normalization, special-key canonicalization, list matching, duplicate discovery, first-owner selection, binding bounds, explicit clearing, and non-aliased defaults.
- Storage regression proves legacy and list-shaped values converge into workspace v47 without resurrecting a cleared Send action and that new tab actions receive defaults when absent.
- Static React regression proves both default Next-tab bindings, independent add/remove labels, per-action reset, and collision evidence are present in the rendered control surface.
- Runner regression proves any Send binding can start a runnable non-repeat event and that list-aware hints retain the first configured combination.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M273 therefore makes no screenshot, observed-click, focus-ring, screen-reader, or platform-global-key interception claim beyond pinned source, static component output, deterministic frontend regressions, strict compilation, complete suites, and the production renderer.

## Remote gate

Pending publication of the M273 implementation commit to remote `main` and completion of its CLI container verify/publish workflow.

## Acceptance boundary

M273 closes multiple binding management and editable tab-lifecycle dispatch for the sixteen actions Brunomnia currently exposes. Eighteen pinned shortcut actions remain to be adapted or source-audited, alongside the wider accessibility and desktop distribution gaps. Exactly five parity rows remain incomplete, so Brunomnia is not declared feature-complete.
