# Milestone 265 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: close bounded default/custom npm-registry plugin acquisition without conflating package download with production dependency installation, native modules, automatic updates, or broad Node/plugin ecosystem compatibility.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `plugin-name.ts` requires unscoped `insomnia-plugin-*` names for this installer and rejects empty/oversized names, traversal, shell metacharacters, unsafe starts/ends, consecutive dashes, reserved names, and unsupported characters.
- Pinned `install-plugin.ts` asks the configured npm registry for package metadata, requires an `insomnia` attribute, validates returned identity, permits npmjs, GitHub Packages, or the configured registry host for tarballs, and requires HTTPS except for an exact user-configured HTTP registry host/port.
- Pinned installation forwards manual proxy/no-proxy and custom-CA settings, checks the advertised SHA-1 tarball checksum, and runs Yarn's production installation before copying package dependencies. Dependency acquisition is explicitly separate from this milestone.
- Pinned settings expose a package-name install action and a device-local custom registry setting. Installation refreshes plugin discovery; it does not establish an automatic remote update watcher.

## Implementation

- A native Tauri command accepts the strict package name plus device-local registry, certificate-validation, active-file CA, proxy, and no-proxy inputs. It uses bounded Reqwest requests directly and never starts a shell, Yarn, npm, lifecycle script, or downloaded code.
- Registry metadata is limited to 1 MB and five redirects that must remain on the configured origin. Tarballs are limited to 10 MB and each redirect is revalidated against the npm/GitHub/custom-host and HTTPS/exact-custom-HTTP policy. URL credentials are rejected.
- The advertised 40-digit SHA-1 is verified before parsing. In-memory gzip expansion is capped at 20 MB, with at most 2,000 tar entries. Header checksums, octal fields, padding, UTF-8/PAX/GNU paths, traversal, excessive nesting, duplicate modules, per-module/aggregate bytes, and file count are validated without filesystem extraction.
- `package/package.json`, `insomnia`, strict package name, metadata/tarball name and version, JavaScript entry resolution, and retained module identity must all match. Packages that declare production dependencies receive a visible warning because only bundled package-local modules and Brunomnia's curated registry can load.
- The workbench persists the custom registry URL through bounded preference migration, validates names client-side, and fetches packages into the existing complete-module review form. Remote sources deliberately receive no filesystem `sourcePath`; a separate action installs them disabled with zero capability or module grants.
- `Plugins and extension API` remains `Baseline`. Exactly five parity rows remain incomplete: four `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Vendored bundle freshness | Pass — isolated exact-version regeneration left the checked-in UUID/AJV source unchanged |
| Focused registry/migration suites | Pass — strict TypeScript validator, safe-default preference migration, and 7 native package/name/archive/custom-registry tests |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics in the hydrated `/private/tmp` snapshot |
| Full frontend suite | Pass — 96 files and 688 tests; 2 opt-in integration files and 4 tests skipped. The authoritative run used loopback authority because the sandbox correctly refused `127.0.0.1` binding. |
| Production and CLI build | Pass — TypeScript, Vite renderer, and 22.6 MB bundled CLI completed; the generated CLI artifact was refreshed |
| Native aggregate suite | Pass in complete partition — 173 tests passed and 4 opt-in public/live fixtures were ignored with the existing strict `elapsed_ms > 0` cancellation timing fixture filtered; that fixture passed alone. Two unpartitioned attempts reproduced only that zero-millisecond assertion or unrelated existing environment flakes. |
| Native formatting and lint | Pass — `cargo fmt --check` and all-target/all-feature strict Clippy completed without diagnostics |

## Focused coverage

- Exact unscoped package-name acceptance and malformed, scoped, traversal, dash, and reserved-name rejection match the pinned validator boundary.
- Synthetic valid npm tarballs preserve manifest display metadata, entry source, nested relative modules, and requested module permissions.
- Traversal, corrupt header checksums, oversized modules, duplicate/unsafe paths, malformed identity, and bounded gzip/tar failures stop before source reaches the renderer.
- A real custom loopback HTTP registry serves metadata and tarball bytes; the native client applies the exact custom-origin HTTP exception, verifies SHA-1, validates package identity, and returns reviewable source.
- Legacy preferences receive the public npm default; malformed registry values are bounded as device-local strings and native URL validation remains authoritative at fetch time.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M265 therefore makes no screenshot, observed-click, DOM, focus, screen-reader, or visual-layout claim beyond source-backed behavior, strict compilation, focused/full regressions, production build, and native verification evidence.

## Remote gate

Remote signed-container evidence will be appended after the implementation commit completes the main-branch workflow.

## Acceptance boundary

M265 closes bounded npm/custom-registry package acquisition into the disabled zero-grant review lifecycle. It does not claim production dependency download, native dependency behavior for host-loaded hooks/actions, registry authentication, automatic remote updates, integrity algorithms beyond the pinned SHA-1 contract, exact context-menu placement, broad ecosystem compatibility, or CLI host RPC/user-invoked actions. Five parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
