# Milestone 91 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: keep OAuth 2 runtime credentials device-local across folder/Git and encrypted-sync workflows, reject incoming token injection, clear transient callback data, and recover rejected refresh grants.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` declares OAuth2Token `canSync=false` and stores access, refresh, identity, and expiry outside request auth configuration.
- Its token path treats HTTP 401 and OAuth `invalid_grant` refresh responses as unusable credentials and returns to fresh acquisition.
- Brunomnia retains runtime state in its local catalog document but now enforces the same observable non-shareable boundary for managed projects and encrypted sync without an account or hosted secret store.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 48 files, 304 tests |
| Focused OAuth/token/project/security suites | Pass — 5 files, 43 tests |
| Vite production build | Pass — 181 modules; OAuth 3.77 kB; Auth 12.13 kB; main JavaScript 496.29 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 66 tests, unchanged native tree after Milestone 88 validation |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Request- and folder-owned code, verifier, access, identity, refresh, and expiry fields are removed from shareable copies without mutating local state; OAuth client configuration remains.
- Split-YAML project writes receive scrubbed auth, while project reload restores matching local owner credentials over incoming configuration.
- Encrypted-sync payloads omit runtime fields; pull sanitizes incoming data before restoring matching local owners and preserving device-local state.
- New resources, changed auth types, and credentials supplied only by incoming project/sync data receive no local token.
- Publish-time plaintext policy evaluates the exact scrubbed project/sync payload, so local OAuth tokens do not leak or block safe publication.
- HTTP 401 and `invalid_grant` are typed token errors: interactive grants invoke fresh authorization and client/password grants retry cleanly without stale refresh state.
- Automatic code exchange uses the listener redirect only for the token call, restores configured redirect/state, and clears one-time code/verifier data; canceled Auth-editor flows restore their source snapshot.

## Manual/rendered QA

Rendered QA and live provider/project interaction were not run because this task's standing direction prohibits the in-app Browser and no provider credentials are stored in the repository. Serialization boundaries, resolver ordering, cancellation, type safety, bundle splitting, and app packaging are verified without rendered interaction in this phase.

## Acceptance boundary

Managed project and encrypted-sync OAuth runtime isolation is a complete baseline. Runtime credentials still live inside the encrypted/local catalog project document rather than a dedicated OS-keychain-wrapped token database. Explicit user-controlled full-workspace/interchange exports retain their prior credential behavior. Embedded-browser session controls and live cross-platform provider fixtures remain open.
