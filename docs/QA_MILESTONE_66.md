# Milestone 66 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add selected/all staging controls and a resilient commit-and-push path while preserving explicit Git, secret-policy, conflict, and network-failure boundaries.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [Git staging modal](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/ui/components/modals/git-staging-modal.tsx) exposes selected/all staging controls and separate **Commit** and **Commit and push** actions.

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
| Focused native bulk-stage fixture | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 35 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 36-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- One native call stages two independently modified tracked files, and the staged diff contains both new values.
- One native call unstages both files, leaves the index diff empty, and preserves both working-tree changes.
- Selected and all controls exclude conflicts and disable when their eligible set is empty.
- Selected staging and bulk staging both retain the plaintext-secret policy gate.
- Commit and commit-and-push share the same validated local commit path and optional author overrides.
- Commit-and-push refreshes the committed local status before attempting the configured remote.
- Push rejection is reported as a preserved local commit plus a failed push; no rollback or atomicity is claimed.
- The workflow is neither account-gated nor subscription-gated.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Button enablement, keyboard focus, responsive wrapping, commit feedback, and remote-failure presentation are compile-, fixture-, style-, and bundle-verified only in this phase.

## Acceptance boundary

Commit-and-push is sequential: the local commit succeeds before the network operation starts. Authentication, connectivity, remote policy, or non-fast-forward failures leave that commit available locally and require a later retry or manual resolution. Brunomnia does not expose hunk staging, amend/signing controls, force push, automatic push retry, or a rollback of a successfully created commit.
