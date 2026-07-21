# Milestone 260 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: complete the pinned mock-server capability by adding account-free public/self-host deployment workflows around the existing local editor, request-aware renderer, and Faker contract.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `workspace.new.tsx`, the mock model, `upsertMockbin` flow, and current Kong cloud/self-hosted Mockbin documentation expose local editing plus either a hosted URL or user-operated deployment. The concrete missing operation was deployability, not another editor or route-rendering control.
- Existing Milestones 89–105 already cover route matching, live edits, request data, Liquid-style control flow, structured failures, and all 118 documented Faker names. Exact parser diagnostics, JavaScript object identity, corpus strings, and probability distributions do not expose separate workbench operations.
- Brunomnia supplies user-owned infrastructure instead of a vendor-operated paid tier: exported deployments can receive a public URL through Docker, Kubernetes, a reverse proxy/ingress, or any supervisor that runs the headless executable.

## Implementation

- The mock workbench exports a versioned `*.brunomnia-mock.json` deployment with a public-bind default and no account, organization, credential, or entitlement state.
- A bounded deployment loader validates regular-file identity, 20 MB input size, format version, bind allowlist, route/header/template limits, and command/environment overrides before serving.
- The Tauri executable accepts `--brunomnia-mock-server`; the smaller `brunomnia-mock-server` crate reuses the exact same Rust modules instead of maintaining a second renderer.
- SIGINT/SIGTERM stop cleanly. Valid route-file replacements reload every 500 ms; invalid/partial replacements preserve the last valid routes, while identity/bind changes require restart.
- The multi-stage OCI image uses pinned Rust and Debian digests, runs as `65532:65532`, and supports read-only root filesystems, no-new-privileges, and a complete capability drop.
- The immutable GitHub workflow verifies frontend serialization, formatting, tests, Clippy, standalone smoke behavior, and the constrained image before publishing AMD64/ARM64 manifests with SBOM, provenance, and keyless Cosign signing.
- `Mock servers` is `Complete` in `PARITY.md`. Exactly six rows remain incomplete: five `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Deployment serializer | Pass — 1 file, 2 tests |
| Full frontend suite | Pass — 94 files and 662 tests; 2 opt-in integration files and 4 tests skipped in a clean `/private/tmp` source snapshot |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics in the same clean snapshot |
| Standalone Rust suite | Pass — 24 tests, including deployment parsing/overrides/bounds and real loopback serve/stop behavior |
| Native Rust suite | Pass — a 167-test aggregate passed before the final deployment-bound regression; all 3 deployment tests then passed. Two unrelated existing subsecond shell/cancellation tests flaked in separate repeat aggregates and each passed independently; 4 opt-in fixtures remain ignored. |
| `cargo fmt --check` | Pass for standalone and Tauri manifests |
| Standalone Clippy | Pass — all targets with warnings denied |
| Headless standalone smoke | Pass — readiness, dynamic request rendering, malformed-file preservation, live file reload, and SIGTERM shutdown |
| Headless Tauri-binary smoke | Pass — the built desktop executable's `--brunomnia-mock-server` entrypoint executes the same end-to-end smoke |
| Pinned container build | Pass with Rust 1.88 after explicit cross-version compilation validation |
| Constrained container smoke | Pass — non-root `65532:65532`, read-only root filesystem, all capabilities dropped, no-new-privileges, and expected parameter/default rendering |
| Production dependency audit | Pass — `npm ci` reports 0 vulnerabilities |

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M260 therefore makes no screenshot, observed-click, DOM, focus, screen-reader, or visual-layout claim beyond pinned-source behavior, focused regressions, compile checks, and executable/container smokes.

## Remote gate

Pending implementation push and immutable GitHub workflow evidence.

## Acceptance boundary

M260 closes local, public-URL, and self-hosted mock operations without claiming that Brunomnia runs a vendor-owned shared hosting service or that internal LiquidJS/FakerJS object and corpus identity are separate user capabilities. Public reachability, TLS, DNS, and infrastructure costs belong to the user's selected host; Brunomnia adds no account, subscription, quota, or entitlement gate. Six parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
