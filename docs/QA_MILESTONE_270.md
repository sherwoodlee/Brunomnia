# Milestone 270 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: remove the enterprise entitlement from pinned Insomnia Cloud Credentials by providing free, account-independent, non-syncable protected profiles for the exact AWS, GCP, HashiCorp, and Azure credential families, then bind selected profile authority into desktop external-vault approval and cache identity.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `ui/components/settings/cloud-service-credentials.tsx` gates Cloud Credentials on `usePlanData().isEnterprisePlan` and renders an upgrade notice otherwise. Brunomnia adds no plan, account, license, telemetry, or entitlement check.
- `insomnia-data/src/models/cloud-credential.ts` defines AWS temporary, credential-file, and SSO records; one GCP service-account key-file record; HashiCorp on-premises/Vault Dedicated token or AppRole plus HCP Vault Secrets client credentials; and an Azure OAuth result. It explicitly sets `canSync = false`.
- `ui/components/modals/cloud-credential-modal/` provides the pinned provider forms. `ui/components/templating/external-vault/` binds selected records to provider-specific secret coordinates, including HCP organization/project/app/version and the full Azure Key Vault secret identifier.
- The optional `@kong/insomnia-plugin-external-vault` runtime is not present in the source tree. Brunomnia therefore claims only behavior proven from the pinned model/forms plus public provider contracts and its own deterministic adapters; it does not infer unavailable package internals.

## Implementation

