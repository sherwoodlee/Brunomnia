# Milestone 251 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: replace project-global cookies and certificates with pinned Insomnia-style workspace-owned device-local state across migration, execution, transfer, interchange, and publication boundaries.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia-data/src/models/cookie-jar.ts` defines one duplicable, non-syncable cookie jar model whose default name is `Default Jar`.
- Pinned `packages/insomnia-data/src/models/client-certificate.ts` and `ca-certificate.ts` parent certificate records to a workspace and mark both model types `canSync = false`.
- Pinned `organization.$organizationId.project.$projectId.workspace.$workspaceId.tsx` loads the cookie jar, CA certificates, and client certificates by `workspaceId`; its update/create certificate routes retain the same parent identity.
- Pinned `organization.$organizationId.project.$projectId.workspace.new.tsx` creates the workspace's default cookie jar together with the workspace.
- Pinned v5 `client-certs.yaml` confirms sync-style YAML keeps the cookie jar but omits local certificate material, matching the non-syncable model contract.

## Implementation

- Workspace v43 adds `fileState[fileId] = { cookies, certificates }`. Top-level `cookies` and `certificates` remain only as bounded v42 migration inputs and normalize to empty values after migration.
- Legacy global cookies and certificates clone independently to every typed file because historical ownership is unknowable. V43 state normalizes only live typed file IDs, drops stale entries, preserves truly empty projects as `{}`, and maps generated collections and their requests to the owning API Design ID.
- New collections, API designs, mock servers, root environments, and MCP clients receive an immediate empty default state. Environment-root deletion clones its state to newly promoted roots; MCP deletion removes the orphaned entry.
- Direct/dependent HTTP and GraphQL, OAuth, schema loading, gRPC, WebSocket/GraphQL-subscription/SSE/Socket.IO, scripts, code generation, Runner, standalone unit tests, plugins, mocks, integrations/MCP, cookie editing, certificate editing, and portable CLI execution resolve state from the owning file. Same-file dependent sends retain shared cookie side effects while cross-file dependencies remain isolated.
- Typed-file duplication clones only the selected file state, while identity-preserving moves transfer and remove that exact entry. Imported jars initialize each newly imported file; scoped Brunomnia and Insomnia v4/v5 exports read the selected collection/design state.
- Split folder/Git writes and encrypted collaboration payloads omit `fileState`; reload and pull preserve the current device-local map. Manual Brunomnia export remains an explicit portability path, while Insomnia v5 YAML continues to omit local certificates.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused ownership matrix | Passed: 7 files and 99 tests covering v42/v43 migration, generated-design ownership, isolated updates, duplicate/move transfer, import/export, and folder/sync local-only boundaries |
| Strict TypeScript project check | Passed with no diagnostics; the production composite compiler also passed unused-symbol and literal-width checks |
| Full Vitest coverage | Passed outside the listener-restricted sandbox: 89 files, 88 passed and 1 public-matrix file skipped; 640 tests passed and 3 remained skipped |
| Full native coverage | Passed outside the listener-restricted sandbox: 145 local tests passed and 4 public/live fixtures remained ignored by default |
| Packaged CLI template and runner smokes | Passed, including cookie continuity, file/root trust, templates/scripts/plugins/config, collection/suite selection, Spectral sources, reports, proxy/TLS, workspace CA/client identity, and assertion evidence |
| Non-root/no-network CLI container | Passed with exact version, read-only workspace, self-contained Spectral local-reference lint, suite execution, and explicit-grant TypeScript config/plugin tags |
| Rust formatting, check, and all-target clippy | Passed with warnings denied under the declared MSRV |
| Production dependency audit | Passed: 0 npm production vulnerabilities |
| Clean TypeScript/Vite/CLI production build | Passed: 1,517 renderer modules; 186.06 kB CSS, 15.86 kB Workspace switcher, 20.07 kB catalog, 455.72 kB main renderer, 3,274.00 kB lazy Spectral chunk, and 23,393,414-byte CLI bundle; the established large lazy-chunk warning remains |
| Tauri debug macOS app bundle | Passed with `--bundles app`: 94,587,736-byte native binary in a 92,376 KiB `Brunomnia.app` filesystem allocation |
| Parity-row and changed-path checks | Passed: exactly 15 incomplete rows (14 `Baseline`, 1 `Early baseline`) and no whitespace errors |

The generated CLI SHA-256 is `f43cb44086b91a5a83e8d304fd70804e5ba6b982b4faba788a0f0ff476ba0f64`; the bundle changes because workspace migration and ownership resolution are shared with the headless artifact.

The sandbox denies localhost listeners, Docker access, and advisory/source network requests. Full frontend/native suites, CLI smokes, the container gate, npm audit, and pinned-source inspection were therefore rerun with only their required external authority rather than weakening production or fixture policy. No failure involved changed ownership behavior.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. No screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim is made. Source-backed React wiring, strict compilation, deterministic ownership regressions, protocol tests, packaged smokes, and the production renderer cover this milestone without credentials or user data.

## Remote gate

Main implementation commit `0ec887b390112617f9855e6e212a205a1b142d48` completed verify and publish in [Actions run 29744192382](https://github.com/sherwoodlee/Brunomnia/actions/runs/29744192382). The verify job reproduced the committed CLI under the configured Node runtime, passed freshness, built the verification image, and passed both ordinary and extended non-root/no-network container smokes. The publish job emitted AMD64/ARM64 provenance/SBOM attestation manifests and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:246abb6687b8d4e85cebe5a652ba3a80e7be3f0d457ecfeb6f3fc2abeeae4f67
```

Independent manifest inspection resolved AMD64 `sha256:9c97f83ab16f8173f44833527cd45df6efc66b6c2ab039d90d9270cd3908552c`, ARM64 `sha256:9bec4d12027d4c8afe4f93e863bcb2198f1e7be0e6f44a4a23b8d8d6c71146c6`, and attached attestation manifests `sha256:9f2f8e86e28fe24fed3c05a0cf32dcde133a2f5f2a1770d04952ce1f25fd9e26` plus `sha256:23f1bec5c4cb2d712675636106466ec40fddb558edf7db1f501a6225d80bb941`. Independent Cosign 3.1.2 verification passed issuer `https://token.actions.githubusercontent.com`, exact identity `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, implementation SHA and digest claims, trusted certificate-chain validation, and offline transparency-log inclusion at Rekor index `2206273641`.

Both jobs and every required step completed successfully. GitHub emitted only its informational Node 20 action-runtime deprecation annotation; the runner forced those pinned actions onto Node 24 and no gate was skipped or weakened.

## Acceptance boundary

M251 closes per-file cookie, CA-certificate, and client-certificate isolation within Brunomnia's atomic local-project document. Separate physical workspace records, cloud discovery, and provider onboarding remain; exactly 15 parity rows are incomplete, so Brunomnia is not feature-complete.
