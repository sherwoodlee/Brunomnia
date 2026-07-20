# Milestone 246 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: expose Insomnia's five typed project-file scopes in the local project manager and add same/cross-project duplication with fresh nested identities, without claiming the separate true-move gap complete.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia-data/src/models/project.ts` models a project as the parent container, while `packages/insomnia-data/src/models/workspace.ts` defines `collection`, `design`, `mock-server`, `environment`, and `mcp` scopes.
- Pinned `packages/insomnia/src/ui/components/modals/workspace-duplicate-modal.tsx` selects a destination organization/project and new name. Its route exports the selected workspace through Insomnia v5, imports it with new identities, and navigates to the duplicate.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.move-workspace.tsx` is a separate true-move path that updates the workspace parent ID without duplication. That path remains outside this milestone.

## Implementation

- One pure model derives every collection, API design, local mock server, root global-environment tree, and MCP client as a typed project file with the pinned labels.
- Collection duplication rekeys collection, folder, request, row, collection-environment, proto-file, Socket.IO argument/listener, and multipart identities while remapping folder/order/active-environment references.
- Design duplication carries its generated collection and owned suites/tests, remapping collection and request references. Mock routes/headers, environment descendants/rows, and MCP environment/header identities also rekey.
- Cross-project copies merge compatible source cookie data into the destination's current project-level jar. MCP copies start disabled and clear runtime state, refresh, identity, and expiry values; authored connection configuration remains reviewable.
- Response, stream, runner, unit-test-result, and MCP connection histories are not copied. The source document is never rewritten by duplication.
- The existing catalog reads healthy source/target documents, writes only the destination through its rotating-backup save path, then opens the destination. Same-project duplication follows the identical path without redundant cookie copying.
- The top-bar manager lazily lists Project files, labels all five scopes, and exposes a named destination dialog limited to healthy local projects with busy-state gating and explicit history disclosure.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused typed-workspace/catalog matrix | Passed: 2 files and 42 tests covering five-scope inventory, nested identity replacement, generated design/suite references, environment subtrees, mock/MCP handling, and cross-project catalog persistence |
| Strict TypeScript project check | Passed with no diagnostics |
| Full Vitest coverage | Passed outside the listener-restricted sandbox: 86 files and 624 tests; 1 public-matrix file and 3 tests remained skipped |
| Full native coverage | Covered all 141 local tests outside the listener-restricted sandbox across the full run plus the exact established login-shell timing rerun; 4 public/live fixtures remained ignored by default |
| Packaged CLI template and runner smokes | Passed, including file/root trust, retained test source, templates/scripts/plugins/config, selection/environments, Spectral refs/rulesets, reports, proxy/TLS, and assertion evidence |
| Non-root/no-network CLI container | Passed with exact version, read-only workspace, self-contained Spectral local-reference lint, suite execution, and explicit-grant TypeScript config/plugin tags |
| Rust formatting, check, and all-target clippy | Passed with warnings denied |
| Production dependency audit | Passed: 0 npm production vulnerabilities |
| Clean TypeScript/Vite/CLI production build | Passed: 1,516 modules; 183.24 kB CSS, 10.95 kB Workspace switcher, 17.60 kB catalog, 441.04 kB main renderer, 3,274.00 kB lazy Spectral chunk, and 23,389,298-byte CLI bundle |
| Tauri debug macOS app bundle | Passed: 94,207,432-byte native binary in a 92,004 KiB `Brunomnia.app` filesystem allocation |
| Parity-row and changed-path checks | Passed: exactly 15 incomplete rows (14 `Baseline`, 1 `Early baseline`) and no whitespace errors |

The generated CLI SHA-256 is `5ac96310ca6504b87cf4ab21a72b414ed0b5fdc27dd6c60a3c5b3fca3ab138de`.

The sandbox denies localhost listeners and Docker access. The exact frontend/native suites and CLI/container smokes were rerun outside it rather than weakening fixtures or production policy. The full native run also observed the established login-shell timing fallback; its exact fixture passed on immediate rerun. No failure involved changed project-file paths.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. No screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim is made. Source-backed React controls, strict compilation, deterministic model regressions, and the production renderer cover this milestone without credentials or user data.

## Remote gate

Main implementation commit `4ed4c9ead13735df71eba34a1e0c753ff8bd24d4` completed verify and publish in [Actions run 29736863918](https://github.com/sherwoodlee/Brunomnia/actions/runs/29736863918). The verify job reproduced the committed CLI under the configured Node runtime, passed freshness, built the verification image, and passed both ordinary and extended non-root/no-network container smokes. The publish job emitted AMD64/ARM64 provenance/SBOM attestation manifests and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:80254353268cdcc2a1fb2b794d4ea41a78003ecbdde05e396700c5bbc702066b
```

Independent manifest inspection resolved AMD64 `sha256:7f09b0d2c91350d3dcef61c91721b9f281acedaa42fdbf571cd27b7a8c590878`, ARM64 `sha256:f88b9d16d8ecd2a2664cbe47104882300022399481d245c91e34e8056919cc53`, and attached attestation manifests `sha256:ac29753792ee879a6ba732b5f8b273fd3f3cc1c0a015cb68765b50ff31a35bfb` plus `sha256:a8163720159939278fc36311368defc2ca45471e697da0368a66b8ffcf31bfb5`. Independent Cosign 3.1.2 verification passed issuer `https://token.actions.githubusercontent.com`, exact identity `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, implementation SHA and digest claims, trusted certificate-chain validation, and offline transparency-log inclusion at Rekor index `2205535185`.

Both jobs and every required step completed successfully.

## Acceptance boundary

M246 closes the typed project-file inventory and pinned duplicate-to-project flow. Brunomnia still stores one atomic document per local project, does not yet reparent a selected typed file out of its source, and does not yet permit a truly empty project. Local projects and Collections remain `Baseline`; exactly 15 parity rows remain incomplete, so Brunomnia is not feature-complete.
