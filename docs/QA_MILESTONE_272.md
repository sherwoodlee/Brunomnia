# Milestone 272 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: close the pinned private-environment Secret-variable gap with free local-vault ownership, masked editing, `vault.*` runtime resolution, explicit plaintext conversion, and fail-closed persistence/interchange boundaries.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia-data/src/models/environment.ts` defines String, JSON, and Secret key/value rows, the persisted `__insomnia_vault` path, runtime `vault` path, and mask value.
- `environment-key-value-editor/key-value-editor.tsx` offers Secret only for private environments with a vault key, decrypts for editing, encrypts on conversion, and confirms Secret-to-plaintext changes.
- `common/render.ts`, `mask-or-decrypt-vault-data.ts`, and `surface-profiles.ts` establish the private-environment runtime and publication boundaries. Brunomnia adapts those operations to its existing account-free per-project AES-256-GCM vault rather than depending on an Insomnia account key.

## Implementation

- Workspace v46 permits `valueType: "secret"` only in private global environments. Normalization forces the persisted row value to an empty string, returns the environment to Table mode, and drops Secret rows from public, collection, folder, and untrusted imported scopes.
- Plaintext lives in a hidden encrypted `VaultEntry` with `kind: "environment"`, owner row ID, and canonical reserved name. Native save validation rejects malformed owners, names, ordinary-entry owner IDs, and unsupported kinds.
- The editor exposes masked/revealable values only while the local vault is unlocked. Secret-to-String/JSON conversion requires confirmation; JSON validation ignores sibling Secret metadata without decrypting it. Raw JSON and shared-environment conversion fail closed while Secret rows remain.
- Enabled rows from the resolved active environment become `vault.<name>` values across the existing renderer, request, realtime, runner, integration, plugin, and script-vault paths. Ordinary direct vault entries deliberately override matching aliases.
- Secret changes persist after a 300 ms debounce. Pending writes flush before project switching or vault locking; failures remain visible and prevent the lock/switch transition from discarding decrypted edits.
- Environment duplication clones independent owner entries. Row/environment deletion and vault reset remove the matching hidden entries or metadata. Hidden entries stay outside direct vault CRUD.
- Every compatibility export omits Secret rows and warns. Insomnia v4/v5 Secret pairs and `__insomnia_vault` blobs are warned and omitted because the source account key is non-portable.
- No plan, license, Brunomnia account, telemetry, hosted sync, quota, or entitlement check is involved.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Secret suites | Pass — 7 frontend files/107 tests cover helper ownership, masked static controls, JSON coexistence, migration, direct vault filtering, import omission, export omission, and reset behavior; 3 focused native secure-store tests cover encrypted round-trip, malformed owner rejection, wrong passphrases, and revision conflicts |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics from the fresh-source isolated mirror |
| Full frontend suite | Pass in required partition — 102 regular files/711 tests passed with 2 opt-in integration files/4 tests skipped; the real MCP loopback file passed separately, so all 712 active tests were observed passing |
| Production and CLI build | Pass — TypeScript, Vite renderer, 1,547 transformed modules, and the 22.6 MB bundled CLI completed; CLI size is 23,681,277 bytes with SHA-256 `6f7a3efdf77a0ecbfd455a143e84dae6939d1c58ad06d91184d4723e3f4be7b2` |
| Packaged CLI smokes | Pass outside localhost sandbox — template/file grants, authoritative physical store, and full runner/config/plugin/transport/report smoke matrices passed |
| Native aggregate suite | Pass in complete partition — the unrestricted aggregate passed 188 tests with 4 opt-in public/live fixtures ignored and the login-shell fixture filtered; that fixture passed separately, so all 189 active native tests were observed passing |
| Native formatting and lint | Pass — `cargo fmt --check`, locked all-target/all-feature Cargo check, and strict Clippy completed without diagnostics |

## Focused coverage

- Helper regressions prove canonical hidden names, owner upsert/removal, direct-entry exclusion, locked-session denial, enabled resolved aliases, independent duplication, and reset metadata cleanup.
- Static React regressions prove Secret controls appear only with private/unlocked authority, values render as password inputs, reveal controls are labeled, and locked rows remain non-editable.
- Migration regressions prove embedded plaintext becomes empty metadata, raw mode becomes Table, and public/global-collection authority is rejected. Import/export regressions prove neither Brunomnia nor Insomnia encrypted Secret data crosses compatibility boundaries silently.
- Native regression proves the encrypted file never contains the environment plaintext, authenticated unlock restores the exact owner entry, and noncanonical owner metadata fails before replacement.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M272 therefore makes no screenshot, observed-click, focus-ring, screen-reader, or visual-layout claim beyond pinned source, static component output, deterministic frontend/native regressions, strict compilation, complete suites, and the production renderer.

## Remote gate

Pending publication of the M272 implementation commit to remote `main` and completion of its CLI container verify/publish workflow.

## Acceptance boundary

M272 closes pinned private global-environment Secret rows without an account or paid gate. It does not claim portable decryption of Insomnia account-vault ciphertext, Secret types outside private global environments, silent Azure background renewal, non-macOS protected profile storage, or script-facing external-provider APIs. Exactly five parity rows remain incomplete, so Brunomnia is not declared feature-complete.
