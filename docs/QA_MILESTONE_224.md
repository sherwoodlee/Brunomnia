# Milestone 224 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: observe and independently verify the first remotely published M223 CLI container, closing the explicit post-push signature gate without changing executable product code.

## Remote workflow

- Main commit `2654a4c442f153034255a677be298e277bec9cba` triggered [Actions run 29707093949](https://github.com/sherwoodlee/Brunomnia/actions/runs/29707093949).
- The `verify` job completed successfully after rebuilding the CLI, confirming the committed bundle was current, building the image, and running the no-network suite with a read-only mount.
- The `publish` job completed successfully after pushing AMD64/ARM64 manifests and their SBOM/provenance attestations, installing Cosign, and signing the immutable digest through GitHub OIDC.

## Independent verification

- `docker buildx imagetools inspect ghcr.io/sherwoodlee/brunomnia-cli:edge` resolved the published manifest to `sha256:5c0253be23b1b6a8ed97f85108fdc15db520d59e6cea036cddaddf1187bfc517`.
- `cosign verify` accepted that exact digest only when constrained to issuer `https://token.actions.githubusercontent.com` and subject `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`.
- Cosign validated the image claim, trusted certificate chain, workflow repository/ref/name/trigger, exact source commit, and the Rekor signed-entry timestamp and log inclusion.

Reproduction:

```sh
cosign verify ghcr.io/sherwoodlee/brunomnia-cli@sha256:5c0253be23b1b6a8ed97f85108fdc15db520d59e6cea036cddaddf1187bfc517 \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main$'
```

## Validation

| Gate | Result |
| --- | --- |
| Remote image verification job | Passed |
| Remote multi-architecture publish/sign job | Passed |
| GHCR tag-to-digest resolution | Passed: `sha256:5c0253be23b1b6a8ed97f85108fdc15db520d59e6cea036cddaddf1187bfc517` |
| Independent Cosign verification | Passed: claims, OIDC identity, certificate authority, and transparency log |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

No application, CLI, dependency, container, or workflow source changed in this evidence-only milestone, so M223's local/full gates and the successful remote run are the executable evidence.

## Acceptance boundary

M224 closes the signed-container publication/verification item. Headless CLI remains `Baseline` because executable JS/TS config, plugin tags, desktop-vault state, exact error/edge behavior, uncommon full-Spectral/export/report/proxy/TLS semantics, and stronger process isolation remain. Desktop signing/notarization and Windows/Linux desktop artifacts also remain in the packaging row. Exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
