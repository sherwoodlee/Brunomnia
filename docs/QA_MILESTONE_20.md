# Milestone 20 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: deterministic collection-runner report artifacts, desktop JSON/JUnit downloads, the current documented Inso `run test` reporter-name inventory, CLI file/stdout output, CI exit-code preservation, and strict TypeScript release-gate repair.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 24 files, 121 tests |
| Vite production build | Pass — 153 modules; 466.79 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 472,199-byte CommonJS executable |
| CLI script safe-default smoke | Pass — the scripted fixture was refused without `--allow-scripts` and retained exit code 1 under the default `spec` reporter |
| CLI file safe-default smoke | Pass — trusted scripts were refused without `--allow-script-files` and retained exit code 1 |
| CLI TAP smoke | Pass — one request and four script assertions produced valid numbered TAP with exit code 0 |
| CLI JUnit file smoke | Pass — `--output` wrote a 1-test artifact and `xmllint --noout` accepted it |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 20 tests passed; the unchanged loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build/execution, and native packaging used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed that independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The native source did not change in this milestone. As in Milestones 16–19, the sandbox result is 20/21: only the unchanged integration that opens a loopback listener was denied. No 21/21 claim is made.

## Focused coverage

- A single side-effect-free formatter supplies desktop downloads and CLI stdout/file output for `dot`, `list`, `min`, `progress`, `spec`, TAP, versioned JSON, and JUnit.
- JSON preserves the complete bounded saved report inside a versioned envelope. JUnit emits one testcase per attempt so retries are not collapsed.
- HTTP/script assertion failures and runner/transport errors remain distinguishable in JUnit `failure` and `error` elements, with timestamps, duration, cancellation, and aggregate counts retained where the format permits.
- XML metacharacters, attribute newlines, and XML-invalid control characters are encoded or replaced. TAP failure diagnostics are single-line and numbered.
- Focused tests inventory every accepted reporter, exercise exact filenames and MIME types, distinguish failures from errors, and cover human-readable summaries plus unknown-reporter rejection.
- Desktop buttons download the latest device-local report for the selected collection. CLI `--reporter`/`-r` and `--output`/`-o` do not alter the existing non-zero failure exit contract.
- A clean strict typecheck repaired one missing selected-environment guard, an arguments fixture signature, two package-adapter typing issues, and multipart union inference exposed by the non-incremental gate.

## Contract reconciliation

The CLI surface was reconciled on 2026-07-17 against the official Kong [`run test` reference](https://developer.konghq.com/inso-cli/reference/run_test/), which lists `dot`, `list`, `min`, `progress`, `spec`, and `tap` reporter names. Brunomnia accepts all six names. JSON and JUnit are explicitly documented Brunomnia CI formats rather than claimed upstream Inso formats.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The download controls are typechecked and use the same local Blob/anchor mechanism as the existing artifact export, but visual, keyboard, and assistive-technology validation are not claimed.

## Acceptance boundary

This evidence accepts a compatible reporter-name and portable-artifact baseline, not byte-identical Mocha cosmetics or full Insomnia parity. Request selection/drag ordering, response bodies in reports, `--bail`, test-name filtering, every Inso command/configuration flag, all protocol semantics, stronger portable script isolation, signed containers/installers, and the remaining gaps in [PARITY.md](PARITY.md) remain open.
