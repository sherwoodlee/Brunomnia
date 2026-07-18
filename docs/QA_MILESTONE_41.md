# Milestone 41 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: extend the off-by-default device-local password-visibility preference and accessible per-field inspection controls to stored MCP, AI-provider, and Konnect credentials without changing their storage, resolution, execution, or policy boundaries.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [settings model](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) defaults `showPasswords` false; the [General settings UI](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) exposes Reveal passwords; and the [masked-setting component](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/masked-setting.tsx) combines that global choice with temporary field-level disclosure for secret settings.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 31 files, 188 tests |
| Vite production build | Pass — 158 modules; 498.69 KB / 498,687-byte main JavaScript chunk; 30,813-byte lazy integration chunk; no chunk-size warning |
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

- MCP bearer tokens and Basic passwords, AI-provider keys or protected references, and Konnect token references now use the same default-mask/global-reveal decision as request authentication secrets.
- With the global preference off, each integration credential presents an aria-labelled Show/Hide button for temporary inspection.
- Enabling the global choice clears redundant field-level disclosure, so turning it off masks the field immediately.
- The keyed MCP configuration subtree remounts when the active client changes, preventing temporary reveal state from carrying to a different client.
- Focused pure tests cover default masking, global reveal, and one-field reveal.
- Existing governance edit restrictions still disable credential editing and disclosure controls for viewers.
- The preference changes presentation only. Protected-reference validation, plaintext-secret detection, vault resolution, request execution, project publication filtering, imports, exports, and logs are unchanged.
- Local-vault value disclosure plus vault and encrypted-sync passphrases retain their independent controls.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Button focus order, password-manager interaction, and visual fit at responsive breakpoints are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

This baseline covers the stored integration credentials with defined secret semantics: MCP bearer/Basic, AI-provider, and Konnect credential fields. Arbitrary MCP headers, ordinary request headers/environment values, and non-secret integration inputs are not reclassified. Brunomnia does not claim current Insomnia's exact randomized mask, copy-button presentation, or CodeMirror behavior.
