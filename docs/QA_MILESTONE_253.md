# Milestone 253 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: complete the account-free Konnect service integration by reconciling every pinned active region into credential-free managed local projects with exact API pagination/retry behavior, safe stale cleanup, progress/count evidence, and an opt-in live tenant fixture.

## Source and documentation audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia/src/konnect/api.ts` defines active regions `us`, `eu`, `au`, `in`, and `sg`; page-number control-plane pagination; offset Service/Route pagination; 30-second requests; five retries after `429`; and a five-service concurrency contract.
- Pinned `packages/insomnia/src/konnect/sync.ts` creates or updates one Project per control plane, one Environment workspace per project, one Collection workspace per Gateway Service, preserves failed-region projects, removes stale services/projects only when safe, reports created/updated/deleted/skipped totals plus progress/duration, and never pushes Gateway configuration.
- The complete Kong/developer.konghq.com Insomnia documentation tree at commit `73995e32ed758882a290c945807225d7442b483e` contains one service-integration page: `app/insomnia/konnect-integration.md`. No newly documented adapter exists beyond Konnect.
- Current documentation confirms the user-visible project/control-plane, Collection/Gateway-Service, pull-only Sync, local-route-preservation, and explicit skipped-route model implemented here.

## Implementation

- `konnect.ts` now derives the five standard regional origins, retains sanitized region/cluster/deployment metadata, uses exact `page[size]/page[number]` and `size/offset` pagination, rejects repeated offsets, applies bounded `Retry-After` or exponential `429` retry, and fetches Routes through five-Service batches.
- Resource reconciliation returns pinned-shaped control-plane/Service/request-route totals with created, updated, deleted, and skipped counts. Managed request signatures count only remote-owned fields so preserved local edits do not create false update evidence.
- `konnectCatalog.ts` uses a pure region/control-plane planner, reads catalog projects in bounded batches, creates one root Environment when missing, creates or updates one local project per control plane, and removes stale/duplicate managed projects only for regions whose complete pass succeeded. A control-plane failure marks the region skipped and preserves every existing project in that region; the pinned Singapore permission gap remains non-fatal.
- Browser and native catalogs expose inactive project creation. New managed projects are written authoritatively without switching the coordinator project or exposing it to a stale React autosave. The renderer invalidates pending autosaves, locks project switching for the mutation, verifies the coordinator remains active before and after writes, and refreshes sidebar entries only after completion.
- Workspace v44 stores bounded managed coordinator/control-plane/region/cluster/deployment metadata. Managed projects persist an empty token and disabled integration; only the coordinator keeps the protected PAT reference. Portable imports, encrypted/shared payloads, and manual project duplicates strip management ownership so untrusted data cannot claim automatic deletion authority.
- The Konnect workbench exposes **Sync all control planes**, live progress, duration, created/updated/deleted/skipped summaries, failed regions, and up to 100 skipped-route reasons while retaining selected-plane discovery/pull.
- `konnectLive.integration.test.ts` is gated by `BRUNOMNIA_KONNECT_LIVE=1`, `BRUNOMNIA_KONNECT_TOKEN`, and optional `BRUNOMNIA_KONNECT_REGION`. It reads a real tenant's control-plane and first Service/Route inventory without storing the raw token in project data. The fixture remains skipped by default because no credential is checked into the repository.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Konnect/catalog/security matrix | Passed: 5 TypeScript files and 76 tests covering regional pagination, bounded retry, pure stale-region planning, inactive browser creation, credential confinement, managed-project creation/update/deletion, progress/count formatting, coordinator race refusal, and metadata stripping |
| Native inactive-create regression | Passed: exact workspace-store test retains the active coordinator while creating/readback of the managed project succeeds |
| Strict TypeScript project check | Passed with no diagnostics |
| Full Vitest coverage | Passed outside the listener-restricted sandbox: 91 files passed and 2 opt-in/public files skipped; 651 tests passed and 4 remained skipped |
| Full native coverage | Passed outside the listener-restricted sandbox: 149 local tests passed and 4 public/live fixtures remained ignored by default |
| Packaged CLI physical-store smoke | Passed: native manifest detection, sibling record assembly, environment hierarchy, scripts, and data-URL execution |
| Existing packaged CLI smokes | Template and Runner smokes passed, including roots, scripts/plugins/config, cookies/chaining, environments, reports, proxy/TLS, workspace CA/client identity, Spectral, suite/collection selection, and assertion evidence |
| Non-root/no-network CLI container | Passed with exact version, read-only workspace, self-contained Spectral local-reference lint, standalone suite execution, and explicit-grant TypeScript config/plugin tags |
| Rust formatting, check, and all-target clippy | Passed with warnings denied |
| Production dependency audit | Passed: 0 npm production vulnerabilities |
| Clean TypeScript/Vite/CLI production build | Passed: 1,519 renderer modules; 186.06 kB CSS, 27.73 kB catalog chunk, 120.87 kB Integration workbench, 456.95 kB main renderer, 3,274.00 kB lazy Spectral chunk, and 23,404,003-byte CLI bundle; the established large lazy-chunk warning remains |
| Tauri debug macOS app bundle | Passed with `--bundles app`: 95,221,912-byte native binary in a 92,996 KiB `Brunomnia.app` filesystem allocation |
| Parity-row and changed-path checks | Passed: exactly 13 incomplete rows (12 `Baseline`, 1 `Early baseline`) and no whitespace errors |

