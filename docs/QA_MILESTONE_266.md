# Milestone 266 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: close same-package registry reinstall/update identity and authority lifecycle without inventing an automatic updater or conflating reviewed package replacement with unrestricted dependency execution.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned plugin settings accept one strict package name, call the same install command every time, then explicitly reload the plugin registry. There is no update checker, background remote update, version comparison, or automatic file watcher.
- Pinned discovery stores plugins in a map keyed by package name, so reinstalling the same package replaces that identity rather than adding a second active record. Existing disabled configuration remains keyed by package name across reload.
- Pinned plugin-window discovery uses native `require` and can observe installed production dependencies while loading public exports. The separate templating sandbox explicitly skips `node_modules` and routes bare names only through its curated registry. Broad dependency/native-module compatibility therefore remains open rather than being falsely closed by this milestone.
- Pinned action/hook discovery excludes disabled plugins and carries package identity into each exported action, hook, tag, and theme. Stable package identity is therefore part of the observable reinstall lifecycle.

## Implementation

- `PluginRecord` now carries an optional strict `registryPackageName`. One shared TypeScript validator drives UI validation and persisted migration; malformed, scoped, traversal, reserved, and otherwise unsupported identities are discarded.
- The native fetch remains a review-only source acquisition. After fetch, the installer associates the reviewed package with its strict registry identity and uses the current device registry/proxy/TLS/CA settings for each later explicit check.
- Applying a package with a new identity appends one disabled zero-grant record. Applying an existing identity replaces its stable record instead of duplicating it.
- Byte-identical entry source, complete package map, entry key, and requested modules preserve the stable ID, enablement, capability/module grants, plugin data, active theme, and original installation date while refreshing version, description, warnings, and source metadata.
- Any authority-changing source/map/entry/request difference keeps the stable ID but installs disabled with zero grants, removes plugin data, and clears its active theme. The same complete reset now applies to manual source replacement and explicit local reload, repairing their prior data/theme retention.
- Registry-installed plugin summaries show the package identity and expose **Check registry**. Fetching moves into the ordinary review form; manual edits detach the registry identity so modified source cannot masquerade as an official package update.
- Safe workspace imports preserve valid package identity for future review while still disabling imported plugins and clearing data, grants, and themes.
- `Plugins and extension API` remains `Baseline`. Exactly five parity rows remain incomplete: four `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Vendored bundle freshness | Pass — isolated exact-version regeneration left the checked-in UUID/AJV source unchanged |
| Focused identity/lifecycle suites | Pass — 2 plugin files and 10 tests plus 2 focused migration/import tests |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics in the hydrated `/private/tmp` snapshot |
| Full frontend suite | Pass — 96 files and 689 tests; 2 opt-in integration files and 4 tests skipped. The authoritative run used loopback authority. |
| Production and CLI build | Pass — TypeScript, Vite renderer, and 22.6 MB bundled CLI completed; the generated CLI artifact was refreshed |
| Native aggregate suite | Pass in complete partition — 172 aggregate tests passed and 4 opt-in public/live fixtures were ignored with two unrelated existing timing/environment fixtures filtered; both filtered fixtures passed alone, for 174 passing native tests total |
| Native formatting and lint | Pass — `cargo fmt --check` and all-target/all-feature strict Clippy completed without diagnostics |

## Focused coverage

- Shared strict registry-name tests continue to match the native boundary while persisted malformed identity is removed.
- Safe imports retain only package identity; active runtime authority remains stripped.
- A byte-identical package update changes version metadata without changing ID, enablement, grants, data, theme, or installation date.
- A changed package update keeps the stable ID but disables execution, clears both grant classes and data, removes the active theme, and never creates a duplicate record.
- Type checking covers the workbench's explicit installed-plugin check, review transition, update targeting, source detachment, and complete local/manual authority reset.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M266 therefore makes no screenshot, observed-click, DOM, focus, screen-reader, or visual-layout claim beyond source-backed behavior, strict compilation, focused/full regressions, production build, and native verification evidence.

## Remote gate

Remote signed-container evidence will be appended after the implementation commit completes the main-branch workflow.

## Acceptance boundary

M266 closes explicit same-package remote reinstall/update identity and authority handling while correcting the false automatic-updater requirement. It does not claim production dependency download, native dependency behavior for host-loaded hooks/actions, registry authentication, exact context-menu placement, broad ecosystem compatibility, or CLI host RPC/user-invoked actions. Five parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
