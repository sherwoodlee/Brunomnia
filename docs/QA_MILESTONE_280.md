# Milestone 280 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: close the final parity row with signed native update channels, credential-required trusted releases, universal macOS packaging, explicit accessibility semantics/preferences, rendered keyboard QA, and final workspace migration while retaining truthful unsigned main-branch artifacts.

## Source reconciliation

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` and Kong Developer documentation commit `73995e32ed758882a290c945807225d7442b483e` remain the pinned clean-room behavior references.
- The pinned desktop contract checks at startup and every three hours, supports stable and beta channels, exposes manual checking, disables development/administrator/portable updates, applies signed macOS/Windows updates on restart, and reports Linux package releases without bypassing package ownership.
- The pinned preference shell requires keyboard-operable sections, visible focus, meaningful control names/status, reduced-motion behavior, sufficient contrast, and platform high-contrast compatibility. Exact Electron DOM/CSS internals are not a product capability.
- Prior milestones already closed the complete 33-action shortcut registry, themes, density, editor/layout/preferences, unsigned cross-platform installers, checksums, provenance, retention, and tagged publication. M280 audits and closes only the named updater, signing/notarization, universal-macOS, and accessibility gaps.

## Implementation

- Workspace v52 adds normalized `updateAutomatically` and stable/beta `updateChannel` preferences without importing device update policy from projects or shared payloads.
- `tauri-plugin-updater` uses separate rolling stable/beta manifests, the embedded public key, a 30-second check deadline, exact version revalidation, signed download verification, progress events, staged bytes, and explicit restart installation. Linux remains notice-only; development, administrator-disabled, and portable Windows builds fail closed.
- The app-level update provider runs the default startup/three-hour schedule, serializes operations, presents manual checking, release notes, progress, verified-ready state, and Linux release navigation in General preferences.
- The tagged workflow requires updater, Apple Developer ID/notarization, and DigiCert credentials; builds universal macOS, Windows x64, and Linux x64 outputs; verifies notarization staples and Authenticode; emits signed updater archives; attaches provenance; creates the versioned GitHub release; and atomically replaces separate rolling stable/beta assets. The ordinary `main` matrix remains explicitly unsigned.
- The application shell adds a skip link and labeled main landmark. Preferences use a true tablist/tab/tabpanel contract with Arrow/Home/End activation, polite live feedback, focus-visible controls, reduced-motion suppression, increased-contrast rules, forced-colors adaptation, and corrected accent/faint-text contrast.
- No update, accessibility, signing configuration, preference, shortcut, theme, package, or organization capability depends on an account, subscription, plan, seat, entitlement, or telemetry service.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused updater/release/accessibility regressions | Pass — updater client/provider helpers, native channel/policy behavior, manifest generation, release-config generation, artifact manifests, preference tabs, and static accessibility contracts pass inside the complete suites |
| TypeScript | Pass — `tsc -b --pretty false` completed without diagnostics from the exact-source validation mirror |
| Full frontend suite | Pass outside the localhost sandbox — 115 files/756 tests passed; 2 files/4 explicit live public-service tests were skipped |
| Production and CLI build | Pass — Vite transformed 1,555 modules; the generated 23,699,228-byte CLI has SHA-256 `c2c82b7a99f1a0d4c38f0962265f01aac64b96755dbaee802d22cf458af60b14` |
| Packaged CLI smokes | Pass outside the localhost sandbox — template/script file grants, authoritative physical store, complete Runner/config/plugin/transport/report matrix, and the pinned non-root/no-network/read-only container contract passed |
| Native aggregate suite | Pass outside the localhost sandbox — 200 tests passed and 4 explicit public/model fixtures were ignored; cancellation timing now reports the contract-required nonzero elapsed millisecond deterministically |
| Mock-server suite | Pass outside the localhost sandbox — 24 tests passed, including the real bind/serve/stop lifecycle |
| Native formatting, compile, and lint | Pass — both Rust manifests pass formatting; the desktop crate passes all-feature check and strict all-target/all-feature Clippy; the mock crate passes strict all-target Clippy |
| Production dependency audit | Pass — `npm audit --omit=dev` reported 0 vulnerabilities. `cargo-audit` is not installed, so no Cargo advisory audit is claimed |
| Workflow and manifest audit | Pass — Actionlint 1.7.12 accepts the workflow; release/updater generators reject malformed versions, missing signatures, and incomplete platform sets; the trusted path requires credentials instead of falling back to unsigned release artifacts |
| Local Tauri bundle | Pass — an unsigned release build against the independently validated renderer produced `Brunomnia.app` and a 15,813,713-byte updater archive with SHA-256 `ea7bb73ef66c7051da0038b4e5e7d3461c6b92d144b56565b270d9a27ef5da1b`; `Info.plist` records version `0.1.0` and minimum macOS `10.15` |

## Rendered QA

The production preview loaded at `http://127.0.0.1:4173/` in the Codex in-app browser at 1280×720. The seeded workbench rendered with a first-focus skip link, banner/main/footer semantics, no framework overlay, and no console warnings or errors.