The generated CLI SHA-256 is `a9a6a69011d4b454e4b3aff96099e5c088d56fbd364417be28b4cf31b24ee487`; the bundle changes because workspace migration advances to v44 even though Konnect catalog orchestration remains a desktop renderer capability.

The sandbox denies localhost/Unix listeners, Docker access, and advisory network requests. Full frontend/native suites, listener-backed CLI smokes, the container gate, and npm audit were rerun with only their required external authority rather than weakening application or fixture policy. Initial failures were exclusively the expected `EPERM`, Docker-socket, and DNS restrictions; every rerun passed.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. The new control and result summary are covered by source-backed React wiring, strict compilation, deterministic formatting/progress regressions, catalog race guards, production build, and packaged-app creation. No screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim is made.

## Remote gate

Main implementation commit `2ff722b0bf52a2a7437126a32671cd32439e3c61` completed verify and publish in [Actions run 29749054438](https://github.com/sherwoodlee/Brunomnia/actions/runs/29749054438). The verify job reproduced the committed CLI under Node 22, passed freshness, built the verification image, and passed ordinary plus extended non-root/no-network container smokes. The publish job emitted AMD64/ARM64 provenance/SBOM attestation manifests and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:fe7f7a8c4cf821a9068f375a3d40add55c50d16ef9cfbd41ecc9ed3ca3955d7c
```

Independent manifest inspection resolved AMD64 `sha256:89f61da8219901df11b64328a2350711a9ee8d7bdd5232541754378531e27439`, ARM64 `sha256:4c055cf025b48f18a775bcc0cac9b6a3bfbb36caccff17751e1a6ba984f3a42c`, and attached attestation manifests `sha256:36de9c336375a22d23fc6be7fe3f896bbee7e3662a9e53e62651b5a73f546fff` plus `sha256:11950e258a2524bdbd064b1774d9d34d77cfd9b0c9c7806086c64acf68e70e43`. Independent Cosign verification passed issuer `https://token.actions.githubusercontent.com`, exact identity `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, implementation SHA and digest claims, trusted certificate-chain validation, and offline transparency-log inclusion at Rekor index `2206533360`.

Both jobs and every required step completed successfully; no gate was skipped or weakened.

## Acceptance boundary

M253 closes automatic all-control-plane project/workspace reconciliation, live-tenant fixture availability, and the current-adapter audit. **Service integrations** is now `Complete`. Managed ownership is intentionally local-coordinator scoped instead of requiring a Brunomnia account or hosted organization. Exactly 13 parity rows remain incomplete, so Brunomnia is not feature-complete.
