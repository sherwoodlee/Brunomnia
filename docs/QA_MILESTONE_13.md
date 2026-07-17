# Milestone 13 verification record

Date: 2026-07-16 (America/Los_Angeles)

Scope: exact current script scope/helper reconciliation, ordered async assertions, secondary-request cookie/response continuity, scope-aware Postman translation, runner scope separation, and trusted CLI assertion parity.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript project build | Pass |
| Vitest | Pass — 21 files, 95 tests |
| Vite production build | Pass — 149 modules; 409.99 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 330.0 KB CommonJS executable |
| CLI safe-default smoke | Pass — scripted fixture refused without `--allow-scripts` |
| CLI trusted async-script smoke | Pass — 1 request, HTTP 200, 2 ordered assertions |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 19 tests passed; the loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — final production renderer, executable, and `Brunomnia.app` built |
| Batched staged-path whitespace checks | Pass |

TypeScript, Vitest, Vite, and CLI execution used the same disposable `/tmp` source mirror and clean dependency tree described in Milestone 12. The final `dist` output was copied back before the Tauri bundle, with only the independently verified `beforeBuildCommand` disabled.

The native code did not change. The native suite repeated the same sandbox-only result as Milestone 12: 19 tests passed and only the integration that opens a loopback listener was denied. A second permission escalation was not attempted because the platform had already rejected the normal retry for its current account/tool usage ceiling. No 20/20 claim is made.

## Focused coverage

- A Node VM harness executes the actual generated Worker source with realistic request, response, scope, folder, and permission state. It proves global/collection/local writes, generic iteration lookup, nearest-folder mutation, query-string repetition, keyed-array Basic auth, ordered async tests, and documented Chai chains.
- Secondary-state tests prove `Set-Cookie` parsing and stored-response metadata are available for later script requests and request chaining.
- Runner tests prove global/collection/folder/iteration/local rendering stays separated and disabled collection rows mask lower global values.
- Postman import tests prove globals, collection variables, local/iteration variables, secondary requests, tests, and expectations translate to the matching Insomnia API rather than one collapsed scope.
- The checked-in CLI fixture now uses an awaited assertion plus chain-returning Chai type/key assertions; the explicit trusted run preserves declaration order and passes both tests.
- Full frontend, native compile/lint, and app-bundle gates show no regression in earlier protocol, transport, project, security, integration, hierarchy, or request-authoring work.

## Current-doc reconciliation

This phase re-read the current official Kong documentation for [scripts](https://developer.konghq.com/insomnia/scripts/) and [environments](https://developer.konghq.com/insomnia/environments/). The implementation and ledger now reflect query-string `addQueryParams`, keyed auth arrays plus the second type argument, name/ID parent-folder lookup, global/collection/folder/iteration/local aliases and priority, vault opt-in behavior, bare-hostname secondary requests, response `code`, and the documented Chai examples.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The final renderer compiled and the macOS `.app` bundled successfully, but visual and assistive-technology validation are not claimed.

## Acceptance boundary

This evidence accepts Milestone 13's contract-fidelity baseline, not full Insomnia parity. Distinct global-base/selected-global and collection-base/selected-collection stores, the remaining bundled libraries/Node modules, file-backed script bodies/certificates, complete Chai/Lodash behavior, external-vault script access, deprecated Postman interfaces, and stronger portable CLI isolation remain explicit gaps in [SCRIPTING.md](SCRIPTING.md) and [PARITY.md](PARITY.md).
