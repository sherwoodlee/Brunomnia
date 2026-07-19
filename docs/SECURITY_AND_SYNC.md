# Secrets, encrypted sync, and local governance

Milestone 7 adds a local security control plane without an account or subscription. It is designed so a later real-time server, identity provider, or cloud-vault login adapter does not require moving plaintext secrets into workspace storage.

## Local encrypted vault

The Tauri desktop app stores `local-vault.enc.json` in its application-data directory. The envelope uses AES-256-GCM with a random 128-bit salt, random 96-bit nonce, and a key derived from the user passphrase using PBKDF2-HMAC-SHA256 at 210,000 iterations. Encrypted files have a 50 MB read limit. Writes use a unique create-only temporary file, flush before replacement, reject symlinks, and use mode `0600` on Unix.

The passphrase and decrypted entries exist only in renderer memory while the vault is unlocked. Locking clears both. Losing the passphrase is intentionally unrecoverable; reset deletes the encrypted file after explicit confirmation.

Use a secret in any normal request field with:

```text
{{ vault.orders_api_token }}
```

Local vault variables resolve in HTTP, GraphQL, gRPC, WebSocket/SSE connection fields, OAuth token requests, and non-streaming collection runs. Pre-request and after-response scripts receive no vault data by default. A device-local Preferences grant can expose the currently unlocked entries through `insomnia.vault.get`; imports and shared-project/sync reads reset or preserve local grants instead of accepting them from shared data.

## External vault providers

Brunomnia supports four providers through their official command-line clients:

| Provider | Executable and credential source |
| --- | --- |
| AWS Secrets Manager | `aws`; normal AWS CLI credential chain/profile/SSO |
| GCP Secret Manager | `gcloud`; active gcloud account or service-account configuration |
| Azure Key Vault | `az`; active Azure CLI login |
| HashiCorp Vault | `vault`; normal Vault CLI environment/token/agent configuration |

Brunomnia does not persist provider credentials. It starts the executable directly with an argument array—never a shell—rejects option-shaped references, enforces a 30-second limit and 10 MB output limit, and caches resolved values in memory for up to 30 minutes. The cache is capped at 20 MB and 256 entries; values larger than the cache ceiling are returned without being cached. Clearing the cache does not change the provider login.

Template syntax is:

```text
{% external 'provider', 'reference', 'scope', 'field', 'version' %}
```

`scope` means AWS region, GCP project, or Azure vault name. `field` is used for HashiCorp KV responses. `version` is a provider version/stage where supported. Before request rendering can resolve a reference, an owner or admin must approve the exact provider/reference/scope/field/version tuple in **Security & Sync**. Changing any part of that tuple requires a new approval. The explicit **Test without revealing** action can check a reference and reports only its byte length.

External tags cover HTTP, GraphQL, OAuth/schema requests, non-streaming collection runs, plugin-mediated HTTP, integrations, generated client code, direct and interactive gRPC, and WebSocket/GraphQL-subscription/SSE/Socket.IO connection and outbound rendering. Portable CLI HTTP/GraphQL runs require `--allow-external-vaults` in addition to the same exact workspace reference allowlist. The CLI invokes the installed official provider executable directly with the ambient user/service credential chain, applies the same 30-second/10 MB process bounds, rejects malformed or option-shaped values, strictly decodes AWS binary secrets as UTF-8, and keeps at most 20 MB/256 entries in process memory. Workspace files cannot grant this process authority to themselves.

## Local File template tags

The desktop `{% file '/absolute/path.txt' %}` tag reuses the device-local script file grant and allowed-folder list. The host canonicalizes both the requested file and each configured absolute root, rejects traversal and symlink escapes, requires a regular file, caps reads at 5 MB, and returns UTF-8 inspection text. The renderer never receives unrestricted filesystem authority. Browser development, disabled grants, missing roots, and out-of-root paths fail explicitly; File tags cannot write, list directories, or execute content.

The trusted portable CLI has a separate `--allow-template-files` process grant; `--allow-script-files` implies it for compatibility with script-backed workspaces. The CLI does not consume desktop approved roots, so either flag lets the imported workspace name any readable path available to that operating-system process, still under the 5 MB UTF-8 read-only ceiling. Keep both flags absent for untrusted workspaces. They cannot be persisted in workspace data and grant no write, directory-listing, or execution API.

