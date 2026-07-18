# Milestone 67 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: match current Insomnia branch-manager behavior by refusing a branch merge until staged and unstaged work is resolved, without mutating that work during preflight.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [Git project branches modal](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/modals/git-project-branches-modal.tsx) checks the current staged/unstaged change sets and refuses merge until they are committed or discarded.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 42 files, 253 tests |
| Vite production build | Pass — 170 modules; 498,482-byte main JavaScript chunk; 21,519-byte lazy Git-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native merge-preflight fixture | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 36 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 37-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- A feature branch changes a different file, proving the preflight—not Git overlap detection—rejects local work.
- An unstaged tracked edit is rejected, retains its exact local content, and creates no merge state.
- The same edit staged into the index is rejected, remains visible in the staged diff, and creates no merge state.
- Current merge/rebase/conflict state is rejected through the same preflight boundary.
- A clean working tree continues through the existing merge and conflict paths.
- Direct Git execution retains argument arrays, target-branch validation, and no shell.
- The workflow is neither account-gated nor subscription-gated.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Error placement, branch-selector behavior, keyboard focus, and responsive presentation are compile-, fixture-, style-, and bundle-verified only in this phase.

## Acceptance boundary

The preflight is deliberately stricter than native Git for non-overlapping edits: every current staged, unstaged, untracked, conflicted, merge, or rebase state must be resolved first. Brunomnia does not stash or autostash work, and it does not add rebase, cherry-pick, force merge, or automatic conflict cleanup.
