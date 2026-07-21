# Milestone 261 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: complete the pinned import/export capability with legacy Insomnia migration, multi-artifact and Postman data-dump import, direct MCP URL import, selected-request export, and explicit private-environment consent.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned importer registration includes Insomnia v1–v5, Postman, HAR, OpenAPI/Swagger, WSDL, and cURL families. V1–v3 are compatibility migrations into the current resource model rather than separate editors.
- Pinned scan routes accept multiple files/folders, while `extract-postman-data-dump.ts` classifies collection/environment files through `archive.json`.
- Pinned MCP import can start from a remote server URL. Brunomnia represents that operation as a first-class disabled client rather than executing or authorizing the endpoint during import.
- Pinned request export selects requests and retains folder context. Pinned settings require an explicit private-environment choice instead of silently publishing private values.
- Insomnia v5 database-only proto IDs, deprecated script subsets, external file paths, WSDL placeholder generation, and non-binary compatibility formats are representation limits rather than separate missing operations.

## Implementation

- Insomnia v1–v3 documents migrate through the existing bounded v4 mapper with explicit legacy warnings and source metadata.
- The import dialog accepts up to 100 supported files/folder descendants and applies successful artifacts together while showing per-file failures. Workspace replacements must remain isolated.
- A dependency-free ZIP reader supports stored and deflate JSON entries, validates CRC plus declared/actual size, limits archives to 20 MB/1,000 entries/50 MB extracted output, aborts forged streaming expansion, and rejects encryption, ZIP64, multidisk, malformed directories, and unsupported compression.
- Postman `archive.json` maps listed collection/environment files into the existing adapters. Direct HTTP(S) MCP URLs reject embedded credentials and create disabled, credential-cleared clients.
- Collection export can select request subsets while retaining every ancestor folder, stable resource order, and only matching or unbound standalone tests.
- Effective private environment trees are omitted by default. Explicit inclusion adds a visible pre-download warning and an artifact warning.
- `Import and export formats` is `Complete` in `PARITY.md`. Exactly five rows remain incomplete: four `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused interchange suites | Pass — 3 files and 37 tests covering legacy formats, ZIP/batch/MCP import, round trips, selected exports, and private-value consent |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics in a clean `/private/tmp` snapshot |
| Full frontend suite | Pass — 95 files and 670 tests; 2 opt-in integration files and 4 tests skipped. The authoritative rerun used loopback authority because the sandbox correctly refused `127.0.0.1` binding. |
| Production build | Pass — TypeScript, Vite renderer, and 22.4 MB bundled CLI completed from the same clean snapshot |
| Safety review | Pass — archive/file/count/size/CRC/streaming-expansion/credential bounds and replacement isolation are exercised or fail closed |

## Focused coverage

- Insomnia v1 JSON bodies/formats and v2 string bodies normalize into the same v4 request model as v3 object bodies, with explicit legacy warnings.
- A generated stored Postman ZIP imports one collection and one environment; malformed ZIPs report bounded failures.
- Mixed files keep a valid cURL import while reporting an invalid JSON sibling, proving partial-batch behavior.
- MCP URL import preserves a bounded HTTPS endpoint, refuses non-HTTP schemes and embedded credentials, and produces a disabled client.
- Selected collection exports retain both nested ancestor folders and resource order, remove unrelated requests/tests, preserve unbound tests, and reject an empty selection.
- Private parent and inherited-private child values are absent by default and appear only in an explicitly consented warning-bearing artifact.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M261 therefore makes no screenshot, observed-click, DOM, focus, screen-reader, or visual-layout claim beyond source-backed behavior, strict compilation, focused/full regressions, and production build evidence.

## Remote gate

Implementation commit `87573b437335c1ae4496c6751688340c547c1a5c` completed both verify and publish jobs in [CLI container run 29796149058](https://github.com/sherwoodlee/Brunomnia/actions/runs/29796149058). The verify job reproduced the committed CLI, passed freshness, built the verification image, and passed ordinary plus extended non-root/no-network container smokes. The publish job emitted AMD64/ARM64 SBOM and provenance attestations and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:75eb3d8e99b82f89f4191d29c7edd3967126b749038db2869b8611a01540efbb
```

Independent manifest inspection resolved AMD64 `sha256:a682b3a199c2f2efaef8a63f519888be56f590d8f09c7f762b85bed29ec2d5d6`, ARM64 `sha256:9cfd773d4d9cd39a67fef8409f91f6dd818c6cf6b244846e18bf5765e903e846`, and attached attestation manifests `sha256:06390082d64937a4289d9a7d922bda8b31d3ecaab11eec4d1cd5b09d423cdd9a` plus `sha256:795fb270eb31511fc3a4b23951f472de245f254d6d73de19c40971d36cd1d464`. Independent Cosign verification passed claims, trusted certificate-chain validation, exact issuer `https://token.actions.githubusercontent.com`, exact subject `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, branch, repository, workflow, implementation SHA, digest claims, and offline transparency-log inclusion at Rekor index `2209834353`.

## Acceptance boundary

M261 closes import/export operations without claiming lossless representation where a target format has no field or embedded bytes. Conversions remain local, bounded, reviewable, and account-free; imported active authorities are never inherited. Five parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
