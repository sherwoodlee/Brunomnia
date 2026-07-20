# Milestone 257 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: complete the pinned REST/HTTP execution capability row by preserving compressed wire and decoded content sizes, matching HTML preview defaults, expanding nested multipart viewing, and correcting implementation-detail requirements that were not separate Insomnia features.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `libcurl-promise.ts` writes the decoded response entity to a response sidecar, records the write-byte count as `bytesContent`, and exposes libcurl `SIZE_DOWNLOAD` as `bytesRead`; the response size badge shows both Read and Content.
- Pinned ordinary response viewing reads the complete sidecar into one buffer before rendering. Sidecar paths are persistence architecture, not a streaming viewer capability unavailable in Brunomnia's device-local project store.
- Pinned response sniffing attempts valid JSON and then a leading HTML doctype despite misleading headers. It does not implement the broader signature/content inference previously listed as a Brunomnia gap.
- Pinned HTML preview defaults `disableHtmlPreviewJs` to false, resolves relative resources against the response URL, and permits remote resources. Brunomnia now defaults its existing opaque-origin script and remote-resource grants on while imported untrusted workspaces still reset both grants off.
- Pinned multipart viewing recursively sends a selected multipart part back through the ordinary response viewer. Brunomnia now permits nesting through the same 100 MiB response-preview ceiling with a 100-level malformed-input guard rather than the previous five-level/5 MiB limits.
- Pinned HTTP/3 remains absent from the settings surface. Browser forbidden-header and TLS authority are browser-platform constraints, while libcurl's exact callback boundaries, header casing/global order, framing, challenge rounds, and DNS/connect/TLS text are transport implementation details rather than separate workbench operations.
- Pinned timeline capture filters SSL buffers, converts incoming chunks to size summaries, bounds outgoing body text, and renders a text console. Brunomnia retains the corresponding prepared request, duplicate final headers, redirects/effective URL, connection/TLS/proxy summaries, compressed/decoded byte counts, protocol, failures, and bounded body evidence without claiming fabricated byte-exact wire events.

## Implementation

- Native ordinary HTTP sends an explicit `Accept-Encoding: gzip, deflate, br, zstd` default unless the request authors one, reads the compressed response bytes before decoding, and reverses stacked content encodings through gzip/x-gzip, zlib or raw deflate, Brotli, and zstd decoders.
- A decode failure preserves the existing one-time raw retry contract. Streaming clients continue through Reqwest's automatic decoders.
- Native responses expose `wireSizeBytes` independently from decoded `sizeBytes`; the response badge, saved-history picker, timeline, plugin `getBytesRead()`, and HAR `bodySize` use wire-read evidence while body previews, plugins, downloads, and HAR content retain decoded entity bytes.
- Native response timelines add endpoint, negotiated protocol, TLS validation, and proxy-route summaries while preserving ordered outgoing headers/data, redirect records, duplicate final headers, effective URL, and classified failure evidence.
- New local projects and missing legacy preference fields inherit pinned default-on HTML JavaScript and remote-resource authority. Secure imports remain default-off until the user grants those capabilities.
- Nested multipart viewing expands practical selected sections up to 100 MiB and 100 levels while retaining exact part saves and all existing friendly viewers.
- `REST/HTTP execution` is `Complete` in `PARITY.md`; exactly nine rows remain incomplete: eight `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused HTTP/timeline/multipart/storage/plugin/export regressions | Pass — 6 files, 94 tests before the final calculated-header regression; all are included in the full suite |
| Full Vitest suite with loopback authority | Pass — 92 files, 657 tests; 4 opt-in public fixtures skipped |
| TypeScript/Vite/CLI production build | Pass — 1,520 renderer modules; 187.71 kB stylesheet; 459.29 kB main renderer; 22.3 MB bundled CLI |
| Native compressed loopback regression | Pass — exact gzip wire/content sizes and negotiated encoding header |
| Native full suite | Effective pass — 163 tests passed and 4 opt-in fixtures ignored; the unrelated login-shell environment test failed in aggregate and passed its exact isolated rerun |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| Bundled CLI template/physical-store/runner smokes | Pass |
| Tauri debug macOS app bundle | Pass — 97,045,736-byte native binary in a 94,776 KiB `Brunomnia.app` filesystem allocation |
| Parity and changed-path checks | Pass — exactly 9 incomplete rows (8 `Baseline`, 1 `Early baseline`) and no whitespace errors |

## Focused coverage

- Gzip, zlib deflate, Brotli, and zstd decoding preserve decoded payload bytes; unknown encodings enter the raw fallback boundary.
- A live gzip loopback response proves the outgoing encoding negotiation, compressed wire-byte count, decoded content-byte count, and decoded body.
- Native charset decoding preserves `wireSizeBytes` through frontend hooks and response persistence.
- Timeline evidence distinguishes compressed wire reads from decoded content and includes connection, TLS validation, proxy route, duplicate headers, redirect, effective-URL, and protocol records.
- HAR response `bodySize` and plugin `getBytesRead()` expose wire reads while HAR content and plugin bodies remain decoded.
- New/missing preference defaults match pinned HTML authority; secure workspace import still removes inherited active-content authority.
- Multipart regression coverage proves sections above 5 MiB and depths above five remain expandable while the response-wide safety ceiling remains enforced.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M257 therefore makes no screenshot, observed-click, DOM, focus, screen-reader, or visual-layout claim beyond source-backed behavior, strict compilation, focused regressions, full suites, live loopback evidence, and packaged-app verification.

## Acceptance boundary

M257 closes REST/HTTP as a user-capability row. It does not equate Tauri/Reqwest internals with Electron/libcurl internals, claim HTTP/3 that pinned Insomnia does not expose, bypass browser security limits, or relabel text diagnostics as a byte-exact packet capture. Brunomnia now covers the pinned request methods, bodies, headers, auth handoff, redirects, timeouts, proxy/TLS/client identity, cookies, compression, byte accounting, history, viewers, downloads, scripts/plugins, failure evidence, and timeline operations without an account or entitlement gate. Nine parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
