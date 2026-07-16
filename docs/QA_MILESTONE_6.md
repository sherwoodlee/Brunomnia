# Milestone 6 verification

Verified on 2026-07-16 on macOS against the Phase 6 Git Sync and local-extensibility implementation.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript project check | Pass |
| Vitest single-worker suite | Pass — 12 files, 51 tests |
| Vite production bundle | Pass — 137 modules transformed |
| Bundled CLI build | Pass — 294.8 KB CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo test` | Pass — 15 native tests, including loopback integration outside the filesystem/network sandbox |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Tauri debug app bundle | Pass — `src-tauri/target/debug/bundle/macos/Brunomnia.app` |

The final TypeScript, Vite, and Vitest gates used the bundled Node.js 24.14 runtime directly because the local shell's Node.js 26 process intermittently slept during tool startup. This changes only the executable used to run the same checked-in packages, not their configuration or coverage. The full Vitest run exited normally in 30.45 seconds.

The complete 15-test Rust suite passed before the final atomic-write hardening. After that patch, all four project tests and the local-package test were rerun, then all targets compiled under Clippy with warnings denied. The loopback test requires execution outside the filesystem/network sandbox; the focused post-hardening tests do not bind a port.

## Focused evidence

- Native tests prove split-YAML round trips leave unmanaged files untouched, reject a managed-directory symlink escape, parse initial/dotted branches, load a local CommonJS package entry, and retain base/ours/theirs during a real Git conflict before staging a resolution.
- Workspace tests prove versions 1–5 migrate to v6 and imported plugins lose enabled state, stored data, active themes, and every inherited grant.
- Plugin tests parse the generated strict-mode Worker source and reject static/dynamic imports plus ESM exports.
- Clippy covers the complete Tauri command surface with warnings denied.

## Rendered QA

Production preview: `http://127.0.0.1:4173/` in the Codex in-app browser.

1. Opened Plugins and loaded the built-in starter source.
2. Installed it and verified the initial state was disabled with zero grants while one tag and one action were discovered.
3. Granted only enabled, request read/write, store, template, and action capabilities.
4. Ran **Store request name** and observed its plugin-local write, alert notification, and completion message.
5. Sent the HTTP **List Orders** request with the request hook active and received the expected 200 response and passing after-response test.
6. Opened Git Sync in the production browser build and verified the explicit native-only filesystem/Git explanation.
7. Checked browser warning/error logs after these interactions; none were present.

## Deliberate bounds

- Git credentials use the installed Git/SSH configuration; provider-specific authentication and repository onboarding are not claimed.
- Commit history UI, rebase/cherry-pick, automatic project discovery, and cross-device collaboration remain open.
- Plugins must be dependency-free or pre-bundled CommonJS; arbitrary npm packages, native modules, remote installation, file watching, and full ecosystem compatibility are not claimed.
- Plugin request/response integration covers HTTP, GraphQL, gRPC, and non-streaming collection runs. Streaming-specific hooks and the complete Insomnia context/hook/template-argument surface remain tracked in [PARITY.md](PARITY.md).
