# Milestone 128 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: complete Insomnia's pinned HTTPSnippet target/client matrix and locally persisted two-level selection without weakening exact effective-request or payload behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference and resolves HTTPSnippet 3.0.10.
- HTTPSnippet registers thirty-nine clients across twenty ordered target families: 1 C, 1 Clojure, 1 Crystal, 2 C#, 1 Go, 1 HTTP, 4 Java, 4 JavaScript, 1 Kotlin, 5 Node.js, 1 Objective-C, 1 OCaml, 4 PHP, 2 PowerShell, 2 Python, 1 R, 2 Ruby, 1 Rust, 3 Shell, and 1 Swift client.
- `generate-code-modal.tsx` renders separate target and client dropdowns, changes a target to its declared default client, stores both selected objects in local storage, and initially falls back to Shell/cURL.
- The pinned HTTP metadata mismatch remains bounded: Brunomnia resolves the registered `http1.1` client instead of the nonexistent declared `1.1` key.
- RestSharp and Faraday explicitly refuse unsupported methods upstream. Brunomnia preserves that limitation as generated output plus a visible warning rather than silently changing the method or client.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 59 files, 393 tests |
| Focused code-generation regressions | Pass — 1 file, 12 tests |
| New alternate-client syntax smoke checks | Pass — seven JavaScript/Node files through Node, Python through `py_compile`, Ruby through `ruby -c`, and HTTPie/Wget through `bash -n`; C#, Java, PHP, PowerShell, and dependency runtimes are unavailable locally |
| Native test suite | Pass — 97 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 199 modules; 310.34 kB main, 192.35 kB React vendor, 66.74 kB interchange, and 36.38 kB lazy code-generation JavaScript with no warning |
| Bundled CLI build/startup | Pass — 532.7 kB CommonJS executable and help output |
| macOS Tauri debug `.app` bundle | Pass — app-only bundle, arm64 executable, and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- The typed registry reproduces all twenty family IDs, all thirty-nine client keys, package ordering, and declared defaults, with the HTTP mismatch repaired to its registered client.
- Missing/invalid saved values recover to the selected family's default or initial Shell/cURL; valid alternate choices resolve to the matching generator identity.
- Nineteen alternate emitters preserve effective methods, URLs, headers, static authentication, MIME, and body bytes alongside the existing clients.
- UTF-8 text containing a newline, `π`, and a NUL byte uses the same exact Base64 payload across every new executable alternate; multipart and standalone binary identity tests cover all thirty-nine clients.
- RestSharp and Faraday unsupported custom methods return named warnings and non-executing error snippets rather than misleading request code.
- Generated JavaScript, Node.js, Python, Ruby, HTTPie, and Wget fixtures pass every parser available for the added clients on this machine.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes the pinned target/client inventory and selection model. Per-client conversion options, runtime-only advanced signing, dependency installation, comprehensive target-language validation, and snippet execution remain open. Existing `Baseline` and `Early baseline` rows remain; Brunomnia is not declared feature-complete.
