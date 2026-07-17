# Milestone 17 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: one shared clean-room `require('chai').assert` compatibility surface for the disposable desktop Worker and explicitly trusted CLI, covering the major public assertion families while retaining honest bounds around chainable BDD behavior and npm-package equivalence.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript project build | Pass |
| Vitest | Pass — 22 files, 108 tests |
| Vite production build | Pass — 151 modules; 461.42 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 453,789-byte CommonJS executable |
| CLI script safe-default smoke | Pass — the scripted fixture was refused without `--allow-scripts` |
| CLI file safe-default smoke | Pass — trusted scripts were refused without `--allow-script-files` |
| CLI shared-assertion smoke | Pass — 1 request, HTTP 200, 4 assertions including shared deep nested-property and key behavior |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 20 tests passed; the loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Batched changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build, CLI execution, and native packaging used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed that independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The native source did not change in this milestone. As in Milestone 16, the sandbox result is 20/21: only the unchanged integration that opens a loopback listener was denied. No 21/21 claim is made.

## Focused coverage

- The direct module test inventories every public method name in the current official `assert` reference and checks representative type, ordinary/nested/own/deep inclusion, nested/deep property, key, deep/ordered member, numeric/operator, property/getter mutation, throw, prototype-response, predicate, frozen, empty, and custom-error-message behavior.
- The serialized Worker test executes `deepNestedPropertyVal` and `sameDeepMembers`, proving that the self-contained factory remains valid after source serialization and does not drift from direct execution.
- Desktop and trusted CLI runtimes already inject that same factory. The offline CLI fixture now exercises shared `deepNestedPropertyVal` and `containsAllKeys` calls without changing its four-test collection contract.
- Unknown module names remain denied; the assertion expansion adds no filesystem, network, package-loading, or host-object authority.

## Contract reconciliation

The scope was reconciled on 2026-07-17 against the official Kong [scripts reference](https://developer.konghq.com/insomnia/scripts/), which describes the full range of Chai `assert` assertions, and the official Chai [`assert` API](https://www.chaijs.com/api/assert/) and [`expect`/BDD API](https://www.chaijs.com/api/bdd/). Brunomnia implements a broad public `assert` family baseline through a clean-room bounded adapter; it does not embed or copy the Chai package.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The final renderer compiled and the macOS `.app` bundled successfully, but visual, keyboard, and assistive-technology validation are not claimed. This phase introduces no new visible UI.

## Acceptance boundary

This evidence accepts Milestone 17's shared Chai `assert` baseline, not full Insomnia parity or exact Chai package equivalence. The finite chainable `expect` adapter, plugins, `should`, custom assertion extension hooks, exotic/cyclic deep comparison, complete overload/error metadata behavior, other bounded npm-module adapters, and the non-scripting gaps named in [PARITY.md](PARITY.md) remain open.
