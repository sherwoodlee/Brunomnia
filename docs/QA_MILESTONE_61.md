# Milestone 61 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add free, bounded Git commit-history browsing and selected-commit inspection to the native split-YAML project workflow without fetching, changing repository state, or accepting arbitrary Git revision expressions.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [Git log modal](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/modals/git-log-modal.tsx) displays commit message, relative time, author name, and author-email tooltip. Its [Git layer](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/sync/git/git-vcs.ts) defaults history depth to 35 and attempts a current-remote fetch before reading the log. Brunomnia matches the useful history list locally, adds parent/ref metadata and patch inspection, and deliberately avoids the implicit network side effect.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 42 files, 253 tests |
| Vite production build | Pass — 170 modules; 498.11 KB / 498,109-byte main JavaScript chunk; 17,709-byte Git-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 30 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 31-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- An unborn repository returns an empty history.
- A bounded request returns the newest reachable commits first and retains message, author name/email, ISO timestamp, parents, and local decorations.
- The renderer requests 35 entries while the native layer clamps all callers to 1–100.
- Selecting a commit returns `git show` metadata, file statistics, and a rename/copy-aware patch under the existing 2 MB output cap.
- Patch lookup rejects branch names, abbreviated IDs, flags, revision syntax, and command-like input; only a 40- or 64-character hexadecimal object ID is accepted and then verified as a commit.
- Git is invoked directly with argument arrays and `--` path termination; history and inspection never use a shell or alter the repository.
- History is neither account-gated nor subscription-gated.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. History navigation, active-row state, metadata layout, responsive stacking, scrolling, and patch presentation are compile-, style-, and bundle-verified only in this phase.

## Acceptance boundary

Brunomnia reads commits reachable from the current local `HEAD` and does not fetch. It does not yet aggregate remote branches, render a commit graph, search or paginate beyond the bounded call, display full message bodies/signatures, render binary patches, or provide checkout/revert/reset actions from a commit. Provider-specific authentication/onboarding, credential validation, and automatic repository discovery remain open in the parity ledger.

Milestone 221 correction: a later audit of the same pinned source confirms that rebase and cherry-pick are not user-facing standard Git Sync capabilities, and that its history route accepts no arbitrary branch/ref selector. Those items and broader unspecified edge-case fixtures are therefore not parity requirements.
