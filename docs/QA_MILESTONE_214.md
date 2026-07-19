# Milestone 214 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align pinned Inso API-spec export with identifier-only working-directory input, explicit Kong-annotation stripping, stdout/file selection, nested output creation, and backward-compatible legacy input.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` exposes `export spec [identifier]`, global `-w`/`--workingDir`, `-o`/`--output`, and `-s`/`--skipAnnotations`; it resolves a stored API specification by name/ID, writes unchanged source when stripping is absent, and resolves output under the effective working directory.
- Pinned `packages/insomnia-inso/src/commands/export-specification.ts` parses YAML only when stripping is requested, recursively removes keys whose names start with exact lowercase `x-kong-`, reserializes YAML, creates missing output parents, and otherwise preserves the original specification text.
- Brunomnia applies the same data transformation to its bounded local `ApiDesign` model, adds cycle and 100-level recursion rejection for adversarial YAML aliases, and retains the earlier `<workspace> <identifier>` invocation for existing automation.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused export/parser regressions | Passed: 2 files, 16 tests |
| Full Vitest suite | Passed: 77 files, 566 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 6,447,853-byte CLI |
| Bundled CLI startup/help | Passed: export input, short/long annotation stripping, output, and working-directory contracts present |
| Bundled export/Runner smoke | Passed: split-project legacy raw stdout, pinned identifier-only short-strip nested file, retained non-Kong extensions, and all prior Runner transport evidence |
| Bundled localhost CLI file-boundary smoke | Passed |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Passed |

## Focused coverage

- Pure export preserves source bytes when stripping is absent, removes root and deeply nested `x-kong-*` keys when requested, preserves similarly positioned non-Kong extensions, handles arrays, and rejects cyclic YAML aliases instead of recursing indefinitely.
- Option-aware positional extraction treats `--skipAnnotations` as a boolean and protects the design identifier around working-directory and output values; `--skip-annotations` is an additional Brunomnia alias.
- Pinned `export spec <design> -w <project>` and legacy `export spec <workspace> <design>` both resolve JSON or split-YAML workspace inputs through the shared migration boundary.
- `-s` plus `-o exports/nested/clean.yaml` writes normalized stripped YAML under the split project and creates parent directories. No-output legacy export writes unchanged annotated source to stdout.
- Config-provided working directories remain available because export uses the same bounded `.insorc` loader and explicit CLI precedence as run commands.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 214 closes the named pinned export-spec input, stripping, and output-path gap. Exact upstream database partial-ID ambiguity, interactive specification prompts, executable JS/TS configs, full Spectral behavior, remote references, remaining Inso commands/flags, process-level JavaScript isolation, and signed containers remain. Headless CLI and API specification design stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 215.
