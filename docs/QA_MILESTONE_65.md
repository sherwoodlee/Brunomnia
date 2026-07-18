# Milestone 65 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add free, confined per-file Git diff review for staged and unstaged changes, with a bounded UTF-8 preview for untracked files and explicit binary/size/path failure modes.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [Git staging modal](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/modals/git-staging-modal.tsx) selects a staged or unstaged file and renders its before/after content in a diff editor. Brunomnia retains its unified patch renderer while adding the same file-scoped review path and useful untracked-text evidence.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 42 files, 253 tests |
| Vite production build | Pass — 170 modules; 498.48 KB / 498,482-byte main JavaScript chunk; 20,497-byte lazy Git-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 34 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 35-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- File-scoped unstaged diff contains the tracked index-to-working-tree removal/addition.
- File-scoped staged diff contains the tracked `HEAD`-to-index removal/addition.
- A current untracked UTF-8 file returns its name and exact text under the 2 MB cap.
- Untracked binary input is rejected as non-text; oversized input returns only a bounded notice.
- A staged request for an unstaged-only file and a request for a stale/unchanged file are rejected.
- Traversal and symlink escapes are rejected before file reads; tracked Git calls use `--` path termination and no shell.
- Switching staged/unstaged mode clears the selected file, while the aggregate diff remains available.
- Per-file review is neither account-gated nor subscription-gated.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. File selector population, mode reset, long-path truncation, responsive controls, scrolling, and patch presentation are compile-, fixture-, style-, and bundle-verified only in this phase.

## Acceptance boundary

Brunomnia displays a unified textual patch/direct untracked preview rather than a side-by-side semantic editor. It does not provide syntax-aware comparison, hunk staging, a binary/hex viewer, or untracked previews above 2 MB. Tracked binary and rename/copy output remains Git-defined.
