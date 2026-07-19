# Milestone 208 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: separate pinned Inso global and collection environment selectors, accept bounded local global-environment files, and make Run via CLI generate the same independent `--globals` and `--env` inputs.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` defines collection `-g, --globals <identifier>` independently from `-e, --env <identifier>`. A non-file global selector matches an environment ID/name and becomes the active workspace global; a file is imported and its first environment becomes active before the collection environment is resolved.
- Brunomnia maps workspace environments to pinned globals and collection sub-environments to pinned request environments. Missing explicit selectors fail before transport rather than falling back silently.
- Global files are local-only and capped at 20 MB, 100 environments, 1,000 variables per environment, 500-character identities, and 1 MB values. Bounded Brunomnia environment resources/lists, Insomnia v4 exports, and Insomnia v5 environment documents are parsed as data without script execution.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused environment-selector regressions | Passed: 1 file, 12 tests |
| Full Vitest suite | Passed: 77 files, 565 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 5,366,522-byte CLI |
| Bundled CLI startup/help | Passed: collection/test `--globals` and `--env` plus `script` are present |
| Bundled Runner environment-selection smoke | Passed: ID/name selection, Brunomnia/Insomnia v4/v5 files, short/long flags, failures, and HTTP 200 evidence |
| Bundled localhost CLI template smoke | Passed |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Passed |

## Focused coverage

- Global selectors match exact workspace IDs or names and preserve bounded parent inheritance; collection selectors independently match sub-environment IDs or names.
- Generated Runner commands always identify the selected global scope with `--globals`, add `--env` only for an active collection sub-environment, preserve exact request order, and shell-quote all values.
- The packaged localhost smoke proves selected global plus collection values reach request templates, then repeats with standalone Insomnia v4, Insomnia v5, and Brunomnia environment files through both long and short flags.
- Missing global and collection selectors exit nonzero before transport. Existing iteration, config-script, timeout, folder, request-filter, CI fallback, delay, bail, and assertion evidence remains in the same packaged smoke.

## Manual/rendered QA

Run via CLI changes one generated command but not the dialog layout or interaction. The production build statically validates the new properties. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 208 corrects the previous `--env` global-scope mismatch and adds pinned global-file behavior. Explicit source identity for Brunomnia's anonymous collection base environment, interactive environment prompts, executable JS/TS configs, plugin tags, desktop local-vault access, remaining Inso commands/flags, TLS exceptions/material, stronger portable script isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 209.
