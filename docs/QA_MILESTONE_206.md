# Milestone 206 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned Inso `.insorc` discovery and explicit `--config` loading for supported global workingDir/CI/verbose/print options, with bounded script-definition retention and CLI-over-config precedence.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` uses `cosmiconfig('inso')`, explicitly loads `--config` or searches from `workingDir`/cwd, keeps only truthy `workingDir`, `ci`, `verbose`, and `printOptions` entries, retains `scripts`, then overlays command options.
- Pinned fixtures use extensionless/YAML `.insorc` and Git-root discovery; cosmiconfig additionally recognizes JSON/YAML variants, package properties, and executable JS/TS config loaders.
- Brunomnia supports extensionless, JSON, YAML, YML, and `package.json` `inso` documents under 1 MB, searches upward, filters typed global options, bounds 100 script strings, and deliberately leaves executable JS/TS config loading for a later explicit-authority stage.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused config normalization regressions | Pass — 1 file, 10 tests |
| Full Vitest suite | Pass — 77 files, 563 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 528 renderer modules; 175.18 kB stylesheet; 71.43 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,356,281-byte CLI bundle |
| Bundled CLI startup/help | Pass — explicit/discovered config formats and supported options documented |
| Bundled Runner preview config smoke | Pass — explicit workingDir, config CI fallback, upward discovery, print diagnostics, and missing-file rejection |
| Bundled localhost CLI template smoke | Pass — legacy positional input plus denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Unknown config options and non-string scripts are omitted; supported booleans retain explicit true/false and workingDir requires nonblank text.
- Config/script/name/file-size bounds prevent oversized automatic input; empty documents normalize to empty options and scripts.
- Explicit `--config` supplies workingDir and verbose behavior for the main selected folder run; config `ci` supplies the first collection when no identifier is present.
- Upward discovery from `-w` finds `.insorc`; CLI `--printOptions` overrides config false and emits config/effective-option evidence to stderr without corrupting JSON report stdout.
- A missing explicit config exits visibly before workspace or network access; ordinary no-config invocation remains unchanged.
- Script definitions are retained but not executed, and no JS/TS config, shell, prompt, network, filesystem-authority, cloud, account, subscription, telemetry, entitlement, vault, TLS, or plugin behavior is introduced.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 206 accepts bounded declarative Inso configuration discovery and option precedence. Config-script execution, executable JS/TS configs, interactive prompts, plugin tags, desktop local-vault access, remaining Inso commands/flags, TLS exceptions/material, stronger portable script isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 207.
