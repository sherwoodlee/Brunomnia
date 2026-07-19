# Milestone 222 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: apply pinned Inso global configuration options and their diagnostics uniformly to every user-facing actionable command, then reconcile the remaining command inventory without treating the maintainer-only documentation generator as an end-user requirement.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia-inso/src/cli.ts` routes `run test`, `run collection`, `lint spec`, `export spec`, and `script` through one `mergeOptionsAndInit` helper. That helper merges filtered config options with CLI values, enables verbose logging, and prints loaded options before each action.
- Brunomnia already implements every pinned end-user command family and local/global flag, plus documented bounded extensions. Before this milestone, only `run` emitted merged `verbose`/`printOptions` diagnostics; lint, export, and script loaded the same config but skipped that observable behavior.
- Pinned `generate-docs` is invoked from the package-maintainer README after installing/building the monorepo, writes Markdown into a versioned source `reference` directory relative to `__dirname`, has no description/options, and intentionally exits with status 1. It is build-maintenance plumbing, not an installed end-user workflow or parity requirement.

## Implementation

- One `resolveRunnerGlobalOptions` path loads bounded config, applies explicit CLI precedence, derives `workingDir`, `ci`, `verbose`, and `printOptions`, and emits diagnostics to stderr.
- `run collection`, `run test`, `lint spec`, `export spec`, and `script` now use that path. Reporter and exported-spec stdout remains machine-readable.
- The packaged smoke executes successful lint, export, script, and run paths from one discovered config and proves diagnostics do not alter exit status or stdout behavior.

## Automated gates

| Gate | Result |
| --- | --- |
| Full Vitest suite | Passed: 77 files, 567 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 433.88 kB main, 6,460,573-byte CLI |
| Packaged CLI runner smoke | Passed: cross-command diagnostics plus prior lint/export/config/runner/transport evidence |
| Packaged CLI template smoke | Passed: trust boundaries, generated source, templates, chaining, and cookies |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

The implementation changes only the TypeScript CLI, generated bundle, and its packaged smoke. Rust/native tests and the macOS app bundle are unchanged; Milestone 220 remains the latest full native and app-bundle gate.

## Manual/rendered QA

This milestone changes headless stderr diagnostics and has no desktop interaction. No rendered Browser claim is made.

## Acceptance boundary

Milestone 222 closes uniform global-option diagnostics and confirms the pinned end-user command/flag inventory. It does not claim exact Commander/Enquirer formatting, executable JavaScript/TypeScript configs, plugin tags, desktop-vault access, full Spectral identity, uncommon report/proxy/TLS edge behavior, process-level JavaScript isolation, or signed containers. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
