# Milestone 88 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: replace manual-only OAuth 2 authorization with a bounded Tauri system-browser callback flow for authorization-code and implicit grants while preserving browser/manual fallback behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes authorization-code and implicit OAuth 2 grants, default-browser authorization, PKCE, state, and access/refresh/identity token editing.
- Its implicit response choices are access token, ID token, or combined ID and access tokens; Brunomnia persists the same response-type values and callback outputs.
- Brunomnia uses the operating-system browser and a local listener instead of an embedded authorization WebView. No account, subscription, hosted callback, telemetry, or entitlement branch participates.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 46 files, 283 tests |
| Focused OAuth/auth/HTTP suites | Pass — 4 files, 23 tests |
| Vite production build | Pass — 179 modules; lazy auth chunk 13.78 kB; main JavaScript 490.67 kB with no warning |
| Bundled CLI build/startup | Pass |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Focused native OAuth callback suite | Pass — 3 tests |
| Native test suite | Pass — 66 tests with loopback fixtures outside the filesystem sandbox |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Missing state and enabled-but-empty PKCE verifiers use cryptographically random URL-safe values without mutating the source request during preparation.
- Authorization-code URLs force `response_type=code`; legacy implicit `code` values normalize to `token`; combined `id_token token` values survive Insomnia-compatible import/export.
- Native callbacks accept only bounded HTTP loopback hosts and the configured path, allocate or preserve ports, rewrite `redirect_uri`, validate state, and reject malformed input.
- Authorization codes use the listener's exact redirect URL for token exchange and retain access, refresh, identity, type, and expiry result metadata.
- Implicit browser fragments are converted locally into a second callback request, then access and identity tokens plus token type are retained.
- Provider errors, missing results, state mismatches, duplicate IDs, explicit cancellation, request-switch cleanup, and five-minute timeout behavior are bounded and actionable.
- The frontend receives exact ready URLs through a Tauri channel, exposes cancellation, and keeps copied-URL/manual fields for browser development or incompatible providers.

## Manual/rendered QA

Rendered QA and a live third-party OAuth provider were not run because this task's standing direction prohibits the in-app Browser and the repository intentionally carries no provider credentials. UI structure, native browser invocation, callback contracts, cancellation, type safety, bundle splitting, and app packaging are verified without rendered interaction in this phase.

## Acceptance boundary

System-browser loopback capture is a complete baseline for authorization-code and implicit grants. HTTPS, custom-scheme, and non-loopback automatic redirects remain manual; device authorization, dynamic client registration, embedded-browser/session controls, live provider fixtures, and cross-platform browser integration remain open.
