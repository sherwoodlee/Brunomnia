# Milestone 268 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: place reviewed plugin actions on the renderer surfaces actually used by pinned Insomnia, preserve exact request/folder/design target models, and refuse stale action output after authority changes.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `request-actions-dropdown.tsx` loads `getRequestActions()` when the request menu opens and appends one Plugins section whose entries execute with the selected request.
- `request-group-actions-dropdown.tsx` loads `getRequestGroupActions()` when the folder menu opens and executes with the selected group plus its ordered child requests.
- `workspace-card-dropdown.tsx` loads `getDocumentActions()` only when workspace scope is design and executes with parsed API-spec contents. This is the pinned renderer placement for document actions.
- `getWorkspaceActions()` exists in the plugin index, preload bridge, renderer bridge, invocation switch, and tests, but no pinned renderer TypeScript/TSX consumer invokes it. Brunomnia therefore keeps workspace actions callable from its plugin workbench instead of inventing a menu surface that pinned Insomnia does not mount.
- Pinned production plugin settings expose only `npmRegistryUrl`. `NODE_AUTH_TOKEN` enters the Yarn environment only inside `isDevelopment()`. Registry-token UI/authentication is therefore not an explicit production parity requirement.

## Implementation

- Enabled, error-free plugins must retain the explicit `action` grant before their descriptor is loaded into the contextual catalog. One invalid plugin is isolated without suppressing actions from healthy plugins; plugin changes clear the prior catalog synchronously before rediscovery.
- Request actions appear on ordinary request rows and their pinned duplicates. Request-group actions appear on folder rows. Document actions appear on API Design project cards. Every trigger uses the matching target kind and fixed positioning so the sidebar scroll container cannot clip the menu.
- Menus expose `aria-haspopup`, `aria-expanded`, a labelled menu role, focus the first action when opened, close on outside pointer input or Escape, and return focus after Escape. A single in-flight action disables every contextual trigger and prevents concurrent store/request races.
- Invocations re-resolve the request, collection/folder, or design from the current workspace. Missing or cross-collection targets fail before plugin execution. Empty folders and document-only projects receive bounded synthetic request context without adding that request to the workspace.
- Target-owned cookies, certificates, request ancestors, environment, OAuth handling, host prompts, clipboard, paths, and data import/export feed the same two-second Worker boundary used by the workbench.
- The action authority identity includes source, package/dependency maps and entries, enable/error state, module grants, and capability grants. Completion persists matching request mutations and plugin-local store only when that identity still matches; revocation, source replacement, plugin removal, or project switching discards stale output.
- Bounded success/error feedback includes at most three plugin notifications plus a remaining-count summary. Descriptor failures remain inspectable from the status bar without exposing disabled or ungranted actions.
- `Plugins and extension API` remains `Baseline`. Exactly five parity rows remain incomplete: four `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Vendored bundle freshness | Pass — exact UUID/AJV regeneration left the checked-in source byte-identical |
| Focused contextual suites | Pass — 3 frontend files and 13 tests cover catalog filtering/failure isolation, request/folder/design placement rendering, exact target rebinding, request/store persistence, and stale grant/source refusal |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics in the hydrated `/private/tmp` snapshot |
| Full frontend suite | Pass — 97 files and 695 tests passed; 2 opt-in integration files and 4 tests skipped. The authoritative run used loopback authority; the sandbox-only run refused its existing MCP listener with `EPERM`. |
| Production and CLI build | Pass — TypeScript, Vite renderer, 1,545 transformed modules, and the 22.6 MB bundled CLI completed; the CLI SHA-256 remained `645109eb7dc06da7b83e51c001f9695eeaba5520d569d0792036a80578ab2f60` |
| Native aggregate suite | Pass in complete partition — 175 aggregate tests passed with 4 opt-in public/live fixtures ignored and the login-shell fixture filtered; that fixture passed separately. The known strict zero-millisecond cancellation assertion failed only in isolation and passed under final aggregate load, so all 176 active native tests were observed passing. |
| Native formatting and lint | Pass — `cargo fmt --check` and all-target/all-feature strict Clippy completed without diagnostics |

## Focused coverage

- Catalog regressions prove disabled, errored, and ungranted plugins cannot populate menus; workspace exports are deliberately excluded from renderer placement; one descriptor failure does not hide healthy exports.
- Invocation regressions prove request ownership, folder identity, document identity, and action-ID/kind agreement are checked before execution.
- Authority regressions prove accepted request/store output and rejection after grant revocation or source changes.
- Server-rendered component regressions prove request actions appear on ordinary plus pinned request rows, request-group actions appear only on folder rows, and document actions appear only on API Design project cards.
- Existing plugin Worker, package/dependency, CLI, storage, request, and interchange suites continue to pass unchanged.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M268 therefore makes no screenshot, observed-click, DOM-event, focus-ring, screen-reader, clipping, or visual-layout claim beyond source-backed component output, keyboard/pointer implementation, strict compilation, focused/full regressions, production build, and native verification evidence.

## Remote gate

Implementation commit `9bdb72f70874138ea96d073df9b90fd6b31b2dd6` completed both verify and publish jobs in [CLI container run 29809190427](https://github.com/sherwoodlee/Brunomnia/actions/runs/29809190427). The verify job rebuilt the committed CLI without a diff, built the verification image, matched the package version, and passed the pinned-image, non-root, no-network, read-only, local-reference lint, standalone-suite, config, and plugin-tag smoke.

The publish job emitted AMD64/ARM64 SBOM and provenance attestations and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:8b59ad943b8d692c98edef93e1e87729b6200d2e8d676e9e7f60ac24670f45d3
```

Independent manifest inspection resolved AMD64 `sha256:97aafc813b77387140190bd7df1420156fcff6692bd5b91e999dc1f30cafd324`, ARM64 `sha256:ef0a3af0de15f231990c7c37df97d87e43371a300f8a83f4c79e626ee5dc3104`, and attached attestation manifests `sha256:24091e2e7c961abb1dfc21bf1c36c3cc946ea40f8410e809802e6fa713c99d51` plus `sha256:449e858147d5caad89630bc6f5061c0a9337aeb8b02cab557fc440dcf1f95b62`. Both platform attestations expose SPDX and SLSA provenance predicates. Independent Cosign verification passed claims, trusted certificate-chain validation, exact issuer `https://token.actions.githubusercontent.com`, exact subject `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, branch, repository, workflow, implementation SHA, digest claims, and offline transparency-log inclusion at Rekor index `2210909062`.

## Acceptance boundary

M268 closes source-backed request, request-group, and design-document action placement plus stale-authority result handling. It corrects registry authentication as a false production requirement and preserves workspace actions in the workbench because pinned Insomnia exposes no renderer consumer. It does not claim native addons/install scripts, ESM/export-map or conflicting multi-version graph support, ambient Node/process compatibility, broad ecosystem compatibility, or CLI host RPC/user-invoked actions. Five parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
