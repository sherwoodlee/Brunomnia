# Milestone 10 verification

Verified on 2026-07-16 on macOS against the Phase 10 nested-resource and environment-hierarchy baseline.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript non-incremental project check | Pass |
| Vitest suite | Pass — 20 files, 82 tests |
| Vite production bundle | Pass — 147 modules transformed; 374.79 KB main chunk plus route-level lazy chunks; no chunk-size warning |
| Bundled CLI build and local smoke run | Pass — 299.4 KB CommonJS executable; 1 request and 2 assertions passed |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --all-features` | Pass |
| `cargo clippy --all-targets --all-features -- -D warnings` | Pass |
| `cargo test --all-features` | Pass — 20 native tests |
| Tauri debug app bundle | Pass — `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| `git diff --check` | Pass |

The final TypeScript and Vite invocations used the bundled Node.js 24.14 runtime. Vitest ran from the disposable Phase 9 `/tmp` source mirror updated with the Phase 10 files and a fresh `npm ci` dependency tree in `/tmp`; this avoids the synced Documents filesystem startup bottleneck while testing the same source and lockfile. The sandboxed Rust run passed 19 tests and failed only when the loopback integration was denied permission to bind. The approved loopback-capable run then passed all 20 tests.

The Tauri command disabled only its already-independently-verified `beforeBuildCommand` and consumed the verified production `dist` output. It produced the explicit app-only macOS debug bundle; signed/notarized distribution is not claimed.

## Focused evidence

- Resource tests prove parent-to-child environment overrides, collection/folder/request priority, case-insensitive header replacement, nearest folder authentication, root-to-request pre-scripts, request-to-root after-scripts, and recursive private-tree filtering.
- Migration tests prove workspace v10 defaults, invalid-reference cleanup, folder/environment cycle repair, and private-descendant propagation.
- Security tests prove private publication filtering and active-ID repair, local-private preservation across sync, and plaintext detection in collection and inherited folder variables, headers, and authentication.
- Insomnia compatibility tests prove v4/v5 nested folders survive import/export with request placement and folder documentation, and import application remaps IDs without breaking references.
- The full frontend suite, CLI smoke, native suite, and desktop bundle remain green, demonstrating no regression in earlier protocol, automation, project, plugin, security, MCP, AI, Konnect, GraphQL, or preference milestones.

## Rendered QA boundary

The existing task direction prohibited another in-app Browser pass in this logical turn, so no fresh screenshot, DOM, console, or interactive rendered claim is made. Verification is limited to the compiled production UI, successful desktop app bundle, static React/CSS review, and automated hierarchy/interchange/migration suites. A future rendered pass should exercise deep folder search/collapse, folder moves and deletion, collection/folder/request documentation, inherited authentication and headers, environment parent changes, private-tree labels, and narrow-width modal layouts.

## Deliberate bounds

- Folders do not yet support drag/drop ordering, bulk operations, or every upstream context-menu action.
- Documentation preview is plain text rather than rendered Markdown.
- Private environments are omitted from publication; their values are not encrypted unless vault or approved external-vault references are used.
- Environment and folder ancestry is bounded and cycle-safe, but the UI does not expose a general-purpose resource-tree reorder operation.
- Insomnia v4/v5 adapters preserve the supported hierarchy and folder configuration, while format-specific unsupported protocols/files continue to use explicit warnings.
- Accessibility audit, signed/notarized installers, Windows/Linux packaging, and remaining parity-ledger gaps are later phases; Milestone 10 does not declare full Insomnia parity.
