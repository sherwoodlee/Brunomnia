# Milestone 63 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add free, guarded local Git branch deletion with explicit confirmation policy, strict branch validation, current-branch protection, and no force path.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [branches modal](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/modals/git-branches-modal.tsx) exposes a confirmed Delete action for non-current local branches. Brunomnia adds the same branch-management capability while using native Git's merged-branch check instead of exposing unconditional/force deletion.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 42 files, 253 tests |
| Vite production build | Pass — 170 modules; 498.34 KB / 498,336-byte main JavaScript chunk; 19,403-byte lazy Git-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 32 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 33-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- The native command rejects an empty, malformed, option-shaped, nonexistent, or current branch before deletion.
- Deletion uses a direct `git branch -d -- name` argument vector and does not invoke a shell.
- A fully merged branch is deleted and disappears from refreshed status.
- An unmerged branch is refused by Git and remains present afterward.
- The UI offers only non-current local branches and identifies the exact selected branch in confirmation copy.
- **Confirm destructive actions** remains authoritative for the extra UI prompt; native current/unmerged protections apply regardless of that preference.
- Local deletion leaves remote-tracking refs and provider branches untouched.
- Branch deletion is neither account-gated nor subscription-gated.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Selector interaction, confirmation behavior, disabled states, success/error messages, and responsive layout are compile-, fixture-, and bundle-verified only in this phase.

## Acceptance boundary

This baseline has no force-delete action. It does not delete or rename remote branches, inspect provider branch protection, perform bulk deletion, or rename local branches. Git decides whether a branch is fully merged into the current `HEAD`; refused branches remain intact and the native error is shown in the workbench.
