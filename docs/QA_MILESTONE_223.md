# Milestone 223 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add the pinned signed-container release shape for Brunomnia's account-free CLI without expanding script, plugin, vault, filesystem, or network authority.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Inso has a package-owned Dockerfile, builds a Linux CLI image in `.github/workflows/release-build.yml`, publishes tags in `release-publish.yml`, emits SLSA container provenance, and signs image tags/digests through Kong's public signing action.
- The remaining plugin/vault items are also real capabilities rather than false ledger requirements. Pinned Inso initializes the shared Node runtime, the shared renderer loads user and bundled plugin template tags, the package optionally bundles `@kong/insomnia-plugin-external-vault`, and common rendering can decrypt desktop vault data when the app-data session contains a valid key.
- M223 deliberately selects only the independent release-integrity slice. Plugin execution and desktop-vault access remain separate authority-bearing work.

## Implementation

- `Dockerfile.cli` uses the immutable multi-architecture digest of official `node:22.17.0-bookworm-slim`, copies only the generated CLI bundle, labels source/version/revision/license metadata, runs as the built-in `node` user, and defaults to help.
- `.dockerignore` reduces the build context to `bin/brunomnia.cjs`; source, dependencies, project data, Git metadata, native targets, and local build output cannot enter the image.
- The container workflow pins every third-party action by commit, rebuilds the CLI and rejects a stale committed bundle, then runs a standalone suite with no network and a read-only workspace mount.
- Main pushes publish `edge`; version tags additionally publish the tag and `latest`. Publication emits Linux AMD64/ARM64 manifests, BuildKit provenance, an SBOM, and a keyless Cosign signature over the immutable digest using GitHub OIDC and repository-scoped package credentials.
- The local smoke checks the non-root identity and exact entrypoint, package version, no-network execution, read-only workspace behavior, and one passing standalone suite before removing its temporary image.

## Automated gates

| Gate | Result |
| --- | --- |
| Workflow YAML, Actionlint, and Node smoke syntax | Passed |
| Local CLI container smoke | Passed: pinned image, non-root runtime, exact version, read-only workspace, no network, one passing suite |
| Multi-architecture Buildx export | Passed: Linux AMD64 and ARM64 OCI manifest list written to `/tmp/brunomnia-cli-m223.oci.tar` |
| Full Vitest suite | Passed: 77 files, 567 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 433.88 kB main, 6,460,660-byte CLI |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

No Rust/native behavior changed. Milestone 220 remains the latest full native test and macOS app-bundle gate.

## Remote gate

The keyless publication job can run only after this workflow exists on remote `main`. M223 therefore accepts the locally verified release definition but keeps first remote publication/signature observation explicit. The Headless CLI and packaging rows remain `Baseline` until that post-push evidence and their unrelated remaining gaps are addressed.

## Acceptance boundary

The image does not silently grant scripts, plugins, external vaults, files, certificates, proxies, or network access; existing CLI flags and container runtime policy still control those authorities. M223 does not add executable config, user plugin tags, desktop-vault state, stronger process isolation, desktop signing/notarization, or desktop installers. Exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
