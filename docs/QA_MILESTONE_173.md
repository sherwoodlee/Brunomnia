# Milestone 173 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: retain classified native failures that occur before an HTTP response in the ordinary Timeline, response history, activity history, and Runner Console while preserving transport policy, bounded evidence, secret redaction, and account-free local storage.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned ordinary HTTP execution retains libcurl debug entries on both successful and failed requests, and its Runner reads the same timeline stream when constructing Console output.
- Pinned debug capture filters SSL buffers, empty messages, and cookie-jar mutation text; outgoing body data uses the configured size threshold, incoming chunks become size-only text, and request failures remain visible without requiring a response object.
- Reqwest provides error classification, elapsed local timing, configured request evidence, and redirect attempts but not libcurl's complete pre-response debug callback stream. M173 stores only evidence the native boundary can support honestly.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused HTTP/timeline/Runner regressions | Pass — 3 files, 61 tests |
| Full Vitest suite | Pass — 68 files, 512 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 515 renderer modules; 167.31 kB stylesheet; 61.70 kB automation workbench; 71.61 kB interchange dialogs; 417.66 kB main renderer; 5,319,255-byte CLI bundle |
| Bundled CLI startup/help | Pass — unchanged collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled Runner preview smoke | Pass — split-YAML project input, selected request order, data, and delay |
| Bundled localhost CLI template smoke | Pass — denial, File grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- The Tauri command now serializes a stable native failure envelope containing message, classified kind, elapsed milliseconds, followed redirect evidence, and redirect-truncation state. Timeout, connect, redirect, decode, request-builder/status, generic transport, and explicit cancellation paths remain distinguishable.
- Client construction, ordinary sends, Digest/NTLM challenge sends, body decoding, and raw decode fallback attach the available elapsed and redirect trace without weakening timeout, TLS, proxy, client-identity, redirect, authentication, or cancellation policy.
- The shared frontend transport recognizes both object and serialized-object Tauri errors. It builds the same bounded prepared-request, configured-header, payload, and redirect timeline prefix as successful requests, then appends the classified transport failure.
- Direct failures become ordinary status-zero responses with exact UTF-8 error size, request URL, elapsed time, Timeline data, searchable activity rows, and retained response history under the configured finite/zero/unlimited and environment-filtered rules.
- Runner failures consume the structured duration and timeline instead of substituting wall-clock-only evidence. Existing 64 KiB per-attempt, 1 MiB per-report, and 1,000-entry limits still apply, and URL query secrets plus sensitive header values are redacted before report persistence.
- Success responses, browser-development failures, unknown legacy error shapes, response maps, plugins, cookies, scripts, and report schemas preserve their previous contracts.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M173 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed rendering, strict compilation, focused native/frontend loopbacks, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 173 accepts classified native failures before a response, elapsed/error/configured-request evidence, available redirect continuity, ordinary status-zero history, and bounded/redacted Runner Console reuse. Reqwest still does not expose byte-exact wire header casing/global order, transport-added framing, DNS/connect/TLS debug callbacks, compressed transfer-byte accounting, challenge-round headers, or a complete libcurl-equivalent pre-response stream, and those details are not claimed. UTF-32 and device-unsupported rare Runner data encodings, reopened-file re-decoding, remaining collection-run protocol semantics, and broader Inso work also remain. REST/HTTP execution and Collection runner stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 174.
