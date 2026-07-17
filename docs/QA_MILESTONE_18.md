# Milestone 18 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: replace duplicated desktop/CLI expectation implementations with one serializable clean-room chain factory; resolve the current Chai BDD chain, assertion, and alias name surface; preserve the existing Postman/Jest-style aliases; and exercise identical direct, Worker, and CLI behavior.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript project build | Pass |
| Vitest | Pass — 23 files, 113 tests |
| Vite production build | Pass — 152 modules; 465.75 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 462,574-byte CommonJS executable |
| CLI script safe-default smoke | Pass — the scripted fixture was refused without `--allow-scripts` |
| CLI file safe-default smoke | Pass — trusted scripts were refused without `--allow-script-files` |
| CLI shared-chain smoke | Pass — 1 request, HTTP 200, 4 tests including deep nested inclusion and ordered members |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 20 tests passed; the loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Batched changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build, CLI execution, and native packaging used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed that independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The native source did not change in this milestone. As in Milestones 16 and 17, the sandbox result is 20/21: only the unchanged integration that opens a loopback listener was denied. No 21/21 claim is made.

## Focused coverage

- The direct test inventories all current language chains, state modifiers, assertion methods, documented aliases, and retained Postman/Jest-style aliases.
- Representative tests cover truth/value/type/object-state getters, custom messages, negation, deep nested and own inclusion, exact/subset/any/deep keys, property target chaining, numeric/date comparisons, approximate values, length-as-method and length-as-chain behavior, regular expressions, ordered/deep members, predicates, errors, prototype responses, property/getter mutation deltas, and static failure.
- `buildScriptWorkerSource` serializes the same factory and executes deep nested inclusion, ordered member subsets, and chained length comparisons in the disposable Worker.
- The CLI imports the factory directly. Its offline fixture executes the same deep nested and ordered chains while preserving the existing script/file safe-default checks.
- The change removes two finite implementations instead of introducing a third assertion path; `require('chai').expect`, global `expect`, and `insomnia.expect` now share one runtime per execution environment.

## Contract reconciliation

The scope was reconciled on 2026-07-17 against the official Kong [scripts reference](https://developer.konghq.com/insomnia/scripts/) and official Chai [`expect`/BDD API](https://www.chaijs.com/api/bdd/). The current documented public name and alias surface resolves, but Brunomnia remains an original bounded implementation rather than an embedded copy of Chai.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. This phase introduces no visible UI. The final renderer compiled and the macOS `.app` bundled successfully, but visual, keyboard, and assistive-technology validation are not claimed.

## Acceptance boundary

This evidence accepts Milestone 18's shared chainable `expect` baseline, not full Insomnia parity or exact Chai internals. Chai plugins, `should`, assertion extension/overwrite hooks, exact error metadata, exotic/non-enumerable/symbol/cyclic deep identity, every overloaded and negated-mutation nuance, other bounded package adapters, and the non-scripting gaps named in [PARITY.md](PARITY.md) remain open.
