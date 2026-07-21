# Milestone 267 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: add bounded reviewable pure-CommonJS production dependency graphs without inheriting Yarn lifecycle-script, native-addon, ambient-process, or unrestricted Node authority.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned installation creates a temporary package, runs bundled Yarn `add --production`, copies the plugin into its device directory, and copies every other top-level installed directory into that plugin's `node_modules`. It does not pass Yarn's `--ignore-scripts` flag.
- Pinned discovery clears the native require cache and requires the plugin directory inside the isolated Electron plugin window. Request/response hooks and actions can therefore use Yarn-installed JavaScript or native dependencies with ordinary Node resolution and ambient process authority.
- Pinned template-tag execution is deliberately different: its bounded module-map walk skips `node_modules`, and bare names resolve only through the curated permission registry. Production dependencies are not a template-sandbox requirement in pinned Insomnia.
- Brunomnia keeps one reviewed Worker path for every export and the CLI. M267 therefore implements pure-CommonJS dependency compatibility as a stricter account-free extension rather than reintroducing native `require`, lifecycle scripts, or ambient Node authority.

## Implementation

- `PluginSourceOutput` and `PluginRecord` carry a separate dependency source map plus package version/entry metadata. Workspace migration retains only safe `node_modules/<package>/...` UTF-8 JavaScript/CJS/JSON maps under 50-package, 2,000-file, and 20 MB aggregate limits.
- Local plugin reads follow declared `dependencies` and `optionalDependencies` inside the selected canonical package root. Missing optionals warn, required missing packages remain visible and ungrantable, symlink/root escapes fail, and incompatible same-name versions fail rather than silently resolving the wrong code.
- Registry dependency metadata uses the same TLS/CA/proxy/no-proxy and same-origin redirect boundary. Exact versions, dist tags, caret, tilde, wildcard, comparator, OR, and full-version hyphen ranges select the highest matching record. Each tarball remains confined, identity-matched, and SHA-1 verified; aggregate metadata/download/source/package/file limits stop unbounded graphs.
- Lifecycle scripts never run. Peer dependencies, bundled `node_modules`, aliases, Git/HTTP/file/workspace specifications, ESM-only entries, export maps without compatible CommonJS main/index source, binaries, and native addons are rejected or explicitly warned.
- The shared desktop/CLI loader resolves plugin-relative files, dependency package main/index/subpaths, JSON, and CJS. A dependency-relative path cannot enter a sibling package. Every non-baseline curated or dependency package remains unavailable until its own requested module grant is stored.
- Dependency source, package versions, entries, and requests are authority identity. Any change disables the plugin and clears grants/data/theme; byte-identical registry or local reloads preserve reviewed authority. Manual source editing detaches both linkage and dependency state.
- The workbench lists dependency count, versioned package grants, every retained source file, acquisition warnings, and the remaining unsupported surfaces before enablement.
- `Plugins and extension API` remains `Baseline`. Exactly five parity rows remain incomplete: four `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Vendored bundle freshness | Pass — isolated exact-version regeneration left the checked-in UUID/AJV source unchanged |
| Focused dependency/runtime suites | Pass — 3 frontend files and 64 tests plus 9 native plugin parser/local/registry/range tests |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics in the hydrated `/private/tmp` snapshot |
| Full frontend suite | Pass — 96 files and 690 tests; 2 opt-in integration files and 4 tests skipped. The authoritative run used loopback authority. |
| Production and CLI build | Pass — TypeScript, Vite renderer, and 22.6 MB bundled CLI completed; the generated CLI artifact was refreshed |
| Native aggregate suite | Pass in complete partition — 174 aggregate tests passed and 4 opt-in public/live fixtures were ignored with two unrelated existing timing/environment fixtures filtered. The login-shell fixture passed alone; the cancellation fixture passed in the initial 175-pass full run and reproduced only its known strict zero-millisecond assertion when isolated, for all 176 active native tests observed passing. |
| Native formatting and lint | Pass — `cargo fmt --check` and all-target/all-feature strict Clippy completed without diagnostics |

## Focused coverage

- Local `node_modules` capture proves package identity/version/entry, range matching, prefixed source retention, and explicit requested-package output.
- The custom loopback registry serves plugin and dependency metadata/tarballs; the native client selects the compatible dependency, verifies both SHA-1 values, retains review source, and redacts both query secrets.
- Range regressions cover exact, partial, caret, spaced comparators, tags, and unsupported non-registry specifications.
- Desktop/CLI shared-loader regressions prove zero-grant denial, granted dependency execution, relative source/JSON continuity, missing-module denial, and sibling-package traversal rejection.
- Migration drops unsafe dependency paths/packages while retaining safe package metadata and source; changed dependency identity resets registry-update authority.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M267 therefore makes no screenshot, observed-click, DOM, focus, screen-reader, or visual-layout claim beyond source-backed behavior, strict compilation, focused/full regressions, production build, and native verification evidence.

## Remote gate

Remote signed-container evidence will be appended after the implementation commit completes the main-branch workflow.

## Acceptance boundary

M267 closes bounded pure-CommonJS production dependency acquisition, review, persistence, grants, and execution across local/registry desktop plugins plus the stricter CLI worker. It does not claim lifecycle/install scripts, native addons, ESM/export-map or conflicting multi-version graph support, ambient Node/process compatibility, registry authentication, exact upstream context-menu placement, broad ecosystem compatibility, or CLI host RPC/user-invoked actions. Five parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
