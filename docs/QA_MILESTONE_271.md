# Milestone 271 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: close the pinned Azure Cloud Credential lifecycle gap with free, account-independent, official Azure CLI browser/device-code authentication, visible pending instructions, exact protected-profile capture, expiry warning, and explicit identity-preserving renewal.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `ui/components/settings/cloud-service-credentials.tsx` starts Azure authorization through `openAuthUrl`, labels an expired credential, offers **Renew**, and omits the ordinary edit action for Azure records.
- `ui/src/root.tsx` handles `insomnia://oauth/azure/authenticate` and exchanges the returned code. The OAuth application configuration comes from `/v1/oauth/azure/config`, so copying a hosted public client identifier would create a hidden upstream account dependency.
- The optional `@kong/insomnia-plugin-external-vault` runtime is not present in the source tree. Brunomnia therefore adapts the proven lifecycle with Microsoft's official Azure CLI rather than inferring unavailable package internals or borrowing Kong's application registration.

## Implementation

- **Authenticate with Azure** starts `az login --scope https://vault.azure.net/.default --output none --only-show-errors`; **Use device code** adds only `--use-device-code`. Both commands are direct argument arrays, never shell strings, and have a 10-minute interactive ceiling.
- Bounded stdout and stderr line readers relay only login status through a typed Tauri channel. Device URL/code instructions become visible before process completion. React retains at most the latest eight lines. Channel closure does not interrupt Azure CLI cleanup.
- After successful login, separate bounded `az account get-access-token --resource https://vault.azure.net` and `az account show` commands run without event streaming. Their output never reaches React or command arguments.
- Native conversion requires a non-empty token, numeric future `expires_on`, active account username, and subscription ID with tenant fallback, then produces the exact `azureOauth` shape already validated and stored by the macOS Keychain profile store.
- Azure profile fields have no manual editor. Expired records show **Token expired** and **Renew**. Renewal targets the existing record ID; a matching normalized username also replaces the prior identity rather than creating a duplicate.
- No plan, license, Brunomnia account, telemetry, borrowed public client ID, client secret, or hosted callback is involved. Ambient Azure Key Vault resolution remains available when no protected profile is selected.
- `Secrets and external vaults` remains `Baseline`. Exactly five parity rows remain incomplete: four `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Vendored bundle freshness | Pass — exact UUID/AJV regeneration left `pluginVendored.generated.ts` byte-identical at SHA-256 `733aeb389eacbb540e93e9c577589d70b35f800db57e7254028bd8f7845ac0ef` |
| Focused Azure suites | Pass — 2 frontend files/5 tests cover native browser/device-code channel payloads, live status relay, expired/Renew/no-edit rendering, device-code fallback, and identity-preserving upsert; 7 native external-vault tests cover command construction, streamed lines, profile conversion, authority, URLs, parsing, and cache identity |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics |
| Full frontend suite | Pass in required partition — 100 regular files/703 tests passed with 2 opt-in integration files/4 tests skipped; the real MCP loopback file passed separately, so all 704 active tests were observed passing |
| Production and CLI build | Pass — TypeScript, Vite renderer, 1,546 transformed modules, and the 22.6 MB bundled CLI completed; CLI size is 23,680,816 bytes with SHA-256 `3030279aa13eb970ec057604f63473a4db1a161c341978895494c25fefbb9096`, byte-identical to the committed artifact |
| Packaged CLI smokes | Pass outside localhost sandbox — template/file grants, authoritative physical store, and full runner/config/plugin/transport/report smoke matrices all passed |
| Native aggregate suite | Pass in complete partition — a clean unrestricted aggregate rerun passed 187 tests with 4 opt-in public/live fixtures ignored and the login-shell fixture filtered; that fixture passed separately, so all 188 active native tests were observed passing. One prior unrestricted aggregate attempt saw an unrelated MCP test-server connection-reset race; the exact fixture and complete rerun both passed |
| Native formatting and lint | Pass — `cargo fmt --check`, locked Cargo check, and all-target/all-feature strict Clippy completed without diagnostics |

## Focused coverage

- Command regression proves browser and device-code argument arrays request only the Key Vault default scope and contain no token value.
- Channel regression serializes each bounded login line immediately as `{ kind: "status", message }`; token and account commands have no channel parameter.
- Conversion regression proves numeric epoch expiry becomes RFC 3339, subscription identity wins with tenant fallback, username and token are retained exactly, and expired output fails closed.
- Native bridge regression proves both authentication modes carry distinct Tauri channels and deliver status to the caller.
- Static React regression proves expired state, Renew, device-code fallback, and absence of Azure Edit, while pure upsert regression proves ID preservation.

## Manual/rendered and live-provider QA

Rendered/manual QA remains omitted under the standing project direction. M271 therefore makes no screenshot, observed-click, focus-ring, screen-reader, visual-layout, real-user-Keychain, or real-browser claim beyond pinned source, static component output, deterministic channel/native regressions, strict compilation, full suites, and the production renderer.

No real Azure tenant was used. M271 proves official CLI argument construction, bounded streaming, secret-bearing output isolation, profile parsing, expiry, persistence handoff, and UI lifecycle state. Installed CLI version, browser launch, tenant policy, conditional access, interactive consent, device-code availability, subscription selection, billing, and network compatibility remain environment-dependent.

## Remote gate

Pending implementation publication and immutable workflow/signing evidence.

## Acceptance boundary

M271 closes guided Azure protected-profile acquisition and explicit renewal on packaged macOS without an account or paid gate. It does not claim silent background renewal, non-macOS protected profile storage, script-facing provider APIs, unavailable closed-package implementation details, or broader secret-field UX. Five parity rows remain incomplete, so Brunomnia is not declared feature-complete.
