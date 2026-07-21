# Secrets, encrypted sync, and local governance

Milestone 7 adds a local security control plane without an account or subscription. It is designed so a later real-time server, identity provider, or cloud-vault login adapter does not require moving plaintext secrets into workspace storage.

## Local encrypted vault

The Tauri desktop app stores `local-vault.enc.json` in its application-data directory. The envelope uses AES-256-GCM with a random 128-bit salt, random 96-bit nonce, and a key derived from the user passphrase using PBKDF2-HMAC-SHA256 at 210,000 iterations. Encrypted files have a 50 MB read limit. Writes use a unique create-only temporary file, flush before replacement, reject symlinks, and use mode `0600` on Unix.

By default, the passphrase and decrypted entries exist only in renderer memory while the vault is unlocked. Locking clears both. The optional **Save encrypted vault key locally** control validates the current project vault and stores that project's passphrase as a generic-password item protected by macOS Keychain. No native command returns the saved passphrase: the renderer can inspect only supported/retained booleans, request an unlock that returns decrypted entries, or request a save that reuses the native key. The active project automatically attempts that operation-specific unlock on startup and project switch.

Saved keys are scoped by validated local project ID. A saved key survives soft deletion and restore with its encrypted vault, but reset, individual permanent purge, and Empty Trash remove it. A key that no longer authenticates the current vault is treated as stale and removed before manual entry is requested. Browser development and non-macOS Tauri builds do not claim OS-backed vault-key retention. Losing both the passphrase and its Keychain item is intentionally unrecoverable; reset deletes the encrypted file and saved item after explicit confirmation.

Use a secret in any normal request field with:

```text
{{ vault.orders_api_token }}
```

Local vault variables resolve in HTTP, GraphQL, gRPC, WebSocket/SSE connection fields, OAuth token requests, and non-streaming collection runs. Pre-request and after-response scripts receive no vault data by default. A device-local Preferences grant can expose the currently unlocked entries through `insomnia.vault.get`; imports and shared-project/sync reads reset or preserve local grants instead of accepting them from shared data.

### Private-environment Secret variables

Private global environments can mark a Table row as **Secret** while the local vault is unlocked. The row keeps only its stable ID, name, enabled state, description, and Secret type in workspace data; its `value` is always empty. Plaintext is stored as an owner-bound encrypted vault entry and resolves at runtime as `vault.<row-name>`, including inherited private-environment rows. A direct vault entry with the same runtime name wins deliberately.

Secret inputs are masked by default and can be revealed per row. Creating, editing, deleting, or duplicating one requires the decrypted vault. Changes are encrypted after a 300 ms debounce; a pending save is flushed before project switching or vault locking, and a failed flush leaves the vault unlocked with a visible error. Changing Secret to String or JSON requires confirmation because the decrypted value will enter ordinary workspace data. Raw JSON mode stays unavailable while Secret rows exist, and making that environment shared is blocked until those rows are converted or removed.

Secret rows are accepted only in private global environments. Workspace v46 normalization clears any embedded Secret plaintext, removes Secret rows from public, collection, and folder environments, and forces a private environment containing one back to Table mode. Resetting the encrypted vault also removes its Secret row metadata. Private trees remain omitted from Git/folder projects and encrypted sync; all compatibility exports omit Secret rows even when the user explicitly includes other private values. Insomnia encrypted Secret blobs are non-portable without their account vault key, so imports omit them with an explicit warning rather than preserving unusable ciphertext.

## External vault providers

Brunomnia supports four providers through ambient official command-line logins or protected device profiles:

| Provider | Ambient authority | Protected profile authority |
| --- | --- | --- |
| AWS Secrets Manager | `aws` normal credential chain | Temporary key/session values, credential-file section, or SSO profile/config paths |
| GCP Secret Manager | `gcloud` active account | Absolute service-account key-file path |
| Azure Key Vault | `az` active login | Guided official Azure CLI browser/device-code result containing account identity, RFC 3339 expiry, and access token |
| HashiCorp Vault | `vault` environment/token/agent | On-premises or Vault Dedicated token/AppRole, or HCP Vault Secrets client credentials |

Profiles are free, account-independent, non-syncable records. The packaged macOS app validates at most 100 records, 250 KB aggregate JSON, 32 KB per value, unique IDs, unique provider/name pairs, absolute file paths, HTTP(S) Vault addresses, and Azure expiry before storing the complete list as one generic-password item under the `dev.brunomnia.desktop.external-vault-credentials` Keychain service. Profiles never enter workspace JSON, project records, exports, Git/folder publication, encrypted sync, or browser storage. Browser development and non-macOS Tauri builds do not claim a protected profile store.

AWS temporary secrets are passed only through child environment variables; file/SSO selection uses non-secret profile arguments and credential/config environment paths. GCP uses its credential-file override environment. HashiCorp token/AppRole resolution uses Vault environment variables, with bounded direct AppRole login. HCP Vault Secrets exchanges client credentials and reads the static value through fixed HashiCorp HTTPS hosts. Azure selected profiles send a non-expired token only to validated Azure Key Vault HTTPS service hosts. Ambient mode continues to start the official executable directly with an argument array—never a shell. Resolver child processes and direct HTTPS responses have 30-second and 10 MB bounds. Guided Azure login has a 10-minute ceiling and streams only bounded `az login --output none` status lines; access-token and account command output never enters the renderer.

