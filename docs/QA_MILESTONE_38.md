# Milestone 38 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: separate device-local interface and editor font families/sizes with current-compatible bounds, defaults, live CSS application, and legacy-safe migration.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [settings defaults](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) use a 13 px interface size, 11 px editor size, and empty custom family values; the [general settings UI](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) exposes independent interface/text-editor family and size controls; the [font constants](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/common/constants.ts) bound both sizes to 8–24 px; and the [settings side effects](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/hooks/use-settings-side-effects.ts) apply interface and monospace families separately.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 29 files, 182 tests |
| Vite production build | Pass — 158 modules; 497.82 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 520,070-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 24 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Every verification and packaging gate uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- New devices and imported workspaces use 13 px interface and 11 px editor defaults with both custom family lists empty.
- Existing Brunomnia `fontSize` remains the editor size, avoiding an upgrade-time visual reinterpretation; v20 adds the independent interface default.
- Both size controls clamp to current-compatible 8–24 px bounds and preserve explicit supported values.
- Interface and monospace family lists are independent, capped at 512 characters, flatten CR/LF to spaces, and normalize non-string values empty.
- Nonblank family lists override inherited CSS variables at the app shell; clearing a field restores the built-in sans-serif or monospace stack.
- The interface size applies at the app shell while the editor size continues to drive code surfaces independently.
- Managed projects and encrypted-sync pulls preserve the device values, workspace imports reset them, and workspace v20/interchange round trips agree on the schema.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Font loading, fallback resolution, and dense-control scaling are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

Custom family fields depend on fonts installed on the device and provide no discovery picker. The app-shell size affects inherited interface typography, while many dense controls intentionally retain fixed pixel sizes; a complete typographic scaling/accessibility audit remains open in [PARITY.md](PARITY.md).
