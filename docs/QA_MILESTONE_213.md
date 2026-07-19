# Milestone 213 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align collection-run reporter fallback with pinned Inso's shared readable `spec` default while retaining every explicit reporter and M212's separate result-file behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` declares one `defaultReporter: TestReporter = 'spec'` and supplies it to both `run test` and `run collection` `--reporter` options.
- Brunomnia previously defaulted suite runs to `spec` but collection runs to its JSON extension. M213 removes that local difference; JSON and JUnit remain available only when requested explicitly.

## Automated gates

| Gate | Result |
| --- | --- |
| Full Vitest suite | Passed: 77 files, 565 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 6,445,848-byte CLI |
| Bundled CLI startup/help | Passed: complete reporter inventory and collection/test contracts present |
| Bundled Runner reporter smoke | Passed: omitted collection reporter emitted `spec` identity/attempt output while redacted JSON wrote independently; explicit JSON/JUnit flows remained valid |
| Bundled localhost CLI file-boundary smoke | Passed |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Passed |

## Focused coverage

- The CLI now calls the shared reporter parser with `spec` fallback for either run subject rather than branching collection runs to JSON.
- A packaged collection invocation omits `--reporter`, writes an explicitly accepted redacted result file, and emits the expected `Preview collection` plus successful `Mutual TLS (iteration 1, attempt 1)` spec output on stdout.
- Explicit collection `--reporter junit` still emits XML while a metadata-safe JSON result file is written; every existing explicit `--reporter json` automation assertion continues to parse its complete Brunomnia envelope.
- Reporter choice does not change safe/full result-file schema, exit status, request execution, output-path validation, or risk acceptance.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 213 closes the named pinned default-reporter gap. Brunomnia's reporter text preserves compatible roles and evidence but does not claim byte-identical Mocha cosmetics. Interactive prompts, executable JS/TS configs, plugin tags, desktop local-vault access, remaining Inso commands/flags, uncommon report/proxy/TLS edge semantics, process-level JavaScript isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 214.
