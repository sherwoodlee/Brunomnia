# Milestone 68 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: validate configured Git remote access before creating a commit requested through commit-and-push, while preserving honest handling of later write-side failures.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [Git commits route](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/routes/git.commits.tsx) validates repository credentials before invoking its commit operation when push was requested.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 42 files, 253 tests |
| Vite production build | Pass — 170 modules; 498,565-byte main JavaScript chunk; 21,557-byte lazy Git-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native remote-access fixture | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 37 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 38-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- A configured local bare remote is resolved by exact remote name and queried through direct Git arguments.
- Successful validation against a local private-path remote leaves the local `HEAD` object identifier unchanged and the working/index status clean.
- An unknown remote name fails before `ls-remote` execution.
- Commit-and-push awaits validation before invoking the existing commit command.
- Ordinary commit remains local-only and does not perform a network preflight.
- A later push rejection still reports and preserves the newly created local commit.
- The native operation runs off the UI thread through the established blocking command boundary.
- The workflow is neither account-gated nor subscription-gated.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Credential-helper prompts, slow-network feedback, error placement, retry behavior, and responsive controls are compile-, fixture-, style-, and bundle-verified only in this phase.

## Acceptance boundary

`git ls-remote --heads` validates remote reachability and any access needed to list heads. A public remote may permit that query anonymously, so this baseline cannot prove the validity of a particular stored token; it also cannot prove write permission, fast-forward eligibility, branch-protection approval, remote availability after validation, or that another writer will not race the push. Those later failures leave the local commit intact and require retry or manual resolution. Brunomnia does not store provider credentials or add a hosted-account requirement.