Template syntax is:

```text
{% external 'provider', 'reference', 'scope', 'field', 'version', 'credential-id', 'app-name' %}
```

The final two arguments are optional and device-local. Without a selected profile, `scope` means AWS region, GCP project, or Azure vault name; `field` selects a HashiCorp KV value. With HCP Vault Secrets, `reference` is the secret name, `scope` is the organization ID, `field` is the project ID, and `app-name` names the HCP application. With an Azure OAuth profile, `reference` is the full Key Vault secret identifier URL and the remaining service coordinates are blank. AWS profile region is used only when the tag does not override it.

Before request rendering can resolve a reference, an owner or admin must approve its exact provider/reference/scope/field/version tuple. Selecting a profile upgrades the identity to include its credential ID; HCP additionally includes the app name. Changing any part requires a new approval and creates a distinct cache entry. The explicit **Test without revealing** action reports only resolved byte length. The memory cache lasts at most 30 minutes and is capped at 20 MB and 256 entries; oversized values are returned without caching.

External tags cover HTTP, GraphQL, OAuth/schema requests, non-streaming collection runs, plugin-mediated HTTP, integrations, generated client code, direct and interactive gRPC, and WebSocket/GraphQL-subscription/SSE/Socket.IO connection and outbound rendering. Portable CLI HTTP/GraphQL runs require `--allow-external-vaults`; they retain ambient official-CLI behavior with the same exact unprofiled allowlist and process/cache bounds. Device-profile or HCP-app arguments are rejected explicitly in the portable CLI rather than falling back to another credential authority. Workspace files cannot grant either process authority to themselves.

The profile CRUD, runtime adapters, and Azure lifecycle are implemented without an entitlement check or Brunomnia account. **Authenticate with Azure** runs official `az login` for the Key Vault scope, **Use device code** exposes its live URL/code instructions, expired profiles show **Renew**, and successful renewal preserves the device-record ID. Brunomnia supplies no borrowed public client ID or hidden app registration. It requests the Key Vault token and active account only after login succeeds, validates the numeric future expiry, and stores the resulting exact `azureOauth` record in the existing macOS Keychain profile list. Silent background renewal, non-macOS protected profile stores, script-facing external-provider APIs, and Secret types outside private global environments are not claimed.

## Local File template tags

The desktop `{% file '/absolute/path.txt' %}` tag reuses the device-local script file grant and allowed-folder list. The host canonicalizes both the requested file and each configured absolute root, rejects traversal and symlink escapes, requires a regular file, caps reads at 5 MB, and returns UTF-8 inspection text. The renderer never receives unrestricted filesystem authority. Browser development, disabled grants, missing roots, and out-of-root paths fail explicitly; File tags cannot write, list directories, or execute content.

The trusted portable CLI has a separate `--allow-template-files` process grant; `--allow-script-files` implies it for compatibility with script-backed workspaces. Either grant also requires one or more invocation-only `-f`/`--dataFolders` roots. The CLI canonicalizes each root and requested regular file, rejects traversal and symlink escapes, and keeps the 5 MB read-only ceiling. It does not consume desktop approved roots, and workspace data cannot persist either the process grant or roots. Keep all grants absent for untrusted workspaces; they provide no write, directory-listing, or execution API.

## Plaintext-secret guardrail

When the vault policy is enabled, Brunomnia scans likely secret-named environment variables (including disabled values), credential-bearing headers and query parameters, embedded URL credentials, authentication, Netrc, client-key and token fields, plus MCP, AI-provider, and Konnect credentials. Managed-folder/Git stage, commit, push, and write operations plus encrypted-sync pushes are blocked until candidates in the exact publishable payload use a complete `vault.*` variable or external-vault tag. Local request/folder tokens plus MCP OAuth tokens and dynamically registered client credentials are removed before that scan and before serialization, so they neither leak nor falsely block publication. Manually configured MCP OAuth client secrets remain configuration and must use a complete protected reference. Integration execution independently rejects raw credential fields. This is a focused guardrail, not a general-purpose secret scanner; request bodies, arbitrary values, repository history, and files changed outside Brunomnia still require review.

## OS-protected OAuth runtime credentials

The packaged macOS app removes request, folder, and MCP OAuth runtime codes, PKCE verifiers, access/identity/refresh tokens, expiry data, and dynamically registered MCP client credentials from ordinary workspace JSON. It serializes only those runtime fields into a versioned AES-256-GCM envelope with a fresh 96-bit nonce, authenticates the local workspace ID as associated data, and limits the plaintext payload to 5 MB. A random 256-bit master key is created once as the `dev.brunomnia.desktop.runtime-credentials` generic-password item in macOS Keychain and cached only for the running process.

