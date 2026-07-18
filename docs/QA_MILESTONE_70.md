# Milestone 70 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: expose native Git push-readiness in every status result, identify unpublished branches, and disable standalone pushes that have no local branch tip to publish.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [Git service](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/main/git-service.ts) exposes a `canPush` loader and persists `hasUnpushedChanges` after repository, commit, branch, and push operations; its log remains a separate local 35-entry query.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 43 files, 257 tests |
| Vite production build | Pass — 171 modules; 498,565-byte main JavaScript chunk; 23,729-byte lazy Git-workbench chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 522,127-byte CommonJS executable; help command returned every command/reporter family |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native push-readiness fixture | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 39 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 40-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- A committed branch without any remote is not reported ready to push.
- Adding a remote without an upstream marks the committed branch ready and the UI presents it as unpublished.
- The initial `push -u` establishes the upstream and clears readiness when both tips match.
- One new local commit produces `ahead = 1` and restores readiness.
- A successful native push refreshes status and clears readiness again.
- Detached/unborn heads and missing exact configured remotes keep standalone Push disabled.
- Commit-and-push controls do not use the pre-commit readiness flag.
- Status computation and the full fixture use direct Git arguments with no shell or external network.
- The workflow is neither account-gated nor subscription-gated.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Unpublished copy, disabled-state contrast, keyboard focus, header wrapping, and responsive action layout are compile-, fixture-, style-, and bundle-verified only in this phase.

## Acceptance boundary

Readiness reflects local refs and the last-known upstream, not a live authorization or remote-state probe. A stale remote-tracking ref can make the indicator stale until fetch; push/preflight remains authoritative for connectivity, authentication, permissions, branch protection, and races. Brunomnia does not force push, poll in the background, or add provider/account requirements.
