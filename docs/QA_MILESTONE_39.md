# Milestone 39 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: device-local allowed data folders for desktop script attachments, enforced through canonical native containment and safe workspace migration/import behavior.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [settings model](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) defaults `dataFolders` empty; the [General settings UI](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) exposes the folder list under Security; and the [main-process secure reader](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/secure-read-file.ts) checks script/plugin/environment paths against secured roots. Brunomnia deliberately strengthens ordinary containment with canonical component-aware `Path` checks while keeping its narrower read-only attachment scope explicit.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 29 files, 182 tests |
| Vite production build | Pass — 158 modules; 498.07 KB / 498,068-byte main JavaScript chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 520,305-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 26 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Every verification and packaging gate uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 27-test native suite: only the existing mock-server integration that opens a loopback listener is denied. The three script-file tests all pass. No rendered-browser claim is made.

## Focused coverage

- New devices and imported workspaces start with no allowed roots and the separate script file authority off.
- Migration trims roots, removes blanks and duplicates, caps the list at 100 values and each value at 4,096 characters, and rejects non-string entries.
- Workspace imports reset both roots and script authority; managed projects and encrypted revisions continue to omit device-local preferences.
- Every desktop primary, secondary, and collection-run script attachment read passes the current roots into the Tauri command.
- Native reads require at least one existing directory root, canonicalize the source and roots, and use component-aware containment before inspecting or reading file bytes.
- Native tests prove allowed bounded reads, the 5 MB limit, empty-root refusal, outside-root refusal, and rejection of a symlink inside an allowed folder that resolves outside it.
- Workspace v21 and Brunomnia interchange round trips agree on the schema; the trusted CLI keeps its independent explicit file flag.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The path textarea, blur normalization, disabled browser state, and explanatory copy are compile- and source-verified only in this phase.

## Acceptance boundary

Brunomnia exposes typed absolute roots rather than a native folder picker. The grant is read-only and limited to mediated script body, multipart, and PEM attachment hydration; upstream-described folder writes and automatic temporary/application-data roots are not claimed. The trusted CLI does not consume the desktop list. Canonical checks reject ordinary traversal and symlink escapes but do not claim a capability-secure directory handle against adversarial filesystem races.
