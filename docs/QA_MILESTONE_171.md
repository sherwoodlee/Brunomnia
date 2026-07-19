# Milestone 171 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned-shaped Runner CLI command preview, exact selected-request/delay CLI execution, complete local-project path resolution, and split-YAML project input while preserving account-free local operation and the CLI's explicit trust boundary.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `cli-preview-modal.tsx` generates `inso run collection` from the current workspace, selected request IDs/order or folder target, active environment, iterations, delay, data-file path, and bail state, then exposes a copy action.
- Brunomnia's Runner already retained those execution controls per document, but its CLI did not accept an ordered request subset or request delay and its browser file model did not expose durable paths.
- Brunomnia preserves its stronger trust boundary: generated commands do not silently grant script, file, script-network, template-file, or external-vault authority.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused runner/CLI regressions | Pass — 2 files, 35 tests |
| Full Vitest suite | Pass — 68 files, 509 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 515 renderer modules; 167.31 kB stylesheet; 61.70 kB automation workbench; 71.61 kB interchange dialogs; 413.97 kB main renderer; 5,318,641-byte CLI bundle |
| Bundled CLI startup/help | Pass — JSON/split-project input, environment, ordered request, iterations, retries, delay, data, bail, trust, and reporter contracts present |
| Bundled Runner preview smoke | Pass — split-YAML project input executed third/first request order for two data iterations with a real bounded inter-request delay |
| Bundled localhost CLI template smoke | Pass — denial, File grant, saved `insomnia.send()`, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 108 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- A side-effect-free generator emits one POSIX-shell-safe command from the current collection/environment IDs, exact selected request order, bounded iterations/retries/delay, optional data path, and bail state. Empty/default controls are omitted without broadening the request plan.
- Repeated `--request`/`-i` selectors resolve exact IDs or unambiguous names and feed the shared runner's ordered `requestIds`; missing and duplicate-name selectors fail before transport. `--delay-request`/`--delay` uses the desktop runner's shared 0–30,000 ms delay path.
- `--env`/`-e`, `--iterations`/`-n`, and `--data`/`-d` are accepted consistently. The reusable localhost smoke proves split-project loading, exact request omission/order, data-driven iteration count, and elapsed request delay through the bundled artifact.
- The CLI accepts full Brunomnia JSON or a folder/Git project containing `.brunomnia/project.yaml` plus managed collection/environment/design/mock/MCP YAML directories. Missing optional directories remain empty; malformed metadata remains a visible failure.
- The native host returns only a canonical, validated saved project JSON path confined to the application project store. The Tauri dialog prefers this complete local snapshot, while connected split-project paths remain valid editable alternatives.
- Browser-local workspaces and browser-selected data files do not gain fabricated path authority. The dialog displays required editable placeholders, explains full-JSON export and decoded UTF-8 data-save steps, and disables copying until every required path exists.
- The preview exposes request/iteration/delay/bail evidence, Escape/backdrop/close dismissal, clipboard success/error state, and an explicit trust-grant notice without adding any account, plan, or upgrade gate.

## Manual/rendered QA

The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction. No alternate browser surface or policy workaround was attempted. M171 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed controls, strict compilation, focused command/CLI/native evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 171 accepts pinned-shaped Run via CLI preview, shell-safe command construction, complete native local-workspace paths, honest browser/data path handling, exact ordered request selectors, shared request delay, and connected split-YAML collection execution. The preview targets POSIX shells rather than PowerShell/cmd, requires explicit data-file persistence, and deliberately leaves trust grants manual. UTF-32 and device-unsupported rare data encodings, re-decoding a reopened file without re-selection, transport-native duplicate raw header order and libcurl-style redirect/network diagnostics, remaining collection-run protocol semantics, and broader Inso work remain. Collection runner and Headless CLI stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 172.
