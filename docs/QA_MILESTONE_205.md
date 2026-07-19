# Milestone 205 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: accept pinned Inso global `-w, --workingDir <path>` input for collection and test runs, with only the target identifier positional, and make desktop Run via CLI previews emit that shape while retaining Brunomnia's earlier positional workspace contract.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` registers `-w, --workingDir <path>` globally, obtains command data from that directory/file, and leaves the collection workspace, test suite, or API-spec identifier as the command positional.
- Pinned global options may occur before or after command-specific positionals under Commander; Brunomnia now removes every supported value/boolean run option before resolving positional inputs, so both placements work.
- Existing Brunomnia automation may still pass `<workspace-or-project> <identifier>` without `--workingDir`; that form remains backward compatible, while generated desktop commands now use the pinned long option.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused working-directory regressions | Pass — 1 file, 9 tests |
| Full Vitest suite | Pass — 77 files, 562 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 528 renderer modules; 175.18 kB stylesheet; 71.43 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,352,093-byte CLI bundle |
| Bundled CLI startup/help | Pass — pinned working-directory input shape documented |
| Bundled Runner preview working-directory smoke | Pass — long and short flags across selected run, zero-match, empty-folder, bail, and timeout paths |
| Bundled localhost CLI template smoke | Pass — legacy positional input plus denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Legacy workspace-plus-identifier arguments remain intact around repeated item and boolean bail flags.
- Pinned identifier-only commands discard `-w`/`--workingDir` and its value from positionals whether the global option appears before or after command options.
- The desktop command builder emits collection ID first, then shell-safe `--workingDir`, followed by environment, exact item order, iterations, retries, delay, data, and bail.
- The packaged split-YAML run uses long `--workingDir`; zero-match, empty-folder, bail, timeout-success, and timeout-failure paths use short `-w` and preserve their prior exact evidence.
- The unchanged template smoke continues to use the legacy positional workspace form, proving backward compatibility through scripts, files, responses, and cookies.
- No config discovery, script alias, prompt, report schema, persistence, network, filesystem-authority expansion, cloud, account, subscription, telemetry, entitlement, vault, TLS, or plugin behavior is introduced.

## Manual/rendered QA

Generated Run via CLI text changes, but the in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate surface or policy workaround was attempted. No rendered copy-dialog or clipboard claim is made beyond pure command generation and packaged execution.

## Acceptance boundary

Milestone 205 accepts pinned working-directory run input and establishes the path-precedence foundation for `.insorc` discovery. Interactive prompts, `.insorc` options/scripts, plugin tags, desktop local-vault access, remaining Inso commands/flags, TLS exceptions/material, stronger portable script isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 206.
