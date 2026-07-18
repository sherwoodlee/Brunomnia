# Milestone 71 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: turn common native Git push rejection evidence into stable, actionable workbench errors without retrying or changing local history.

The scope was reconciled against current Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75`. Its [Git service](https://github.com/Kong/insomnia/blob/5143b4103030f45293c67b96f4a780398c511d75/packages/insomnia/src/main/git-service.ts) handles non-fast-forward, authentication-required, tag-exists, HTTP, and generic push errors as distinct cases.

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
| Focused native divergent-push fixture | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 40 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and unsigned `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. Native lint/test/build gates use the independently warmed Cargo target. The Tauri bundle consumes the verified production renderer with only the mirror's duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full 41-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- A primary repository publishes an initial branch to a local bare remote.
- A second clone creates and pushes a newer remote commit without updating the primary's tracking ref.
- A distinct primary commit then receives a real non-fast-forward/fetch-first rejection from native Git.
- The error becomes stable pull-and-resolve guidance rather than raw version-dependent stderr.
- The rejected local commit remains the primary `HEAD` and status remains ready to push.
- Authentication/write/SSH/HTTP and repository-not-found patterns have distinct actionable categories.
- Unknown output remains bounded by the existing 2 MB native text limit.
- No shell, force operation, network service, or hosted account participates in the fixture.
- The workflow is neither account-gated nor subscription-gated.

## Manual/rendered QA

Rendered QA was not run because this task's standing direction prohibited the in-app Browser. Error placement, multiline wrapping, credential-helper retry flow, and responsive presentation are compile-, fixture-, style-, and bundle-verified only in this phase.

## Acceptance boundary

Text classification is best-effort across Git versions, locales, protocols, and hosting providers. Unrecognized failures retain bounded Git output. Brunomnia does not auto-pull, retry, rebase, force push, rewrite local commits, validate every provider policy, or expose a tag-push command.
