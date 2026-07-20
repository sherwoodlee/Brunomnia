# Milestone 232 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: discover the effective MCP STDIO `PATH` from the user's login shell with bounded fallback behavior while preserving direct, ambient-isolated child execution and reviewed environment precedence.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `main/mcp/transport-stdio.ts` awaits `shellPath()`, falls back to Electron's current `process.env.PATH`, filters blank reviewed names, and spreads reviewed values after the default `PATH` before constructing `StdioClientTransport`.
- Pinned Insomnia declares `shell-path` 3.1.0; its package lock resolves `shell-env` 4.0.3 and `default-shell` 2.2.0. Windows returns `process.env`. Unix first uses the OS-account shell, then `$SHELL` or the platform default, runs `-ilc` with Oh My Zsh/tmux suppression variables, parses ANSI-stripped delimited `command env` output, tries `/bin/zsh` and `/bin/bash` after default-shell failure, and finally falls back to the app environment.
- The discovery shell is only an environment lookup. The SDK still starts the configured MCP executable directly with its argument array and explicit environment.

## Implementation

- Unix native spawn selects the OS-account shell before the pinned environment/platform fallback, invokes temporary login/interactive candidates with `-ilc`, sets the pinned update/tmux guards, and extracts only `PATH` from ANSI-stripped UUID-delimited `command env` output. A failed default shell proceeds through distinct `/bin/zsh` and `/bin/bash` candidates. Windows retains the app `PATH`, matching the pinned dependency.
- Discovery captures standard output in an anonymous temporary file, discards standard error, polls every 10 ms, limits output to 1 MB, and terminates after five seconds. Empty, malformed, oversized, timed-out, nonzero, or unstartable discovery falls back silently to the app `PATH`; an absent app path becomes an explicit empty `PATH` like pinned Insomnia.
- The MCP process still receives `env_clear()`, then the discovered/fallback `PATH`, then reviewed rendered rows. A reviewed `PATH` therefore wins, while unrelated application and discovery-shell variables never reach the server.
- Discovery runs only when a new native child must start. Existing project/client-scoped sessions retain their initialized process until explicit, configuration-triggered, fatal, or normal lifecycle replacement; Brunomnia never runs the MCP executable or its arguments through a shell.
- No shell startup output, parsed environment, path value, or discovery failure is written to MCP events, workspace state, or errors.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused native MCP STDIO suite | Passed: 10 tests, including account-shell precedence, ANSI/noisy login-shell parsing, alternate-shell/final/timeout fallback, bare-command lookup, reviewed `PATH` precedence, isolation, reuse, cancellation, and fatal recovery |
| Full Vitest suite | Passed: 80 files, 587 tests |
| Full native suite | Passed: 118 tests; 1 public-fixture test ignored |
| Packaged CLI template and runner smokes | Passed |
| Rust formatting, clippy, and check | Passed |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 73.02 kB Integration workbench, 434.07 kB main, 16,449,664-byte CLI |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

The full frontend/native suites and packaged CLI smokes ran with loopback access because their disposable MCP, HTTP, and protocol fixtures bind local sockets. This native-only milestone leaves the generated CLI byte-identical at SHA-256 `2ec54c299ee0b366e88d061454cd6745df3e425bfe787bb4b8938d002d671fe9`.

## Manual/rendered QA

No renderer behavior changes in M232. Deterministic Unix fixtures prove startup-noise isolation, login-shell extraction, bounded timeout fallback, bare executable lookup through the resolved path, reviewed override precedence, and unchanged direct-child execution without depending on personal shell configuration or external MCP credentials.

## Remote gate

Main commit `ac97e91e8433f0a545f74df227b785b8122d755f` completed verify and publish in [Actions run 29710856723](https://github.com/sherwoodlee/Brunomnia/actions/runs/29710856723). Node 22 rebuilt the generated CLI, passed the freshness and non-root no-network trust smoke, and published AMD64/ARM64 provenance/SBOM manifests at:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:18612b9893d12c03043dd1a22bb0813add99d676d1eaaced99b685b386a0b3da
```

Independent `cosign verify` passed issuer `https://token.actions.githubusercontent.com` and the exact `cli-container.yml@refs/heads/main` identity, validated the M232 commit and digest claims plus the trusted certificate chain, and found transparency-log entry `2204639763`.

## Acceptance boundary

M232 closes bounded login-shell `PATH` discovery and fallback parity for MCP STDIO process startup. Milestone 233 later closes first-class Insomnia v4/v5 MCP-resource import/export. Recursive/conditional schema forms, long-lived GET/POST SSE resumption/reconnect, elicitation and reviewed sampling UI, notification/server-request response UI, multiple authorization-server failover, DPoP, live third-party fixtures, and OS-keychain-wrapped runtime credentials remain. MCP clients and Import/export stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
