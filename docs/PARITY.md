# Insomnia feature-parity ledger

Last reconciled: **2026-07-17** against the current Kong Developer documentation for Insomnia.

This is the authoritative claim ledger for Brunomnia. A roadmap item being implemented does not make its row complete: `Complete` requires compatible user-visible behavior plus reproducible tests; `Baseline` means a useful subset exists with named gaps; `Not started` means no parity claim is made.

## Capability ledger

| Capability family | Brunomnia status | Current evidence and remaining gap | Insomnia reference |
| --- | --- | --- | --- |
| Local projects and persistence | Baseline | Versioned local workspace with atomic native persistence and no account requirement. Multiple projects/vault management and recovery UI remain. | [Storage options](https://developer.konghq.com/insomnia/storage/) |
| Collections, requests, environments, and history | Baseline | Editable collections/requests, nested folders, collection/folder/request documentation, inherited folder headers/auth/scripts/variables, distinct global-base/selected-global and collection-base/selected-collection editors, device-local private global sub-environments, iteration/request-local variables, delayed/repeating sends, custom methods, explicit path/query rows, descriptions, multiline values, and the last 100 results exist. Drag/drop ordering, richer resource actions, tag-builder UX, and collected-data breadth remain. | [Collections](https://developer.konghq.com/insomnia/collections/), [environments](https://developer.konghq.com/insomnia/environments/), [requests](https://developer.konghq.com/insomnia/requests/) |
| REST/HTTP execution | Baseline | Native execution, custom token-valid methods, encoded `{path}` substitution, repeated query keys, response inspection, redirects, timeouts, TLS validation, proxy exclusions, domain-scoped PEM identity, and per-request cookie policy work. Local code generation covers six client targets with named payload/signing bounds. HTTP version controls, compression/client-network details, and browser forbidden-header limits remain. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| GraphQL | Baseline | Query, templated variables, operation name, native execution, bounded/cached introspection, automatic selection/URL refresh, structural and cached-root validation, documentation browsing, and safe root-field insertion work. Persisted queries, full language-service validation/autocomplete, subscriptions, and richer schema workflows remain. | [GraphQL](https://developer.konghq.com/insomnia/graphql/) |
| WebSocket | Baseline | Native text and base64/file binary composition, headers, ordered events, and bounded runner samples work. Custom proxy/client identity and richer message collections remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| Server-Sent Events | Baseline | Native incremental parsing covers chunking, CRLF, comments, event names, multiline data, and bounded runner samples. Reconnect/long-run controls remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| gRPC | Baseline | Reflection, pasted proto compilation, dynamic JSON/protobuf mapping, and all four call shapes. Importable proto trees and additional metadata/schema workflows remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| Request bodies | Baseline | JSON, text, URL-encoded, multipart text/files with duplicate fields and editable part filename/content type, binary payloads, and local JSON/conservative-XML beautification work; CLI supports the same finite modes. Arbitrary per-part headers and some encoding compatibility remain. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| Request authentication | Baseline | All documented families have editable execution paths: Basic, Digest, OAuth 1/2, NTLM, AWS IAM v4, Bearer, API key, Hawk, Atlassian ASAP, and Netrc. Automated OAuth callback capture, credential-vault storage, uncommon challenge variants, and cross-platform integration fixtures remain. | [Request authentication](https://developer.konghq.com/insomnia/request-authentication/) |
| Cookies, chaining, and dynamic variables | Baseline | Persistent editable jar, automatic primary/secondary-request Set-Cookie storage, send/store policy, response chaining/JSONPath, seven-level base/selected global/collection/folder/iteration/local precedence with disabled-row masking, and a broad safe tag subset work. File/external-vault tags, full Faker/JSONPath breadth, and guided tag-builder UX remain. | [Template tags](https://developer.konghq.com/insomnia/template-tags/), [dynamic variables](https://developer.konghq.com/insomnia/dynamic-variables/), [request chaining](https://developer.konghq.com/how-to/chain-requests/) |
| API specification design | Baseline | OpenAPI 3.x editor, formatter, structural linter, preview, request generation, and safe local Spectral-style custom rules work. Full Spectral functions, remote/package `extends`, multi-file references, and richer tooling remain. | [API specifications](https://developer.konghq.com/insomnia/api-specs/) |
| Pre-request and after-response scripts | Baseline | Disposable desktop Workers cover distinct global/collection base and selected stores, documented seven-level aliases/priority, ID/name parent folders, query-string/object URL mutation, keyed-array Basic/Bearer/API-key updates, proxy/certificate helpers, response facades, ordered async tests, every currently documented public `chai.assert` method name through one bounded adapter, all currently documented external-library and Node-module names, separately opt-in local binary/multipart/PEM attachment, and mediated HTTP/vault access with cookie/response continuity. Exact Chai internals and full chainable `expect`, npm-package/Lodash behavior, PFX and secondary-request file sources, external-vault scripts, and stronger portable CLI isolation remain. Deprecated Postman interfaces are explicitly unsupported upstream, not a parity requirement. | [Scripts](https://developer.konghq.com/insomnia/scripts/), [Chai assert API](https://www.chaijs.com/api/assert/), [environments](https://developer.konghq.com/insomnia/environments/) |
| Collection runner and automated tests | Baseline | Ordered data-driven runs, retries/delay/cancellation, separated global/collection/folder/iteration/local propagation, disabled-row masking, primary/secondary cookie/response chaining, bounded WebSocket/SSE samples, ordered async assertions, and reports work. Rich report export, all protocol semantics, and Inso breadth remain. | [Collections and runner](https://developer.konghq.com/insomnia/collections/) |
| Mock servers | Baseline | Real native loopback mock server with routes, parameters, headers, delays, CORS, three dynamic tokens, and optional prompt/spec/example-driven AI generation. Liquid/Faker breadth, automatic response/URL-to-mock generation, and hosted/self-host deployment workflows remain. | [Mock servers](https://developer.konghq.com/insomnia/mock-servers/) |
| Headless CLI and CI | Baseline | Bundled CLI lints/generates/exports OpenAPI and runs HTTP/GraphQL collections/tests with shared runner logic. Workspace JavaScript is disabled by default, with separate trusted-script and secondary-network flags. Inso command/flag/report breadth, stronger portable script isolation, and signed containers remain. | [Inso CLI](https://developer.konghq.com/inso-cli/), [CLI reference](https://developer.konghq.com/inso-cli/reference/) |
| Import and export formats | Baseline | Existing formats/scopes map advanced Insomnia/Postman auth, scope-aware Postman scripts and collection variables, custom HTTP methods, explicit path/query/header rows with descriptions and multiline values, OpenAPI path parameters, cookie jars, distinct Insomnia v4/v5 collection base/sub-environments, standalone v5 global environments, and nested folders with headers/auth/variables/scripts/docs. Partial/deprecated scripts, external files, WSDL placeholders, Socket.IO/MCP downgrades, and omitted binary bytes remain explicit bounds. | [Import/export reference](https://developer.konghq.com/insomnia/import-export/) |
| Git Sync and version control | Baseline | Split-YAML projects in standard repositories now support init/clone/status, stage/unstage, working/staged diff, commits, local branches, remotes, pull/push, merge, three-way text resolution, binary side selection, and abort. Commit history UI, provider-specific authentication/onboarding, rebase/cherry-pick, automatic discovery, and broader edge-case fixtures remain. | [Storage and Git Sync](https://developer.konghq.com/insomnia/storage/), [Git Sync](https://developer.konghq.com/insomnia/git-sync/) |
| Plugins and extension API | Baseline | Disabled-by-default local CommonJS plugins run in disposable Workers with explicit grants. Request/response hooks, custom tags, actions, themes, local store, notifications, and mediated network/prompt/clipboard APIs work for HTTP, GraphQL, gRPC, and collection runs. Remote/npm dependency installation, discovery/hot reload, streaming hooks, complete context/hook coverage, and ecosystem compatibility remain. | [Plugins](https://developer.konghq.com/insomnia/plugins/), [plugin reference](https://developer.konghq.com/insomnia/plugins/plugin-reference/), [hooks and actions](https://developer.konghq.com/insomnia/plugins/hooks-and-actions/) |
| Secrets and external vaults | Baseline | A passphrase-derived AES-256-GCM local vault keeps decrypted values in memory, resolves `vault.*` variables, and can be exposed to desktop scripts only through a device-local off-by-default grant. Device-local private sub-environment trees are omitted from exports/projects/encrypted sync. AWS, GCP, Azure, and HashiCorp tags use installed official CLI credential chains, a memory cache, and per-reference approval. OS-keychain wrapping, provider-native login UX/SDKs, headless adapters, script access to external providers, and broader secret-field UX remain. | [External vault integration](https://developer.konghq.com/insomnia/external-vault/), [environments](https://developer.konghq.com/insomnia/environments/) |
| Cloud sync and collaboration | Baseline | A user-controlled shared file now carries filtered workspace data under AES-256-GCM E2EE with pull/push revisions, conflict rejection, explicit force, local actor labels, and no hosted dependency. Git remains available for branch/commit workflows. Per-user key wrapping, real-time sync/presence, comments, resource-specific cloud branches/history, discovery, and offline merge UI remain. | [Storage options](https://developer.konghq.com/insomnia/storage/), [data security](https://developer.konghq.com/insomnia/end-to-end-encryption/) |
| MCP clients | Baseline | Multiple project-scoped HTTP/STDIO clients support initialization, paginated discovery/caching of tools/prompts/resources/templates, invocation, roots, JSON/SSE parsing, session IDs, vault-backed credentials, event records, and split-YAML serialization. HTTP OAuth, long-lived streaming, cancellation, elicitation, reviewed sampling, notification response UI, persistent STDIO sessions, and guided resource-template arguments remain. | [MCP clients](https://developer.konghq.com/insomnia/mcp-clients-in-insomnia/) |
| AI-assisted workflows | Baseline | Optional OpenAI, Anthropic, Gemini, and custom/local OpenAI-compatible configuration drives bounded mock generation and reviewable Git commit grouping. Credentials are vault-backed and no Brunomnia account/model is required. Direct `.gguf` loading, automatic URL/response-to-mock context, and reviewed MCP sampling remain. | [AI in Insomnia](https://developer.konghq.com/insomnia/ai-in-insomnia/) |
| Service integrations | Baseline | A pull-only Konnect adapter lists control planes and maps Gateway Services plus HTTP/HTTPS Routes while preserving local request work and recording unsupported routes. Live-tenant fixtures, SNI/TCP/UDP execution, bidirectional configuration, and any newly documented adapters remain. | [Konnect integration](https://developer.konghq.com/insomnia/konnect-integration/) |
| SSO, RBAC, SCIM, audit, and organization controls | Early baseline | Workspace v14 retains normalized owner/admin/editor/viewer actors, last-owner protection, storage/secret/external-reference policy checks, encrypted-sync and integration edit enforcement, device-local script authorities, and bounded local audit events. These are local controls, not identity proof. Self-hosted SAML/OIDC, SCIM, authenticated organization service, complete RBAC enforcement, and tamper-evident audit export remain. | [Authentication and authorization](https://developer.konghq.com/insomnia/authentication-authorization/), [SSO](https://developer.konghq.com/insomnia/sso/), [SCIM](https://developer.konghq.com/insomnia/scim/) |
| Preferences, shortcuts, themes, accessibility, and packaging | Baseline | Device-local system/dark/light themes, comfortable/compact density, editor font sizing, request/script defaults, off-by-default script network/file/vault grants, delete confirmation, GraphQL auto-introspection preference, eleven editable shortcuts with collision warnings—including Generate Code—sidebar toggling, and a macOS Tauri app bundle exist. Full command/action coverage, accessibility audit, updater, signing/notarization, and Windows/Linux release artifacts remain. | [Keyboard shortcuts](https://developer.konghq.com/insomnia/keyboard-shortcuts/), [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |

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

## Milestone 8 acceptance evidence

- MCP HTTP protocol/session/discovery/invocation implementation and parser tests: [`src/lib/mcp.ts`](../src/lib/mcp.ts) and [`src/lib/mcp.test.ts`](../src/lib/mcp.test.ts)
- Direct-process bounded MCP STDIO implementation and native tests: [`src-tauri/src/mcp_stdio.rs`](../src-tauri/src/mcp_stdio.rs)
- Hosted/custom/local provider adapters, structured-output validation, mock generation, Git suggestions, and tests: [`src/lib/ai.ts`](../src/lib/ai.ts) and [`src/lib/ai.test.ts`](../src/lib/ai.test.ts)
- Konnect pagination confinement, mapping/preservation logic, and tests: [`src/lib/konnect.ts`](../src/lib/konnect.ts) and [`src/lib/konnect.test.ts`](../src/lib/konnect.test.ts)
- Disabled-by-default integration configuration and operation UI: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- AI mock and Git suggestion review surfaces: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/components/ProjectWorkbench.tsx`](../src/components/ProjectWorkbench.tsx)
- Workspace v8 normalization, authority stripping, project serialization, and plaintext credential policy: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/security.ts`](../src/lib/security.ts), and [`src-tauri/src/project.rs`](../src-tauri/src/project.rs)
- User guide: [`docs/MCP_AI_KONNECT.md`](MCP_AI_KONNECT.md)
- Exact verification record: [`docs/QA_MILESTONE_8.md`](QA_MILESTONE_8.md)

## Milestone 9 acceptance evidence

- Bounded introspection, schema normalization, structural/root validation, and safe insertion logic: [`src/lib/graphql.ts`](../src/lib/graphql.ts) and [`src/lib/graphql.test.ts`](../src/lib/graphql.test.ts)
- Schema explorer, documentation pane, and query/variables composition UI: [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Device-local appearance, request defaults, shortcut editing/collision detection, and reset UI: [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx), [`src/lib/preferences.ts`](../src/lib/preferences.ts), and [`src/lib/preferences.test.ts`](../src/lib/preferences.test.ts)
- Delayed/repeating send control, cancellation, request actions, and customizable global bindings: [`src/App.tsx`](../src/App.tsx)
- Workspace v9 schema/preference normalization and device-local synchronization boundaries: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/security.ts`](../src/lib/security.ts), and [`src/lib/project.ts`](../src/lib/project.ts)
- User guide: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md)
- Exact verification record: [`docs/QA_MILESTONE_9.md`](QA_MILESTONE_9.md)

## Milestone 10 acceptance evidence

- Bounded environment/folder ancestry, inherited execution composition, private-tree filtering, and focused tests: [`src/lib/resources.ts`](../src/lib/resources.ts) and [`src/lib/resources.test.ts`](../src/lib/resources.test.ts)
- Nested collection/folder/request and base/sub-environment editing: [`src/App.tsx`](../src/App.tsx)
- Workspace v10 cycle repair, private-descendant normalization, and migration tests: [`src/lib/storage.ts`](../src/lib/storage.ts) and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Folder/environment-aware runner and CLI paths: [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Insomnia v4/v5 folder and environment hierarchy round trips: [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts) and [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts)
- Private publication filtering and inherited secret-policy scanning: [`src/lib/security.ts`](../src/lib/security.ts), [`src/lib/project.ts`](../src/lib/project.ts), and [`src/lib/security.test.ts`](../src/lib/security.test.ts)
- User guide: [`docs/RESOURCE_HIERARCHY.md`](RESOURCE_HIERARCHY.md)
- Exact verification record: [`docs/QA_MILESTONE_10.md`](QA_MILESTONE_10.md)

## Milestone 11 acceptance evidence

- Method-token normalization, encoded path substitution, repeated query keys, and JSON/XML body formatting: [`src/lib/request.ts`](../src/lib/request.ts) and [`src/lib/request.test.ts`](../src/lib/request.test.ts)
- Six-target local code generator and focused output/warning tests: [`src/lib/codegen.ts`](../src/lib/codegen.ts) and [`src/lib/codegen.test.ts`](../src/lib/codegen.test.ts)
- Custom-method, path/query/header, multiline-row, Beautify, Generate Code, and shortcut UI: [`src/App.tsx`](../src/App.tsx), [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx), and [`src/components/CodeGenerationDialog.tsx`](../src/components/CodeGenerationDialog.tsx)
- OpenAPI, Postman, and Insomnia v4/v5 request-authoring preservation and round trips: [`src/lib/openapi.ts`](../src/lib/openapi.ts), [`src/lib/interchange/postman.ts`](../src/lib/interchange/postman.ts), [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), and [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts)
- Workspace v11 row/method/shortcut migration and project/import propagation: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/project.ts`](../src/lib/project.ts), and [`src/lib/interchange/apply.ts`](../src/lib/interchange/apply.ts)
- User guide: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_11.md`](QA_MILESTONE_11.md)

## Milestone 12 acceptance evidence

- Permission-bounded Worker bridge, request normalization, selected module adapters, vault/network grants, and focused tests: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Direct-send scope persistence and mediated transport integration: [`src/App.tsx`](../src/App.tsx)
- Collection/folder scope propagation and permission-aware runner integration: [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/lib/runner.test.ts`](../src/lib/runner.test.ts), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Explicit CLI trusted-script/network flags and compatibility runtime: [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Workspace v12 safe-default permission migration and device-local controls: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- User guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_12.md`](QA_MILESTONE_12.md)

## Milestone 13 acceptance evidence

- Executable Worker compatibility harness, secondary state helper, exact request/scope APIs, async assertions, and focused tests: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Scope-correct direct/runner execution and secondary cookie/response continuity: [`src/App.tsx`](../src/App.tsx), [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/lib/runner.test.ts`](../src/lib/runner.test.ts), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Trusted CLI async Chai compatibility and self-contained fixture: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`examples/cli-workspace.json`](../examples/cli-workspace.json)
- Scope-aware Postman script translation and import coverage: [`src/lib/interchange/postman.ts`](../src/lib/interchange/postman.ts) and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_13.md`](QA_MILESTONE_13.md)

## Milestone 14 acceptance evidence

- Distinct global and collection base/selected scope resolution, disabled masking, direct persistence, and collection environment editing: [`src/lib/resources.ts`](../src/lib/resources.ts), [`src/App.tsx`](../src/App.tsx), and [`src/lib/resources.test.ts`](../src/lib/resources.test.ts)
- Seven-level executable Worker contract with alias/mutation coverage: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Scope-identical collection runner and trusted CLI propagation: [`src/lib/runner.ts`](../src/lib/runner.ts), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Workspace v13 collection-environment normalization, project serialization, and secret-policy coverage: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/project.ts`](../src/lib/project.ts), [`src/lib/security.ts`](../src/lib/security.ts), and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Corrected Postman and Insomnia v4/v5 environment-store interchange with round-trip tests: [`src/lib/interchange/postman.ts`](../src/lib/interchange/postman.ts), [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts), and [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_14.md`](QA_MILESTONE_14.md)

## Milestone 15 acceptance evidence

- Shared self-contained adapters for the complete documented module-name surface: [`src/lib/scriptModules.ts`](../src/lib/scriptModules.ts)
- Direct adapter contracts, exact name inventory, common-operation coverage, 5 MB input bounds, serialized-Worker execution, and unknown-module denial: [`src/lib/scriptModules.test.ts`](../src/lib/scriptModules.test.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Identical desktop Worker and trusted CLI module injection: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Offline trusted-CLI schema/CSV/SHA-256 fixture: [`examples/cli-workspace.json`](../examples/cli-workspace.json)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_15.md`](QA_MILESTONE_15.md)

## Milestone 16 acceptance evidence

- Worker-side path references, explicit authority checks, body/multipart/PEM facades, host hydration, aggregate limits, and executable denial/attachment tests: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Bounded regular-file Tauri command and focused native test: [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) and [`src-tauri/src/models.rs`](../src-tauri/src/models.rs)
- Device-only desktop reader and direct-send/runner injection: [`src/lib/scriptFiles.ts`](../src/lib/scriptFiles.ts), [`src/App.tsx`](../src/App.tsx), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Separate trusted CLI authority plus offline exact-byte fixture: [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`examples/cli-workspace.json`](../examples/cli-workspace.json), and [`examples/cli-script-file.txt`](../examples/cli-script-file.txt)
- Workspace v14 safe-default preference migration and UI: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_16.md`](QA_MILESTONE_16.md)

## Milestone 17 acceptance evidence

- Shared clean-room `chai.assert` implementation and desktop/CLI module factory: [`src/lib/scriptModules.ts`](../src/lib/scriptModules.ts)
- Official public-name inventory, representative direct operations and getter overloads, custom-message failure behavior, and serialized-Worker coverage: [`src/lib/scriptModules.test.ts`](../src/lib/scriptModules.test.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Offline trusted-CLI deep nested-property and key assertions: [`examples/cli-workspace.json`](../examples/cli-workspace.json)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_17.md`](QA_MILESTONE_17.md)

## Parity declaration rule

Brunomnia must not be described as feature-complete while any row is `Baseline`, `Early baseline`, or `Not started`. Before a parity release, re-read the current Insomnia documentation and changelog, add newly documented capability rows, and attach reproducible evidence for every row. Commercial availability in Insomnia does not remove a capability from this ledger; Brunomnia's implementation remains governed by [the free feature policy](FREE_FEATURE_POLICY.md).
