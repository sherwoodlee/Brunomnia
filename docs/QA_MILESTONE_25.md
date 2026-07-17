# Milestone 25 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: Inso-compatible headless test-name regex flags, pre-execution validation, callback-level filtering, clean-unmatched omission, failure retention, and portable match evidence.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 24 files, 136 tests |
| Vite production build | Pass — 153 modules; 475.44 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 482,098-byte CommonJS executable |
| Offline CLI filtered-match smoke | Pass — one exact match, one retained result, and only the matching callback name in JSON |
| Offline CLI zero-match smoke | Pass — zero passed/failed/total and zero matched tests |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 20 tests passed; the unchanged loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build/smokes, native checks, and packaging used the established disposable `/tmp` source mirror and dependency tree. The two CLI smokes used the checked-in `examples/cli-workspace.json` with its offline `data:` request. Trusted scripts and the existing explicit local-file grant were enabled; no external network was used. The Tauri bundle consumed the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The native source did not change in this milestone. The sandbox result remains 20/21: only the unchanged integration that opens a loopback listener was denied. No 21/21 claim is made.

## Focused coverage

- The current documented `-t` and `--testNamePattern` spellings reach one shared runner option; `--test-name-pattern` is an additional alias.
- Invalid regex syntax and patterns over 1,000 characters are rejected before the request executor is called.
- The pattern reaches after-response execution but not pre-request execution.
- A disposable Worker skips an unmatched callback that would throw, while a matching callback executes and passes.
- Clean requests with no matched registrations execute for dynamic discovery but do not create report results or consume request/response evidence budgets.
- HTTP, transport, and script failures remain reportable even when the filter matches no test name.
- Reports retain the exact pattern and matched-test execution count, including an explicit zero-match result.
- The 1,000-registration bound counts matched and unmatched registrations so filtering cannot bypass the existing script-result safety cap.

## Manual/rendered QA

No rendered UI changed in this milestone. Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser.

## Acceptance boundary

This evidence accepts callback-level regex filtering for Brunomnia's request-centric after-response tests. Requests and top-level script statements still execute before dynamic test names are known. Standalone test-suite resources, suite/test identifiers, configuration-file option discovery, `--keepFile`, request/proxy/data-folder compatibility flags, and the remaining Inso command surface are not claimed. Other gaps remain in [PARITY.md](PARITY.md).
