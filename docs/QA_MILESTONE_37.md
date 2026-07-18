# Milestone 37 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: device-local request/response layout, editor wrapping, indentation, and font-ligature preferences with live application and safe migration.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [settings defaults](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) define responsive layout, wrapping on, tabs on, indent size 2, and ligatures off; the [general settings UI](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) exposes those controls; the [request route](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.tsx) forces vertical layout or follows its responsive breakpoint; the [CodeMirror adapter](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/.client/codemirror/code-editor.tsx) applies wrapping, tabs/spaces, and indent size; and the [settings side effects](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/hooks/use-settings-side-effects.ts) apply ligatures globally.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 29 files, 182 tests |
| Vite production build | Pass — 158 modules; 497.30 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 519,691-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 24 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Every verification and packaging gate uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- New devices, legacy workspaces, and imports normalize to responsive layout, line wrapping on, tabs on, indent size 2, and ligatures off.
- Forced vertical mode stacks request above response independent of width; normal mode retains Brunomnia's existing responsive layout.
- Code surfaces switch between wrapped and horizontally scrollable content, use the configured CSS tab width, and inherit the ligature setting.
- Tab inserts a literal tab or configured spaces at the caret; any selection indents every selected line without replacing its content.
- Shift-Tab removes one tab or up to the configured number of leading spaces from current/selected lines without consuming non-indentation text.
- Indent width clamps to 1–16, malformed booleans cannot opt in, explicit supported values survive migration, and imports restore device-safe defaults.
- Workspace v19, project serialization, replacement/merge imports, and Brunomnia export/import round trips agree on the new schema version.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Layout and CSS preference application are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

Brunomnia's automatic vertical breakpoint remains 1,000 px instead of current Insomnia's 880 px, while forced vertical behavior is equivalent. The bounded textarea editor does not claim CodeMirror key maps, autocompletion, linting, folding, bracket helpers, or template-token presentation. Custom interface and monospace font families remain open in [PARITY.md](PARITY.md).
