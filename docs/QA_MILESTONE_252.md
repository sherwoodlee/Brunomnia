# Milestone 252 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: replace aggregate active-project persistence with one bounded project manifest plus authoritative physical records for every visible Collection, Document, Mock Server, root Environment branch, and MCP Client without changing the assembled workspace API.

## Source and compatibility audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference established by Milestones 246–251.
- Pinned Insomnia parents separately typed `collection`, `design`, `mock-server`, `environment`, and `mcp` workspace records to a Project; duplication and move routes operate on those workspace identities rather than an aggregate multi-file project payload.
- Brunomnia retains one local project catalog entry and one assembled in-memory `Workspace`, but the active browser/native persistence boundary now matches the separately authoritative typed-file model. Project preferences, governance, plugins, AI/Konnect configuration, local evidence, and immutable project snapshots remain project-level data.
- The physical format is an internal local-store contract rather than a portable export format. Existing Brunomnia JSON, split folder/Git, encrypted-sync, Insomnia interchange, and snapshot formats remain compatible and continue to assemble through their existing adapters.

## Implementation

- `workspacePhysicalStore.ts` defines one shared versioned manifest/record format. The manifest contains only project-level shell data plus an ordered identity-bound record index. Each Collection, Mock Server, and MCP Client has one record; each Document record includes its generated Collection; each root Environment record includes its complete descendant branch; each record carries its file-owned cookies and certificates.
- Split and assembly reject duplicate manifest keys/IDs, payload/manifest identity mismatches, duplicate resource IDs, duplicate ordering indexes, missing/corrupt records, malformed environment branches, wrong generated-Collection ownership, and oversized record inventories. Assembled array order and the ordinary `Workspace` shape remain byte-for-byte stable for valid input.
- Browser catalogs write generation-specific local-storage records before the new manifest, rotate only a valid current manifest into backup, keep exact record generations through delete/restore, and remove only the selected project's referenced records during purge or Empty. Aggregate browser documents migrate on initialization/save without a workspace schema bump.
- Native app-data saves stage a complete sibling `.records` directory and manifest, rotate the prior valid pair into matching backup paths, roll back failed replacement, and reject non-regular/symlinked record stores and record files. Catalog rebuild, open/read/save/rename/create, backup recovery, snapshots, deletion, trash listing/restoration/purge/Empty, and runtime-credential wrapping all use transparent assembly. Aggregate primary, backup, legacy, and deleted-project copies migrate in place.
- One corrupt authoritative record invalidates only the current generation and exposes the last valid project backup as recoverable; restoration preserves the corrupt manifest/record generation in recovery instead of silently dropping the affected typed file.
- The packaged CLI detects a native physical manifest, accepts only `record-00000.json` sibling files in a regular non-symlink directory, enforces 20 MB per-record and 100 MB aggregate limits, assembles the ordinary workspace, and then enters the unchanged migration/runner path.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused physical-persistence matrix | Passed: 3 TypeScript files/48 tests plus 2 Rust modules/15 tests covering split/assembly, payload binding, browser migration/backup/trash cleanup, CLI filesystem confinement, native migration, credential wrapping, snapshots, record corruption fallback, and restore |
| Strict TypeScript project check | Passed with no diagnostics |
| Full Vitest coverage | Passed outside the listener-restricted sandbox: 90 files passed, 1 public-matrix file skipped; 644 tests passed and 3 remained skipped |
| Full native coverage | Passed outside the listener-restricted sandbox: 148 local tests passed and 4 public/live fixtures remained ignored by default |
| Packaged CLI physical-store smoke | Passed with the checked-in bundle: native manifest detection, sibling record assembly, environment hierarchy, scripts, and data-URL execution |
| Existing packaged CLI smokes | Template and Runner smokes passed, including trust grants, cookies/chaining, stored/file environments, config/plugins, reports, proxy/TLS, workspace CA/client identity, Spectral, suite/collection selection, and assertion evidence |
| Non-root/no-network CLI container | Passed with exact version, read-only workspace, self-contained Spectral local-reference lint, suite execution, and explicit-grant TypeScript config/plugin tags |
| Rust formatting, check, and all-target clippy | Passed with warnings denied |
| Production dependency audit | Passed: 0 npm production vulnerabilities |
| Clean TypeScript/Vite/CLI production build | Passed: 1,518 renderer modules; 186.06 kB CSS, 26.87 kB catalog chunk, 455.72 kB main renderer, 3,274.00 kB lazy Spectral chunk, and 23,402,557-byte CLI bundle; the established large lazy-chunk warning remains |
| Tauri debug macOS app bundle | Passed with `--bundles app`: 95,221,144-byte native binary in a 92,996 KiB `Brunomnia.app` filesystem allocation |
| Parity-row and changed-path checks | Passed: exactly 14 incomplete rows (13 `Baseline`, 1 `Early baseline`) and no whitespace errors |

The generated CLI SHA-256 is `a955d414aee3f200440dd22e3c14da7db759e723bfb2e37076af99d02b47d6ed`; the bundle changes because physical-store loading is part of the packaged headless entry point.

The sandbox denies localhost/Unix listeners, login-shell discovery, Docker access, and advisory network requests. Full frontend/native suites, listener-backed CLI smokes, the container gate, and npm audit were therefore rerun with only their required external authority rather than weakening production or fixture policy. No failure involved changed persistence behavior.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. This milestone changes transparent persistence and CLI loading rather than renderer controls; no screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim is made.

## Remote gate

Main implementation commit `6dd337f2714ae5271ea38694e5b6ab59a3d9bc22` completed verify and publish in [Actions run 29746480811](https://github.com/sherwoodlee/Brunomnia/actions/runs/29746480811). The verify job reproduced the committed CLI under Node 22, passed freshness, built the verification image, and passed ordinary plus extended non-root/no-network container smokes. The publish job emitted AMD64/ARM64 provenance/SBOM attestation manifests and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:b6e525daa21e2bfd0a7eefb5b6bf11cc22dcc5986bc7398412fcbfc89601413e
```

Independent manifest inspection resolved AMD64 `sha256:e611b7e6c7120379da4f8a003df8f68726fb7b640b1302f3e33d4229bace1013`, ARM64 `sha256:dec582517bf020a0bed5c2c1b4dec67eab3f8ad3bebca1059864945c51163947`, and attached attestation manifests `sha256:054ab93b880a2745a6b88a3cdfc7b6103447b36f7d15671f1a2f3090c5819dd4` plus `sha256:03685d9069e28300bcde9d91939a81c41e7959c39451156822ad5e43a861cecd`. Independent Cosign 3.1.2 verification passed issuer `https://token.actions.githubusercontent.com`, exact identity `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, implementation SHA and digest claims, trusted certificate-chain validation, and offline transparency-log inclusion at Rekor index `2206353920`.

Both jobs and every required step completed successfully. GitHub emitted only its informational Node 20 action-runtime deprecation annotation; the runner forced those pinned actions onto Node 24 and no gate was skipped or weakened.

## Acceptance boundary

M252 closes separate physical workspace records and therefore closes **Collections, requests, environments, and history**. Immutable snapshots intentionally remain self-contained aggregate recovery artifacts, and project-level preferences/policies remain in the bounded manifest. Cloud discovery and provider onboarding remain under **Local projects and persistence**; exactly 14 parity rows are incomplete, so Brunomnia is not feature-complete.
