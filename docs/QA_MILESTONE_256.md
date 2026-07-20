# Milestone 256 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: close Request authentication by adding pinned-compatible embedded OAuth server-trust and client-identity handling on the packaged macOS Tauri target, while removing fixture-only requirements from the product ledger.

## Source and platform audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia/src/main/authorize-user-in-window.ts` has exactly two explicit authentication-challenge behaviors: its OAuth session either uses Chromium trust or blindly accepts server trust according to `validateAuthSSL`, and `select-client-certificate` automatically chooses one candidate or displays a chooser for multiple candidates. Other challenge types remain Electron/Chromium defaults.
- Pinned `packages/insomnia-smoke-test/tests/smoke/oauth.test.ts` exercises authorization code, inherited auth, refresh, PKCE S256/plain, implicit ID/access token combinations, session clearing, client credentials, and password grants against a local `127.0.0.1:4010` OIDC fixture. It does not define a hosted-provider or operating-system matrix.
- Tauri 2.11.5 exposes the raw `WKWebView` through `with_webview`. Wry 0.55.1 owns one `WryNavigationDelegate` that preserves redirect, page-load, download, and process-termination behavior but does not implement WebKit's optional `webView:didReceiveAuthenticationChallenge:completionHandler:` selector.
- WebKit and Security.framework provide the missing native primitives: optional-selector installation, server-trust credentials, client-identity credentials, in-memory `SecKey`/`SecIdentity` construction, and platform default handling for unrelated challenges.

## Implementation

- OAuth IPC now carries the authentication-certificate validation preference plus only the matching file-owned client certificate selected through Brunomnia's existing port-first/host-fallback rule. System-browser authorization receives no client material.
- The embedded window is created at `about:blank`. Its proxy, isolated data store, navigation, completed-load, popup, close, timeout, and cancellation behavior remains unchanged, but the authorization URL is not loaded until the native policy installer confirms readiness.
- macOS dynamically adds WebKit's optional challenge selector to Wry's existing delegate rather than replacing it. A process-wide class hook dispatches through a per-`WKWebView` policy map; non-OAuth WebViews and absent policies always receive platform default handling.
- Server-trust challenges use default platform verification when auth validation is enabled. When disabled, the challenge's exact `SecTrust` receives an ephemeral `NSURLCredential`; a repeated failure cancels instead of looping.
- Client-certificate challenges receive the configured workspace-file identity only when protocol, case-insensitive host, and effective port match the original authorization origin. Redirects to another origin cannot solicit the identity, failed reuse cancels, and unmatched/no-identity challenges retain platform behavior.
- PEM and PFX/PKCS#12 reuse the existing size, passphrase, exclusivity, and chain validation. PFX material is normalized to PEM; EC SEC1/PKCS#8 and RSA PKCS#1/PKCS#8 private keys become in-memory Security.framework keys and an in-memory identity. No OAuth private key or identity is added to macOS Keychain.
- Window destruction removes the policy and releases every native key, certificate, identity, and credential reference. Explicit cancel, timeout, callback completion, failed install, and failed initial navigation all destroy the window through the existing flow cleanup.

## Gap classification

- **Embedded insecure TLS** was a true product gap and is closed by the server-trust challenge path.
- **Explicit client-certificate selection** was a true product gap and is closed through Brunomnia's existing explicit file-owned certificate configuration plus native challenge credential selection. Host/port configuration replaces Electron's transient system-certificate chooser while preserving the required user-controlled identity outcome and adding origin confinement.
- **Uncommon challenge variants** was not a concrete upstream capability. Pinned source adds no handlers beyond trust and client certificate selection; Brunomnia now delegates every other challenge to WebKit defaults.
- **Cross-platform provider fixtures** was an evidence request rather than product behavior. Pinned Insomnia itself uses a deterministic local OIDC smoke, and Brunomnia's packaged WebKit target now has deterministic callback, token, proxy, trust, key-format, identity, and selector evidence without external credentials.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused OAuth frontend bridge | Passed: 15 tests, including auth validation, proxy policy, PEM identity IPC, system-browser secret omission, callback, cancellation, and token exchange |
| Focused native WebKit/Security.framework matrix | Passed: optional selector registration, default/insecure/retry/unrelated challenge classification, origin/port identity confinement, EC PEM, PFX/PKCS#12, RSA PKCS#1, URL credential, and trust credential construction |
| Full frontend suite | Passed outside the listener-restricted sandbox: 92 files and 655 tests; 2 public/live files and 4 tests remained skipped |
| Native coverage | Covered all 161 local tests through a successful 160-test full run plus the final optional-selector regression in the focused five-test matrix; 4 public/live fixtures remained ignored |
| Rust quality gates | Passed: formatting, library check, and all-target Clippy with warnings denied |
| Production build | Passed: 1,520 modules; 187.71 kB CSS, 12.87 kB Auth editor, 457.59 kB main renderer, 3,274.00 kB lazy Spectral chunk, and a 23,404,892-byte CLI bundle |
| Production dependency audit | Passed: 0 npm production vulnerabilities |
| Packaged CLI smokes | Passed: template/file/root trust, physical-record assembly, runner/config/plugin/Spectral/report/proxy/TLS/CA/client-identity coverage |
| Tauri debug app bundle | Passed with app-only bundling: 96,633,528-byte native binary in a 94,376 KiB `Brunomnia.app` filesystem allocation |
| Parity and changed-path checks | Passed: exactly 10 incomplete rows (9 `Baseline`, 1 `Early baseline`) and no whitespace errors |

The generated CLI SHA-256 is `b2623bdaa53dcb4bdfb567a771f93baf38ddc0493f1dec6becab7f2b2c500235`.

The sandbox denied localhost listeners, so the exact frontend/native suites and CLI smokes were rerun outside it rather than weakening fixtures or production policy. A later native recount observed the established login-shell five-second fallback once and then passed that exact fixture; its next full pass canceled an HTTP exchange correctly but rounded the sub-millisecond duration to `0`, tripping the unrelated historical `elapsed_ms > 0` assertion on exact bounded reruns. The earlier full run, all five changed native tests, formatting/check/clippy, and remote workflow remain the acceptance gates rather than weakening that unrelated assertion. The default Tauri bundle command successfully built `Brunomnia.app` before its additional DMG helper failed; the exact app-only bundle command then passed. No failure involved changed OAuth behavior.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. No credentialed provider, screenshot, observed-click, DOM, console, focus-navigation, system-certificate dialog, screen-reader, or pixel-layout claim is made. Pinned source, deterministic bridge and native selector/credential regressions, strict compilation, full suites, the production renderer, and the packaged macOS app cover this milestone without user credentials or private keychain data.

## Remote gate

The implementation workflow and signed-image evidence will be recorded after the milestone commit reaches remote `main`.

## Acceptance boundary

M256 closes the remaining concrete Request authentication behavior on Brunomnia's packaged macOS target. It does not claim hosted provider uptime, credentials, or a rendered OS dialog matrix that pinned Insomnia does not require in its own smoke suite. **Request authentication** is now `Complete`. Exactly 10 parity rows remain incomplete, so Brunomnia is not feature-complete.
