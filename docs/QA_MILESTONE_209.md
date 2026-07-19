# Milestone 209 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned variadic `-f`/`--dataFolders` inputs to collection and test runs, require those invocation-only roots for trusted CLI File tags and script attachments, and canonically reject paths or symlinks that escape them.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` defines `-f, --dataFolders [dataFolders...]` for both `run test` and `run collection` and passes the collected roots into request-run options.
- Pinned Insomnia's secure file reader treats data folders as a security boundary. Brunomnia retains its additional off-by-default `--allow-template-files` and `--allow-script-files` process grants, then also requires at least one pinned root so neither an imported workspace nor a single broad flag can name arbitrary process-readable files.
- Brunomnia caps roots at 20 and paths at 4,096 characters, canonicalizes each existing directory and requested file, requires a regular file, uses component-aware containment, rejects symlink escapes, and preserves the existing 5 MB per-file and script aggregate bounds.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused variadic-option regressions | Passed: 1 file, 12 tests |
| Full Vitest suite | Passed: 77 files, 565 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 5,369,136-byte CLI |
| Bundled CLI startup/help | Passed: collection/test `-f, --dataFolders <folder...>` is present |
| Bundled Runner environment/config smoke | Passed |
| Bundled localhost CLI file-boundary smoke | Passed: default/rootless/outside/symlink denial plus valid template/script reads and HTTP 200 evidence |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Passed |

## Focused coverage

- Positional extraction skips every variadic root while preserving the identifier and later options; repeated long/short data-folder flags retain root order.
- A trusted File tag still fails without its process grant, then fails with a grant but no root, fails when the requested file is outside a valid root, and fails through an in-root symlink to an outside file.
- A canonical in-root File tag succeeds with `--allow-template-files`; a script-created attachment succeeds with `--allow-script-files`. Both preserve the existing exact rendered/script evidence and HTTP 200 result.
- Roots are invocation-only and are never read from workspace preferences, `.insorc`, or imported project data. Run via CLI continues to omit every file/script grant and root rather than fabricating authority.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 209 closes the unrestricted trusted-file process gap while retaining explicit process consent. Interactive prompts, executable JS/TS configs, plugin tags, desktop local-vault access, remaining Inso commands/flags, CLI proxy/TLS exceptions and custom material, process-level JavaScript sandboxing, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 210.
