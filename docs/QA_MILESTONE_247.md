# Milestone 247 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: implement the pinned identity-preserving typed workspace parent move across healthy local projects, including owned local evidence, collision refusal, and rollback-safe catalog persistence.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.move-workspace.tsx` validates the destination project and selected workspace, then updates only `Workspace.parentId`; authored workspace and descendant identities remain unchanged.
- That true move is separate from pinned `workspace.move.tsx`, whose modal says Duplicate file and performs an Insomnia v5 export/import into a selected project with new identities. Milestone 246 covers the latter path.
- Brunomnia's one-document project storage requires explicit ownership partitioning and two-document persistence to reproduce the same visible move behavior without introducing accounts or a hosted database.

## Implementation

- Generated collections owned by API designs no longer appear as independent Collection files; the Document is their typed owner, matching the pinned design workspace hierarchy.
- Collection moves preserve collection/folder/request/environment/row identities and carry owned suites, suite results, Runner reports, request activity, stored responses, stream sessions, and response-viewer state. Document moves carry the same generated-collection graph plus the design.
- Mock servers carry every route, root global Environments carry their complete descendant tree, and MCP clients carry device-local connection history.
- A complete target identity inventory covers authored documents and local evidence. Any collision refuses before mutation with guidance to use Duplicate instead; same-project Move also refuses.
- Moving the final Collection or root Environment creates a fresh minimal Requests or Base Environment file with new identities so the source project remains loadable. The moved file itself is not cloned or rekeyed.
- Cookie data is copied into the destination's project-level jar and retained at source; this avoids stealing cookies from unrelated source files until per-file cookie jars are introduced. Certificates, preferences, policy, plugin, integration, and collaboration settings remain destination-owned project state.
- Catalog persistence saves the complete destination first and source removal second. A source-save failure restores both original documents; active workspace operations increment a save generation so a stale debounced autosave cannot rewrite the moved source.
- The Project files list offers Move only when another healthy project exists. Its destination dialog excludes the source, explains identity/evidence/fallback behavior, obeys active-work gating, and opens the destination on success.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused typed-workspace/catalog matrix | Passed: 2 files and 47 tests covering five scopes, duplication, ownership/evidence moves, hidden design collections, source placeholders, collisions, same-project refusal, and persisted cross-project moves |
| Strict TypeScript project check | Passed with no diagnostics |
| Full Vitest coverage | Passed outside the listener-restricted sandbox: 86 files and 629 tests; 1 public-matrix file and 3 tests remained skipped |
| Full native coverage | Covered all 141 local tests outside the listener-restricted sandbox across the full run plus the exact established login-shell timing rerun; 4 public/live fixtures remained ignored by default |
| Packaged CLI template and runner smokes | Passed, including file/root trust, retained test source, templates/scripts/plugins/config, selection/environments, Spectral refs/rulesets, reports, proxy/TLS, and assertion evidence |
| Non-root/no-network CLI container | Passed with exact version, read-only workspace, self-contained Spectral local-reference lint, suite execution, and explicit-grant TypeScript config/plugin tags |
| Rust formatting, check, and all-target clippy | Passed with warnings denied |
| Production dependency audit | Passed: 0 npm production vulnerabilities |
| Clean TypeScript/Vite/CLI production build | Passed: 1,516 modules; 183.29 kB CSS, 12.80 kB Workspace switcher, 22.94 kB catalog, 441.20 kB main renderer, 3,274.00 kB lazy Spectral chunk, and 23,389,298-byte CLI bundle |
| Tauri debug macOS app bundle | Passed: 94,207,432-byte native binary in a 92,004 KiB `Brunomnia.app` filesystem allocation |
| Parity-row and changed-path checks | Passed: exactly 15 incomplete rows (14 `Baseline`, 1 `Early baseline`) and no whitespace errors |

The generated CLI SHA-256 is `5ac96310ca6504b87cf4ab21a72b414ed0b5fdc27dd6c60a3c5b3fca3ab138de`.

The sandbox denies localhost listeners and Docker access. The exact frontend/native suites and CLI/container smokes were rerun outside it rather than weakening fixtures or production policy. The full native run also observed the established login-shell timing fallback; its exact fixture passed on immediate rerun. No failure involved changed project-file paths.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. No screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim is made. Source-backed React controls, strict compilation, deterministic model regressions, and the production renderer cover this milestone without credentials or user data.

## Remote gate

Main implementation commit `cbaf43e5ec58ef040b1e00d918d8211bb5ac7311` completed verify and publish in [Actions run 29737898637](https://github.com/sherwoodlee/Brunomnia/actions/runs/29737898637). The verify job reproduced the committed CLI under the configured Node runtime, passed freshness, built the verification image, and passed both ordinary and extended non-root/no-network container smokes. The publish job emitted AMD64/ARM64 provenance/SBOM attestation manifests and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:eafa3f30551b6f40e04720893c35cb9d37656c96ba9fa847df7981546d152fd3
```

Independent manifest inspection resolved AMD64 `sha256:a686052c2465f82762a8b089bfce0f17ec3ff14aaae3ea66b416c0f1b8b5f92a`, ARM64 `sha256:a319191aaa25843c99657126a19b131598f3ceb337af6338f1582e1812091277`, and attached attestation manifests `sha256:367c46e725ebe4f6b91565b98f33cf74257228d4a3d0c9e01b3841ab636d3ff0` plus `sha256:b9acb8622250b1869b7d8937afb2732f3d239b277b3c3ae73e01cfcb782bf201`. Independent Cosign 3.1.2 verification passed issuer `https://token.actions.githubusercontent.com`, exact identity `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, implementation SHA and digest claims, trusted certificate-chain validation, and offline transparency-log inclusion at Rekor index `2205565352`.

Both jobs and every required step completed successfully.

## Acceptance boundary

M247 closes identity-preserving cross-project reparenting for every exposed typed file and its owned local evidence. Brunomnia still stores one document per local project, creates a fallback instead of an empty source project, and keeps cookie/certificate/settings state at project scope. Local projects and Collections remain `Baseline`; exactly 15 parity rows remain incomplete, so Brunomnia is not feature-complete.
