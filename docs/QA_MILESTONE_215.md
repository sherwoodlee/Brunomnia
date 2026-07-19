# Milestone 215 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align pinned Inso `lint spec` file/stored-design input resolution, explicit ruleset precedence, and sibling `.spectral*` discovery while preserving Brunomnia's safe local rules engine and established CI fallback extension.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` exposes `lint spec [identifier]` plus global `-w`/`--workingDir`; it resolves the identifier as a working-directory-relative file first, otherwise selects a stored API specification by identifier or an interactive prompt. Its API-spec prompt returns no selection in CI. Brunomnia retains a deterministic first-design CI fallback as an explicit automation extension.
- Pinned explicit `-r`/`--ruleset` resolves from the working-directory base and overrides discovery. File lint with no explicit ruleset calls `getRuleSetFileFromFolderByFilename`, which selects a sibling filename beginning `.spectral`; stored specifications use the database source path.
- Brunomnia deterministically sorts sibling candidates, uses a stored design's local ruleset when no explicit override is supplied, and retains the documented safe truthy/falsy/defined/enumeration/length/pattern/casing subset instead of executing arbitrary JavaScript, remote/package extensions, or unrestricted reference loaders.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused OpenAPI/parser regressions | Passed: 2 files, 16 tests |
| Full Vitest suite | Passed: 77 files, 566 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 6,449,813-byte CLI |
| Bundled CLI startup/help | Passed: lint identifier/file, working-directory, ruleset, and JSON-extension contracts present |
| Bundled lint/export/Runner smoke | Passed: stored-design and Brunomnia-extension CI lint success, explicit and sibling-ruleset failures, export continuity, and all prior Runner transport evidence |
| Bundled localhost CLI file-boundary smoke | Passed |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Passed |

## Focused coverage

- Option-aware positional extraction protects the lint identifier around `-w`, `--ruleset`, and `--json`; short `-r` shares the existing value-option handling.
- The packaged split project lints a stored design by exact ID, then verifies Brunomnia's retained no-identifier `--ci` extension selects the first design. Both produce one operation and zero issues.
- A working-directory-relative explicit ruleset overrides the stored design ruleset, reports the custom API-info error, and exits non-zero.
- A working-directory-relative specification file discovers sibling `.spectral.yaml`, reports the same custom error, and exits non-zero without falling back to a stored design.
- Filesystem inspection distinguishes a missing file candidate from other stat failures, so permission or I/O errors remain explicit instead of silently broadening to project data.
- Shared working-directory-base resolution now keeps lint, export, and collection result output consistent for directory projects and workspace files.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 215 closes the named pinned lint-spec input and local ruleset-resolution gap. Full Spectral function/package/remote-reference identity, interactive prompts, executable JS/TS configs, partial-ID ambiguity, remaining Inso commands/flags, process-level JavaScript isolation, and signed containers remain. Headless CLI and API specification design stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 216.
