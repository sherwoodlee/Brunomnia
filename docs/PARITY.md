# Insomnia feature-parity ledger

Last reconciled: **2026-07-16** against the current Kong Developer documentation for Insomnia.

This is the authoritative claim ledger for Brunomnia. A roadmap item being implemented does not make its row complete: `Complete` requires compatible user-visible behavior plus reproducible tests; `Baseline` means a useful subset exists with named gaps; `Not started` means no parity claim is made.

## Capability ledger

| Capability family | Brunomnia status | Current evidence and remaining gap | Insomnia reference |
| --- | --- | --- | --- |
| Local projects and persistence | Baseline | Versioned local workspace with atomic native persistence and no account requirement. Multiple projects/vault management and recovery UI remain. | [Storage options](https://developer.konghq.com/insomnia/storage/) |
| Collections, requests, environments, and history | Baseline | Editable collections/requests, environment/iteration/request-local variables, dynamic aliases, chained response values, and the last 100 results exist. Nested resource models, environment inheritance, tag-builder UX, and collected-data breadth remain. | [Collections](https://developer.konghq.com/insomnia/collections/), [environments](https://developer.konghq.com/insomnia/environments/) |
| REST/HTTP execution | Baseline | Native execution, response inspection, redirects, timeouts, TLS validation, proxy exclusions, domain-scoped PEM identity, and per-request cookie policy work. HTTP version controls, timelines, compression/client-network details, and browser forbidden-header limits remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| GraphQL | Baseline | Query, variables, operation name, templating, native execution, and response inspection. Schema fetching/browsing, persisted queries, and richer GraphQL tooling remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| WebSocket | Baseline | Native text and base64/file binary composition, headers, ordered events, and bounded runner samples work. Custom proxy/client identity and richer message collections remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| Server-Sent Events | Baseline | Native incremental parsing covers chunking, CRLF, comments, event names, multiline data, and bounded runner samples. Reconnect/long-run controls remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| gRPC | Baseline | Reflection, pasted proto compilation, dynamic JSON/protobuf mapping, and all four call shapes. Importable proto trees and additional metadata/schema workflows remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| Request bodies | Baseline | JSON, text, URL-encoded, multipart text/files with duplicate fields and editable part filename/content type, and binary payloads work; CLI supports the same finite modes. Arbitrary per-part headers and some encoding compatibility remain. | [Collections](https://developer.konghq.com/insomnia/collections/) |
| Request authentication | Baseline | All documented families have editable execution paths: Basic, Digest, OAuth 1/2, NTLM, AWS IAM v4, Bearer, API key, Hawk, Atlassian ASAP, and Netrc. Automated OAuth callback capture, credential-vault storage, uncommon challenge variants, and cross-platform integration fixtures remain. | [Request authentication](https://developer.konghq.com/insomnia/request-authentication/) |
| Cookies, chaining, and dynamic variables | Baseline | Persistent editable jar, automatic native Set-Cookie storage, send/store policy, response chaining/JSONPath, environment/iteration/local variables, and a broad safe tag subset work. File/external-vault tags, full Faker/JSONPath breadth, and guided tag-builder UX remain. | [Template tags](https://developer.konghq.com/insomnia/template-tags/), [dynamic variables](https://developer.konghq.com/insomnia/dynamic-variables/), [request chaining](https://developer.konghq.com/how-to/chain-requests/) |
| API specification design | Baseline | OpenAPI 3.x editor, formatter, structural linter, preview, request generation, and safe local Spectral-style custom rules work. Full Spectral functions, remote/package `extends`, multi-file references, and richer tooling remain. | [API specifications](https://developer.konghq.com/insomnia/api-specs/) |
| Pre-request and after-response scripts | Baseline | Permission-bounded execution now covers environment/base/collection/local/iteration variables, request getters/setters, response headers/cookies, console capture, and Jest/Chai-style assertions. Script-originated network access, modules, and the full Insomnia API remain intentionally unavailable. | [Scripts](https://developer.konghq.com/insomnia/scripts/) |
| Collection runner and automated tests | Baseline | Ordered data-driven runs, retries/delay/cancellation, local/environment propagation, cookie/response chaining, bounded WebSocket/SSE samples, assertions, and reports work. Rich report export, all protocol semantics, and Inso breadth remain. | [Collections and runner](https://developer.konghq.com/insomnia/collections/) |
| Mock servers | Baseline | Real native loopback mock server with routes, parameters, headers, delays, CORS, and three dynamic tokens. Liquid/Faker breadth, response-to-mock generation, hosted/self-host deployment workflows, and AI generation remain. | [Mock servers](https://developer.konghq.com/insomnia/mock-servers/) |
| Headless CLI and CI | Baseline | Bundled CLI lints/generates/exports OpenAPI and runs HTTP/GraphQL collections/tests with shared runner logic. Inso command/flag/report breadth and signed containers remain. | [Inso CLI](https://developer.konghq.com/inso-cli/), [CLI reference](https://developer.konghq.com/inso-cli/reference/) |
| Import and export formats | Baseline | Existing formats/scopes now also map advanced Insomnia/Postman auth and round-trip Insomnia v4/v5 cookie jars. Folder flattening, partial scripts, external files, WSDL placeholders, Socket.IO/MCP downgrades, and omitted binary bytes remain explicit bounds. | [Import/export reference](https://developer.konghq.com/insomnia/import-export/) |
| Git Sync and version control | Baseline | Split-YAML projects in standard repositories now support init/clone/status, stage/unstage, working/staged diff, commits, local branches, remotes, pull/push, merge, three-way text resolution, binary side selection, and abort. Commit history UI, provider-specific authentication/onboarding, rebase/cherry-pick, automatic discovery, and broader edge-case fixtures remain. | [Storage and Git Sync](https://developer.konghq.com/insomnia/storage/), [Git Sync](https://developer.konghq.com/insomnia/git-sync/) |
| Plugins and extension API | Baseline | Disabled-by-default local CommonJS plugins run in disposable Workers with explicit grants. Request/response hooks, custom tags, actions, themes, local store, notifications, and mediated network/prompt/clipboard APIs work for HTTP, GraphQL, gRPC, and collection runs. Remote/npm dependency installation, discovery/hot reload, streaming hooks, complete context/hook coverage, and ecosystem compatibility remain. | [Plugins](https://developer.konghq.com/insomnia/plugins/), [plugin reference](https://developer.konghq.com/insomnia/plugins/plugin-reference/), [hooks and actions](https://developer.konghq.com/insomnia/plugins/hooks-and-actions/) |
| Secrets and external vaults | Baseline | A passphrase-derived AES-256-GCM local vault keeps decrypted values in memory and resolves `vault.*` variables. AWS, GCP, Azure, and HashiCorp template tags use installed official CLI credential chains, a bounded memory cache, and per-reference approval. Private environment hierarchy, OS-keychain wrapping, provider-native login UX/SDKs, script vault namespace, headless adapters, and broader secret-field UX remain. | [External vault integration](https://developer.konghq.com/insomnia/external-vault/), [environments](https://developer.konghq.com/insomnia/environments/) |
| Cloud sync and collaboration | Baseline | A user-controlled shared file now carries filtered workspace data under AES-256-GCM E2EE with pull/push revisions, conflict rejection, explicit force, local actor labels, and no hosted dependency. Git remains available for branch/commit workflows. Per-user key wrapping, real-time sync/presence, comments, resource-specific cloud branches/history, discovery, and offline merge UI remain. | [Storage options](https://developer.konghq.com/insomnia/storage/), [data security](https://developer.konghq.com/insomnia/end-to-end-encryption/) |
| MCP clients | Not started | HTTP/STDIO connections, discovery, cached tools/prompts/resources, execution, and project serialization remain. | [MCP clients](https://developer.konghq.com/insomnia/mcp-clients-in-insomnia/) |
| AI-assisted workflows | Not started | User-selected hosted/custom/local model configuration, mock generation, and Git commit grouping remain. These must be optional and usable without a Brunomnia subscription. | [AI in Insomnia](https://developer.konghq.com/insomnia/ai-in-insomnia/) |
| Service integrations | Not started | Konnect/Gateway testing and other product-specific adapters in the current documentation remain. | [Insomnia documentation](https://developer.konghq.com/insomnia/) |
| SSO, RBAC, SCIM, audit, and organization controls | Early baseline | Workspace v7 has normalized owner/admin/editor/viewer actors, last-owner protection, storage/secret/external-reference policy checks, encrypted-sync edit enforcement, and bounded local audit events. These are local controls, not identity proof. Self-hosted SAML/OIDC, SCIM, authenticated organization service, complete RBAC enforcement, and tamper-evident audit export remain. | [Authentication and authorization](https://developer.konghq.com/insomnia/authentication-authorization/), [SSO](https://developer.konghq.com/insomnia/sso/), [SCIM](https://developer.konghq.com/insomnia/scim/) |
| Preferences, shortcuts, themes, accessibility, and packaging | Early baseline | Responsive keyboard-accessible core UI and a macOS Tauri app bundle exist. Full preferences/shortcut/theme compatibility, accessibility audit, updater, signing, and Windows/Linux release artifacts remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |

## Milestone 3 acceptance evidence

- Shared design and generation engine: [`src/lib/openapi.ts`](../src/lib/openapi.ts) and [`src/lib/openapi.test.ts`](../src/lib/openapi.test.ts)
- Permission-bounded browser runtime: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts)
- Shared runner and data parser: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Native loopback server and integration test: [`src-tauri/src/mock_server.rs`](../src-tauri/src/mock_server.rs)
- Headless entry point and offline fixture: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`examples/cli-workspace.json`](../examples/cli-workspace.json)
- UI surfaces: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Exact verification record: [`docs/QA.md`](QA.md)

## Milestone 4 acceptance evidence

- Format detection and adapter routing: [`src/lib/interchange/index.ts`](../src/lib/interchange/index.ts)
- Insomnia, Postman, HAR, cURL, API definition, and WSDL converters: [`src/lib/interchange/`](../src/lib/interchange/)
- Scoped compatibility exports and round-trip tests: [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts) and [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts)
- Import fixtures for every adapter: [`examples/imports/`](../examples/imports/)
- Pre-apply warning and export-preview UI: [`src/components/InterchangeDialogs.tsx`](../src/components/InterchangeDialogs.tsx)
- Collision-safe application and workspace v4 migration: [`src/lib/interchange/apply.ts`](../src/lib/interchange/apply.ts) and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Exact verification record: [`docs/QA_MILESTONE_4.md`](QA_MILESTONE_4.md)

## Milestone 5 acceptance evidence

- Advanced signers, OAuth helpers, and native challenge handlers: [`src/lib/auth.ts`](../src/lib/auth.ts) and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Persistent cookie and template/chaining engines: [`src/lib/cookies.ts`](../src/lib/cookies.ts) and [`src/lib/templates.ts`](../src/lib/templates.ts)
- Auth, cookie, transport, multipart, and binary WebSocket UI: [`src/components/AuthEditor.tsx`](../src/components/AuthEditor.tsx), [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx), and [`src/App.tsx`](../src/App.tsx)
- Runner/script/custom-ruleset compatibility: [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts), and [`src/lib/openapi.ts`](../src/lib/openapi.ts)
- Advanced interoperability and workspace v5 migration: [`src/lib/interchange/`](../src/lib/interchange/) and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Exact verification record: [`docs/QA_MILESTONE_5.md`](QA_MILESTONE_5.md)

## Milestone 6 acceptance evidence

- Split-YAML ownership, symlink confinement, standard Git operations, and conflicts: [`src-tauri/src/project.rs`](../src-tauri/src/project.rs)
- Native local package reader and Tauri command boundary: [`src-tauri/src/plugin.rs`](../src-tauri/src/plugin.rs) and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Git status/diff/branch/remote/conflict UI: [`src/components/ProjectWorkbench.tsx`](../src/components/ProjectWorkbench.tsx)
- Permissioned plugin Worker, compatibility adapter, and tests: [`src/lib/plugins.ts`](../src/lib/plugins.ts) and [`src/lib/plugins.test.ts`](../src/lib/plugins.test.ts)
- Disabled-by-default installation and per-capability grant UI: [`src/components/PluginWorkbench.tsx`](../src/components/PluginWorkbench.tsx)
- Request/runner integration and workspace v6 migration: [`src/lib/http.ts`](../src/lib/http.ts), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- User guides: [`docs/GIT_PROJECTS.md`](GIT_PROJECTS.md) and [`docs/PLUGINS.md`](PLUGINS.md)
- Exact verification record: [`docs/QA_MILESTONE_6.md`](QA_MILESTONE_6.md)

## Milestone 7 acceptance evidence

- AES-GCM vault and revision-checked encrypted sync: [`src-tauri/src/secure_store.rs`](../src-tauri/src/secure_store.rs)
- Four-family bounded official-CLI adapter and memory cache: [`src-tauri/src/external_vault.rs`](../src-tauri/src/external_vault.rs)
- Shareable-scope filtering, vault variables, policy scanning, audit helper, and tests: [`src/lib/security.ts`](../src/lib/security.ts) and [`src/lib/security.test.ts`](../src/lib/security.test.ts)
- Vault, external-provider, encrypted-sync, member/role, policy, and audit UI: [`src/components/SecurityWorkbench.tsx`](../src/components/SecurityWorkbench.tsx)
- Request/OAuth/runner template integration: [`src/lib/http.ts`](../src/lib/http.ts), [`src/components/AuthEditor.tsx`](../src/components/AuthEditor.tsx), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Workspace v7 migration normalization and policy-safe Git persistence: [`src/lib/storage.ts`](../src/lib/storage.ts) and [`src/components/ProjectWorkbench.tsx`](../src/components/ProjectWorkbench.tsx)
- User guide: [`docs/SECURITY_AND_SYNC.md`](SECURITY_AND_SYNC.md)
- Exact verification record: [`docs/QA_MILESTONE_7.md`](QA_MILESTONE_7.md)

## Parity declaration rule

Brunomnia must not be described as feature-complete while any row is `Baseline`, `Early baseline`, or `Not started`. Before a parity release, re-read the current Insomnia documentation and changelog, add newly documented capability rows, and attach reproducible evidence for every row. Commercial availability in Insomnia does not remove a capability from this ledger; Brunomnia's implementation remains governed by [the free feature policy](FREE_FEATURE_POLICY.md).
