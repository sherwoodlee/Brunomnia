# Milestone 151 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: remove byte-exact wire diagnostic export as a false parity requirement, preserve Brunomnia's account-free transcript/HAR extensions, and keep the real pinned timeline evidence gap under REST/HTTP execution.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `response-debug-modal.tsx` loads `services.helpers.getResponseTimeline` and renders `ResponseTimelineViewer`; there is no diagnostic export action or byte-oriented artifact contract.
- `response-timeline-viewer.tsx` converts timeline values to prefixed text lines in a read-only editor: `<`/`>` for headers, `|` for data, `*` for text, and doubled angle markers for SSL categories.
- The current and legacy libcurl debug callbacks explicitly discard `SslDataIn`, `SslDataOut`, empty buffers, and cookie-jar addition text. Small outgoing data is converted with `buffer.toString('utf8')`, data at or above the configured limit is replaced with a hidden-size message, and every incoming body chunk is replaced with `Received … chunk`.
- `getResponseTimeline(response, true)` optionally appends the separately stored response body after converting its file bytes to UTF-8 text. It does not recover compressed transfer bytes or exact binary wire data.

## Verification gates

| Gate | Result |
| --- | --- |
| Pinned debug-modal source scan | Pass — read-only timeline viewer, no export action |
| Pinned current/legacy libcurl callback scan | Pass — SSL filtering, bounded UTF-8 outgoing data, summarized incoming chunks |
| Pinned timeline loader scan | Pass — optional body file is UTF-8 text, not wire reconstruction |
| Brunomnia product-code delta | Pass — no product source changed |
| Full Vitest suite | Pass — unchanged M150 product tree, 65 files and 461 tests |
| Production build | Pass — unchanged M150 product tree, 509 renderer modules and 5,283,187-byte CLI bundle |
| Native test suite | Pass — unchanged M150 native tree, 105 tests and 1 opt-in public fixture ignored |
| Production dependency audit | Pass — unchanged M150 lockfile, 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — unchanged arm64 `dev.brunomnia.desktop` M150 artifact |
| Changed-path whitespace checks | Pass |

## Ledger correction

- Collections no longer carries a nonexistent byte-exact diagnostic export requirement. Its `Baseline` status remains justified by broader folder/environment/mock/spec/runner document tabs, final-tab dashboard navigation, and close-all/close-others actions.
- REST/HTTP execution continues to name the real difference: Brunomnia persists prepared-request and aggregate-response evidence but not libcurl-style HeaderIn/HeaderOut/Text records with duplicate raw header order and redirect/network text.
- Brunomnia's **Export debug** deterministic response transcript and **Export HAR** remain free extensions. They do not claim to reconstruct transport evidence that neither Brunomnia nor pinned Insomnia retained byte-exactly.
- Historical M144–M149 boundaries now use the corrected richer header/text timeline wording rather than repeating the false export requirement.

## Manual/rendered QA

No rendered QA was run because this task's standing direction prohibits the in-app Browser. M151 changes documentation and the authoritative parity interpretation only; it makes no product interaction, screenshot, DOM, console, focus, accessibility, or visual-layout claim.

## Acceptance boundary

Milestone 151 removes only the false byte-exact wire diagnostic export gap. It does not claim Brunomnia already has pinned libcurl-style raw header and redirect/network timeline text, and it does not remove the remaining REST/HTTP execution gap. Collections remains `Baseline` for the named broader tab differences; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 152.