- A dedicated native store accepts at most 100 records and 250 KB aggregate JSON, bounds every value to 32 KB, validates strict IDs, unique provider/name pairs, exact tagged provider shapes, absolute file paths, HTTP(S) Vault addresses, and RFC 3339 Azure expiry. The full list is one generic-password item under service `dev.brunomnia.desktop.external-vault-credentials`, account `profiles-v1`.
- The packaged macOS app exposes load/save commands only. Profiles remain outside workspace schemas, project records, browser storage, imports/exports, Git/folder publication, encrypted sync, and portable CLI data. Browser development and non-macOS Tauri builds fail closed instead of persisting plaintext.
- AWS temporary values enter only child environment variables. File and SSO profiles use non-secret `--profile` plus optional credential/config environment paths; tag scope overrides stored region. GCP sets `CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE` without exposing file contents.
- HashiCorp token profiles use `VAULT_ADDR`, `VAULT_TOKEN`, and optional `VAULT_NAMESPACE`. AppRole performs one bounded direct `vault write -field=token auth/approle/login` before the KV read. HCP Vault Secrets performs bounded fixed-host client-credentials HTTPS, constructs percent-encoded organization/project/app/secret/version paths, and returns only the static secret value.
- Azure selected profiles reject invalid/expired tokens, require a full HTTPS secret identifier containing `/secrets/`, restrict token transmission to Azure Key Vault service suffixes, add API version 7.4 when absent, and return only the secret value. Guided browser acquisition and automatic refresh are not implemented; trusted OAuth result fields must currently be supplied manually.
- Ambient `aws`, `gcloud`, `az`, and `vault` chains remain unchanged when no profile is selected. Child commands are shell-free and retain the 30-second/10 MB process bounds. Direct HTTPS uses the same timeout/response ceiling and fixed or validated service hosts.
- Profile identity upgrades reference approvals and memory-cache identity from legacy `v1` to credential-bound `v2`; HCP app coordinates use `v3`. The generated external tag carries credential ID and optional HCP app name. Deleting a selected record clears local selection. Portable CLI resolution rejects either device-only argument rather than silently using ambient authority.
- React exposes free CRUD for every pinned record family and provider-filtered selection. HCP organization/project/app coordinates and Azure full secret identifiers are visible in the existing resolver surface. No provider secret is rendered after a successful test; only byte length is reported.
- `Secrets and external vaults` remains `Baseline`. Exactly five parity rows remain incomplete: four `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Vendored bundle freshness | Pass — exact UUID/AJV regeneration left `pluginVendored.generated.ts` byte-identical at SHA-256 `733aeb389eacbb540e93e9c577589d70b35f800db57e7254028bd8f7845ac0ef` |
| Focused credential suites | Pass — 6 frontend files/33 tests cover native bridge payloads, complete approval identity, external-tag propagation, portable CLI refusal, exact profile forms, provider filtering, and deletion cleanup; 6 native tests cover record validation/round trip, profile authority, secret-free arguments, HCP URL construction, and cache isolation |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics |
| Full frontend suite | Pass in required partition — 100 regular files/701 tests passed with 2 opt-in integration files/4 tests skipped; the sandboxed aggregate could not bind localhost, and the real MCP loopback file passed separately outside that restriction, so all 702 active tests were observed passing |
| Production and CLI build | Pass — TypeScript, Vite renderer, 1,546 transformed modules, and the 22.6 MB bundled CLI completed; CLI size is 23,680,816 bytes with SHA-256 `3030279aa13eb970ec057604f63473a4db1a161c341978895494c25fefbb9096` |
| Packaged CLI smokes | Pass outside localhost sandbox — template/file grants, authoritative physical store, and full runner/config/plugin/transport/report smoke matrices all passed |
| Native aggregate suite | Pass in complete partition — 184 tests passed with 4 opt-in public/live fixtures ignored and the known login-shell fixture filtered; that fixture passed separately, so all 185 active native tests were observed passing |
| Native formatting and lint | Pass — `cargo fmt --check` and all-target/all-feature strict Clippy completed without diagnostics |

## Focused coverage

- The native store uses a process-local test backend and a serial guard, never the user's real Keychain. It proves exact tagged round trips, provider mismatch/duplicate/path/URL refusal, and the bounded persistence boundary.
- AWS profile regression inspects the direct child command and proves secret access/session values exist only in its environment, never arguments. Provider mismatch is rejected before execution.
- HCP regression proves latest and explicit-version URLs, percent-encoded app/secret segments, and separate cache identities for credential and app changes.
- Template and security regressions prove the sixth credential argument and seventh app argument reach native input and produce distinct `v2`/`v3` approvals.
- Static React regression proves HCP and Azure profile fields, password masking, provider filtering, and selection cleanup after deletion. It does not substitute for rendered interaction QA.
- Portable CLI regression proves a profiled tag cannot silently execute under an ambient official-CLI identity.
- Full frontend/native suites preserve existing local vault, OAuth runtime store, Git credentials, scripts/plugins, all protocol render paths, imports, publication filtering, encrypted sync, project recovery, and CLI behavior.

## Manual/rendered and live-provider QA

Rendered/manual QA remains omitted under the standing project direction. M270 therefore makes no screenshot, observed-click, focus-ring, screen-reader, visual-layout, or real-user-Keychain claim beyond pinned source, static component output, deterministic bridge/native regressions, strict compilation, full suites, and the production renderer.

No real AWS, GCP, Azure, Vault Dedicated, or HCP account was used. M270 proves validated command/environment construction, fixed/validated HTTPS authority, parsing, expiry, bounds, and cache/approval behavior; live provider authorization, policy, tenant, billing, and network compatibility remain environment-dependent.

## Remote gate

Pending the implementation commit's remote `main` verification and signed multi-architecture publication. This section will be amended with the exact workflow, image digest, attestations, Cosign identity, and transparency evidence after that gate completes.

## Acceptance boundary

M270 closes free protected profile CRUD and desktop runtime use for the pinned AWS, GCP, HashiCorp, and Azure credential record families on packaged macOS. It does not claim guided Azure browser authorization/token refresh, non-macOS protected profile storage, script-facing provider APIs, unavailable closed-package implementation details, or broader secret-field UX. Five parity rows remain incomplete, so Brunomnia is not declared feature-complete.
