# Insomnia feature-parity ledger

Last reconciled: **2026-07-17** against the current Kong Developer documentation for Insomnia. Milestone-specific source checks after that date are recorded in their verification files.

This is the authoritative claim ledger for Brunomnia. A roadmap item being implemented does not make its row complete: `Complete` requires compatible user-visible behavior plus reproducible tests; `Baseline` means a useful subset exists with named gaps; `Not started` means no parity claim is made.

## Capability ledger

| Capability family | Brunomnia status | Current evidence and remaining gap | Insomnia reference |
| --- | --- | --- | --- |
| Local projects and persistence | Baseline | Versioned local workspace with atomic native persistence and no account requirement. Multiple projects/vault management and recovery UI remain. | [Storage options](https://developer.konghq.com/insomnia/storage/) |
| Collections, requests, environments, and history | Baseline | Editable collections/requests, persistent mixed folder/request drag ordering and cross-collection moves, nested folders, collection/folder/request documentation, inherited folder headers/auth/scripts/variables, distinct global-base/selected-global and collection-base/selected-collection editors, device-local private global sub-environments, iteration/request-local variables, delayed/repeating sends, custom methods, explicit path/query rows, descriptions, multiline values, device-persistent regular/bulk header and query editing, a 100-send activity log, and chronologically grouped per-request response history with rich restored-method/URL/status/time/size evidence, 20/default, finite, zero, unlimited, active-environment-filtered retention, exact-entry deletion, active-environment clearing, request-version snapshots/restoration for new entries, persistent ten-entry JSONPath/XPath preview-filter history, byte-exact decoded-body/raw and prettified JSON downloads, and selected-response HTTP debug/HAR 1.2 exports exist. Richer resource actions, tag-builder UX, environment-tree ordering, collected-data breadth, legacy-version reconstruction, advanced JSONPath selectors, byte-exact wire diagnostic export, and keyboard-equivalent tree reordering remain. | [Collections](https://developer.konghq.com/insomnia/collections/), [environments](https://developer.konghq.com/insomnia/environments/), [requests](https://developer.konghq.com/insomnia/requests/) |
| REST/HTTP execution | Baseline | Native execution, custom token-valid methods, encoded `{path}` substitution, repeated query keys, response inspection, persistent per-request Visual/Source/Raw preview modes with declared-charset text, valid-JSON/leading-doctype detection despite misleading headers, bounded HTTP(S) link opening in JSON/source viewers with an upstream-default disable preference, and safe-by-default HTML with response-URL-aware relative links, preview reset, separate opt-in remote-resource/opaque-origin JavaScript authorities, static remote content, and dual-grant external scripts/connections/workers, byte-backed responsive image/embedded PDF/native audio viewers, bounded CSV-table viewer, and selectable byte-backed multipart sections with headers/charset-aware text/exact save plus selected-part recursion into the same friendly viewers, exact decoded entity-byte preservation across native/browser execution, saved history, raw downloads, and response-plugin buffers, persisted prepared-request/aggregate-response timeline evidence with a device-local outgoing-data threshold, source-matched 5/100 MiB response-preview guards with raw download/session reveal, device-local redirect/30-second timeout/API certificate-validation defaults with per-request inheritance/overrides, `0`-disabled deadlines, a `0`/finite/`-1` native redirect maximum, inherited system/manual/direct proxy routing with protocol-specific URLs and no-proxy exclusions, domain-scoped PEM identity, per-request cookie policy, device-local Default/HTTP 1.0/HTTP 1.1/HTTP/2/HTTP/2 Prior Knowledge preference, and transparent gzip/Brotli/deflate/zstd response decoding work. Negotiated native versions appear in response evidence, and decode failures receive one raw fallback. Filesystem-backed/load-on-demand response bodies, signature/content sniffing beyond valid UTF-8 JSON and a leading HTML doctype, multipart recursion beyond five levels or through nested sections over 5 MiB, upstream's default-on unrestricted response-WebView authority, compressed raw wire chunks/headers, redirect traces, broader client-network diagnostics, HTTP/3, and browser forbidden-header/TLS limits remain. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| GraphQL | Baseline | Query, templated variables, operation name, native execution, bounded/cached introspection, automatic selection/URL refresh, structural and cached-root validation, documentation browsing, and safe root-field insertion work. Persisted queries, full language-service validation/autocomplete, subscriptions, and richer schema workflows remain. | [GraphQL](https://developer.konghq.com/insomnia/graphql/) |
| WebSocket | Baseline | Native text and base64/file binary composition, headers, ordered events, and bounded runner samples work. Custom proxy/client identity and richer message collections remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| Server-Sent Events | Baseline | Native long-running sessions cover chunking, CRLF, comments, event names, multiline data, persistent bounded/unlimited reconnect policy, server `retry:` hints, `Last-Event-ID` resume, reconnect cancellation, and bounded runner samples. A live reconnect integration fixture, richer event search/export, and streaming plugin hooks remain. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| gRPC | Baseline | Reflection, pasted proto compilation, dynamic JSON/protobuf mapping, and all four call shapes. Importable proto trees and additional metadata/schema workflows remain. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| Request bodies | Baseline | JSON, text, URL-encoded, multipart text/files with duplicate fields and editable part filename/content type, binary payloads, and local JSON/conservative-XML beautification work; CLI supports the same finite modes. Arbitrary per-part headers and some encoding compatibility remain. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| Request authentication | Baseline | All documented families have editable execution paths: Basic, Digest, OAuth 1/2, NTLM, AWS IAM v4, Bearer, API key, Hawk, Atlassian ASAP, and Netrc. OAuth token calls resolve a separate on-by-default authentication certificate-validation preference. Automated OAuth callback capture, credential-vault storage, uncommon challenge variants, and cross-platform integration fixtures remain. | [Request authentication](https://developer.konghq.com/insomnia/request-authentication/) |
| Cookies, chaining, and dynamic variables | Baseline | Persistent editable jar, automatic primary/secondary-request Set-Cookie storage, send/store policy, response chaining/JSONPath, seven-level base/selected global/collection/folder/iteration/local precedence with disabled-row masking, and a broad safe tag subset work. File/external-vault tags, full Faker/JSONPath breadth, and guided tag-builder UX remain. | [Template tags](https://developer.konghq.com/insomnia/template-tags/), [dynamic variables](https://developer.konghq.com/insomnia/dynamic-variables/), [request chaining](https://developer.konghq.com/how-to/chain-requests/) |
| API specification design | Baseline | OpenAPI 3.x editor, formatter, structural linter, preview, request generation, and safe local Spectral-style custom rules work. Full Spectral functions, remote/package `extends`, multi-file references, and richer tooling remain. | [API specifications](https://developer.konghq.com/insomnia/api-specs/) |
| Pre-request and after-response scripts | Baseline | Disposable desktop Workers cover distinct global/collection base and selected stores, documented seven-level aliases/priority, ID/name parent folders, query-string/object URL mutation, keyed-array Basic/Bearer/API-key updates, proxy/certificate helpers, response facades, ordered async tests, every currently documented public `chai.assert` method name plus Chai BDD chain/assertion/alias name through shared bounded adapters, all currently documented external-library and Node-module names, and separately opt-in primary/secondary binary/multipart/PEM attachment restricted to canonical device-approved roots plus mediated HTTP/vault access with cookie/response continuity. Exact Chai/package internals and full Lodash behavior, PFX, script file writes, external-vault scripts, and stronger portable CLI isolation remain. Deprecated Postman interfaces are explicitly unsupported upstream, not a parity requirement. | [Scripts](https://developer.konghq.com/insomnia/scripts/), [Chai assert API](https://www.chaijs.com/api/assert/), [Chai BDD API](https://www.chaijs.com/api/bdd/), [environments](https://developer.konghq.com/insomnia/environments/) |
| Collection runner and automated tests | Baseline | Selectable drag/keyboard-ordered data-driven runs, retries/delay/bail/cancellation, separated global/collection/folder/iteration/local propagation, disabled-row masking, primary/secondary cookie/response chaining, bounded WebSocket/SSE samples, ordered async assertions, saved reports, redacted resolved request metadata, bounded status/header/body response inspection, and downloadable versioned JSON/JUnit evidence work. Full transport-added request/response console fidelity, all protocol semantics, and Inso breadth remain. | [Collection runner guide](https://developer.konghq.com/how-to/use-the-collection-runner/), [collections](https://developer.konghq.com/insomnia/collections/) |
| Mock servers | Baseline | Real native loopback mock server with routes, parameters, headers, delays, CORS, three dynamic tokens, direct active-response-to-new-route creation or selected-route response overwrite, and optional AI generation from pasted prompt/spec/example material or explicitly selected credential-redacted active-request/latest-response context. Liquid/Faker breadth, binary mock bodies, URL-to-mock generation, response-pane server selection, and hosted/self-host deployment workflows remain. | [Mock servers](https://developer.konghq.com/insomnia/mock-servers/) |
| Headless CLI and CI | Baseline | Bundled CLI lints/generates/exports OpenAPI and runs HTTP/GraphQL collections/tests with shared runner logic, retry-aware `--bail`, and validated `-t`/`--testNamePattern` regex filtering of dynamically registered after-response test names. The documented `dot`, `list`, `min`, `progress`, `spec`, and `tap` reporters work alongside JSON/JUnit output. Workspace JavaScript is disabled by default with separate trusted-script/network/file flags; effective Never certificate validation and manual proxy routing are refused rather than weakening Node TLS globally or silently bypassing proxy policy. Upstream standalone unit-test-suite identity/selection, remaining Inso commands/flags/configuration discovery, per-request insecure TLS, stronger portable script isolation, and signed containers remain. | [Inso CLI](https://developer.konghq.com/inso-cli/), [run test reference](https://developer.konghq.com/inso-cli/reference/run_test/) |
| Import and export formats | Baseline | Existing formats/scopes map advanced Insomnia/Postman auth, scope-aware Postman scripts and collection variables, custom HTTP methods, explicit path/query/header rows with descriptions and multiline values, OpenAPI path parameters, cookie jars, Insomnia `global`/`on`/`off` redirect modes, distinct Insomnia v4/v5 collection base/sub-environments, standalone v5 global environments, and nested folders with headers/auth/variables/scripts/docs. Partial/deprecated scripts, external files, WSDL placeholders, Socket.IO/MCP downgrades, and omitted binary bytes remain explicit bounds. | [Import/export reference](https://developer.konghq.com/insomnia/import-export/) |
| Git Sync and version control | Baseline | Split-YAML projects in standard repositories now support init/clone/status with push readiness and unpublished-branch evidence, selected/all stage and unstage, selected/all unstaged discard with index preservation, aggregate and confined per-file working/staged diffs including bounded untracked text, commit, ordered reviewed grouped commits, or remote-access-preflighted commit-and-push with explicit partial-progress, nothing-to-push defense, and actionable non-fast-forward/auth/access failure reporting, a bounded current-branch history with author/date/parents/decorations and selected-commit patches, local branch create/switch/merged-delete, explicit fetch/prune, remote-only branch discovery and tracking checkout, remotes, pull/push, clean-tree-guarded merge, three-way text resolution, binary side selection, and abort. Provider-specific authentication/onboarding/credential validation, un-checked-out remote history, force/local-remote deletion, rebase/cherry-pick, automatic discovery, and broader edge-case fixtures remain. | [Storage and Git Sync](https://developer.konghq.com/insomnia/storage/), [Git Sync](https://developer.konghq.com/insomnia/git-sync/) |
| Plugins and extension API | Baseline | Disabled-by-default local CommonJS plugins run in disposable Workers with explicit grants. Request/response hooks, custom tags, actions, themes, local store, notifications, and mediated network/prompt/clipboard APIs work for HTTP, GraphQL, gRPC, and collection runs. Remote/npm dependency installation, discovery/hot reload, streaming hooks, complete context/hook coverage, and ecosystem compatibility remain. | [Plugins](https://developer.konghq.com/insomnia/plugins/), [plugin reference](https://developer.konghq.com/insomnia/plugins/plugin-reference/), [hooks and actions](https://developer.konghq.com/insomnia/plugins/hooks-and-actions/) |
| Secrets and external vaults | Baseline | A passphrase-derived AES-256-GCM local vault keeps decrypted values in memory, resolves `vault.*` variables, and can be exposed to desktop scripts only through a device-local off-by-default grant. Device-local private sub-environment trees are omitted from exports/projects/encrypted sync. AWS, GCP, Azure, and HashiCorp tags use installed official CLI credential chains, a memory cache, and per-reference approval. OS-keychain wrapping, provider-native login UX/SDKs, headless adapters, script access to external providers, and broader secret-field UX remain. | [External vault integration](https://developer.konghq.com/insomnia/external-vault/), [environments](https://developer.konghq.com/insomnia/environments/) |
| Cloud sync and collaboration | Baseline | A user-controlled shared file now carries filtered workspace data under AES-256-GCM E2EE with pull/push revisions, conflict rejection, explicit force, local actor labels, and no hosted dependency. Git remains available for branch/commit workflows. Per-user key wrapping, real-time sync/presence, comments, resource-specific cloud branches/history, discovery, and offline merge UI remain. | [Storage options](https://developer.konghq.com/insomnia/storage/), [data security](https://developer.konghq.com/insomnia/end-to-end-encryption/) |
| MCP clients | Baseline | Multiple project-scoped HTTP/STDIO clients support initialization, paginated discovery/caching of tools/prompts/resources/templates, invocation, roots, JSON/SSE parsing, session IDs, vault-backed credentials, event records, and split-YAML serialization. HTTP OAuth, long-lived streaming, cancellation, elicitation, reviewed sampling, notification response UI, persistent STDIO sessions, and guided resource-template arguments remain. | [MCP clients](https://developer.konghq.com/insomnia/mcp-clients-in-insomnia/) |
| AI-assisted workflows | Baseline | Optional OpenAI, Anthropic, Gemini, and custom/local OpenAI-compatible configuration drives bounded mock generation from manual or explicitly selected active-request/latest-response context plus reviewable Git commit grouping that can be executed in order with optional push. Credentials are vault-backed and no Brunomnia account/model is required. Direct `.gguf` loading, automatic URL fetching, and reviewed MCP sampling remain. | [AI in Insomnia](https://developer.konghq.com/insomnia/ai-in-insomnia/) |
| Service integrations | Baseline | A pull-only Konnect adapter lists control planes and maps Gateway Services plus HTTP/HTTPS Routes while preserving local request work and recording unsupported routes. Live-tenant fixtures, SNI/TCP/UDP execution, bidirectional configuration, and any newly documented adapters remain. | [Konnect integration](https://developer.konghq.com/insomnia/konnect-integration/) |
| SSO, RBAC, SCIM, audit, and organization controls | Early baseline | Workspace v22 retains normalized owner/admin/editor/viewer actors, last-owner protection, storage/secret/external-reference policy checks, encrypted-sync and integration edit enforcement, device-local script authorities, and bounded local audit events. These are local controls, not identity proof. Self-hosted SAML/OIDC, SCIM, authenticated organization service, complete RBAC enforcement, and tamper-evident audit export remain. | [Authentication and authorization](https://developer.konghq.com/insomnia/authentication-authorization/), [SSO](https://developer.konghq.com/insomnia/sso/), [SCIM](https://developer.konghq.com/insomnia/scim/) |
| Preferences, shortcuts, themes, accessibility, and packaging | Baseline | Device-local system/dark/light themes, comfortable/compact density, editor font sizing, request/script defaults, preferred HTTP version, redirect/timeout/API-validation/auth-validation and system/manual proxy defaults, regular/bulk header and query editors, forced-vertical layout, editor wrapping/tabs/indent width/ligatures, separate interface/editor families and 8–24 px sizes, masked request/folder authentication and MCP/AI/Konnect credentials with global/per-field reveal, maximum redirects, timeline chunk size, response-history limit/environment filtering, response-viewer link disabling, off-by-default HTML-preview remote resources/JavaScript plus script network/file/vault grants, delete confirmation, GraphQL auto-introspection, eleven editable shortcuts with collision warnings—including Generate Code—sidebar toggling, and a macOS Tauri app bundle exist. Full command/action coverage, accessibility audit, updater, signing/notarization, and Windows/Linux release artifacts remain. | [Keyboard shortcuts](https://developer.konghq.com/insomnia/keyboard-shortcuts/), [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |

## Milestone 3 acceptance evidence

- Shared design and generation engine: [`src/lib/openapi.ts`](../src/lib/openapi.ts) and [`src/lib/openapi.test.ts`](../src/lib/openapi.test.ts)
- Permission-bounded browser runtime: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts)
- Shared runner and data parser: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Native loopback server and integration test: [`src-tauri/src/mock_server.rs`](../src-tauri/src/mock_server.rs)
- Direct text-response-to-route conversion and focused tests: [`src/lib/mockRouteFromResponse.ts`](../src/lib/mockRouteFromResponse.ts) and [`src/lib/mockRouteFromResponse.test.ts`](../src/lib/mockRouteFromResponse.test.ts)
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
- Reviewable credential-redacted active-request/latest-response mock context and focused tests: [`src/lib/mockAiContext.ts`](../src/lib/mockAiContext.ts) and [`src/lib/mockAiContext.test.ts`](../src/lib/mockAiContext.test.ts)
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

## Milestone 18 acceptance evidence

- Shared serializable `expect` implementation: [`src/lib/scriptExpect.ts`](../src/lib/scriptExpect.ts)
- Current BDD name/alias inventory plus representative direct behavior and failure coverage: [`src/lib/scriptExpect.test.ts`](../src/lib/scriptExpect.test.ts)
- Identical desktop Worker and trusted CLI injection: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Serialized-Worker and offline trusted-CLI deep nested/ordered chain coverage: [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts) and [`examples/cli-workspace.json`](../examples/cli-workspace.json)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_18.md`](QA_MILESTONE_18.md)

## Milestone 19 acceptance evidence

- Shared subrequest normalization, inert path resolution, host hydration, and execution-wide budget: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts)
- Desktop Worker message bridge and trusted CLI invocation of the same preparer: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts) and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Binary, multipart, PEM, denial, template, exact-byte, and aggregate-budget coverage: [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Updated user guide: [`docs/SCRIPTING.md`](SCRIPTING.md)
- Exact verification record: [`docs/QA_MILESTONE_19.md`](QA_MILESTONE_19.md)

## Milestone 20 acceptance evidence

- Shared deterministic reporter and artifact formatter: [`src/lib/runnerReport.ts`](../src/lib/runnerReport.ts)
- JSON, JUnit, TAP, text-reporter, escaping, and inventory coverage: [`src/lib/runnerReport.test.ts`](../src/lib/runnerReport.test.ts)
- Desktop JSON/JUnit downloads and CLI reporter/output integration: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- User guide: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_20.md`](QA_MILESTONE_20.md)

## Milestone 21 acceptance evidence

- Shared selected-order and retry-aware bail semantics: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Desktop checkbox plan, drag/drop, accessible move controls, and bail option: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- CLI `--bail` propagation and bailed-report output: [`cli/brunomnia.ts`](../cli/brunomnia.ts) and [`src/lib/runnerReport.ts`](../src/lib/runnerReport.ts)
- Updated guide: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_21.md`](QA_MILESTONE_21.md)

## Milestone 22 acceptance evidence

- Shared UTF-8-safe response capture and aggregate budgets: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Serializable response snapshot contract: [`src/types.ts`](../src/types.ts)
- Keyboard-selectable saved/live response detail pane: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Updated guide: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_22.md`](QA_MILESTONE_22.md)

## Milestone 23 acceptance evidence

- Shared resolved/redacted request capture and budgets: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Serializable request metadata contract: [`src/types.ts`](../src/types.ts)
- Actual request URL propagation in desktop demo and CLI transports: [`src/lib/http.ts`](../src/lib/http.ts) and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Combined request/response attempt evidence pane: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Updated guide: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_23.md`](QA_MILESTONE_23.md)

## Milestone 24 acceptance evidence

- Persistent mixed-resource order and move contract: [`src/types.ts`](../src/types.ts) and [`src/lib/resources.ts`](../src/lib/resources.ts)
- Collection, request, folder, and subtree move coverage: [`src/lib/resources.test.ts`](../src/lib/resources.test.ts)
- Malformed/stale order normalization: [`src/lib/storage.ts`](../src/lib/storage.ts) and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Collision-safe imported-order remapping: [`src/lib/interchange/apply.ts`](../src/lib/interchange/apply.ts)
- Native sidebar drag targets and drop indicators: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)
- Updated guide: [`docs/RESOURCE_HIERARCHY.md`](RESOURCE_HIERARCHY.md)
- Exact verification record: [`docs/QA_MILESTONE_24.md`](QA_MILESTONE_24.md)

## Milestone 25 acceptance evidence

- Shared regex validation, propagation, clean-unmatched omission, failure retention, and match counts: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Callback-level filtering in desktop Workers and trusted CLI scripts: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts), [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Filter metadata in JSON and text evidence: [`src/types.ts`](../src/types.ts), [`src/lib/runnerReport.ts`](../src/lib/runnerReport.ts), and [`src/lib/runnerReport.test.ts`](../src/lib/runnerReport.test.ts)
- Updated guide: [`docs/RUNNER_REPORTS.md`](RUNNER_REPORTS.md)
- Exact verification record: [`docs/QA_MILESTONE_25.md`](QA_MILESTONE_25.md)

## Milestone 26 acceptance evidence

- Persistent request-level reconnect contract and migration defaults: [`src/types.ts`](../src/types.ts), [`src/data/seed.ts`](../src/data/seed.ts), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Native lifetime, reconnect, retry-hint, resume, and cancellation behavior: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Reconnect editor and stream-state feedback: [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx), [`src/App.tsx`](../src/App.tsx), and [`src/styles.css`](../src/styles.css)
- Focused frontend and native policy/parser coverage: [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- User guide: [`docs/SSE_STREAMS.md`](SSE_STREAMS.md)
- Exact verification record: [`docs/QA_MILESTONE_26.md`](QA_MILESTONE_26.md)

## Milestone 27 acceptance evidence

- Device-local preference model, safe normalization, import reset, and authoring UI: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Native HTTP/1 forcing, HTTP/2 negotiation/prior knowledge, and actual response version capture: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs) and [`src-tauri/src/models.rs`](../src-tauri/src/models.rs)
- Ordinary, GraphQL, Event Stream, collection-run, script/plugin, artifact-import, OAuth, AI, MCP, and Konnect preference propagation: [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/App.tsx`](../src/App.tsx), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Negotiated-version summary, timeline, saved-history continuity, and focused coverage: [`src/App.tsx`](../src/App.tsx), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Updated guide: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md)
- Exact verification record: [`docs/QA_MILESTONE_27.md`](QA_MILESTONE_27.md)

## Milestone 28 acceptance evidence

- Explicit native compression feature set and locked codec dependencies: [`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml) and [`src-tauri/Cargo.lock`](../src-tauri/Cargo.lock)
- Shared HTTP/SSE automatic decoding plus ordinary-request decode-error fallback: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Updated request guide: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_28.md`](QA_MILESTONE_28.md)

## Milestone 29 acceptance evidence

- Device-local redirect preference, safe normalization, import reset, and authoring UI: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Native disabled/finite/unlimited redirect modes plus bounded SSE header establishment: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Primary, stream, collection-run, script/plugin, artifact-import, OAuth, AI, MCP, Konnect, and Git-AI propagation: [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/App.tsx`](../src/App.tsx), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Focused invocation, stream-input, migration, immutability, and native policy coverage: [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_29.md`](QA_MILESTONE_29.md)

## Milestone 30 acceptance evidence

- Device-local response preferences, safe normalization/import reset, and authoring controls: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Finite/zero/unlimited and environment-scoped retention/visibility policy: [`src/lib/responseHistory.ts`](../src/lib/responseHistory.ts) and [`src/lib/responseHistory.test.ts`](../src/lib/responseHistory.test.ts)
- Main-request, collection-run, and secondary-script persistence plus environment-filtered template execution: [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts), and [`src/lib/http.ts`](../src/lib/http.ts)
- Saved-response selector, request/environment restoration, and responsive styling: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)
- Migration/invocation/template coverage: [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts), and [`src/lib/templates.test.ts`](../src/lib/templates.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_30.md`](QA_MILESTONE_30.md)

## Milestone 31 acceptance evidence

- Device-local default, request-mode migration, and three-state authoring controls: [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx), and [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Shared inheritance policy for ordinary HTTP and native Event Streams: [`src/lib/transport.ts`](../src/lib/transport.ts), [`src/lib/http.ts`](../src/lib/http.ts), and [`src/lib/protocol.ts`](../src/lib/protocol.ts)
- Primary, collection-run, script/plugin, artifact-import, OAuth, AI, MCP, Konnect, and Git-AI context propagation: [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`src/components/PluginWorkbench.tsx`](../src/components/PluginWorkbench.tsx)
- Insomnia v4/v5 `global`/`on`/`off` preservation: [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts), and their focused tests
- Inheritance, override, migration, invocation, stream-input, and interchange coverage: [`src/lib/transport.test.ts`](../src/lib/transport.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/lib/interchange/`](../src/lib/interchange/)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_31.md`](QA_MILESTONE_31.md)

## Milestone 32 acceptance evidence

- Device-local 10 KiB default, safe normalization/import reset, and current-compatible setting UI: [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Prepared request payload classification, exact threshold/zero-fallback policy, response summary, and IEC size evidence: [`src/lib/timeline.ts`](../src/lib/timeline.ts) and [`src/lib/timeline.test.ts`](../src/lib/timeline.test.ts)
- Native/browser execution attachment plus plugin and saved-history continuity: [`src/lib/http.ts`](../src/lib/http.ts), [`src/App.tsx`](../src/App.tsx), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Persisted timeline normalization and responsive inspection: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/App.tsx`](../src/App.tsx), and [`src/styles.css`](../src/styles.css)
- Focused migration, invocation, text/form/multipart, exact-boundary, and zero-fallback coverage: [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), and [`src/lib/timeline.test.ts`](../src/lib/timeline.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_32.md`](QA_MILESTONE_32.md)

## Milestone 33 acceptance evidence

- Device-local 30-second execution default, `0`-disabled deadlines, safe normalization/import reset, and inherited/custom authoring controls: [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx), and [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Shared effective-timeout resolution for HTTP, GraphQL, Event Streams, gRPC, browser Fetch, and the CLI: [`src/lib/transport.ts`](../src/lib/transport.ts), [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Native no-deadline behavior for HTTP, SSE response-header establishment, gRPC connection/RPC deadlines, and gRPC response streams: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs), and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Primary, collection-run, script/plugin, artifact-import, OAuth, integration, and Git-AI context propagation with explicit safety deadlines retained by bounded internal adapters: [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/components/PluginWorkbench.tsx`](../src/components/PluginWorkbench.tsx), and [`src/lib/`](../src/lib/)
- Inheritance, explicit override, zero, legacy migration, native invocation, stream-input, and cURL-import coverage: [`src/lib/transport.test.ts`](../src/lib/transport.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_33.md`](QA_MILESTONE_33.md)

## Milestone 34 acceptance evidence

- Separate on-by-default API/authentication settings, safe normalization/import reset, inherited/always/never request controls, and v16 migration: [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx), and [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Shared effective-validation resolution for native HTTP, GraphQL, Event Streams, and gRPC: [`src/lib/transport.ts`](../src/lib/transport.ts), [`src/lib/http.ts`](../src/lib/http.ts), and [`src/lib/protocol.ts`](../src/lib/protocol.ts)
- Primary, collection-run, script/plugin, artifact-import, OAuth, integration, and Git-AI propagation with OAuth authentication-setting separation: [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), [`src/components/PluginWorkbench.tsx`](../src/components/PluginWorkbench.tsx), and [`src/lib/http.ts`](../src/lib/http.ts)
- Browser ownership and explicit CLI refusal boundary: [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx), [`src/lib/http.ts`](../src/lib/http.ts), and [`cli/brunomnia.ts`](../cli/brunomnia.ts)
- Inheritance, explicit override, legacy migration, OAuth separation, native invocation, stream-input, and cURL coverage: [`src/lib/transport.test.ts`](../src/lib/transport.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_34.md`](QA_MILESTONE_34.md)

## Milestone 35 acceptance evidence

- Device-local system/manual preference model, protocol-specific URLs, no-proxy list, safe normalization/import reset, and v17 migration: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Shared effective proxy resolution and inherited/custom/direct authoring controls: [`src/lib/transport.ts`](../src/lib/transport.ts) and [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Native system/custom/direct reqwest configuration plus primary HTTP, GraphQL, OAuth, Event Stream, collection-run, script/plugin, artifact-import, and HTTP-backed integration propagation: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/App.tsx`](../src/App.tsx), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Browser ownership, explicit CLI manual-proxy refusal, and gRPC/WebSocket compatibility boundaries: [`src/lib/http.ts`](../src/lib/http.ts), [`cli/brunomnia.ts`](../cli/brunomnia.ts), and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- System/manual protocol selection, no-proxy forwarding, explicit overrides, legacy migration, native invocation, stream-input, and cURL coverage: [`src/lib/transport.test.ts`](../src/lib/transport.test.ts), [`src/lib/http.test.ts`](../src/lib/http.test.ts), [`src/lib/protocol.test.ts`](../src/lib/protocol.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_35.md`](QA_MILESTONE_35.md)

## Milestone 36 acceptance evidence

- Device-local false defaults, strict normalization/import reset, preference controls, and workspace v18 migration: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Direct request-pane Bulk Edit/Regular Edit switching for headers and query parameters: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)
- Current-compatible enabled-row formatting, first-colon parsing, trimming, blank omission, and duplicate ordering: [`src/lib/bulkKeyValues.ts`](../src/lib/bulkKeyValues.ts)
- Focused syntax, migration, import-reset, preference-preservation, and interchange-version coverage: [`src/lib/bulkKeyValues.test.ts`](../src/lib/bulkKeyValues.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_36.md`](QA_MILESTONE_36.md)

## Milestone 37 acceptance evidence

- Device-local current-compatible defaults, strict normalization/import reset, authoring controls, and workspace v19 migration: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Forced vertical request/response layout, editor wrapping, tab width, font size, and ligature application: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)
- Tabs/spaces insertion plus selection-aware indent/outdent behavior: [`src/lib/editorText.ts`](../src/lib/editorText.ts) and [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Focused editor-edit, normalization, import-reset, preference-preservation, and interchange-version coverage: [`src/lib/editorText.test.ts`](../src/lib/editorText.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_37.md`](QA_MILESTONE_37.md)

## Milestone 38 acceptance evidence

- Current-compatible split defaults, 8–24 px bounds, bounded family normalization, import reset, authoring controls, and workspace v20 migration: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Independent live interface/editor family and size application with built-in fallback stacks: [`src/App.tsx`](../src/App.tsx) and [`src/styles.css`](../src/styles.css)
- Focused default, bounds, family normalization, import-reset, preference-preservation, and interchange-version coverage: [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_38.md`](QA_MILESTONE_38.md)

## Milestone 39 acceptance evidence

- Device-local allowed-folder defaults, bounded normalization/deduplication, import reset, authoring controls, and workspace v21 migration: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Canonical native containment for every mediated desktop script file read: [`src/lib/scriptFiles.ts`](../src/lib/scriptFiles.ts), [`src/App.tsx`](../src/App.tsx), [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Frontend and native coverage for safe defaults, explicit preservation, authority stripping, allowed reads, size limits, outside roots, empty/invalid roots, and symlink escape: [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts), [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Updated guides: [`docs/SCRIPTING.md`](SCRIPTING.md) and [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md)
- Exact verification record: [`docs/QA_MILESTONE_39.md`](QA_MILESTONE_39.md)

## Milestone 40 acceptance evidence

- Device-local false default, strict normalization/import reset, authoring control, and workspace v22 migration: [`src/types.ts`](../src/types.ts), [`src/lib/preferences.ts`](../src/lib/preferences.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Request and folder authentication masking plus device-wide and accessible per-field reveal behavior: [`src/components/AuthEditor.tsx`](../src/components/AuthEditor.tsx) and [`src/App.tsx`](../src/App.tsx)
- Focused default/global/per-field visibility, normalization, import-reset, preference-preservation, and interchange-version coverage: [`src/components/AuthEditor.test.ts`](../src/components/AuthEditor.test.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), [`src/lib/interchange/exporters.test.ts`](../src/lib/interchange/exporters.test.ts), and [`src/lib/interchange/importers.test.ts`](../src/lib/interchange/importers.test.ts)
- Updated guides: [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md) and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_40.md`](QA_MILESTONE_40.md)

## Milestone 41 acceptance evidence

- Shared integration credential mask/global-reveal/local-reveal behavior and MCP client disclosure reset: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- Device-local authoring control and boundary copy: [`src/components/PreferencesWorkbench.tsx`](../src/components/PreferencesWorkbench.tsx)
- Focused default/global/per-field visibility coverage: [`src/components/IntegrationWorkbench.test.ts`](../src/components/IntegrationWorkbench.test.ts)
- Updated guides: [`docs/MCP_AI_KONNECT.md`](MCP_AI_KONNECT.md), [`docs/GRAPHQL_AND_PREFERENCES.md`](GRAPHQL_AND_PREFERENCES.md), and [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_41.md`](QA_MILESTONE_41.md)

## Milestone 42 acceptance evidence

- Persisted exact-entry deletion, request/environment-scoped clearing, deterministic fallback selection, and accessible response-summary actions: [`src/App.tsx`](../src/App.tsx)
- Pure history mutation boundaries and focused preservation tests: [`src/lib/responseHistory.ts`](../src/lib/responseHistory.ts) and [`src/lib/responseHistory.test.ts`](../src/lib/responseHistory.test.ts)
- Updated guide: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_42.md`](QA_MILESTONE_42.md)

## Milestone 43 acceptance evidence

- Direct-send capture, asynchronous selection/delete restoration, request-switch race guard, and current tree-position preservation: [`src/App.tsx`](../src/App.tsx)
- Snapshot contract, independent clone helper, lazy runtime validation/restoration, and focused coverage: [`src/types.ts`](../src/types.ts), [`src/lib/responseHistory.ts`](../src/lib/responseHistory.ts), [`src/lib/historicalRequest.ts`](../src/lib/historicalRequest.ts), and [`src/lib/responseHistory.test.ts`](../src/lib/responseHistory.test.ts)
- Collection-run and script-subrequest capture: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx) and [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts)
- Storage survival and secondary-request evidence: [`src/lib/storage.test.ts`](../src/lib/storage.test.ts) and [`src/lib/scriptSandbox.test.ts`](../src/lib/scriptSandbox.test.ts)
- Updated guide: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_43.md`](QA_MILESTONE_43.md)

## Milestone 44 acceptance evidence

- Selected-response raw/prettified actions and lazy artifact dispatch: [`src/App.tsx`](../src/App.tsx)
- Deterministic textual artifact contract, content-type mapping, filename confinement, browser/WebView download, and focused coverage: [`src/lib/responseDownload.ts`](../src/lib/responseDownload.ts) and [`src/lib/responseDownload.test.ts`](../src/lib/responseDownload.test.ts)
- Lazy-loaded existing code-generation dialog boundary: [`src/App.tsx`](../src/App.tsx) and [`src/components/CodeGenerationDialog.tsx`](../src/components/CodeGenerationDialog.tsx)
- Updated guide: [`docs/REQUEST_AUTHORING.md`](REQUEST_AUTHORING.md)
- Exact verification record: [`docs/QA_MILESTONE_44.md`](QA_MILESTONE_44.md)

## Parity declaration rule

Brunomnia must not be described as feature-complete while any row is `Baseline`, `Early baseline`, or `Not started`. Before a parity release, re-read the current Insomnia documentation and changelog, add newly documented capability rows, and attach reproducible evidence for every row. Commercial availability in Insomnia does not remove a capability from this ledger; Brunomnia's implementation remains governed by [the free feature policy](FREE_FEATURE_POLICY.md).
