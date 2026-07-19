# Milestone 217 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align omitted-identifier terminal selection for collection, test-suite/API-specification, lint-specification, and export-specification commands while refusing hidden prompts in non-interactive execution.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/db/models/workspace.ts` prompts for a workspace when `run collection` has no identifier outside CI; `getWorkspaceOrFallback` selects the first workspace only in CI.
- Pinned `packages/insomnia-inso/src/db/models/unit-test-suite.ts` presents API specifications and their unit-test suites when `run test` has no identifier. Pinned `packages/insomnia-inso/src/db/models/api-spec.ts` presents stored API specifications for omitted `lint spec` and `export spec` identifiers.
- Pinned suite/API-specification prompt helpers return no selection in CI. Brunomnia retains its prior deterministic first-suite/design CI fallback as an account-free automation extension and corrects the older Milestone 215 wording that had mislabeled this extension as pinned behavior.
- Brunomnia maps upstream workspace choices to local collections, uses bounded numbered terminal choices with 14-character ID prefixes, defaults to the first row, and refuses non-TTY stdin/stderr with identifier/`--ci` guidance instead of hanging on an invisible prompt. Exact Enquirer autocomplete presentation is not claimed.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused CLI/parser regressions | Passed: 2 files, 16 tests |
| Full Vitest suite | Passed: 77 files, 566 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 6,453,692-byte CLI |
| Bundled CLI startup/help | Passed: optional identifier, terminal prompt, CI fallback, and environment guidance present |
| Bundled lint/export/Runner smoke | Passed: non-TTY collection, suite/design, lint-design, and export-design refusal before transport plus all prior selection/transport/report evidence |
| Real pseudo-terminal CLI traversal | Passed: selected the sole collection and collection environment, then reached the deliberate zero-request pre-transport failure |
| Bundled localhost CLI file-boundary smoke | Passed |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

## Focused coverage

- `run collection` without an identifier lists bounded collection choices; `run test` lists API-design and sort-ordered standalone-suite choices; stored lint/export list API designs.
- Every terminal choice returns a stable full ID into the existing exact-name/full-or-prefix resolver, so selection cannot be confused by duplicate display names after the user chooses a numbered row.
- Invalid numbers fail locally. Empty input chooses the first row. Collection-environment selection then uses the independently verified explicit/CI/prompt boundary from Milestone 216.
- Packaged piped-stdio calls omit identifiers for all four command paths and prove each refuses before any localhost arrival.
- A macOS `expect` pseudo-terminal selected `CLI Health`, selected `CLI selected`, and then failed on `^Missing$` with `No requests identified; nothing to run.` This proves both prompt stages settle before execution without making a request.
- Explicit identifiers, ID prefixes, config working directories, CI collection fallback, Brunomnia's suite/design CI extensions, reporters, and trusted authority boundaries remain covered by the existing packaged matrix.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted. The interactive path was exercised through a real local pseudo-terminal rather than a rendered app surface.

## Acceptance boundary

Milestone 217 closes the named omitted-resource prompt gap with explicit non-TTY safety and honest CI-extension accounting. Exact Enquirer search/autocomplete styling, executable JS/TS configs, plugin tags, the desktop local vault, `--keepFile`, internal documentation generation, remaining Inso flags/edge semantics, full Spectral identity, process-level JavaScript isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 218.
