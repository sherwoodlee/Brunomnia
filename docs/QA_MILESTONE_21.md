# Milestone 21 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: transient collection-run request selection and order, drag and accessible keyboard-button reordering, retry-aware bail semantics, distinct bailed report state, and CLI `--bail` compatibility.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 24 files, 124 tests |
| Vite production build | Pass — 153 modules; 466.79 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 472,682-byte CommonJS executable |
| CLI bail/failure smoke | Pass — a five-iteration run stopped after one exhausted failure, emitted `bailed: true`, and retained exit code 1 |
| CLI trusted-success smoke | Pass — one request and four script assertions completed with bail enabled, `bailed: false`, and exit code 0 |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 20 tests passed; the unchanged loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build/execution, and native packaging used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed that independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The native source did not change in this milestone. As in Milestones 16–20, the sandbox result is 20/21: only the unchanged integration that opens a loopback listener was denied. No 21/21 claim is made.

## Focused coverage

- The shared runner accepts an explicit ordered request-ID plan. Unknown IDs are ignored and duplicates execute once, preventing caller-controlled repetition outside the iteration/retry limits.
- Runner tests prove a selected third/first plan executes in exactly that order and omits the unselected second request.
- Bail waits until the current request exhausts its configured retries, then skips all later requests and iterations. A separate recovery test proves a successful retry continues the plan and does not mark the report bailed.
- `bailed` and `cancelled` remain distinct report fields, and every text reporter names a bailed run in its summary.
- The desktop plan synchronizes with collection membership, defaults new requests to enabled, removes deleted requests, and exposes inclusion checkboxes, native drag/drop, and labeled up/down buttons.
- The CLI passes `--bail` to the same engine. A final bundle smoke proves five configured iterations produce exactly one failed result and `bailed: true` under the flag.

## Contract reconciliation

The desktop behavior was reconciled on 2026-07-17 against Kong's official [collection runner guide](https://developer.konghq.com/how-to/use-the-collection-runner/), which documents selecting and ordering requests before a run. The CLI behavior was reconciled against the official [`run test` reference](https://developer.konghq.com/inso-cli/reference/run_test/), which documents `--bail` as aborting after the first failure. Brunomnia waits for configured retries before treating that failure as exhausted.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The new controls are typechecked and include explicit checkbox/button labels, but visual drag feedback, keyboard focus order, and assistive-technology behavior are not claimed as manually validated.

## Acceptance boundary

This evidence accepts a selectable/reorderable transient run-plan and retry-aware bail baseline, not full Insomnia parity. Named saved plans, per-request iteration counts, response-body report export, test-name filtering, all protocol runner semantics, remaining Inso commands/flags, and the other gaps in [PARITY.md](PARITY.md) remain open.
