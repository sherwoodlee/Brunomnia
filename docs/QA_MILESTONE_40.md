# Milestone 40 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: an off-by-default device-local password-visibility preference for request and inherited-folder authentication editors, plus accessible per-field reveal controls and safe workspace migration/import behavior.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [settings model](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) defaults `showPasswords` false; the [General settings UI](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) exposes Reveal passwords; the [authentication input](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/editors/auth/components/auth-input-row.tsx) combines the global choice with a field-level mask toggle; and the [password viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/password-viewer.tsx) keeps disclosure as presentation state.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 30 files, 185 tests |
| Vite production build | Pass — 158 modules; 498.69 KB / 498,687-byte main JavaScript chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 520,380-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 26 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled and reuses the generated Cargo target directory to avoid a second multi-gigabyte dependency build.

The sandbox result remains one test short of the full 27-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No native behavior changed in this phase. No rendered-browser claim is made.

## Focused coverage

- New devices and imported workspaces keep authentication secrets masked because `showPasswords` defaults false and imports reset device preferences.
- Migration enables the preference only for literal `true`; truthy strings and other malformed values remain false.
- Explicit valid device choices survive workspace v22 migration and Brunomnia interchange versioning.
- Bearer, Basic, Digest, NTLM, API key, OAuth 1/2, AWS IAM, and Hawk secret inputs share one masking decision in both request and folder authentication editors.
- Pure visibility tests cover default masking, global reveal, per-field reveal, and non-secret text inputs.
- When the device preference is off, each secret input presents an aria-labelled Show/Hide button; switching requests remounts field disclosure state, and turning the global choice off resets local reveal state.
- The preference changes only input presentation. Local-vault disclosure and vault/sync passphrases retain independent controls and execution/storage/export behavior is unchanged.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Button focus order, password-manager interaction, and visual fit at responsive breakpoints are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

This baseline covers request and inherited-folder authentication fields. Integration credentials remain independently masked, and arbitrary headers/environment values are not reclassified as passwords. Brunomnia does not claim current Insomnia's exact CodeMirror masking, copy-button, or randomized viewer-mask behavior.
