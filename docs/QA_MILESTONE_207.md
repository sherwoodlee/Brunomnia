# Milestone 207 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned Inso `script <script-name>` execution for declarative config aliases that start with `inso`, accept quote-aware task text and pass-through arguments, recursively dispatch the bundled CLI, and preserve child exit status.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` looks up the named `configFileContent.scripts` entry, requires `startsWith('inso')`, appends arguments following the script name, tokenizes through `string-argv`, and recursively calls Commander `parseAsync`.
- Brunomnia requires the first parsed token to equal `inso`, supports single/double quotes, empty quoted values, and backslash escapes, then spawns the current bundled CLI executable with an argument array rather than a shell.
- Config path and explicit workingDir/CI/verbose options propagate when the task does not provide its own values. A ten-level environment-carried recursion bound prevents non-converging aliases without restricting ordinary nested scripts.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused config-script regressions | Passed: 1 file, 11 tests |
| Full Vitest suite | Passed: 77 files, 564 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.43 kB Automation, 71.61 kB Interchange, 433.88 kB main, 5,359,860-byte CLI |
| Bundled CLI startup/help | Passed: `script <name> [arguments...]` is present |
| Bundled Runner preview config-script smoke | Passed: alias dispatch, pass-through timeout, invalid task, missing alias, and HTTP 200 evidence |
| Bundled localhost CLI template smoke | Passed |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Passed |

## Focused coverage

- Quoted suite/environment names, regex backslashes, empty arguments, and whitespace tokenize to exact argv values without a shell.
- Missing commands, invalid non-`inso` prefixes, unterminated quotes/escapes, oversized tasks, non-string definitions, and unknown script names fail visibly.
- A packaged `preview` alias runs one saved request from the config workingDir, receives forwarded `--requestTimeout`, returns parseable JSON on stdout, and preserves HTTP 200 evidence.
- Invalid task text exits nonzero before child creation; missing names list the bounded available aliases.
- Child process stdout/stderr and exit code flow through the parent; config and explicit global inputs propagate, while task-local values remain authoritative.
- Pipes, redirects, substitutions, wildcard expansion, environment interpolation, and arbitrary shell commands never execute. Existing CLI script/network/file/vault authorities remain separately explicit.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 207 accepts declarative Inso config aliases without adding shell authority. Executable JS/TS configs, interactive prompts, plugin tags, desktop local-vault access, remaining Inso commands/flags, TLS exceptions/material, stronger portable script isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 208.
