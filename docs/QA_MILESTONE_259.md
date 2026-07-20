# Milestone 259 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: complete the pinned Collection Runner and automated-test capability by matching source data-file encoding detection, preserving compressed transfer-byte result statistics, and closing only gaps backed by concrete pinned behavior.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/main/ipc/main.ts` imports `chardet` and calls `chardet.detectFile` whenever the Runner upload does not specify an encoding. `packages/insomnia/package.json` requests `^2.1.0`, and the pinned root lock resolves exactly `2.1.1`.
- Pinned `packages/insomnia/src/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.send.tsx` assigns `testResultCollector.size = baseResponsePatch.bytesRead || 0`.
- Pinned `organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner.tsx` copies that collector size into both saved `responseSize` results and live-item patches. `request-result-card.tsx` formats the same field for the visible result card.
- The Runner route, panes, context, execution store, request-list hook, smoke fixtures, and data-upload modal were re-audited for data, planning, execution, live feedback, filtering, history, cancellation, skipping, result-card, and tab-lifecycle operations. Brunomnia already has concrete coverage for every exposed operation.
- Pinned Inso registers `run test`, `run collection`, `lint spec`, `export spec`, and config `script` as end-user commands. Existing M200-M225 evidence and the packaged CLI smoke cover their arguments, resolution, reporters, trust grants, report policies, and failure behavior. Pinned `generate-docs` remains package-maintainer build plumbing, as classified in M222.
- Byte-exact request header casing/global order, transport-added framing, DNS/connect/TLS callbacks, and challenge-round headers belong to the shared transport implementation and were classified in M257. They are not distinct Runner operations.

## Implementation

- Runner data-file auto-detection now uses exact pinned `chardet` 2.1.1 instead of a BOM/UTF-8/Windows-1252 heuristic. Detected names are normalized to the existing 41-label picker contract.
- The existing portable decoders and validation remain authoritative after detection, including UTF-32, ASCII, Latin-1, EUC-CN, KOI8-RU, KOI8-T, Shift_JIS, and the pinned invalid ISO-8859-12 label.
- Runner response snapshots and live items now use `wireSizeBytes ?? sizeBytes`, matching pinned `bytesRead` for compressed native responses while retaining decoded-size fallback where browser Fetch exposes no wire count.
- Historical cards and exports already derive from the retained Runner snapshot, so the corrected transfer size propagates without a schema migration. Legacy reports keep their stored value.
- `Collection runner and automated tests` is `Complete` in `PARITY.md`. Exactly seven rows remain incomplete: six `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Runner regressions | Pass — 1 file, 38 tests, including probabilistic Shift_JIS identity and compressed wire-size snapshot/live propagation |
| Full frontend suite | Pass — 93 files and 660 tests; 2 opt-in public fixture files and 4 tests skipped. The workspace FileProvider produced unrelated module-read `ETIMEDOUT` failures, so the authoritative rerun used a clean committed `git archive` plus `npm ci` on local `/private/tmp` storage. |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics in the same clean committed archive |
| Production renderer | Pass — 1,541 modules; 187.71 kB stylesheet; 497.75 kB main renderer; 3,274.00 kB lazy Spectral chunk |
| Bundled CLI build | Pass — 23,499,784 bytes; SHA-256 `adadff2fd9fef9807c8fd8e91248a53c90f00e1eb87b1a4e027d6f5b40f5b743` |
| Bundled CLI smokes | Pass — Runner preview, template/file authority, physical records, and non-root/no-network container behavior |
| Native full suite | Pass — 165 tests passed and 4 opt-in fixtures ignored outside the listener-restricted sandbox |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| Tauri debug macOS app bundle | Pass — 97,371,096-byte native binary in a 95,096 KiB `Brunomnia.app` filesystem allocation; the broader all-target attempt built the app before the sandboxed DMG helper failed, and the app-only rerun passed |

## Focused coverage

- A repeated real Shift_JIS paragraph is detected as `shift_jis` and decodes to the expected Japanese text. The existing Western fixture now records `iso-8859-1`, matching the probabilistic detector rather than a hard-coded fallback.
- A compressed-shaped response with 12 decoded bytes and 2 wire bytes retains and renders 2 bytes in both the saved Runner response snapshot and final live item.
- The focused Runner suite also preserves target scoping, draft lifecycle, data parsing and bounds, retries, delay, cancel/skip, bail, script flow, assertions, response/timeline/request budgets, redaction, iteration data, and folder ancestry.
- The packaged Runner smoke proves stored/file/CI selection, global and collection environments, exact item order, remote data, delay, timeout, bail, assertions, reports, proxy/TLS/CA/client identities, config scripts/plugins, and split-project inputs.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M259 therefore makes no screenshot, observed-click, DOM, focus, screen-reader, or visual-layout claim beyond pinned-source behavior, strict focused regressions, renderer/CLI/native builds, packaged CLI smokes, and the packaged app artifact.

## Remote gate

Implementation commit `2cf40c100ac9926a72f9bd8c7c386e90b31a3ad6` completed verify and publish in [Actions run 29788317913](https://github.com/sherwoodlee/Brunomnia/actions/runs/29788317913). Both jobs passed. The verify job reproduced the committed CLI under Node 22, passed freshness, built the verification image, and passed ordinary plus extended non-root/no-network container smokes. The publish job emitted AMD64/ARM64 provenance and SBOM attestations and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:bbcd38ace310e7ba3426cbe97881edb882b7784182633c017785391498b74fe9
```

Independent manifest inspection resolved AMD64 `sha256:1e550af66f1f8fee4606cd1cb8e70cdfe3f7fa939ae8b534d346580806b664e2`, ARM64 `sha256:db5da668bc7c1cd999b1394101fa64569e836cb7df4ebe5ca8212a61372b1b11`, and attached attestation manifests `sha256:457cc155c1c7643520b6ce1bd67caff023bec5079666d0e71b47469197f6419b` plus `sha256:17a01e4cbf4e676c866928b3307a4534665b0a9779ba9f3290d2a3081c8e3bc4`. Independent Cosign verification passed claims, trusted certificate-chain validation, exact issuer `https://token.actions.githubusercontent.com`, exact subject `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, branch, repository, workflow, implementation SHA, digest claims, and offline transparency-log inclusion at Rekor index `2209032263`.

## Acceptance boundary

M259 closes the documented Runner and Inso operations rather than claiming identity with shared transport implementation details or adding undocumented package-maintainer commands. Runner scripts, files, requests, plugins, and external vaults remain separately opt-in device/CLI authorities rather than account, subscription, or entitlement checks. Seven parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
