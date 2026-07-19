# Milestone 90 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: extend interactive OAuth 2 acquisition from direct requests to collection runs, runner/direct scripts, plugin network calls, and user-triggered project/integration HTTP operations through one cancellable resolver boundary.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` resolves OAuth credentials in the shared network path used by ordinary authenticated request execution rather than limiting authorization to the editor button.
- Brunomnia's shared HTTP path now asks its owning UI for interactive credentials only when noninteractive acquisition cannot satisfy the request; protected dispatch does not race ahead.
- The callback remains local, account-free, and entitlement-free. No hosted OAuth relay or provider credential is required.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 46 files, 295 tests |
| Focused HTTP/OAuth/runner suites | Pass — 3 files, 37 tests before the final resolver fixture; full suite includes 38 |
| Vite production build | Pass — 180 modules; dialog 1.06 kB; OAuth 3.20 kB; Auth 11.97 kB; Automation 50.94 kB; main JavaScript 495.10 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 66 tests, unchanged native tree after Milestone 88 validation |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- A protected send with no reusable credential waits for the supplied resolver, applies its token, reports the updated auth snapshot, and performs exactly one protected network request.
- Without a resolver, the same request fails before native/browser transport is invoked.
- Direct requests, direct scripts, plugin calls, project/integration operations, collection attempts, runner scripts, and runner plugin calls receive an owner-scoped resolver.
- Runner callbacks use current iteration variables, cookies, responses, preferences, vault values, and external-secret policy during code exchange.
- Acquired runner tokens persist through the existing request/closest-folder ownership boundary and remain available to later sequential attempts.
- Cancel run cancels the active native flow; request/project changes and component teardown retain their existing cancellation behavior.
- The shared waiting dialog exposes exact authorization/callback URLs and one explicit cancel action without adding main-bundle pressure.

## Manual/rendered QA

Rendered QA and live provider login were not run because this task's standing direction prohibits the in-app Browser and no provider credentials are stored in the repository. Resolver ordering, callback/token contracts, cancellation wiring, type safety, bundle splitting, and app packaging are verified without rendered interaction in this phase.

## Acceptance boundary

Interactive OAuth is a complete baseline across Brunomnia's user-triggered HTTP execution surfaces. Flows remain sequential and owner-scoped; Brunomnia does not pre-authorize a whole collection or open concurrent provider windows. Invalid-refresh reauthorization, separate unsynced/keychain-backed token storage, embedded-browser session controls, and live cross-platform provider fixtures remain open.
