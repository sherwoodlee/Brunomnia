# CLI container

Brunomnia packages its account-free CLI as a non-root OCI image. The image contains only the generated CLI bundle on top of a digest-pinned official Node 22 runtime; it does not include project data, source dependencies, a Brunomnia account, or an entitlement check.

## Local build

Build the CLI first so the image contains the current source output, then build and smoke the image:

```sh
npm run build:cli
npm run test:cli-container
```

Or build it directly:

```sh
docker build -f Dockerfile.cli -t brunomnia-cli:local .
docker run --rm brunomnia-cli:local --version
```

Mount workspaces read-only whenever the command does not need to write reports:

```sh
docker run --rm --network none \
  -v "$PWD/examples:/workspace:ro" \
  brunomnia-cli:local run test "CLI Health" \
  --workingDir /workspace/cli-workspace.json --ci --allow-scripts
```

Provide a separate writable mount for `--output`. Networked collection runs require the container network and must receive only the hostnames, proxy settings, certificates, data folders, and trusted-script flags they actually need.

## Published image

Every push to `main` publishes the multi-architecture `ghcr.io/sherwoodlee/brunomnia-cli:edge` image. A `v*` tag additionally publishes that tag and `latest`. The workflow:

1. Rebuilds the CLI and refuses a stale committed bundle.
2. Executes a no-network suite from a read-only mounted workspace.
3. Publishes Linux AMD64 and ARM64 manifests with BuildKit provenance and an SBOM.
4. Signs the immutable manifest digest through GitHub Actions OIDC and Sigstore Cosign.

All third-party workflow actions and the runtime base image are pinned to immutable digests. Publication uses only the repository-scoped `GITHUB_TOKEN` and ephemeral OIDC identity; no long-lived signing key is stored.

Verify a published signature against this repository workflow:

```sh
cosign verify ghcr.io/sherwoodlee/brunomnia-cli@sha256:<digest> \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/(heads/main|tags/v.*)$'
```

Use the immutable digest from the workflow or registry rather than relying on a mutable tag in production automation.

## First verified publication

Main commit `2654a4c442f153034255a677be298e277bec9cba` completed both remote jobs in [Actions run 29707093949](https://github.com/sherwoodlee/Brunomnia/actions/runs/29707093949). The published `edge` tag resolved to:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:5c0253be23b1b6a8ed97f85108fdc15db520d59e6cea036cddaddf1187bfc517
```

Independent `cosign verify` passed for issuer `https://token.actions.githubusercontent.com`, subject `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, the exact workflow commit, trusted certificate authorities, and the Rekor transparency-log entry. The mutable `edge` tag will advance; this digest remains the permanent M223 publication evidence.
