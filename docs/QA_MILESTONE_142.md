# Milestone 142 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned-source-backed Konnect route/path/protocol folder hierarchy and path-based request naming with safe managed-folder reconciliation while retaining Brunomnia's local-work preservation policy.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/konnect/sync.ts` creates one route-level folder, adds HTTP subfolders when a route has multiple paths or protocols, and adds WS/gRPC subfolders only for multiple family protocols.
- HTTP methods share the same path/protocol subfolder. Multi-protocol subfolders use `PROTOCOL resolved-path`; single-protocol multi-path HTTP subfolders use only the resolved path.
- `packages/insomnia/src/konnect/transform.ts` separates the route display name from each request's path-based name and uses the raw regex when conversion falls back to one generic path placeholder.
- Pinned sync updates matching managed folder names, removes stale managed folders, and removes user-added resources. Brunomnia updates/removes only source-marked managed folders and deliberately retains user-created folders plus requests manually organized into them.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Konnect/storage/resource regressions | Pass — 3 files, 51 tests |
| Full Vitest suite | Pass — 62 files, 446 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 506 renderer modules; 7.64 kB lazy StreamConsole chunk; 345.21 kB main renderer; 5,281,322-byte CLI bundle |
| Bundled CLI startup/help | Pass |
| Bundled localhost CLI template smoke | Pass — denial, File grant, Node OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 105 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- A matrix with two HTTP protocols and paths, WS/WSS, and gRPC/GRPCS produces eleven source-backed folders and twelve native requests with exact parent relationships.
- Route names label top folders. Resolved paths label requests and path/protocol folders; protocol prefixes appear only under the pinned multi-protocol rules.
- Managed top-folder keys use the route ID; subfolder keys use route ID plus displayed folder name, matching pinned folder reuse when different raw regexes resolve identically. UTF-8 keys receive deterministic collision-free local IDs.
- Matching folders keep local expansion, headers, environment, auth, scripts, tests, documentation, and IDs while remote-controlled names and parents update.
- Removed routes and changed path/protocol combinations remove only stale managed folders. Local folders survive; a local child whose managed parent disappears is safely reparented to the collection root.
- Requests manually moved into local folders keep that placement. New, unorganized, and previously managed requests follow the regenerated hierarchy.
- Folder provenance survives bounded workspace migration, and existing collection environment/sub-environment/docs plus valid mixed-resource order remain intact.
- Malformed routes without identifiers are isolated with an explicit reason instead of sharing unstable request/folder keys.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. This milestone changes pure mapping, folder provenance persistence, existing integration copy, tests, and documentation; it makes no screenshot, DOM, console, keyboard-interaction, or visual-layout claim beyond strict compilation, focused data-model evidence, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 142 accepts pinned route hierarchy and request-name parity with a deliberate local-organization preservation extension. Automatic all-control-plane project/workspace reconciliation, reviewed expression-router conversion, and credentialed live-tenant evidence remain. Service integrations stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 143.