Catalog primary and backup files, the legacy workspace file, and deleted-project primary/backup copies migrate before use. The renderer receives decrypted values only for a matching request, folder, or MCP OAuth owner; changing the owner to another authentication family leaves those fields blank. Unsupported envelopes, malformed or oversized values, missing/denied Keychain access, workspace swapping, and authentication-tag failures stop persistence or opening instead of writing plaintext. Folder/Git projects, imports, encrypted sync, and explicit runtime-stripping helpers retain their existing omission boundary. Browser development uses browser-local storage and does not claim OS-backed protection.

## Workspace certificates

The **Certificates** tab stores one optional CA PEM and up to 100 host/port-scoped PEM or PFX/PKCS#12 client identities in the local project catalog. PEM certificate/key text is limited to 1 MiB per field; binary PFX/PKCS#12 bundles are limited to 5 MiB and can carry a masked passphrase. Enabled CA certificates extend native roots without disabling normal platform trust. Enabled client identities use port-aware wildcard matching first and hostname-only fallback second; request-local Transport PEM or PFX material takes precedence.

Portable CLI HTTP/GraphQL runs use request-scoped Undici dispatchers for pinned proxy and TLS overrides. `--httpProxy`, `--httpsProxy`, and `--noProxy` override matching ambient proxy variables; request Custom/Direct policy still wins. `--disableCertValidation`/`-k` disables only target-server validation for that invocation, not HTTPS-proxy validation or global Node behavior. Matching workspace/request CA roots and PEM/PFX client identities are attached only to the affected request.

Ordinary collection CLI `--output` is metadata-safe by construction: it omits environment/effective values, auth, headers, URL/body content, response bodies, cookies, proxy credentials, and certificate material. It retains collection/request documentation plus tests and errors, which can still contain secrets and require review. Existing output directories and non-writable files fail before transport; relative destinations stay under the explicit/configured working-directory base unless an absolute path is intentionally supplied.

Collection CLI `--includeFullData <redact|plaintext>` is an explicit local disclosure path. It requires `--output` plus `--acceptRisk`, and validation completes before any request starts. Plaintext contains final rendered requests, complete responses, effective variables, authentication, proxy settings, and matching certificate identity material. Redacted mode replaces all environment values, authentication secrets, known sensitive request/response headers, Set-Cookie values, proxy URL credentials, and CA/PEM/PFX/key/passphrase fields with `<Redacted by Insomnia>`. It does not scan URLs, bodies, response bodies, assertion/error text, or arbitrary header names. Both modes must be stored and shared as sensitive evidence; the command never uploads them or persists risk acceptance.

Workspace certificate records and passphrases are omitted from split-YAML/Git writes and encrypted-sync payloads, then restored from the current device after reload or pull. They therefore do not trigger the plaintext-publication guardrail. Explicit Brunomnia JSON export remains an intentional disclosure path. Request-local PFX bytes/passphrases follow the same explicit-request export boundary as request-local PEM keys and are flagged before plaintext project publication.

## End-to-end encrypted shared file

Encrypted sync serializes collections, environments, designs, mocks, MCP project configuration, and governance metadata, then encrypts the payload locally before writing a user-selected file. History, response bodies, cookies, runner reports, import history, Git paths/identity, plugins, plugin storage/themes, local vault contents, workspace certificates, request/folder and MCP OAuth tokens plus dynamically registered client credentials, AI/Konnect configuration, and the shared-file path stay device-local. Pull sanitizes incoming OAuth runtime fields before restoring only matching local request/folder, certificate, or MCP-client state. MCP credential references can be shared, but raw MCP bearer/Basic values, manually configured OAuth client secrets, and sensitive headers are blocked by the plaintext-secret guardrail.

Each payload contains a monotonically increasing revision. Push compares the encrypted remote revision to the local base revision and refuses a mismatch. Pull applies shareable data while preserving device-local fields and the current local actor. Force push requires an explicit checkbox and creates the next revision rather than reusing a revision number.

The encrypted file can live on a self-hosted filesystem share, mounted WebDAV volume, or other user-controlled file synchronization system. The storage service sees ciphertext and envelope metadata, not workspace contents or the passphrase. A team currently shares one passphrase; per-user public-key wrapping and revocation remain future work.

## Governance and audit boundary

Workspace v12 retains the v7 owner, admin, editor, and viewer actor model. At least one active owner is required. Owner/admin actors can manage members, allowed storage modes, secret policy, external reference approvals, and audit retention. Editors can publish encrypted revisions and operate integrations; viewers cannot. Audit events record governance and sync operations without secret values and are retained up to the configured bound.

Private sub-environment trees stay on the current device and are omitted from encrypted revisions and project/export payloads. They are an omission boundary rather than encrypted storage; use vault or approved external-vault references for protected secret values. Plaintext policy scanning includes inherited collection and folder variables, headers, and authentication.

These controls are meaningful local policy checks but are not authentication or a tamper-proof log. Anyone who can directly edit the workspace file controls its metadata. Self-hosted SAML/OIDC authentication, SCIM provisioning, organization service, comprehensive RBAC enforcement, signed audit export, real-time presence, and comments are still tracked in [the parity ledger](PARITY.md).
