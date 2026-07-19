# Milestone 89 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: match the pinned Insomnia OAuth 2 token model and integrate expiry-aware acquisition/refresh into protected direct, runner, and secondary HTTP sends.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` stores access, refresh, and identity tokens with expiry; refreshes expired credentials; supports token-endpoint Origin; generates an OIDC nonce; maps ID-only implicit results into the request token; and treats `NO_PREFIX` specially.
- Its direct request path can initiate interactive authorization, while token calls use the separate authentication certificate-validation setting.
- Brunomnia implements those behaviors locally without account, relay-service, subscription, telemetry, or entitlement requirements. Its system-browser callback remains direct loopback rather than Insomnia's hosted encrypted relay.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 46 files, 294 tests |
| Focused OAuth/security/storage suites | Pass — 6 files, 70 tests |
| Vite production build | Pass — 179 modules; OAuth chunk 3.20 kB; auth chunk 11.97 kB; main JavaScript 495.46 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 66 tests, unchanged native tree after Milestone 88 validation |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Current non-expiring tokens avoid token traffic; expired tokens select refresh grants and preserve an omitted refresh token.
- Direct sends obtain client/password/code credentials noninteractively or launch system-browser authorization before protected traffic; cancellation and request switching stop the callback.
- Shared HTTP/GraphQL send paths renew noninteractive credentials and refuse missing interactive credentials instead of sending an unauthenticated request.
- Authorization callback plus token exchange retains exact code/redirect state, access, refresh, identity, type, and computed expiry metadata.
- ID-only implicit responses populate both identity and effective request tokens; combined response types retain both and include a generated nonce.
- Initial token calls carry configured Origin, refresh calls match upstream omission, and `NO_PREFIX` produces a raw Authorization value.
- Auth-tab refresh uses the refresh token rather than replaying a code; token clearing removes access, refresh, identity, and expiry state.
- Tokens acquired through inherited authentication persist to the nearest folder owner; request-owned and runner-renewed tokens retain their original ownership.
- Malformed expiry values normalize to non-expiring zero, while codes, PKCE verifiers, and identity tokens participate in plaintext-secret policy checks.

## Manual/rendered QA

Rendered QA and live provider login were not run because this task's standing direction prohibits the in-app Browser and no provider credentials are stored in the repository. Modal structure, callback/token orchestration, cancellation, type safety, runner integration, bundle splitting, and app packaging are verified without rendered interaction in this phase.

## Acceptance boundary

Direct-send OAuth acquisition and shared noninteractive renewal are complete baselines. A collection runner or secondary request that needs a new interactive login stops with an actionable error rather than opening a browser mid-run. Invalid-refresh recovery does not automatically restart authorization. Tokens remain project auth data instead of an OS-keychain-wrapped unsynced token store, and live cross-platform provider fixtures remain open.
