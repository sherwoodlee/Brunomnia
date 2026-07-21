# Milestone 274 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: complete the pinned keyboard-action registry with live account-free local targets, correct the prior inventory count, and migrate the create-menu/create-request binding split without claiming the remaining accessibility or desktop-distribution work complete.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia-data/common-src/settings.ts` contains 33 `KeyboardShortcut` union members, not 34. M273 implemented sixteen actions, so seventeen remained. This record corrects the earlier prose count without changing M273's signed code evidence.
- `hotkeys.ts` supplies the action descriptions and platform defaults. Its current defaults split `sidebar_showCreateDropdown` onto Command/Control+N and `request_createHTTP` onto Command/Control+Alt+N; the settings initializer removes only the legacy conflict and preserves custom combinations.
- Current renderer consumers cover plugin reload, variable disclosure, preferences, send/options, environment switching, HTTP method/URL, request settings/create/delete/folder/duplicate/pin/code generation, response focus, cookies, GraphQL beautification/filtering, sidebar creation, and tab lifecycle.
- The pinned union still declares `workspace_showSettings`, `showAutocomplete`, and `sidebar_focusFilter` without an action-name consumer in the current renderer tree. Brunomnia gives those editable entries useful local collection-settings, active-editor completion, and sidebar-filter targets rather than preserving inert shortcuts.

## Implementation

- Workspace v48 stores all 33 actions in the existing bounded multi-binding model. Missing actions receive defaults while custom lists, explicit empty lists, per-action reset, reset-all, duplicate refusal, and first-owner migration behavior remain intact.
- A v47 workspace whose legacy `new-request` list still contains `Mod+N` receives `create-menu: Mod+N`; only that conflicting combination is removed from request creation, and an otherwise empty result receives the pinned `Mod+Alt+N` default. Custom non-conflicting and explicitly cleared request bindings survive.
- The request workbench now resolves one action owner on `window` in the capture phase. It exposes collection/request settings, keyboard/general Preferences entry, plugin descriptor remount, active GraphQL completion, send options, environment/method/sidebar/response/GraphQL focus, cookies, create menu, contextual sibling request/folder creation, pinning, resolved-variable display, body beautification, and every existing tab action.
- Request creation now uses the active request's collection and folder, inserts the new sibling directly after it in mixed resource order, and retains empty-project creation behavior.
- The pinned defaults assign `Mod+Shift+F` to both sidebar filtering and body beautification. Brunomnia gives body beautification contextual precedence while an active request body editor is mounted and otherwise focuses/selects the sidebar filter; custom unique bindings remain direct.
- `Show variable source and value` toggles a persisted device-local preference. When enabled, environment choices in the template-tag picker reveal a bounded value preview and identify the effective request scope. Secret rows remain empty there and vault values keep their independent authority boundary.
- Plugin operations already instantiate fresh disposable Workers from reviewed stored source. The reload shortcut remounts plugin descriptors/runtime UI; reading changed linked filesystem source still requires the existing explicit review action so disk changes cannot inherit grants silently.
- No account, plan, license, hosted preference service, telemetry, or entitlement check is involved.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused shortcut suites | Pass — 4 files/61 tests cover 33-row rendering, labels/defaults/collisions, create-menu scope, variable disclosure, v47 binding migration, and storage normalization |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics from the fresh-source isolated mirror |
| Full frontend suite | Pass in required partition — 104 regular files/721 tests passed with 2 opt-in integration files/4 tests skipped; the real MCP loopback file passed separately, so all 722 active tests were observed passing |
| Production and CLI build | Pass — TypeScript, Vite renderer, 1,547 transformed modules, and the 22.6 MB bundled CLI completed; CLI size is 23,684,167 bytes with SHA-256 `352f0dcd95de7f875a0a02980fae24c8165dd2305b89cfc07419580a1b4429d9` |
| Packaged CLI smokes | Pass outside localhost sandbox — template/file grants, authoritative physical store, and full runner/config/plugin/transport/report smoke matrices passed |
| Native aggregate suite | Pass in complete partition — the unrestricted aggregate passed 188 tests with 4 opt-in public/live fixtures ignored and the login-shell fixture filtered; that fixture passed separately, so all 189 active native tests were observed passing |
| Native formatting and lint | Pass — `cargo fmt --check`, locked all-target/all-feature Cargo check, and strict Clippy completed without diagnostics |

## Focused coverage

- Preference regressions pin the exact 33-action key set, three Send defaults, the upstream create split, the intentional upstream `Mod+Shift+F` duplicate, registry-owner order, and deep-cloned lists.
- Storage regressions prove v47 `Mod+N` request creation migrates to v48 without colliding with the new create menu and that every prior version now converges on v48.
- Static React regressions prove direct keyboard-tab entry renders 33 action rows, the create menu exposes HTTP request/folder/collection choices with unavailable folder scope disabled, and variable values remain hidden until explicitly enabled.
- Complete frontend, production, packaged CLI, and native suites prove the schema bump and generated CLI remain compatible with project/import/export/catalog/runtime boundaries.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M274 therefore makes no screenshot, observed-click, focus-ring, screen-reader, platform menu interception, or assistive-technology claim beyond pinned source, static component output, deterministic frontend regressions, strict compilation, complete suites, and the production renderer.

## Remote gate

Implementation commit `a8a101d791f6539fd03c637bb0a7cb79b566de21` completed both verify and publish jobs in [CLI container workflow 29821902617](https://github.com/sherwoodlee/Brunomnia/actions/runs/29821902617). The verify job rebuilt the generated CLI without a diff, built the verification image, matched package version, and passed the pinned-image, non-root, no-network, read-only, local-reference lint, standalone-suite, config, and plugin-tag smoke matrix.

The publish job emitted AMD64/ARM64 SBOM and provenance attestations and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:27a2fd127fa24a655aecf7d69d56e882125769399e3fb28df5b2621d66021aae
```

Independent manifest inspection resolved AMD64 `sha256:88c9f546b1f9c0cbeedb4848d888ae1fbfae660cf04e03987206b3eb29ef0f0e`, ARM64 `sha256:37b024c81c6ff1be5d8d12202ba5e8451e4c92aa68798ae738de4ea1715e7665`, and attached attestation manifests `sha256:9e489ef4e71e6f5b48d3894c8373961a5446b32d51a7d0df8730f0261a6a7346` plus `sha256:ec819f5c4cf52f861dc4e59cc5fb8a48edae791da832185564d361735c220718`. Both platform attestations expose SPDX and SLSA provenance predicates.

Independent Cosign verification passed digest claims, trusted certificate-chain validation, exact issuer `https://token.actions.githubusercontent.com`, exact subject `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, `push` trigger, `refs/heads/main`, repository `sherwoodlee/Brunomnia`, workflow `CLI container`, exact implementation commit SHA, and offline transparency-log inclusion at Rekor index `2211627886`.

## Acceptance boundary

M274 closes the pinned keyboard-action inventory and corrects the source count to 33. The Preferences/shortcuts row remains `Baseline` because a complete accessibility audit, updater, desktop signing/notarization, and Windows/Linux desktop release artifacts remain. Exactly five parity rows remain incomplete, so Brunomnia is not declared feature-complete.
