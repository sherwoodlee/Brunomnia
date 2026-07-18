# Milestone 32 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: a device-local maximum timeline chunk size plus persisted prepared-request and aggregate-response evidence.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`: the [settings defaults](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia-data/src/models/settings.ts) set `maxTimelineDataSizeKB` to 10, the [general settings UI](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/settings/general.tsx) exposes a nonnegative Max timeline chunk size field, and the [ordinary libcurl transport](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/network/libcurl-promise.ts) shows outgoing `DataOut` below the threshold, hides exact-limit/oversized chunks, treats zero as a 1 KiB fallback, and records response `DataIn` as a size-only summary. The [Event Stream curl transport](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/main/network/curl.ts) uses the same debug policy.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean non-incremental TypeScript typecheck | Pass |
| Vitest | Pass — 27 files, 158 tests |
| Vite production build | Pass — 156 modules; 486.94 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 482,444-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 24 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Every verification and packaging gate uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The sandbox result remains one test short of the full native suite: only the existing mock-server integration that opens a loopback listener is denied. No rendered-browser claim is made.

## Focused coverage

- New devices and imported workspaces default to 10 KiB; valid local values survive migration, negative values clamp to zero, and invalid values default safely.
- The pure evidence builder proves visible text below the limit, hidden data exactly at it, current-compatible zero-as-1-KiB behavior, and deterministic IEC size labels.
- Text/JSON and GraphQL use their prepared payload, URL-encoded evidence preserves repeated fields, binary content remains size-only, and multipart uses an explicitly approximate configured-part summary.
- Native and browser HTTP execution attach timeline evidence before response plugins, so plugins and saved history retain the transport record while body hooks may still modify preview content.
- Timelines retain resolved method/URL, outgoing evidence, response status/decoded size, timing, and negotiated native protocol where available.
- Legacy stored responses receive an empty timeline; valid imported timeline entries normalize names/timing and stay tied to response identity.
- Collection runs and script/plugin subrequests receive the same device preference; managed projects and encrypted sync continue to keep response evidence device-local.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The Preferences field and timeline inspector are compile-, unit-, and source-verified only in this phase.

## Acceptance boundary

This evidence accepts a useful timeline-size/evidence baseline. Brunomnia records one prepared outgoing payload and one decoded aggregate response summary because reqwest and Fetch do not expose libcurl debug callback boundaries. Raw transport-added headers, TLS/connect diagnostics, redirect hops, exact multipart wire framing, compressed wire-byte accounting, and Event Stream handshake timeline files remain open in [PARITY.md](PARITY.md).
