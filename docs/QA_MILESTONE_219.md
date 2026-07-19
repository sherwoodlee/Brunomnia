# Milestone 219 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: implement pinned Inso root `-v`/`--version` output with package fallback, release-wrapper `VERSION` override, and no workspace/config side effects.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` derives its version from `process.env.VERSION || packageJson.version` and registers `-v, --version` on the root Commander program.
- Commander handles the version option before command actions, so it prints one line and exits without database loading, prompts, request transport, configuration discovery, or analytics work.
- Brunomnia uses the same environment/package precedence and short-circuits before help or command dispatch. The bundled package currently reports `0.1.0`; release automation can provide an explicit version string without rebuilding source constants.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused option-parser regression | Passed: 1 file, 12 tests |
| Full Vitest suite | Passed: 77 files, 567 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 6,456,958-byte CLI |
| Direct bundled version checks | Passed: `--version` → `0.1.0`; `VERSION=9.8.7-preview -v` → `9.8.7-preview` |
| Bundled lint/export/Runner smoke | Passed: package-default and environment-override version output before all prior localhost evidence |
| Bundled localhost CLI file-boundary smoke | Passed |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

## Focused coverage

- `--version` and `-v` are boolean global options for positional extraction, so they cannot be mistaken for an omitted resource identifier.
- The default invocation reads the bundled root package version. The packaged smoke removes any inherited `VERSION` before asserting that fallback.
- A separate packaged child receives `VERSION=9.8.7-preview` and verifies the exact override string through the short form.
- Version handling executes before help and command dispatch and therefore cannot touch project paths, configs, prompt state, transports, reports, or trusted capability flags.
- Existing help, prompt, config, script alias, run, lint, export, reporter, and security behavior remains covered by the unchanged packaged matrix.

## Manual/rendered QA

This milestone changes one headless root option and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 219 closes the named version-option gap. Internal documentation generation, executable JS/TS configs, plugin tags, the desktop local vault, remaining Inso command/error/help edge semantics, full Spectral identity, process-level JavaScript isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 220.
