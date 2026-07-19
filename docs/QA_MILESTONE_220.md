# Milestone 220 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: replace root-only CLI help with pinned-shaped parent and leaf topics, local/global option visibility, short/long help flags, and `help <command> [subcommand]` routing.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` builds a Commander tree with root global options, parent `run`/`lint`/`export` commands, leaf `run test`, `run collection`, `lint spec`, `export spec`, and `script` commands, descriptions, arguments, and local options.
- Commander provides root/parent/leaf `-h`/`--help` and a `help` command from that tree before invoking command actions.
- Pinned `packages/insomnia-inso/src/scripts/docs.ts` separately confirms the intended help model: each command exposes description, syntax, local flags, global flags, and subcommands.
- Brunomnia uses bounded static help topics rather than importing Commander. It includes every implemented pinned option plus visible Brunomnia trust/report/generation extensions and short-circuits before workspace/config loading or prompts. Exact Commander spacing and wrapping are not claimed.

## Automated gates

| Gate | Result |
| --- | --- |
| Full Vitest suite | Passed: 77 files, 567 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 6,460,638-byte CLI |
| Direct bundled help checks | Passed: root, `run test --help`, `help run collection`, and `lint spec -h` |
| Bundled lint/export/Runner smoke | Passed: test/collection/lint scoped syntax, pinned local flags, global flags, and Brunomnia extension visibility before all prior localhost evidence |
| Bundled localhost CLI file-boundary smoke | Passed |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

## Focused coverage

- Root help retains the complete command overview, version, config, prompt, and reporter guidance.
- Parent `run`, `lint`, `export`, and `generate` topics expose subcommands or syntax plus global options.
- Leaf test, collection, lint-spec, export-spec, generation, and script topics expose command syntax, descriptions, local options, and shared global options.
- `--help` and `-h` route from the active parent/leaf. `help run collection` routes through the explicit help command without treating topic names as execution arguments.
- Packaged assertions prove test help includes `--keepFile` and `--testNamePattern`, collection help includes `--includeFullData`, lint help includes `--ruleset`, and every leaf includes the global-option section.
- Help dispatch occurs after version handling but before command actions, so no workspace, config, prompt, transport, report, or trusted-capability side effect is possible.

## Manual/rendered QA

This milestone changes headless text output and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 220 closes the named scoped-help routing gap. Exact Commander formatting, shell completion, generated reference files, executable JS/TS configs, plugin tags, the desktop local vault, remaining Inso error/edge semantics, full Spectral identity, process-level JavaScript isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 221.
