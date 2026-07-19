# Milestone 172 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add duplicate-preserving native response-header evidence, followed redirect hops, effective URL, configured outgoing headers, and bounded Runner Console continuity while preserving existing redirect policy, response compatibility maps, secret redaction, and account-free local storage.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned ordinary HTTP execution enables libcurl raw headers specifically to preserve multiple `Set-Cookie` and duplicated response headers, while its debug callback records `HeaderIn`, `HeaderOut`, `DataOut`, and `Text` entries.
- Pinned debug capture filters SSL buffers, empty messages, and cookie-jar mutation text; outgoing body data uses the configured size threshold, incoming chunks become size-only text, and the Runner reads the same retained timeline stream.
- Reqwest exposes final duplicate header values, effective response URL, and structured redirect attempts, but not libcurl's byte-exact header casing/global wire order, transport-added request framing, DNS/connect/TLS debug callbacks, compressed wire-byte accounting, or pre-response failure stream. M172 records the available native evidence without relabeling it as a raw transcript.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused HTTP/timeline/Runner regressions | Pass — 3 files, 59 tests |
| Full Vitest suite | Pass — 68 files, 510 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 515 renderer modules; 167.31 kB stylesheet; 61.70 kB automation workbench; 71.61 kB interchange dialogs; 415.19 kB main renderer; 5,318,641-byte CLI bundle |
| Bundled CLI startup/help | Pass — unchanged collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled Runner preview smoke | Pass — split-YAML project input, selected request order, data, and delay |
| Bundled localhost CLI template smoke | Pass — denial, File grant, saved `insomnia.send()`, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 109 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Native HTTP responses return the existing flattened compatibility map plus a separate duplicate-preserving header-line sequence. Repeated response values remain individually visible instead of being recoverable only as one comma-joined value.
- A wrapper around the existing disabled/finite/unlimited reqwest redirect policy records only followed status/source/target attempts with elapsed time; it does not change the policy decision. Evidence is capped at 100 hops and adds an explicit truncation entry rather than silently implying completeness.
- Native responses expose the final effective URL. Primary, dependent, Runner, script, and plugin paths continue through the shared frontend transport, so saved response identity, cookie storage, and Console evidence use the actual final URL.
- Transport-only fields are converted into ordinary bounded timeline entries and removed before plugins/history persistence. Configured/calculated outgoing headers retain row order and duplicates; final response status/headers, redirect hops, effective URL, body-size summary, and negotiated protocol share the existing response timeline.
- Browser development receives the same configured-header/final-status timeline shape from the authority Fetch exposes, without claiming duplicate response values or redirect-chain details that the browser hides.
- Runner capture continues to apply 64 KiB per-attempt, 1 MiB per-report, and 1,000-entry limits. Focused evidence proves repeated `Set-Cookie` lines stay repeated while their values, Authorization, and redirect query tokens are redacted before report persistence.
- The ordinary Timeline tab, saved response history, active Runner Console, reopened historical Console, JSON report envelope, and existing text/TAP/JUnit reporters retain their previous account-free behavior.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M172 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed rendering, strict compilation, focused native/frontend loopbacks, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 172 accepts duplicate-preserving native final response values, configured duplicate outgoing rows, followed redirect/effective-URL evidence, explicit redirect-trace truncation, and bounded/redacted Runner Console continuity. Header names are normalized by reqwest and global `HeaderMap` order is not claimed as byte-exact wire order; transport-added Host/framing/compression headers, DNS/connect/TLS events, compressed transfer bytes, challenge-round headers, and failures before a response remain absent. UTF-32 and device-unsupported rare Runner data encodings, reopened-file re-decoding, remaining collection-run protocol semantics, and broader Inso work also remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 173.
