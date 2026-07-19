# Milestone 126 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: expand free local client-code generation toward Insomnia's pinned HTTPSnippet matrix by adding five target-family default clients without weakening effective-request, warning, or exact-body-byte behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/package.json` requests `httpsnippet` `^3.0.10`, and the root lockfile resolves exactly 3.0.10.
- `generate-code-modal.tsx` loads every `availableTargets()` entry, selects each target's declared default client, permits alternate client selection, stores the last target/client locally, exports the effective request to HAR, and uses shell/cURL as its initial fallback.
- `main/ipc/main.ts` constructs `HTTPSnippet` from that HAR and calls `convert(target, client)` in the main process. No account, organization, plan, or entitlement condition wraps the workflow.
- HTTPSnippet 3.0.10 exposes twenty target families. This milestone adds the declared defaults for Node.js/native, PHP/cURL, Ruby/native, Swift/nsurlsession, and Rust/reqwest, bringing Brunomnia to eleven represented families while keeping the remaining matrix gap explicit.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 59 files, 390 tests |
| Focused code-generation regressions | Pass — 1 file, 9 tests |
| Generated-language syntax smoke checks | Pass — Node `--check`, Ruby `-c`, Swift `swiftc -parse`, and Rust `rustfmt --check`; no PHP interpreter is installed |
| Native test suite | Pass — 97 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 199 modules; 310.34 kB main, 192.35 kB React vendor, 66.74 kB interchange, and 15.78 kB lazy code-generation JavaScript with no warning |
| Bundled CLI build/startup | Pass — 532.7 kB CommonJS executable and help output |
| macOS Tauri debug `.app` bundle | Pass — app-only bundle, arm64 executable, and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- The target list remains deterministic and now exposes eleven selected clients without changing the existing target identities.
- Node native HTTP, PHP cURL, Ruby `Net::HTTP`, Swift `URLSession`, and Rust Reqwest preserve arbitrary valid method tokens, resolved URLs, and generated headers.
- A text body containing a newline, non-ASCII `π`, and a NUL byte becomes the exact expected UTF-8 Base64 payload in every added emitter.
- Quotes and backslashes in header values use valid target-specific literals; Rust raw-string delimiter selection remains collision-safe.
- Exact multipart framing and standalone binary bytes continue to share one Base64 payload across every selected client, while malformed saved file data remains an explicit warning.
- Generated binary fixtures parse under the four available target-language tools. PHP output was inspected and is covered by exact escaping tests, but independent PHP syntax validation is not claimed on this machine.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone represents eleven of HTTPSnippet 3.0.10's twenty target families with one selected client each. Nine families, alternate clients, runtime-only advanced signing, dependency installation, comprehensive target-language validation, and snippet execution remain open. Existing `Baseline` and `Early baseline` rows remain; Brunomnia is not declared feature-complete.
