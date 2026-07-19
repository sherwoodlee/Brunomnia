# Milestone 129 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: reproduce pinned Insomnia's generated-code authentication materialization for OAuth 1, Hawk, and Atlassian ASAP while preserving authored Authorization precedence and correcting the parity ledger to user-visible behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `main/har.ts` renders the effective request, applies request-plugin hooks, normalizes GraphQL, and calls `exportHarWithRenderedRequest`. That function invokes `getAuthHeader` only when no authored Authorization header exists.
- `main/network/get-auth-header.ts` statically materializes API-key header/cookie, Basic, Bearer, OAuth 2, OAuth 1, Hawk, and Atlassian ASAP. IAM, Digest, NTLM, and Netrc are absent because they remain transport/challenge-managed.
- ASAP configures `tokenExpiryMs` to ten minutes and `tokenMaxAgeMs` to nine minutes. The generated JWT therefore uses a ten-minute expiry from issuance.
- `generate-code-modal.tsx` passes only HAR, target, and client to HTTPSnippet. It exposes no converter-option, dependency-installation, validation, or execution surface; those prior ledger items were removed as non-requirements.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 59 files, 396 tests |
| Focused code-generation regressions | Pass — 1 file, 15 tests |
| Native test suite | Pass — 97 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 199 modules; 310.35 kB main, 192.35 kB React vendor, 66.74 kB interchange, and 37.46 kB lazy code-generation JavaScript with no warning |
| Bundled CLI build/startup | Pass — 532.7 kB CommonJS executable and help output |
| macOS Tauri debug `.app` bundle | Pass — app-only bundle, arm64 executable, and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- OAuth 1 HMAC-SHA1 reproduces the canonical RFC fixture signature after URL/query/auth materialization.
- Hawk signs the exact prepared text body and Content-Type with fixed time/nonce evidence, including payload hash and MAC.
- Atlassian ASAP generates a PKCS#8 RS256 token with key ID, issuer, audience, subject, additional claims, fixed ID, and `exp = iat + 600`.
- Authored Authorization remains authoritative and removes the automatic-signing omission warning.
- OAuth 2 `NO_PREFIX` emits only the access token.
- Async preview completion is selection-safe, and signing failures become warnings rather than hidden or unhandled conversion failures.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes generated OAuth 1, Hawk, and ASAP materialization. Request-plugin hooks, cookie-jar inclusion, and Node native Content-Length injection remained open here and were closed by Milestone 130. Existing `Baseline` and `Early baseline` rows remain; Brunomnia is not declared feature-complete.
