# Milestone 127 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: represent every target family in Insomnia's pinned HTTPSnippet registry with an account-free local selected client while preserving effective-request and exact-body behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference and resolves HTTPSnippet 3.0.10.
- HTTPSnippet's `targets` object and `availableTargets()` expose twenty families in this order: C, Clojure, Crystal, C#, Go, HTTP, Java, JavaScript, Kotlin, Node.js, Objective-C, OCaml, PHP, PowerShell, Python, R, Ruby, Rust, Shell, and Swift.
- The previously unrepresented functional defaults are C/libcurl, Clojure/clj_http, Crystal/native, Kotlin/okhttp, Objective-C/nsurlsession, OCaml/cohttp, PowerShell/webrequest, and R/httr.
- HTTP is a pinned package defect: its target declares default key `1.1`, registers only client key `http1.1`, and Insomnia's modal uses `target.clients.find(client => client.key === target.default)`. Brunomnia exposes the functional HTTP/1.1 client instead of reproducing an unusable selection.
- Insomnia's modal obtains the registry through main-process IPC and has no account, organization, plan, or entitlement condition. Brunomnia's expanded local target list retains that account-free boundary.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 59 files, 391 tests |
| Focused code-generation regressions | Pass — 1 file, 10 tests |
| New generated-language syntax smoke checks | Pass — C and Objective-C through Xcode Clang, raw HTTP through exact framing assertions; Clojure, Crystal, Kotlin, OCaml, PowerShell, and R runtimes are unavailable locally |
| Native test suite | Pass — 97 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 199 modules; 310.34 kB main, 192.35 kB React vendor, 66.74 kB interchange, and 23.49 kB lazy code-generation JavaScript with no warning |
| Bundled CLI build/startup | Pass — 532.7 kB CommonJS executable and help output |
| macOS Tauri debug `.app` bundle | Pass — app-only bundle, arm64 executable, and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- The selected-client list follows HTTPSnippet's exact twenty-family registry order while retaining Shell/cURL as the default selection.
- Every target receives the same custom method, resolved URL, effective headers, supported static authentication, MIME, text/form/GraphQL body, and warnings.
- C uses an explicit payload length with exact hexadecimal bytes; OCaml uses exact decimal byte escapes; the remaining new executable targets decode one shared Base64 payload.
- A body containing a newline, non-ASCII `π`, and a NUL byte preserves exact UTF-8 bytes across every executable target.
- Raw HTTP/1.1 uses CRLF, origin-form, calculated Host, and byte-counted Content-Length for text. Multipart/binary previews show exact Base64 and return a decode-before-send warning instead of pretending arbitrary octets fit a Unicode preview.
- Quotes, backslashes, interpolation markers, and non-ASCII bytes use target-specific literals; generated C and Objective-C fixtures pass Clang parsing.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes target-family coverage, not the full HTTPSnippet client matrix. Alternate clients, separate persisted target/client selection, runtime-only advanced signing, dependency installation, comprehensive language validation, and snippet execution remain open. Existing `Baseline` and `Early baseline` rows remain; Brunomnia is not declared feature-complete.
