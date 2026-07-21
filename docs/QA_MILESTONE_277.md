# Milestone 277 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: close the finite pinned secrets and external-vault contract by adding private collection Secret rows with owner-scoped runtime aliases, enforcing non-shareable persistence boundaries, and making every protected desktop credential store portable across macOS, Windows, and Linux size limits without weakening renderer isolation.

## Source reconciliation

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned environment models expose String, JSON, and Secret rows only in private environments. Secret values are owner-bound vault material rather than workspace JSON, and request execution resolves the selected collection environment rather than a workspace-global alias bag.
- Pinned scripting exposes `insomnia.vault`; it does not expose arbitrary external-provider profile APIs to scripts. Brunomnia therefore keeps reviewed external-provider access in template/host adapters and keeps script vault authority device-local and off by default.
- Pinned Azure UI and credential code expose explicit renewal. Silent renewal, borrowed first-party client IDs, and hidden account entitlements are not user-facing requirements; Brunomnia uses the installed official Azure CLI for guided browser or device-code authentication and explicit renewal.
- Electron safe storage is a device-protected persistence mechanism, not a requirement to reproduce Chromium ciphertext or renderer access. Brunomnia's equivalent contract is non-renderer OS-protected storage with bounded integrity-checked records on every desktop platform.

## Implementation

- Workspace v49 adds private collection sub-environments with Secret rows. Values remain encrypted vault entries keyed to row owners, inputs are masked, conversion to plaintext is confirmed, direct vault entries win name collisions, and duplicate/delete/reset operations preserve or remove owner authority deliberately.
- Runtime aliases are derived from the owning collection's selected private environment for direct and dependent HTTP, OAuth and schema traffic, Runner execution, scripts, plugins, code generation, GraphQL, gRPC, realtime transports, and unit tests. Requests cannot inherit another collection's private aliases.
- Default export, project serialization, Git, and encrypted sync omit private collection environments. Pulls merge remote shareable state while preserving matching local private environments, explicit private-value exports still omit every Secret row, and imports/reset strip non-portable owner authority.
- Saved vault keys, external-provider profiles, request/folder and MCP OAuth runtime credentials, and reusable Git credentials now use the shared `keyring` adapter on macOS Keychain, Windows Credential Manager, and Linux Secret Service.
- The adapter writes 1,200-byte chunks under a fresh generation, validates a bounded versioned manifest, exact byte length, and SHA-256 digest before returning data, switches the manifest only after every chunk succeeds, removes superseded generations, and migrates legacy macOS items without returning protected keys to the renderer.

## Automated gates

| Gate | Result |
| --- | --- |
| Pinned source identity and contract audit | Pass — exact commit plus Secret scope, collection environment ownership, scripting vault, Azure renewal, and safe-storage boundaries were reconciled |
| Focused M277 regressions | Pass — 17/17 model, UI, migration, interchange, project, sync, and native regressions passed before the aggregate run |
| TypeScript | Pass — `tsc -b` completed without diagnostics after repairing the collection-header editor mapping and constructing the Secret reset fixture from a complete workspace |
| Full frontend suite | Pass in required partition — the aggregate observed 103 files/723 tests passing and 2 opt-in integration files/4 tests skipped; two cold dynamic-import tests exceeded the aggregate timeout and one repaired six-test TSX suite could not collect, then the two affected files passed all 18 tests in isolation. All 105 regular files/731 active tests were observed passing |
| Production and CLI build | Pass — Vite transformed 1,547 modules and the generated 23,686,421-byte CLI bundle completed; CLI SHA-256 is `bd14f30fcb4b5fa8b14d262c9f8cdc5351b1b4fd9759d49fc5897b0a338c29b8` |
| Packaged CLI smokes | Pass outside the localhost sandbox — template/file grants, authoritative physical store, full Runner/config/plugin/transport/report matrix, and pinned non-root/no-network/read-only container all passed |
| Native aggregate suite | Pass outside the localhost sandbox — 191 tests passed and 4 opt-in public/model fixtures were ignored |
| Native formatting, check, and lint | Pass — `cargo fmt --check`, locked all-target/all-feature Cargo check, and strict Clippy completed without diagnostics with `CARGO_INCREMENTAL=0` |

## Manual/rendered QA

Rendered/manual and assistive-technology QA remain omitted under the standing project direction. M277 makes no visual claim beyond the source-backed private collection controls, focused executable UI regressions, builds, packaged CLI gates, and complete automated partition.

## Remote gate

The implementation commit and exact GitHub workflow evidence will be attached after the implementation is pushed to `main`.

## Acceptance boundary

M277 closes the pinned Secret-row, private collection environment, scripting-vault, explicit Azure renewal, external-provider profile, and OS-protected credential persistence contract. It does not claim Chromium ciphertext compatibility, silent provider renewal, external-provider scripting APIs, or renderer access to protected records because those are not pinned user-facing capabilities. `Secrets and external vaults` is now `Complete`; exactly three parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
