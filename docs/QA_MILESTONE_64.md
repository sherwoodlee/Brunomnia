# Milestone 64 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add free, confirmed per-selection and all-unstaged Git discard while preserving staged index content, confining paths, refusing conflict states, and reloading managed YAML.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [Git staging modal](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/modals/git-staging-modal.tsx) exposes confirmed per-file and **Discard all changes** controls. Its [Git layer](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/sync/git/git-vcs.ts) restores tracked worktree content from the stage and removes untracked files. Brunomnia implements the same index-preserving contract through native Git.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 42 files, 253 tests |
| Vite production build | Pass — 170 modules; 498.40 KB / 498,403-byte main JavaScript chunk; 20,091-byte lazy Git-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 33 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 34-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- A tracked file with staged content plus a later working-tree edit restores to the staged bytes, not `HEAD`.
- The staged diff remains present while the working diff becomes empty.
- A selected untracked file is removed; ignored and unselected paths are not passed to Git.
- Empty, stale, staged-only, conflicted, merge/rebase, and traversal selections are rejected before discard.
- Tracked restore and untracked cleanup use direct argument vectors with `--` path termination and no shell.
- Selected and all-unstaged controls share the same native contract, progress/error surface, project reload, and optional destructive confirmation.
- Discard is neither account-gated nor subscription-gated.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Selection counts, both discard controls, confirmation behavior, disabled states, success/error messages, and project reload are compile-, fixture-, and bundle-verified only in this phase.

## Acceptance boundary

Discard is permanent after optional confirmation and has no trash/recovery layer. It does not alter the index, ignored files, active conflicts, submodule internals, or arbitrary directories as a unit. Tracked restore runs before untracked cleanup, so a later filesystem/Git failure is reported but does not roll back a completed earlier group.
