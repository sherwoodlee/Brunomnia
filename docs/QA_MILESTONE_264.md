# Milestone 264 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: close the finite pinned curated plugin-module registry and module-authority lifecycle without conflating it with remote dependency installation, native modules, or broad Node/plugin ecosystem compatibility.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `module-registry.ts` defines baseline `path` and `crypto`, grantable `events`, exact `Module 'X' not permitted by manifest` and `Module 'X' not available in sandbox` failures, operation-local module caching, and heavy vendored libraries included only when granted.
- Pinned vendored inputs resolve `uuid` 11.1.1 and `ajv` 8.18.0. Their regression suites cover UUID v1/v3/v4/v5, validation/version, NIL and DNS/URL namespaces plus AJV required/nested/array/enum/additional-property/error/reuse behavior.
- Pinned crypto regressions cover synchronous MD5, SHA-1, SHA-256, and SHA-512 hashing, chained/base64 output, SHA-256 HMAC, random UUID shape, random bytes, and a 65,536-byte oversized-request clamp. Brunomnia additionally covers SHA-384 and algorithm-aware HMAC through the same bounded implementation.
- Pinned package authority comes from `insomnia.permissions.modules`; declarations grant only registered curated names. Host-loaded hook/action dependency semantics remain broader Node behavior and are explicitly outside this milestone.

## Implementation

- One deterministic registry serves both Blob Workers and resource-limited CLI workers. `buffer`, `path`/`node:path`, and `crypto`/`node:crypto` are baseline; `events`/`node:events`, `uuid`, and `ajv` require explicit grants. Unregistered granted names and ungranted names retain the exact pinned failures.
- The synchronous crypto module implements bounded byte/encoding conversion, MD5/SHA-1/SHA-256/SHA-384/SHA-512, chained digests, hex/base64 output, algorithm-aware HMAC, 65,536-byte-clamped random bytes, and random UUIDs without exposing host Node crypto or asynchronous host RPC.
- An isolated exact-version lockfile plus deterministic esbuild generator emits checked-in minified UUID/AJV factories. Heavy factories are omitted from each operation's worker source unless granted.
- Native package reads validate and bound `insomnia.permissions.modules`, preserving actionable warnings. Source inference scans every retained package module, canonicalizes `node:` aliases, excludes baseline modules, and merges manifest requests without granting them.
- The workbench displays requested curated and unavailable modules separately. New installs start disabled with no grants; source edits, explicit reloads, changed package maps/entries/manifest requests, and workspace import remove module authority. Byte-identical rediscovery with identical requests preserves reviewed grants.
- Workspace migration canonicalizes requests, infers missing legacy requests, constrains grants to requested names, bounds warnings, and imported workspaces clear grants. The CLI receives the same stored grant set and registry while continuing to deny host RPC and persistent writes.
- `Plugins and extension API` remains `Baseline`. Exactly five parity rows remain incomplete: four `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Vendored bundle freshness | Pass — isolated exact-version regeneration matched the checked-in generated source byte-for-byte |
| Focused module/runtime/storage/interchange suites | Pass — 5 files and 94 tests |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics in the clean `/private/tmp` snapshot |
| Full frontend suite | Pass — 96 files and 687 tests; 2 opt-in integration files and 4 tests skipped. The authoritative run used loopback authority because the sandbox correctly refused `127.0.0.1` binding. |
| Production and CLI build | Pass — TypeScript, Vite renderer, and 22.6 MB bundled CLI completed |
| Focused native package tests | Pass — 3 tests cover multi-file package/discovery behavior plus valid and invalid manifest module shapes |
| Native aggregate suite | Pass — 170 tests; 4 opt-in public/live fixtures skipped. The authoritative run used loopback/Unix-socket authority. |
| Native formatting and lint | Pass — `cargo fmt --check` and all-target strict Clippy completed without diagnostics |

## Focused coverage

- Baseline `buffer`, `path`, and every pinned crypto vector execute without a manifest grant. `events` requires a grant, aliases canonicalize, unknown granted names fail unavailable, and ungranted names fail not permitted.
- UUID v1/v3/v4/v5 values, validation, versions, NIL, DNS, and URL namespaces execute from the exact vendored bundle. AJV validates required/nested/array/enum/additional-property cases, exposes errors, and reuses compiled validators.
- Package manifest and source requests merge without widening authority. Package source, module map, entry, or requested-module changes are authority-changing identity; unchanged rediscovery retains only still-requested grants.
- Storage canonicalizes aliases, infers missing requests, drops grants outside requests, bounds warnings, and removes every imported module grant.
- Native package reads preserve valid requests while warning on invalid permission and module shapes.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M264 therefore makes no screenshot, observed-click, DOM, focus, screen-reader, or visual-layout claim beyond source-backed behavior, strict compilation, focused/full regressions, production build, and native verification evidence.

## Remote gate

Remote signed-container evidence will be appended after the implementation commit completes the main-branch workflow.

## Acceptance boundary

M264 closes the pinned curated bare-module registry and reviewable module-grant lifecycle. It does not claim remote/custom-registry installation, dependency download or native dependency behavior for host-loaded hooks/actions, exact context-menu placement, broad Node/plugin ecosystem compatibility, or CLI host RPC/user-invoked actions. Five parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
