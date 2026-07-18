# Milestone 62 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add free, explicit remote-branch refresh, discovery, and tracking checkout to Git Sync while keeping provider credentials in the installed Git client and preserving argument-only native execution.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [branches modal](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/modals/git-branches-modal.tsx) separates local and remote-only branches and offers **Fetch and checkout**. Its [Git layer](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/sync/git/git-vcs.ts) lists/fetches remote branches and refreshes a remote branch before checkout. Brunomnia implements that user-visible path through native Git with an additional explicit fetch/prune control.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 42 files, 253 tests |
| Vite production build | Pass — 170 modules; 498.26 KB / 498,262-byte main JavaScript chunk; 18,786-byte lazy Git-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 31 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 32-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- A local bare repository and independent source/clone pair exercise the workflow without external network access.
- Explicit fetch updates configured remote-tracking refs, prunes deleted branches, and skips tags.
- Discovery retains remote name, slash-containing branch name, and exact tracking ref while omitting symbolic remote `HEAD`.
- Remote entries whose same-named local branch already exists are omitted from the UI's remote-only list.
- Fetch-and-checkout refreshes the selected branch, verifies the exact `refs/remotes/...` ref, creates a same-named local branch, and records its upstream.
- Duplicate local names and option-shaped/nonexistent remotes are rejected before checkout/fetch can reinterpret them.
- Native Git uses argument arrays without a shell; the installed Git credential helper or SSH agent owns authentication.
- Remote branch workflows are neither account-gated nor subscription-gated.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Remote/local counts, selector interaction, loading/error messages, responsive layout, and project reload behavior are compile-, style-, fixture-, and bundle-verified only in this phase.

## Acceptance boundary

Remote discovery is based on configured remote-tracking refs and explicit fetch. Brunomnia does not yet discover provider repositories/accounts, store provider credentials, delete/rename remote branches, browse a remote branch without checking it out, fetch tags, expose advanced refspecs, or add force controls. Git rejects unsafe checkouts that would overwrite work; broader remote credential and failure-mode fixtures remain open.
