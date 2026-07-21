# Milestone 269 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: match pinned Insomnia's optional **Save encrypted vault key locally** behavior with project-scoped macOS Keychain retention, operation-specific automatic unlock/save, and complete local-vault lifecycle cleanup without exposing the saved key to the renderer.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `common/utils/vault.ts` derives one `vault_<accountId>` secret-storage key, saves the vault key only while `saveVaultKeyLocally` is enabled, retrieves it later, and deletes it when retention is disabled.
- `ui/components/settings/vault-key-panel.tsx` exposes the exact **Save encrypted vault key locally** label with confirmation, automatically saves/deletes when the setting or key changes, and describes the stored value as encrypted local data.
- `main/ipc/secret-storage.ts` encrypts secret-storage values through Electron `safeStorage` before its settings store. Brunomnia's packaged target already uses Security.framework for runtime and Git credential master keys, so a generic-password item is the direct macOS Tauri boundary rather than a renderer-readable settings value.
- Pinned storage is account-scoped. Brunomnia has no account dependency, so the compatible authority unit is its validated device-local project ID.

## Implementation

- A dedicated native module maps validated project IDs to `workspace-v1:<id>` generic-password accounts under the `dev.brunomnia.desktop.local-vault-key` service. The 4 KB bounded value is written only after it successfully decrypts that project's current vault.
- The Tauri bridge exposes supported/retained status, retain, forget, saved-key unlock, and saved-key vault save. It exposes no command that returns the saved passphrase. Saved-key save first authenticates the current envelope before replacing it, so an externally changed vault cannot be overwritten through a stale key.
- A failed saved-key decrypt removes the stale item and requests manual entry. Missing and malformed saved values fail closed; invalid/traversal workspace IDs cannot select another Keychain account.
- The active project attempts automatic saved-key unlock on initial hydration and every project switch. React receives only decrypted vault entries and keeps an empty passphrase for that session; later edits use the native saved-key save operation.
- The Security workbench exposes the exact pinned label, explicit confirmation, supported-platform guidance, and a renderer-authority explanation. Removing the only native key from an auto-unlocked session clears decrypted entries; manually unlocked sessions can remain open with their in-memory passphrase.
- Vault reset forgets the item before deleting the validated envelope. Soft project deletion and restore deliberately leave it intact; individual permanent purge and Empty forget matching project items before deleting recognized trash artifacts.
- Browser development and non-macOS Tauri builds report retention as unsupported and never fall back to plaintext storage. No workspace schema, interchange payload, project file, encrypted-sync payload, account, subscription, telemetry, or entitlement state is added.
- `Secrets and external vaults` remains `Baseline`. Exactly five parity rows remain incomplete: four `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Vendored bundle freshness | Pass — exact UUID/AJV regeneration left `pluginVendored.generated.ts` byte-identical at SHA-256 `733aeb389eacbb540e93e9c577589d70b35f800db57e7254028bd8f7845ac0ef` |
| Focused vault suites | Pass — 3 frontend files/16 tests plus 4 native tests cover bridge authority, exact control rendering, key scoping, stale replacement, saved-key save, reset, soft delete/restore, permanent purge, and Empty |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics |
| Full frontend suite | Pass — 99 files and 699 tests passed; 2 opt-in integration files and 4 tests skipped |
| Production and CLI build | Pass — TypeScript, Vite renderer, 1,545 transformed modules, and the 22.6 MB bundled CLI completed; CLI size is 23,680,275 bytes with SHA-256 `645109eb7dc06da7b83e51c001f9695eeaba5520d569d0792036a80578ab2f60` |
| Native aggregate suite | Pass in complete partition — 179 tests passed with 4 opt-in public/live fixtures ignored and the known login-shell fixture filtered; that fixture passed separately, so all 180 active native tests were observed passing |
| Native formatting and lint | Pass — `cargo fmt --check` and all-target/all-feature strict Clippy completed without diagnostics |

## Focused coverage

- Native Keychain regressions use a process-local test backend and never read or modify the user's real Keychain. They prove independent project items, bounded status serialization without key material, stale-key deletion, authenticated saved-key writes, and reset cleanup.
- Catalog lifecycle regression creates a real encrypted project vault, retains its test key, proves soft-delete/restore automatic unlock continuity, then proves individual purge and Empty remove retained keys.
- Renderer bridge regression proves the only five saved-key commands and their exact payloads; saved-key unlock/save payloads contain no passphrase.
- Static React regression proves the exact pinned label, checked/disabled states, macOS-only guidance, and the statement that no saved key returns to the renderer.
- Full frontend and native suites preserve existing vault rendering, scripts, external providers, private environments, project recovery, runtime credentials, Git credentials, imports, sync, and CLI behavior.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M269 therefore makes no screenshot, observed-click, Keychain-dialog, focus-ring, screen-reader, visual-layout, or real-user-Keychain claim beyond pinned source, static component output, deterministic bridge/native regressions, strict compilation, full suites, and the production renderer.

## Remote gate

Implementation commit `5b7d995c3ad5d172f227e7308d4b3c65201a972d` completed both verify and publish jobs in [CLI container run 29810904743](https://github.com/sherwoodlee/Brunomnia/actions/runs/29810904743). The verify job rebuilt the committed CLI under Node 22 without a diff, built the verification image, matched the package version, and passed the pinned-image, non-root, no-network, read-only, local-reference lint, standalone-suite, config, and plugin-tag smoke.

The publish job emitted AMD64/ARM64 SBOM and provenance attestations and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:b3f04390f22a4d9b8470dbb0325bb20ae67bbf1ed419d67b8e64454da538448f
```

Independent manifest inspection resolved AMD64 `sha256:2eda489f10e5a6bd70678b0df46315a1fc05b76993bc28fcef6e59c93f9b50fa`, ARM64 `sha256:d2d0682298a7a868c77087fd64eff1a1ea8f775d6d667440b8b1cf344ffd6aa7`, and attached attestation manifests `sha256:2f323b6c084e766ff9db926beb6687eb2b1629f4c9e2d0b0ce277a732f2ff186` plus `sha256:457b97f9637bf455b6b408678c552802a48bd179fcddda24a3770b907c2c6bf1`. Both platform attestations expose SPDX and SLSA provenance predicates. Independent Cosign verification passed claims, trusted certificate-chain validation, exact issuer `https://token.actions.githubusercontent.com`, exact subject `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, branch, repository, workflow, implementation SHA, digest claims, and offline transparency-log inclusion at Rekor index `2211064544`.

## Acceptance boundary

M269 closes optional local-vault key retention and automatic retrieval for Brunomnia's packaged macOS target without adding an account or renderer key-read API. It does not claim non-macOS OS-backed retention, external-provider native login SDKs, other stored provider secrets, external-provider script APIs, or broader secret-field UX. Five parity rows remain incomplete, so Brunomnia is not declared feature-complete.
