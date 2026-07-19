# Milestone 210 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: implement pinned Inso collection/test HTTP and HTTPS proxy overrides, no-proxy bypass, run-wide certificate-validation disablement, and request-scoped custom CA plus PEM/PFX client identity for the portable CLI.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` initializes proxy defaults from upper/lowercase `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY`, exposes `--httpProxy`, `--httpsProxy`, `--noProxy`, and `--disableCertValidation` for collection/test runs, adds test short `-k`, and passes those settings into the Node request runtime.
- Brunomnia uses pinned Undici 8.7.0 request dispatchers rather than process-global TLS mutation. Explicit flags override matching ambient variables; rendered request Custom/Direct proxy policy remains authoritative, and no-proxy supports exact/suffix/port entries through Undici's bounded parser.
- `--disableCertValidation`/`-k` forces target-server validation off even when a saved request says Always, but does not weaken HTTPS-proxy validation. Otherwise rendered Never/Always applies. Matching custom CA roots extend Node roots and matching PEM or PFX/PKCS#12 identity material attaches only to that dispatcher.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused transport-option regressions | Passed: 1 file, 12 tests |
| Full Vitest suite | Passed: 77 files, 565 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 6,435,412-byte CLI |
| Bundled CLI startup/help | Passed: proxy/no-proxy, validation, data-folder, and existing commands are present |
| Bundled Runner proxy/TLS smoke | Passed: HTTP proxy/bypass, HTTPS CONNECT, validation failure/override, CA, PEM mTLS, PKCS#12 mTLS, and HTTP 200 evidence |
| Bundled localhost CLI file-boundary smoke | Passed |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Passed |

## Focused coverage

- Positional extraction skips every proxy value and certificate-validation boolean while preserving run identifiers.
- A local HTTP proxy receives absolute-form traffic under `--httpProxy`; exact `--noProxy 127.0.0.1` bypasses it and reaches the target directly. A rendered request Custom proxy works without a global flag, while Direct bypasses an explicit global proxy.
- A local HTTPS target with the checked-in test certificate fails under normal validation, succeeds under long `--disableCertValidation`, and succeeds through an HTTP CONNECT proxy under short `-k` plus `--httpsProxy`.
- The same trusted HTTPS fixture succeeds with the checked-in workspace CA and required client certificate, first through PEM certificate/key material and then through the modern encrypted PKCS#12 fixture with its passphrase. The server records authorized mutual-TLS sessions.
- Primary, dependent, suite-saved, and arbitrary granted script sends share the same execute path; dispatchers close after each response or failure, and no process-global proxy/TLS state changes.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 210 closes the named pinned proxy/TLS override gap without weakening global Node state. Interactive prompts, executable JS/TS configs, plugin tags, desktop local-vault access, remaining Inso commands/flags and report-data options, uncommon proxy/TLS edge semantics, process-level JavaScript sandboxing, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 211.
