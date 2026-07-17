# Milestone 12 verification record

Date: 2026-07-16 (America/Los_Angeles)

Scope: permission-bounded scripting compatibility, request/response mutation helpers, scoped/folder variables, opt-in mediated secondary requests, opt-in local-vault access, CLI trust flags, and workspace v12 migration.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript project build | Pass |
| Vitest | Pass — 21 files, 93 tests |
| Vite production build | Pass — 149 modules; 405.67 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 323.9 KB CommonJS executable |
| CLI safe-default smoke | Pass — a scripted fixture was refused without `--allow-scripts` and returned the documented actionable error |
| CLI trusted-script smoke | Pass — 1 request, HTTP 200, 2 assertions |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 19 tests passed; the loopback-only mock integration alone could not bind (`Operation not permitted`) |
| Loopback-capable `cargo test` retry | Not run — the platform rejected the normal permission escalation because the current account/tool usage limit was exhausted |
| macOS Tauri debug `.app` bundle | Pass — executable and `Brunomnia.app` built |
| `git diff --check` | Pass |

TypeScript, Vitest, Vite, and CLI execution used a disposable `/tmp` mirror of the same source and lockfile with the existing clean dependency tree. This avoids the synced Documents filesystem startup bottleneck. The production `dist` output was copied back for the native bundle, whose `beforeBuildCommand` was disabled only after the equivalent frontend and CLI gates passed independently.

The native code was unchanged in this milestone. Its complete suite has 20 tests; the sandbox failure is the same loopback-bind permission boundary exercised in prior milestones, but unlike those milestones the approved retry could not be obtained because the execution platform reported its usage ceiling. No 20/20 claim is made for this phase.

## Focused coverage

- Script tests prove Worker source syntax, request/test compatibility construction, dynamic-import and `eval` rejection, authority-shadowing scaffolding, secondary-request/vault gating text, HTTP/GraphQL normalization, repeated headers, timeout caps, scheme/method rejection, and file-body rejection.
- Runner tests prove collection and parent-folder variable state reaches pre-request scripts, request rendering, and after-response scripts in the correct order.
- Storage tests prove workspace v12 defaults, preference bounds, disabled network/vault grants, and authority stripping on workspace import.
- The CLI safe-default smoke proves a workspace cannot silently execute JavaScript. The trusted smoke proves the explicit grant preserves the existing local scripted fixture and both assertions.
- The full frontend and native compile/lint/app-bundle gates demonstrate no regression in prior protocol, transport, project, security, integration, GraphQL, hierarchy, or request-authoring phases.

## Security review notes

- Desktop scripts run in a disposable Worker and receive neither raw host callbacks nor raw host objects. Internal state, Worker messaging, result arrays, and counters are shadowed from user source.
- Direct network APIs, ambient Worker communication constructors, DOM/storage APIs, dynamic imports, `eval`, and function-constructor escape paths are denied or hardened.
- Secondary requests cross a typed bridge, require absolute HTTP(S), reject file-backed inputs, do not run nested scripts/plugins, and are capped by count, request-description size, response size, per-request timeout, and overall script deadline.
- Vault access is a separate off-by-default device-local grant. Vault state is not included in script results or persistence.
- Imported workspaces reset both grants; project and encrypted-sync reads preserve current local preferences rather than importing authority.
- Node `vm` is not represented as hostile-code isolation. CLI JavaScript requires `--allow-scripts`, and its mediated network path additionally requires `--allow-script-requests`.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited use of the in-app Browser. The production renderer compiled and the macOS `.app` bundled successfully, but this record does not claim visual or assistive-technology validation of the new preference controls.

## Acceptance boundary

This evidence accepts the Milestone 12 scripting baseline, not full Insomnia parity. Unbundled libraries, complete Node/module/Chai/Lodash behavior, advanced request mutation, separately persisted base-environment changes, async tests, secondary response-cookie persistence, external-vault script adapters, stronger portable CLI isolation, and broader Postman globals remain named gaps in [SCRIPTING.md](SCRIPTING.md) and [PARITY.md](PARITY.md).
