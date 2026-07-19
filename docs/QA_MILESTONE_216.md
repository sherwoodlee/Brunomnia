# Milestone 216 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align pinned Inso partial-ID resource selection and collection-environment choice across explicit, CI, interactive, and non-interactive CLI execution without silently selecting ambiguous resources.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/db/models/util.ts` defines identifier matching as an ID prefix. Workspace, API-specification, and unit-test-suite loaders combine that prefix with exact-name matching; workspace/API-specification/suite loaders reject multiple matches through `ensureSingleOrNone`.
- Pinned `packages/insomnia-inso/src/db/models/environment.ts` gives explicit `--env` selection precedence. Without it, no sub-environment uses the base, CI auto-selects exactly one sub-environment, CI reports every name and refuses multiple, and ordinary execution opens an environment prompt.
- Pinned `packages/insomnia-inso/src/cli.ts` applies the same environment decision after collection selection and accepts global-environment ID prefixes or exact names. Brunomnia maps pinned workspaces to local collections and applies one shared exact-name/full-or-prefix selector to collections, stored API designs, global environments, and collection sub-environments.
- Brunomnia intentionally rejects ambiguous environment prefixes instead of accepting the first storage-order match, uses a numbered terminal prompt with the saved active sub-environment as default, and refuses non-TTY prompting with actionable `--env`/`--ci` guidance. These are deterministic safety adaptations, not claims of exact Enquirer presentation identity.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused selector regressions | Passed: 1 file, 12 tests |
| Full Vitest suite | Passed: 77 files, 566 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 6,451,730-byte CLI |
| Bundled CLI startup/help | Passed: stored-resource ID-prefix forms and non-interactive environment guidance present |
| Bundled lint/export/Runner smoke | Passed: stored-design/collection/global/collection-environment prefix execution, explicit environment precedence, sole-environment CI selection, named multi-environment CI refusal, non-TTY refusal, and all prior transport/report evidence |
| Bundled localhost CLI file-boundary smoke | Passed with explicit CI intent for non-interactive fixture execution |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

## Focused coverage

- The shared selector accepts exact names and full or partial IDs, rejects missing identifiers, and rejects prefixes that match multiple resources.
- Global and collection-environment helpers resolve prefix IDs through the same bounded selector while preserving inherited environment resolution.
- Packaged split-project execution selects the collection, global environment, and collection environment through independent ID prefixes and confirms all three scopes in localhost request URLs.
- Packaged stored-design lint selects an API design by ID prefix; exact-name and full-ID export/lint paths remain covered by prior calls.
- Explicit `--env` bypasses CI/prompt selection. Existing config-driven CI runs prove the sole sub-environment fallback across collection and suite paths.
- A two-sub-environment fixture proves `--ci` names and refuses both choices before transport. The same fixture with CI disabled and piped stdio proves non-TTY execution refuses before transport and directs callers to `--env` or `--ci`.
- The interactive numbered prompt is source-audited and strict-TypeScript compiled; the automated environment intentionally does not fabricate a user-owned TTY interaction.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted. Interactive terminal selection was not claimed as manually exercised.

## Acceptance boundary

Milestone 216 closes the named partial-ID and collection-environment decision gap with explicit ambiguity and non-TTY safety bounds. Exact upstream Enquirer autocomplete rendering, remaining resource/spec/suite prompts, executable JS/TS configs, plugin tags, the desktop local vault, remaining Inso commands/flags, full Spectral identity, process-level JavaScript isolation, and signed containers remain. Headless CLI and API specification design stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 217.
