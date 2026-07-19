# Milestone 181 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: replace Brunomnia's flat, single-selected Runner attempt detail with pinned iteration-grouped request cards, collapsed live progress, expanded finished/history evidence, and independent accessible card controls while preserving account-free local execution and bounded evidence.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/ui/components/panes/runner-live-progress-pane.tsx` groups live request cards by iteration, keys each card with `${item.key}-${isRunning}`, and passes `defaultExpanded={!isRunning}` so in-flight cards stay compact and remount expanded when execution finishes.
- Pinned `packages/insomnia/src/ui/components/panes/runner-test-result-pane.tsx` renders every saved request result as a card with `defaultExpanded`, rather than exposing one separately selected request detail.
- Pinned `packages/insomnia/src/ui/components/panes/request-result-card.tsx` offers Skip only for pending/running items and expansion only for completed/failed items. Expanded cards retain request identity, status, assertion rows, and request/response evidence.
- Brunomnia retains its bounded device-local request/response snapshots, aggregate header, history, console, and global assertion controls as compatible account-free adaptations; no source code, cloud entitlement, or account dependency is copied.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused card/assertion/Runner regressions | Pass — 3 files, 44 tests |
| Full Vitest suite | Pass — 71 files, 527 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 522 renderer modules; 171.50 kB stylesheet; 64.26 kB automation workbench; 71.61 kB interchange dialogs; 430.73 kB main renderer; 5,343,117-byte CLI bundle |
| Bundled CLI startup/help | Pass — unchanged collection, suite/API-spec, filter, trust, and reporter contracts present |
| Bundled Runner preview smoke | Pass — split-YAML input, selected order, data, delay, and assertion evidence |
| Bundled localhost CLI template smoke | Pass — denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- One reusable request-attempt card starts completed saved evidence expanded, starts live evidence collapsed with a test summary, and exposes Skip without an expansion affordance for running evidence that has no completed result.
- Completed/failed cards expose an independently labeled `aria-expanded` control. Expansion preserves PASS/FAIL/SKIP row filtering plus bounded request protocol/method/URL/header/body metadata and response status/header/body preview evidence.
- The workbench groups all visible live/latest/history items by first-seen iteration, keeps every attempt in source order, and keys cards with `${item.key}-${running}` so the live-to-finished state change remounts cards with the pinned default.
- The obsolete selected-result state, automatic first-result selection, row keyboard-selection path, duplicate response detail, and local summary/filter approximations are removed. Skip, aggregate counts, history, Console, exports, persistence, and direct response Tests remain unchanged.
- Assertion status/name controls continue to affect only assertion rows inside expanded cards. They never remove an iteration, request card, aggregate count, saved result, request/response snapshot, or console entry.
- The component introduces no network call, filesystem authority, account, subscription, telemetry, entitlement branch, or new persisted sensitive data.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M181 therefore makes no screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim beyond static-render regressions, strict compilation, full suites, real CLI/native loopback execution, and packaged-app verification.

## Acceptance boundary

Milestone 181 accepts pinned Runner request-card grouping, live/finished default expansion, independent completed/failed expansion, pending/running Skip gating, and inline assertion/request/response evidence across active, latest, and reopened historical results. Brunomnia's aggregate header, bounded snapshots, and one global assertion toolbar remain deliberate local adaptations rather than byte- or pixel-identical upstream UI. Exact probabilistic chardet identity, lower-level libcurl wire diagnostics, remaining Runner/result edge semantics, and broader Inso work remain. Collection runner stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 182.
