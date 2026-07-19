# Milestone 152 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: preserve arbitrary mixed request/folder sibling order through Brunomnia's supported hierarchical Insomnia v4 and v5 import/export adapters, including nested folders and legacy fallback behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Ordinary HTTP, WebSocket, Socket.IO, gRPC, and request-group models carry numeric `metaSortKey` values used by sibling move services.
- `mapMeta` and `mapGroupMeta` write `metaSortKey` to v5 `meta.sortKey`; the v5 parser admits optional numeric sort keys for both requests and groups.
- The v5 importer restores each request/group `meta.sortKey` to `metaSortKey`, so hierarchical YAML can preserve mixed sibling order independently from model type.
- Legacy v4 resources already serialize the model-level `metaSortKey`; side resources such as Socket.IO payloads and proto files/directories are not collection-tree siblings.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused interchange/resource regressions | Pass — 3 files, 40 tests |
| Full Vitest suite | Pass — 65 files, 462 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 509 renderer modules; 67.74 kB lazy InterchangeDialogs chunk; 364.73 kB main renderer; 5,283,187-byte CLI bundle |
| Bundled CLI startup/help | Pass |
| Bundled localhost CLI template smoke | Pass — denial, File grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 105 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- V4 export traverses root and nested siblings in current mixed order, writes one sibling-local `metaSortKey` per request/folder, and keeps Socket.IO payload/proto support intact.
- V4 import rebuilds depth-first `resourceOrder` from complete finite sibling keys; incomplete legacy siblings retain their source resource-array order.
- V5 export emits nested arrays in `resourceOrder` and writes the same sibling-local position to every request/folder `meta.sortKey`.
- V5 import sorts only when every sibling has a finite declared key; malformed or partially keyed arrays retain source order rather than mixing incomparable fallback values.
- One round-trip fixture proves request → folder → request at the root, request → nested folder inside that folder, and a request inside the nested folder for both formats.
- The same fixture asserts raw v4 and v5 sort metadata, not only Brunomnia's re-imported projection.
- A shared helper regression proves nested folder IDs cannot be misclassified as blank root requests.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. This milestone changes interchange serialization/parsing and one pure resource-order helper; it makes no screenshot, DOM, console, drag, keyboard, focus, accessibility, or visual-layout claim beyond source semantics, deterministic artifacts, strict compilation, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 152 accepts arbitrary mixed nested sibling order for supported Insomnia v4/v5 compatibility imports and exports. It does not claim flat HAR, raw OpenAPI, or unimplemented export formats can represent Brunomnia's hierarchy, and it does not remove existing downgrade warnings for unsupported data. Import and export formats stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 153.
