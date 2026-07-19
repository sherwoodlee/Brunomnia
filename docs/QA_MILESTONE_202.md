# Milestone 202 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: complete pinned Inso `run collection --item <folder-id>` target expansion by recursively selecting descendant requests in collection tree order before request-name filtering and execution.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` separates supplied item IDs into direct Request and RequestGroup matches, recursively discovers child RequestGroup IDs, and includes every Request whose parent belongs to that closure.
- A single pinned folder item then sorts requests by ancestor and request `metaSortKey` values so the execution plan follows the nested collection tree. Multiple pinned items prioritize explicitly named request IDs and leave folder-expanded requests in stable database order.
- Brunomnia expands each folder at its argument position in the normalized mixed `resourceOrder`, preserving stronger deterministic mixed folder/request item order while including the same recursive target set. Repeated descendants execute once.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused folder-item regressions | Pass — 1 file, 6 tests |
| Full Vitest suite | Pass — 77 files, 559 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 528 renderer modules; 175.18 kB stylesheet; 71.41 kB automation workbench; 71.61 kB interchange dialogs; 433.88 kB main renderer; 5,348,734-byte CLI bundle |
| Bundled CLI startup/help | Pass — pinned repeatable item option remains documented |
| Bundled Runner preview folder-item smoke | Pass — nested folder expansion, selected order, two data iterations, exact URLs, filtering, overrides, delay, bail, and assertions |
| Bundled localhost CLI template smoke | Pass — denial, file grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 110 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — rebuilt arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Root and nested folders expand direct and transitive requests in mixed resource-tree order.
- A folder followed by a direct root request retains item order; selecting an already-expanded request again does not duplicate execution.
- Empty folders resolve to no requests, unknown items fail visibly before transport, and malformed parent cycles terminate through a visited-folder bound.
- Existing exact request IDs and unambiguous request names remain accepted through `--item` and the legacy `--request` alias.
- The packaged split-YAML fixture selects a parent folder plus a root request, filters out the folder's direct request by name, and proves its nested request still executes first across two exact CSV iterations.
- No report schema, persisted project, renderer, script, file, network, vault, TLS, cloud, account, subscription, telemetry, entitlement, or plugin authority changes.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 202 accepts pinned recursive folder-item collection targeting with deterministic mixed-item ordering. Interactive prompts, plugin tags, desktop local-vault access, remaining Inso commands/flags/configuration discovery, TLS exceptions/material, stronger portable script isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 203.
