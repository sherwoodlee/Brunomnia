# Milestone 14 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: distinct global-base/selected-global and collection-base/selected-collection stores, seven-level script lookup, mutation persistence, runner/CLI propagation, collection-environment editing, corrected interchange mapping, and workspace v13 migration.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript project build | Pass |
| Vitest | Pass — 21 files, 99 tests |
| Vite production build | Pass — 149 modules; 417.64 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 337.2 KB CommonJS executable |
| CLI safe-default smoke | Pass — scripted fixture refused without `--allow-scripts` and selected the workspace's active global sub-environment |
| CLI trusted scope smoke | Pass — 1 request, HTTP 200, 2 assertions; base/selected global and collection writes remained distinct |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 19 tests passed; the loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — final production renderer, executable, and `Brunomnia.app` built |
| Batched changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, and CLI execution used the established disposable `/tmp` source mirror and dependency tree. The verified `dist` output was copied back before the Tauri bundle, with only the independently verified `beforeBuildCommand` disabled.

The native code did not change. The native suite repeated the same sandbox-only result as Milestones 12 and 13: 19 tests passed and only the integration that opens a loopback listener was denied. A permission escalation was not retried because the platform previously rejected that normal retry for its account/tool usage ceiling. No 20/20 claim is made.

## Focused coverage

- Resource tests prove root global and selected global values are independent, collection base and selected collection values are independent, disabled rows remain masks, and the selected collection environment participates in ordinary request configuration.
- The Node VM harness executes the actual generated Worker source and proves the documented base-global → selected-global → collection-base → selected-collection → root-to-leaf folder → iteration → local lookup order. It also proves base/selected mutations land in different outputs, setting a disabled selected-global name removes its mask, and selected APIs alias base stores only when no sub-environment is active.
- Direct-send persistence writes base and selected global/collection values back to their owning rows, retains folder state, and passes post-pre-request values and masks into after-response scripts and mediated secondary requests.
- Runner and trusted CLI paths carry the same four environment stores across requests and iterations. The checked-in offline CLI fixture selects a global sub-environment plus a collection sub-environment and asserts writes through all four public APIs.
- Storage tests prove versions 1–12 migrate to workspace v13, collection sub-environment rows are bounded and normalized, and stale active sub-environment IDs are cleared.
- Interchange tests prove Postman collection variables map to collection base, Insomnia v4/v5 collection base/sub-environments round-trip, v5 standalone global environments remain distinct, and collision-safe import rekeying covers the added resource IDs.
- Secret-policy scanning includes collection sub-environment rows, while existing private-global publication filtering and generic split-YAML collection serialization continue to apply.

## Contract mapping

The implementation follows the environment priority and public aliases reconciled against the current official Kong [scripts](https://developer.konghq.com/insomnia/scripts/) and [environments](https://developer.konghq.com/insomnia/environments/) documentation in Milestone 13:

1. `insomnia.baseGlobals` / `variables.baseGlobalVars`
2. `insomnia.globals` / `variables.globalVars`
3. `insomnia.baseEnvironment`, `CollectionVariables`, lowercase `collectionVariables`, and `variables.collectionVars`
4. `insomnia.environment` / `variables.environmentVars`
5. nearest parent folder
6. iteration data
7. request-local variables

Generic lookup resolves in the reverse order, from request-local down to global base. API aliasing occurs only when no selected global or collection sub-environment exists.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The final renderer compiled and the macOS `.app` bundled successfully, but visual, keyboard, and assistive-technology validation are not claimed.

## Acceptance boundary

This evidence accepts Milestone 14's distinct-environment-store baseline, not full Insomnia parity. Global sub-environment chains deeper than one level are exposed as one effective selected-global script store, and inherited disabled masks in that effective store can be persisted on the selected environment after mutation. Remaining gaps include the full bundled library/Node/Chai/Lodash surface, file-backed script helpers, external-vault script access, deprecated Postman interfaces, and stronger portable CLI isolation, alongside the non-scripting gaps named in [PARITY.md](PARITY.md).
