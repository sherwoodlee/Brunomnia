# Milestone 9 verification

Verified on 2026-07-16 on macOS against the Phase 9 GraphQL productivity, request scheduling, and desktop-preferences baseline.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript non-incremental project check | Pass |
| Vitest single-worker suite | Pass — 19 files, 76 tests |
| Vite production bundle | Pass — 146 modules transformed; 354.63 KB main chunk plus route-level lazy chunks; no chunk-size warning |
| Bundled CLI build and local smoke run | Pass — 304.4 KB CommonJS executable; 1 request and 2 assertions passed |
| `cargo fmt --check` | Pass |
| `cargo check` | Pass |
| `cargo clippy --all-targets --all-features -- -D warnings` | Pass |
| `cargo test --all-features` | Pass — 20 native tests |
| Tauri debug app bundle | Pass — `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| `git diff --check` | Pass |

The final TypeScript, Vite, Vitest, CLI, and Tauri CLI invocations used the bundled Node.js 24.14 runtime because the local Node.js 26 process stalled during some tool startups. Vitest ran from a disposable `/tmp` source mirror pointing at the same installed dependencies to avoid the synced Documents filesystem bottleneck. The Rust suite's loopback-only mock-server integration ran with loopback binding permission; all 20 tests passed.

The Tauri command disabled only its already-independently-verified `beforeBuildCommand` and consumed the production `dist` output. The broader all-bundle command built the executable and `.app` before its optional DMG script failed in the automation environment; the explicit app-only bundle then completed successfully. Signed DMG distribution is not claimed.

## Focused evidence

- GraphQL tests cover bounded introspection normalization, nested type labels, variables-object and delimiter failures, cached root-field failures, the query-template warning, and safe root-field insertion.
- HTTP regression coverage proves query template syntax remains literal while variable templates resolve.
- Preference tests cover normalization, collision detection, platform-primary modifier matching, and exact secondary modifiers.
- Workspace tests cover v9 defaults, bounded preference migration, GraphQL schema-cache defaults, and import-time preference reset.
- The production bundle compiles the lazy Preferences route and GraphQL schema explorer with the new appearance, density, responsive, scheduling, and editor styles.
- CLI and all native protocol/project/security tests remain green, demonstrating no regression in the headless or Rust boundaries.

## Rendered QA boundary

The existing task direction prohibited another in-app Browser pass in this logical turn, so no fresh screenshot/DOM/console interaction claim is made. Verification is limited to the compiled production UI, successful desktop app bundle, static React/CSS review, and automated logic/migration suites. A future rendered pass should exercise GraphQL introspection against a controlled endpoint, schema insertion, light/compact appearance, shortcut capture/collision handling, and scheduled-send cancellation at desktop and narrow widths.

## Deliberate bounds

- GraphQL validation is structural plus cached root-field checking, not full language-server autocomplete or nested type validation.
- The shared request transport buffers introspection responses before the 20 MB parsed-text check.
- Automatic introspection follows request selection and raw URL changes; manual refresh remains available for environment-driven endpoint changes.
- Stopping scheduled sends cancels future work but does not abort an in-flight network operation.
- Repeats are capped at 1,000 executions and are unavailable for streaming and gRPC requests.
- Accessibility audit, signed/notarized installers, Windows/Linux packaging, and the remaining parity ledger are later phases; Milestone 9 does not declare full Insomnia parity.
