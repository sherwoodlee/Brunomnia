# Milestone 263 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: close bounded external package-directory discovery and multi-file relative CommonJS loading without conflating those operations with remote npm installation or unrestricted Node compatibility.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `plugins/index.ts` scans the default plugin root, configured extra roots, and each root's `node_modules`; it descends scoped folders, accepts packages with a `package.json` `insomnia` field, de-duplicates by name, and reloads only on explicit initialization/refresh. There is no automatic file watcher.
- Pinned `install-plugin.ts` separately validates `insomnia-plugin-*` names, asks Yarn for registry metadata, permits npmjs/GitHub Packages or a configured registry tarball host, installs production dependencies into a temporary folder, and copies the package plus dependencies into the user-data plugin root.
- Pinned sandbox documentation and tests package only `.js`/`.json` files inside the plugin root, skip `node_modules` and dot-directories, resolve relative modules plus directory indexes, cache CommonJS modules, and route bare names to a curated registry rather than package dependencies.
- The pinned curated registry currently provides baseline `path`/`crypto`, grantable `events`, and pinned vendored `uuid`/`ajv`. Host-loaded hooks/actions still use native `require`; those broader dependency semantics remain separate from M263.

## Implementation

- Native direct reads now return a canonical entry key plus a sorted module map. Package walking permits at most 500 JavaScript/JSON files, 1 MB per file, 5 MB aggregate, 32 levels, and 2,000 entries per folder while rejecting escapes and excluding symlinks, dot-directories, `node_modules`, non-text files, and unsupported entries.
- Native discovery accepts a direct package/file, a folder of packages, its `node_modules`, and scoped folders. It requires the `insomnia` manifest for discovered packages, caps scans at 100 packages/1,000 entries/four scoped levels, de-duplicates canonical roots, and returns bounded per-package warnings.
- The shared browser/CLI worker compiles retained modules only through a host-captured constructor after plugin-visible constructor escape paths are removed. Relative `./`/`../`, `.js`/`.json`, and directory indexes resolve inside the immutable package map with operation-local CommonJS caching and isolated file identity values.
- Missing, above-root, and arbitrary bare dependencies fail closed. The existing safe `buffer` shim remains the only bare module in this milestone.
- The plugin workbench can discover multiple packages, review every retained module, infer permissions across the complete map, and preserve linked roots. New or changed packages start disabled and lose data, grants, and active-theme authority; byte-identical rediscovery preserves prior review state.
- Workspace migration validates module keys/count/individual/aggregate bytes. The opt-in CLI uses the same package map and relative loader without gaining host RPC, persistent writes, dependency folders, or ambient Node authority.
- `Plugins and extension API` remains `Baseline`. Exactly five parity rows remain incomplete: four `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused package/runtime/storage suites | Pass — 3 files and 59 tests |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics in the clean `/private/tmp` snapshot |
| Full frontend suite | Pass — 95 files and 679 tests; 2 opt-in integration files and 4 tests skipped. The authoritative run used loopback authority because the sandbox correctly refused `127.0.0.1` binding. |
| Production and CLI build | Pass — TypeScript, Vite renderer, and 22.4 MB bundled CLI completed; a second deterministic CLI build produced the checked-in artifact |
| Focused native package tests | Pass — 2 tests cover multi-file package maps plus direct/scoped discovery |
| Native aggregate suite | Pass — 169 tests; 4 opt-in public/live fixtures skipped. One unrelated login-shell PATH fixture flaked once, passed alone, and passed in the authoritative aggregate rerun. |
| Native formatting and lint | Pass — `cargo fmt --check` and all-target strict Clippy completed without diagnostics |

## Focused coverage

- Relative JavaScript, JSON, extension, and directory-index resolution execute in the same shared runtime used by desktop and CLI plugins; `__dirname`/`__filename` remain package-relative rather than exposing host paths.
- Missing relative modules, above-root traversal, unsafe persisted keys, and unavailable bare modules fail closed.
- Package permission inference sees helper modules instead of inspecting only the entry file.
- Native package walking retains nested source, excludes `node_modules`, recognizes nested Insomnia display metadata, and discovers both unscoped and scoped packages.
- Workspace migration retains safe package maps and drops traversal keys.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M263 therefore makes no screenshot, observed-click, DOM, focus, screen-reader, or visual-layout claim beyond source-backed behavior, strict compilation, focused/full regressions, production build, and native verification evidence.

## Remote gate

Implementation commit `825a264e8386a7da3ca03cdd3127c40148ba7f1d` completed both verify and publish jobs in [CLI container run 29799807042](https://github.com/sherwoodlee/Brunomnia/actions/runs/29799807042). The verify job rebuilt the committed CLI without a diff, built the verification image, matched the package version, passed the ordinary no-network/read-only suite smoke, and passed the extended pinned-image/non-root/no-network/config/plugin-tag smoke. The publish job emitted AMD64/ARM64 SBOM and provenance attestations and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:5d09696b60eaf982eefb35f1007608c5e6b1027539fe03dd707a940103212658
```

Independent manifest inspection resolved AMD64 `sha256:90aedef2ffc369577385f89628abfba711d3340195ada8405c2a3c7f0b0cb152`, ARM64 `sha256:b6fe96ba630f8d225e0d948e21ffd30f0e80ea7c9367106edb41dbf2541b0704`, and attached attestation manifests `sha256:f15a1de33a2d20622f913e9d305d98bade51a12238fab4be970bf8d50faef4d4` plus `sha256:35a10e5190c647de82a7f97597d18b9843f1d781ed19c6570611de87168e1235`. Independent Cosign verification passed claims, trusted certificate-chain validation, exact issuer `https://token.actions.githubusercontent.com`, exact subject `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, branch, repository, workflow, implementation SHA, digest claims, and offline transparency-log inclusion at Rekor index `2210155281`.

## Acceptance boundary

M263 closes manual external directory discovery and reviewable package-local relative modules. It does not claim remote/custom-registry npm installation, dependency download, the pinned curated bare-module registry, native dependency behavior for host hooks/actions, exact context-menu placement, broad ecosystem compatibility, or CLI host RPC/actions. Five parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
