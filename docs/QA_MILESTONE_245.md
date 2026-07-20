# Milestone 245 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: add pinned-compatible built-in OAuth 2 browser authorization, arbitrary configured callback capture, reusable isolated sessions, explicit/restart clearing, and system-browser selection without claiming the remaining authentication row complete.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia/src/main/network/o-auth-2/get-token.ts` defaults authorization-code requests to the built-in window when `useDefaultBrowser` is false/unset, always uses that window for implicit grants, and reuses a persisted randomly named OAuth partition.
- Pinned `packages/insomnia/src/main/authorize-user-in-window.ts` recognizes success/failure through navigation, redirect, and failed-load events; applies authentication TLS validation and manual proxy settings; and prompts for client certificates. Pinned editor/general settings expose built-in/system choice, explicit session clear, and clear-on-restart.
- Tauri 2.11.5/Wry 0.55.1 provides navigation, completed-load, new-window, isolated data-directory/Apple data-store identifier, proxy, close-event, and forced-destroy surfaces. It does not expose Electron-equivalent certificate-verification or client-certificate-selection callbacks.

## Implementation

- Workspace v41 adds `useDefaultBrowser` with pinned false/unset built-in default and device-local `clearOAuth2SessionOnRestart`; migration bounds invalid values, and Insomnia v4/v5 auth interchange round-trips the browser choice.
- Authorization-code and implicit flows open a 960×720 OAuth-only Tauri window by default. Remote pages match no configured capability, and Tauri's remote-origin command guard denies custom commands.
- Redirect matching is structural across scheme, username/password, host, explicit port, path, and configured query pairs. It extracts query plus fragment code/access-token/ID-token/error values, requires the exact state, rejects lookalike paths, and returns the configured redirect rather than a response-bearing URL for code exchange.
- Navigation and completed-load callbacks capture redirects before provider pages need to load custom schemes. New-window requests are denied as separate privileged windows and navigated through the same isolated window, while callback-bearing popup URLs complete directly.
- One persisted UUID selects an OAuth-only desktop data directory plus Apple custom data-store identifier. Explicit clear and the first clear-on-restart configuration in each app process rotate the UUID; matching the pinned lifecycle, old partitions are no longer selected rather than being traversed or reused.
- The built-in window applies the authorization scheme's configured HTTP/SOCKS5 proxy unless the shared host/suffix/port/IP-CIDR No proxy matcher bypasses it. System-browser mode intentionally leaves app proxy configuration to the external browser.
- Readiness identifies built-in versus system mode. Explicit cancel, user close, duplicate flow IDs, failed popup navigation, and five-minute timeout settle only the matching flow and destroy its window. The existing loopback listener remains the authorization-code system-browser fallback.
- The Auth editor exposes **Use system browser** and **Clear OAuth 2 session**; Preferences exposes **Clear OAuth 2 session on restart**; shared direct/runner/test status surfaces describe the active browser mode.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused OAuth/storage/interchange/editor matrix | Passed: 5 files and 83 tests covering defaults, mode selection, IPC/proxy shape, callback application, token lifecycle, session clear, v41 migration, and v4/v5 round-trip |
| Focused native OAuth matrix | Passed: 8 tests covering custom HTTP/custom-scheme query/fragment extraction, structural lookalike rejection, state mismatch, non-loopback embedded acceptance, strict UUID parsing/atomic rotation, loopback capture, and cancellation |
| Full Vitest coverage | Passed outside the listener-restricted sandbox: 85 files and 618 tests; 1 public-matrix file and 3 tests remained skipped |
| Full native coverage | Covered all 141 local tests outside the listener-restricted sandbox across the full run plus the exact established login-shell timing rerun; 4 public/live fixtures remained ignored by default |
| Packaged CLI template and runner smokes | Passed, including file/root trust, retained test source, templates/scripts/plugins/config, selection/environments, Spectral refs/rulesets, reports, proxy/TLS, and assertion evidence |
| Non-root/no-network CLI container | Passed with exact version, read-only workspace, self-contained Spectral local-reference lint, suite execution, and explicit-grant TypeScript config/plugin tags |
| Rust formatting, check, and all-target clippy | Passed with warnings denied |
| Production dependency audit | Passed: 0 npm production vulnerabilities |
| Clean TypeScript/Vite/CLI production build | Passed: 1,515 modules; 181.90 kB CSS, 12.87 kB Auth editor, 18.64 kB Preferences, 440.84 kB main renderer, 3,274.00 kB lazy Spectral chunk, and 23,389,298-byte CLI bundle |
| Tauri debug macOS app bundle | Passed: 94,190,920-byte native binary in a 91,988 KiB `Brunomnia.app` filesystem allocation |
| Parity-row and changed-path checks | Passed: exactly 15 incomplete rows (14 `Baseline`, 1 `Early baseline`) and no whitespace errors outside the generated CLI artifact |

The generated CLI SHA-256 is `5ac96310ca6504b87cf4ab21a72b414ed0b5fdc27dd6c60a3c5b3fca3ab138de`.

The sandbox denies localhost listeners and Docker access. The exact frontend/native suites and CLI smokes were rerun outside it rather than weakening fixtures or production policy. The final native run also observed the established login-shell five-second fallback; its exact fixture passed on immediate rerun. No failure involved changed OAuth paths.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. No credentialed provider, screenshot, observed-click, popup-rendering, DOM, console, focus-navigation, screen-reader, or pixel-layout claim is made. Source-backed controls, strict TypeScript/React compilation, deterministic matcher/session/adapter regressions, the production renderer, and the macOS app bundle cover this milestone without credentials or user data.

## Remote gate

Remote workflow, multi-architecture GHCR, Cosign, and Rekor evidence will be appended after the implementation commit reaches `main`.

## Acceptance boundary

M245 closes custom-scheme/non-loopback callback capture plus built-in browser/session controls. Tauri/Wry does not expose pinned Insomnia's per-session insecure-TLS override or client-certificate picker, and no live cross-platform provider matrix is claimed. Request authentication remains `Baseline`; exactly 15 parity rows remain incomplete, so Brunomnia is not feature-complete.