General Preferences displayed one **Desktop updates** region and the browser-appropriate packaged-build status. The preference tabs exposed selected state and controlled panels. Right Arrow moved General to Keyboard, selected Keyboard, and displayed its panel; Home/End and reverse navigation are covered by the same bounded handler and focused regression. Default, increased-contrast, forced-color, and reduced-motion contracts are source/regression audited; this record does not claim a physical VoiceOver, NVDA, or JAWS session.

## Remote gate

The complete source commit `7500ff48043b8d3a90c8d38f1abc4dba5f5104ba` passed all three jobs in [Desktop bundles workflow 29893279935](https://github.com/sherwoodlee/Brunomnia/actions/runs/29893279935): macOS ARM64 in 7m45s, Linux x64 in 12m45s, and Windows x64 in 16m53s. Every job built the production renderer and native app, created the platform manifest/checksums, attached direct GitHub build provenance, and uploaded the installer set. The tag-only trusted-build and release jobs correctly remained skipped for the `main` push.

The retained artifacts are `brunomnia-macos-arm64` ID `8519130261` (15,326,484 uploaded bytes), `brunomnia-linux-x64` ID `8519217887` (126,956,862 bytes), and `brunomnia-windows-x64` ID `8519288520` (25,816,001 bytes); none was expired when recorded.

The generated-bundle commit `3d542ffa4e100702662829be56437d48dc66d418` passed both verify and publish jobs in [CLI container workflow 29893528774](https://github.com/sherwoodlee/Brunomnia/actions/runs/29893528774). Verify rebuilt the checked-in bundle without a diff and passed the pinned non-root, no-network, read-only, local-reference lint, standalone-suite, config, and plugin-tag container matrix; publish completed the multi-architecture SBOM/provenance and keyless-signing path.

The first remote attempt exposed that five already-tested v52 propagation files had been omitted by the inherited stale Git index; the corrected source commit fixed that selection. The next CLI run then correctly rejected its stale generated bundle; the final bundle-only commit rebuilt it. These failures were repository-handoff defects caught by the required remote gates, not waived. Only the updater signing secrets are configured remotely; Apple/DigiCert identities are not, so no credential-backed tag was created and no notarized or Authenticode artifact is claimed.

## Acceptance boundary

Milestone 280 closes the pinned preference, shortcut, theme, accessibility, update, and packaging contract. Trusted tagged artifacts remain impossible without user-supplied Apple and DigiCert identities; local/main unsigned artifacts are never described as trusted releases. Browser development cannot install updates, Linux package replacement remains explicit, and no unperformed physical screen-reader session is claimed. Every capability row in [the parity ledger](PARITY.md) is now `Complete` against the pinned behavior references, so Brunomnia may be described as feature-complete within the documented clean-room compatibility and platform bounds.
