# Milestone 28 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: transparent native gzip, Brotli, deflate, and zstd response negotiation/decoding plus a decode-error-only raw retry boundary.

The scope was reconciled against the [current upstream Insomnia transport](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/network/libcurl-promise.ts) at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`, which enables libcurl response decompression and retries without it only for a bad content encoding. [Reqwest's documented codec features](https://docs.rs/reqwest/0.12.28/reqwest/struct.ClientBuilder.html) provide the corresponding native negotiation, header cleanup, and decoded-body behavior.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 24 files, 142 tests |
| Vite production build | Pass — 153 modules; 479.14 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 482,277-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 23 tests passed; the unchanged loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

The four codec features and seven newly required locked packages were resolved from crates.io, then every verification and packaging gate used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result remains 23/24: only the existing mock-server integration that opens a loopback listener was denied. No live compressed-response fixture or 24/24 claim is made.

## Focused coverage

- `gzip`, `brotli`, `deflate`, and `zstd` are explicit reqwest features rather than accidental transitive capabilities.
- Decoder-enabled clients remain the shared default for finite HTTP and long-running SSE execution under every preferred HTTP version mode.
- Reqwest supplies `Accept-Encoding` only when the request does not already control encoding or byte ranges, and removes stale `Content-Encoding`/`Content-Length` after decoding.
- A finite response retries once with all four decoders disabled only when reqwest classifies the body error as a decode error.
- The retry retains URL, method, body, headers, authentication, transport policy, timeout, proxy, certificate, and preferred-version configuration.
- A fallback response is timed from the original attempt and reports the raw body exposed to the renderer; unrelated errors return without replay.
- Both automatic and disabled-decompression client builders compile and build under the native test matrix.

## Manual/rendered QA

No rendered UI changed in this milestone. Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser.

## Acceptance boundary

This evidence accepts a transparent native response-compression baseline. The environment cannot bind deterministic compressed HTTP peers, so gzip/Brotli/deflate/zstd wire decoding and bad-encoding replay are source/build-verified rather than live integration-tested. Raw/decoded response toggles, compressed wire-byte evidence, invalidly encoded SSE fallback, and broader client-network diagnostics remain open in [PARITY.md](PARITY.md).