## Plaintext-secret guardrail

When the vault policy is enabled, Brunomnia scans likely secret-named environment variables (including disabled values), credential-bearing headers and query parameters, embedded URL credentials, authentication, Netrc, client-key and token fields, plus MCP, AI-provider, and Konnect credentials. Managed-folder/Git stage, commit, push, and write operations plus encrypted-sync pushes are blocked until candidates in the exact publishable payload use a complete `vault.*` variable or external-vault tag. Local request/folder tokens plus MCP OAuth tokens and dynamically registered client credentials are removed before that scan and before serialization, so they neither leak nor falsely block publication. Manually configured MCP OAuth client secrets remain configuration and must use a complete protected reference. Integration execution independently rejects raw credential fields. This is a focused guardrail, not a general-purpose secret scanner; request bodies, arbitrary values, repository history, and files changed outside Brunomnia still require review.

## Workspace certificates

The **Certificates** tab stores one optional CA PEM and up to 100 host/port-scoped PEM or PFX/PKCS#12 client identities in the local project catalog. PEM certificate/key text is limited to 1 MiB per field; binary PFX/PKCS#12 bundles are limited to 5 MiB and can carry a masked passphrase. Enabled CA certificates extend native roots without disabling normal platform trust. Enabled client identities use port-aware wildcard matching first and hostname-only fallback second; request-local Transport PEM or PFX material takes precedence.

Workspace certificate records and passphrases are omitted from split-YAML/Git writes and encrypted-sync payloads, then restored from the current device after reload or pull. They therefore do not trigger the plaintext-publication guardrail. Explicit Brunomnia JSON export remains an intentional disclosure path. Request-local PFX bytes/passphrases follow the same explicit-request export boundary as request-local PEM keys and are flagged before plaintext project publication.

## End-to-end encrypted shared file

Encrypted sync serializes collections, environments, designs, mocks, MCP project configuration, and governance metadata, then encrypts the payload locally before writing a user-selected file. History, response bodies, cookies, runner reports, import history, Git paths/identity, plugins, plugin storage/themes, local vault contents, workspace certificates, request/folder and MCP OAuth tokens plus dynamically registered client credentials, AI/Konnect configuration, and the shared-file path stay device-local. Pull sanitizes incoming OAuth runtime fields before restoring only matching local request/folder, certificate, or MCP-client state. MCP credential references can be shared, but raw MCP bearer/Basic values, manually configured OAuth client secrets, and sensitive headers are blocked by the plaintext-secret guardrail.

Each payload contains a monotonically increasing revision. Push compares the encrypted remote revision to the local base revision and refuses a mismatch. Pull applies shareable data while preserving device-local fields and the current local actor. Force push requires an explicit checkbox and creates the next revision rather than reusing a revision number.

The encrypted file can live on a self-hosted filesystem share, mounted WebDAV volume, or other user-controlled file synchronization system. The storage service sees ciphertext and envelope metadata, not workspace contents or the passphrase. A team currently shares one passphrase; per-user public-key wrapping and revocation remain future work.

## Governance and audit boundary

Workspace v12 retains the v7 owner, admin, editor, and viewer actor model. At least one active owner is required. Owner/admin actors can manage members, allowed storage modes, secret policy, external reference approvals, and audit retention. Editors can publish encrypted revisions and operate integrations; viewers cannot. Audit events record governance and sync operations without secret values and are retained up to the configured bound.

Private sub-environment trees stay on the current device and are omitted from encrypted revisions and project/export payloads. They are an omission boundary rather than encrypted storage; use vault or approved external-vault references for protected secret values. Plaintext policy scanning includes inherited collection and folder variables, headers, and authentication.

These controls are meaningful local policy checks but are not authentication or a tamper-proof log. Anyone who can directly edit the workspace file controls its metadata. Self-hosted SAML/OIDC authentication, SCIM provisioning, organization service, comprehensive RBAC enforcement, signed audit export, real-time presence, and comments are still tracked in [the parity ledger](PARITY.md).
