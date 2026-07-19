# Insomnia feature-parity ledger

Last reconciled: **2026-07-18** against the current Kong Developer documentation for Insomnia. Milestone-specific source checks after that date are recorded in their verification files.

This is the authoritative claim ledger for Brunomnia. A roadmap item being implemented does not make its row complete: `Complete` requires compatible user-visible behavior plus reproducible tests; `Baseline` means a useful subset exists with named gaps; `Not started` means no parity claim is made.

## Capability ledger

| Capability family | Brunomnia status | Current evidence and remaining gap | Insomnia reference |
| --- | --- | --- | --- |
| Local projects and persistence | Baseline | Multiple account-free local projects support create, switch, rename, duplicate from active or inactive sources with a chosen name, persistent drag/keyboard ordering, guarded delete, newest-first recently deleted inspection, and conflict-safe workspace/backup/vault restoration through the top-bar manager. Native projects use separately atomic files, a rotating valid backup, catalog backup/reconstruction, legacy single-workspace migration, preserved invalid/trash files, blocking restore-or-switch corruption recovery, and project-scoped encrypted vaults; browser development mirrors the catalog, ordering, backup, trash-listing, and restoration contract in local storage. Exact upstream project-to-typed-workspace hierarchy and cross-project workspace moves, permanent trash policy controls, original catalog timestamps after restoration, multi-version snapshots, cloud discovery, and provider onboarding remain. | [Storage options](https://developer.konghq.com/insomnia/storage/) |
| Collections, requests, environments, and history | Baseline | Editable collections/requests, persistent mixed folder/request drag ordering and cross-collection moves, nested folders, collection/folder/request documentation, inherited folder headers/auth/scripts/variables, distinct global-base/selected-global and collection-base/selected-collection editors, device-local private global sub-environments, iteration/request-local variables, delayed/repeating sends, custom methods, explicit path/query rows, descriptions, multiline values, device-persistent regular/bulk header and query editing, a 100-send activity log, and chronologically grouped per-request response history with rich restored-method/URL/status/time/size evidence, 20/default, finite, zero, unlimited, active-environment-filtered retention, exact-entry deletion, active-environment clearing, request-version snapshots/restoration for new entries, persistent ten-entry JSONPath/XPath preview-filter history, byte-exact decoded-body/raw and prettified JSON downloads, and selected-response HTTP debug/HAR 1.2 exports exist. Richer resource actions, tag-builder UX, environment-tree ordering, collected-data breadth, legacy-version reconstruction, advanced JSONPath selectors, byte-exact wire diagnostic export, and keyboard-equivalent tree reordering remain. | [Collections](https://developer.konghq.com/insomnia/collections/), [environments](https://developer.konghq.com/insomnia/environments/), [requests](https://developer.konghq.com/insomnia/requests/) |
| REST/HTTP execution | Baseline | Native execution, custom token-valid methods, encoded `{path}` substitution, repeated query keys, response inspection, persistent per-request Visual/Source/Raw preview modes with declared-charset text, valid-JSON/leading-doctype detection despite misleading headers, bounded HTTP(S) link opening in JSON/source viewers with an upstream-default disable preference, and safe-by-default HTML with response-URL-aware relative links, preview reset, separate opt-in remote-resource/opaque-origin JavaScript authorities, static remote content, and dual-grant external scripts/connections/workers, byte-backed responsive image/embedded PDF/native audio viewers, bounded CSV-table viewer, and selectable byte-backed multipart sections with headers/charset-aware text/exact save plus selected-part recursion into the same friendly viewers, exact decoded entity-byte preservation across native/browser execution, saved history, raw downloads, and response-plugin buffers, persisted prepared-request/aggregate-response timeline evidence with a device-local outgoing-data threshold, source-matched 5/100 MiB response-preview guards with raw download/session reveal, device-local redirect/30-second timeout/API certificate-validation defaults with per-request inheritance/overrides, `0`-disabled deadlines, a `0`/finite/`-1` native redirect maximum, inherited system/manual/direct proxy routing with protocol-specific URLs and no-proxy exclusions, domain-scoped PEM or PFX/PKCS#12 identity, per-request cookie policy, device-local Default/HTTP 1.0/HTTP 1.1/HTTP/2/HTTP/2 Prior Knowledge preference, and transparent gzip/Brotli/deflate/zstd response decoding work. Negotiated native versions appear in response evidence, and decode failures receive one raw fallback. Filesystem-backed/load-on-demand response bodies, signature/content sniffing beyond valid UTF-8 JSON and a leading HTML doctype, multipart recursion beyond five levels or through nested sections over 5 MiB, upstream's default-on unrestricted response-WebView authority, compressed raw wire chunks/headers, redirect traces, broader client-network diagnostics, HTTP/3, and browser forbidden-header/TLS limits remain. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| GraphQL | Baseline | Query, templated variables, operation name, native HTTP execution, bounded/cached introspection, automatic selection/URL refresh, structural and cached-root validation, documentation browsing, safe field insertion, and operation-aware native `graphql-transport-ws` subscriptions work. Subscriptions convert HTTP(S) endpoints to WS(S), negotiate the required subprotocol, perform `connection_init`/ack/subscribe, close on protocol error/complete, inherit custom proxy/no-proxy policy, certificate validation, and domain-scoped PEM or PFX/PKCS#12 identity, retain ordered event/history evidence, and have no account or entitlement gate. Full language-service validation/autocomplete and richer schema workflows remain. | [GraphQL](https://developer.konghq.com/insomnia/graphql/) |
| WebSocket | Baseline | Native text and base64/file binary composition, device-inherited manual, per-request custom, and Direct proxy modes with absolute-form plain-WS forwarding plus bounded authenticated HTTP/HTTPS CONNECT for WSS and no-proxy exclusions, inherited/overridden WSS certificate validation, domain-scoped PEM or PFX/PKCS#12 client identity, ordered events, bounded runner samples, handshake status/message/headers/HTTP version/duration, persisted lifecycle timeline, and device-local per-request session history with shared finite/zero/unlimited retention, active-environment filtering, chronological selection, historical request-version restoration, event-type filtering, searchable message/error/close data, non-destructive clear-view cutoffs, delete, and clear behavior work. PAC-authenticated system proxy discovery and upstream-style file-backed timeline/event logs remain. Pinned Insomnia exposes no dedicated event-log export action. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| Socket.IO | Baseline | Native Engine.IO v4 starts with bounded HTTP polling, preserves query/header/cookie plus custom proxy/no-proxy/client-identity/TLS policy, upgrades through the `2probe`/`3probe`/`5` WebSocket sequence with the same policy when eligible, and remains fully functional on polling-only or failed-upgrade servers. URL-derived namespaces, custom paths, Bearer connect auth, ordered JSON/text arguments, optional acknowledgements, nested receive-side binary event/ack attachment hydration into Node Buffer-shaped JSON, enabled and live-toggled named listeners, ordered incoming/outgoing/system/upgrade events, server `maxPayload`, bounded runner samples, first-class Insomnia v4/v5 interchange, handshake duration/transport metadata, persisted connection/path/upgrade/reconnect/error/close timeline, and shared history retention/filter/select/request-version-restore/search/type-filter/clear-view/delete/clear behavior work. PAC-authenticated system proxy discovery, upstream-style file-backed logs, and streaming plugin hooks remain. Upstream exposes JSON/Text argument authoring and no dedicated event-log export action. | [Insomnia Socket.IO source](https://github.com/Kong/insomnia/tree/develop/packages/insomnia/src) |
| Server-Sent Events | Baseline | Native long-running sessions cover chunking, CRLF, comments, event names, multiline data, persistent bounded/unlimited reconnect policy, server `retry:` hints, `Last-Event-ID` resume, reconnect cancellation, response status/headers/HTTP version/duration, persisted reconnect/error/close timeline, bounded runner samples, per-request session history with shared retention/filter/select/request-version-restore/search/clear-view/delete/clear behavior, and a real initial-response/reconnect/resume/cancel loopback. Upstream-style file-backed logs and streaming plugin hooks remain. Pinned Insomnia disables the event-type selector for Event Stream responses and exposes no dedicated event-log export action. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| gRPC | Baseline | Authored `grpc:`, `grpcs:`, `http:`, and `https:` endpoints, reflection, bounded multi-file/folder proto-tree import with active/entry selection and cross-file compilation, legacy single-source migration, dynamic JSON/protobuf mapping, all four call shapes, persistent start/send/commit/cancel lifecycle for interactive client and bidirectional streams, ordered call events, numeric status/name/details plus bounded initial/trailing/error metadata, templated request metadata, inherited/overridden secure-endpoint certificate validation, workspace CA trust, and host/port-scoped PEM or PFX/PKCS#12 client identity work. Buf Schema Registry reflection, reflected request stubs, disable-user-agent behavior, richer connection-error guidance, and broader third-party fixtures remain. Pinned Insomnia keeps call state transient and constructs direct `@grpc/grpc-js` channels without a separate HTTP/HTTPS proxy agent, so persisted call history and a custom gRPC proxy are not claimed as parity requirements. | [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |
| Request bodies | Baseline | JSON, text, ordered URL-encoded and multipart rows with enablement, descriptions, one-line/multiline editing, duplicate fields, multipart files, editable filename/content type, binary payloads, local JSON/conservative-XML beautification, a shared disable-body-rendering switch, native binary MIME defaults, Insomnia v4/v5 control round trips, exact multipart loopback evidence, and self-contained generated multipart/binary bytes work. Pinned Insomnia exposes no arbitrary per-part-header model. Template-selected reusable filesystem paths are deliberately replaced by persisted approved bytes; browser-development text-part MIME limits and broader third-party encoding matrices remain. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| Client code generation | Baseline | cURL, JavaScript Fetch, Python Requests, Go `net/http`, Java `HttpClient`, and C# `HttpClient` materialize inherited configuration, active environment values, supported static auth, text/form/GraphQL bodies, exact self-contained multipart bodies, and standalone binary bytes. Insomnia's broader HTTPSnippet target/client matrix, runtime-only advanced signing, dependency management, target-language validation, and execution remain. | [Requests](https://developer.konghq.com/insomnia/requests/) |
| Request authentication | Baseline | All documented families have editable execution paths: Basic, Digest, OAuth 1/2, NTLM, AWS IAM v4, Bearer, API key, Hawk, Atlassian ASAP, and Netrc. Tauri OAuth 2 authorization-code and implicit flows open the system browser, generate missing state/PKCE/OIDC nonce values, bind only HTTP loopback redirects, rewrite ephemeral ports, validate state, bridge fragment responses, retain access/identity/refresh tokens, exchange codes, time out, and cancel explicitly; browser development keeps a manual copied-URL fallback. Direct, collection-run, script/plugin secondary, and user-triggered project/integration sends can acquire interactive credentials through one status/cancel surface; all shared HTTP sends fetch noninteractive grants, refresh expired tokens, and recover rejected refresh grants before protected traffic, while inherited-folder tokens persist to their owner. Runtime codes/verifiers/tokens/expiry stay in the local catalog and are omitted from Git/folder and encrypted-sync payloads, with matching local owner state restored after reload/pull. Origin, combined ID/access responses, identity-token fallback, token expiry, `NO_PREFIX`, clearing, and authentication-certificate separation match the pinned upstream behavior. Custom-scheme/non-loopback automatic callbacks, embedded-browser/session controls, OS-keychain wrapping, uncommon challenge variants, and cross-platform provider fixtures remain. | [Request authentication](https://developer.konghq.com/insomnia/request-authentication/) |
| Cookies, chaining, and dynamic variables | Baseline | Persistent editable jar, automatic primary/secondary-request Set-Cookie storage, send/store policy, response chaining/JSONPath, seven-level base/selected global/collection/folder/iteration/local precedence with disabled-row masking, and a broad safe tag subset work. File/external-vault tags, full Faker/JSONPath breadth, and guided tag-builder UX remain. | [Template tags](https://developer.konghq.com/insomnia/template-tags/), [dynamic variables](https://developer.konghq.com/insomnia/dynamic-variables/), [request chaining](https://developer.konghq.com/how-to/chain-requests/) |
| API specification design | Baseline | OpenAPI 3.x editor, formatter, structural linter, preview, request generation, and safe local Spectral-style custom rules work. Full Spectral functions, remote/package `extends`, multi-file references, and richer tooling remain. | [API specifications](https://developer.konghq.com/insomnia/api-specs/) |
| Pre-request and after-response scripts | Baseline | Disposable desktop Workers cover distinct global/collection base and selected stores, documented seven-level aliases/priority, ID/name parent folders, query-string/object URL mutation, keyed-array Basic/Bearer/API-key updates, proxy/certificate helpers, response facades, ordered async tests, every currently documented public `chai.assert` method name plus Chai BDD chain/assertion/alias name through shared bounded adapters, all currently documented external-library and Node-module names, and separately opt-in primary/secondary binary/multipart/PEM/PFX attachment restricted to canonical device-approved roots plus mediated HTTP/vault access with cookie/response continuity. Exact Chai/package internals and full Lodash behavior, encrypted PEM-key passphrases, script file writes, external-vault scripts, portable CLI client identities, and stronger portable CLI isolation remain. Deprecated Postman interfaces are explicitly unsupported upstream, not a parity requirement. | [Scripts](https://developer.konghq.com/insomnia/scripts/), [Chai assert API](https://www.chaijs.com/api/assert/), [Chai BDD API](https://www.chaijs.com/api/bdd/), [environments](https://developer.konghq.com/insomnia/environments/) |
| Collection runner and automated tests | Baseline | Selectable drag/keyboard-ordered data-driven runs, retries/delay/bail/cancellation, separated global/collection/folder/iteration/local propagation, disabled-row masking, primary/secondary cookie/response chaining, bounded GraphQL subscription/WebSocket/Socket.IO/SSE samples, ordered async assertions, saved reports, redacted resolved request metadata, bounded status/header/body response inspection, and downloadable versioned JSON/JUnit evidence work. Full transport-added request/response console fidelity, all protocol semantics, and Inso breadth remain. | [Collection runner guide](https://developer.konghq.com/how-to/use-the-collection-runner/), [collections](https://developer.konghq.com/insomnia/collections/) |
| Mock servers | Baseline | Real native loopback mock server with live route updates, parameters, headers, delays, CORS, request-aware output from headers, ordered repeated query/form/multipart arrays, decoded path segments/parameters, and raw or parsed JSON/form/multipart bodies with literal/computed bracket and dot traversal plus the upstream-only chainable `default` filter; quote-aware LiquidJS string escapes, typed equality/relational/`contains`/`not`/right-associative `and`/`or` conditions, `elsif`, bounded `assign`/`if`/`unless`/`else`/`raw` controls, permissive missing variables, structured HTTP 500 failures for malformed or disabled syntax and resource ceilings, all 118 currently documented Faker names, three legacy dynamic tokens, and optional AI generation from pasted prompt/spec/example material, an explicitly fetched/reviewed specification URL, or credential-redacted active-request/latest-response context also work. A dedicated response tab can create a new local server and route, create a conflict-checked route in an existing server, overwrite an existing route, and open the selected route with no project-type or subscription gate. Exact LiquidJS diagnostics/ranges/timing/memory/JavaScript-object identity, exact FakerJS corpus/distribution identity, and hosted/self-host deployment workflows remain. | [Mock servers](https://developer.konghq.com/insomnia/mock-servers/), [Faker variables](https://developer.konghq.com/insomnia/faker-variables/) |
| Headless CLI and CI | Baseline | Bundled CLI lints/generates/exports OpenAPI and runs HTTP/GraphQL collections/tests with shared runner logic, retry-aware `--bail`, and validated `-t`/`--testNamePattern` regex filtering of dynamically registered after-response test names. The documented `dot`, `list`, `min`, `progress`, `spec`, and `tap` reporters work alongside JSON/JUnit output. Workspace JavaScript is disabled by default with separate trusted-script/network/file flags; effective Never certificate validation, manual proxy routing, custom CA roots, and PEM/PFX client identities are refused rather than weakening Node TLS globally or silently bypassing transport policy. Upstream standalone unit-test-suite identity/selection, remaining Inso commands/flags/configuration discovery, per-request insecure TLS, custom TLS material, stronger portable script isolation, and signed containers remain. | [Inso CLI](https://developer.konghq.com/inso-cli/), [run test reference](https://developer.konghq.com/inso-cli/reference/run_test/) |
| Import and export formats | Baseline | Existing formats/scopes map advanced Insomnia/Postman auth, scope-aware Postman scripts and collection variables, custom HTTP methods, explicit path/query/header rows with descriptions and multiline values, OpenAPI path parameters, cookie jars, Insomnia `global`/`on`/`off` redirect modes, first-class Insomnia v4/v5 Socket.IO requests/payloads/listeners, distinct collection base/sub-environments, standalone v5 global environments, and nested folders with headers/auth/variables/scripts/docs. Partial/deprecated scripts, external files, WSDL placeholders, MCP downgrade metadata, and omitted binary bytes remain explicit bounds. | [Import/export reference](https://developer.konghq.com/insomnia/import-export/) |
| Git Sync and version control | Baseline | Split-YAML projects in standard repositories now support init/clone/status with push readiness and unpublished-branch evidence, selected/all stage and unstage, selected/all unstaged discard with index preservation, aggregate and confined per-file working/staged diffs including bounded untracked text, commit, ordered reviewed grouped commits, or remote-access-preflighted commit-and-push with explicit partial-progress, nothing-to-push defense, and actionable non-fast-forward/auth/access failure reporting, a bounded current-branch history with author/date/parents/decorations and selected-commit patches, local branch create/switch/merged-delete, explicit fetch/prune, remote-only branch discovery and tracking checkout, remotes, pull/push, clean-tree-guarded merge, three-way text resolution, binary side selection, and abort. Provider-specific authentication/onboarding/credential validation, un-checked-out remote history, force/local-remote deletion, rebase/cherry-pick, automatic discovery, and broader edge-case fixtures remain. | [Storage and Git Sync](https://developer.konghq.com/insomnia/storage/), [Git Sync](https://developer.konghq.com/insomnia/git-sync/) |
| Plugins and extension API | Baseline | Disabled-by-default local CommonJS plugins run in disposable Workers with explicit grants. Request/response hooks, custom tags, actions, themes, local store, notifications, and mediated network/prompt/clipboard APIs work for HTTP, GraphQL, gRPC, and collection runs. Remote/npm dependency installation, discovery/hot reload, streaming hooks, complete context/hook coverage, and ecosystem compatibility remain. | [Plugins](https://developer.konghq.com/insomnia/plugins/), [plugin reference](https://developer.konghq.com/insomnia/plugins/plugin-reference/), [hooks and actions](https://developer.konghq.com/insomnia/plugins/hooks-and-actions/) |
| Secrets and external vaults | Baseline | A passphrase-derived AES-256-GCM local vault keeps decrypted values in memory, resolves `vault.*` variables, and can be exposed to desktop scripts only through a device-local off-by-default grant. Device-local private sub-environment trees are omitted from exports/projects/encrypted sync. AWS, GCP, Azure, and HashiCorp tags use installed official CLI credential chains, a memory cache, and per-reference approval. OS-keychain wrapping, provider-native login UX/SDKs, headless adapters, script access to external providers, and broader secret-field UX remain. | [External vault integration](https://developer.konghq.com/insomnia/external-vault/), [environments](https://developer.konghq.com/insomnia/environments/) |
| Cloud sync and collaboration | Baseline | A user-controlled shared file now carries filtered workspace data under AES-256-GCM E2EE with pull/push revisions, conflict rejection, explicit force, local actor labels, and no hosted dependency. Git remains available for branch/commit workflows. Per-user key wrapping, real-time sync/presence, comments, resource-specific cloud branches/history, discovery, and offline merge UI remain. | [Storage options](https://developer.konghq.com/insomnia/storage/), [data security](https://developer.konghq.com/insomnia/end-to-end-encryption/) |
| MCP clients | Baseline | Multiple project-scoped HTTP/STDIO clients support initialization, paginated discovery/caching and invocation of tools/prompts/resources/templates, roots, JSON/SSE parsing, session IDs, vault-backed credentials, event records, and split-YAML serialization. Prompt arguments and top-level scalar tool JSON-Schema properties have synchronized guided/JSON editors with bounded per-primitive drafts; complex tool values remain directly editable as JSON. Resource templates preserve their URI template, derive required variables, preview and expand bounded RFC 6570 values before `resources/read`. HTTP OAuth supports manual or discovered RFC 9728/RFC 8414/OIDC metadata, dynamic registration, PKCE, resource parameters, loopback capture, refresh recovery, scope escalation, and device-local credentials. Client-ID metadata documents, metadata redirects, recursive/conditional JSON-Schema forms, long-lived streaming, cancellation, elicitation, reviewed sampling, notification response UI, and persistent STDIO sessions remain. | [MCP clients](https://developer.konghq.com/insomnia/mcp-clients-in-insomnia/) |
| AI-assisted workflows | Baseline | Optional OpenAI, Anthropic, Gemini, and custom/local OpenAI-compatible configuration drives bounded mock generation from manual, explicitly fetched/reviewed specification-URL, or selected active-request/latest-response context plus reviewable Git commit grouping that can be executed in order with optional push. Credentials are vault-backed and no Brunomnia account/model is required. Direct `.gguf` loading and reviewed MCP sampling remain. | [AI in Insomnia](https://developer.konghq.com/insomnia/ai-in-insomnia/) |
| Service integrations | Baseline | A pull-only Konnect adapter lists control planes and maps Gateway Services plus HTTP/HTTPS Routes while preserving local request work and recording unsupported routes. Live-tenant fixtures, SNI/TCP/UDP execution, bidirectional configuration, and any newly documented adapters remain. | [Konnect integration](https://developer.konghq.com/insomnia/konnect-integration/) |
| SSO, RBAC, SCIM, audit, and organization controls | Early baseline | Workspace v23 retains normalized owner/admin/editor/viewer actors, last-owner protection, storage/secret/external-reference policy checks, encrypted-sync and integration edit enforcement, device-local script authorities, and bounded local audit events. These are local controls, not identity proof. Self-hosted SAML/OIDC, SCIM, authenticated organization service, complete RBAC enforcement, and tamper-evident audit export remain. | [Authentication and authorization](https://developer.konghq.com/insomnia/authentication-authorization/), [SSO](https://developer.konghq.com/insomnia/sso/), [SCIM](https://developer.konghq.com/insomnia/scim/) |
| Preferences, shortcuts, themes, accessibility, and packaging | Baseline | Device-local system/dark/light themes, comfortable/compact density, editor font sizing, request/script defaults, preferred HTTP version, redirect/timeout/API-validation/auth-validation and system/manual proxy defaults, regular/bulk header and query editors, forced-vertical layout, editor wrapping/tabs/indent width/ligatures, separate interface/editor families and 8–24 px sizes, masked request/folder authentication and MCP/AI/Konnect credentials with global/per-field reveal, maximum redirects, timeline chunk size, response-history limit/environment filtering, response-viewer link disabling, off-by-default HTML-preview remote resources/JavaScript plus script network/file/vault grants, delete confirmation, GraphQL auto-introspection, eleven editable shortcuts with collision warnings—including Generate Code—sidebar toggling, and a macOS Tauri app bundle exist. Full command/action coverage, accessibility audit, updater, signing/notarization, and Windows/Linux release artifacts remain. | [Keyboard shortcuts](https://developer.konghq.com/insomnia/keyboard-shortcuts/), [Insomnia documentation](https://developer.konghq.com/index/insomnia/) |

## Milestone 3 acceptance evidence

- Shared design and generation engine: [`src/lib/openapi.ts`](../src/lib/openapi.ts) and [`src/lib/openapi.test.ts`](../src/lib/openapi.test.ts)
- Permission-bounded browser runtime: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts)
- Shared runner and data parser: [`src/lib/runner.ts`](../src/lib/runner.ts) and [`src/lib/runner.test.ts`](../src/lib/runner.test.ts)
- Native loopback server and integration test: [`src-tauri/src/mock_server.rs`](../src-tauri/src/mock_server.rs)
- Direct text-response-to-route conversion and focused tests: [`src/lib/mockRouteFromResponse.ts`](../src/lib/mockRouteFromResponse.ts) and [`src/lib/mockRouteFromResponse.test.ts`](../src/lib/mockRouteFromResponse.test.ts)
- Request-aware native mock rendering and handler-level fixtures: [`src-tauri/src/mock_server.rs`](../src-tauri/src/mock_server.rs)
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

## Milestone 88 acceptance evidence

- Loopback-only native callback listener, browser opener, state verification, fragment bridge, timeout, and cancellation: [`src-tauri/src/oauth2_callback.rs`](../src-tauri/src/oauth2_callback.rs)
- Generated state/PKCE preparation, callback mapping, native channel bridge, and provider-error handling: [`src/lib/oauth2.ts`](../src/lib/oauth2.ts) and [`src/lib/oauth2.test.ts`](../src/lib/oauth2.test.ts)
- Authorization-code exchange plus access, refresh, and identity-token retention: [`src/lib/http.ts`](../src/lib/http.ts) and [`src/components/AuthEditor.tsx`](../src/components/AuthEditor.tsx)
- Insomnia-compatible implicit response types and import/export persistence: [`src/types.ts`](../src/types.ts), [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), and [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts)
- Exact verification record: [`docs/QA_MILESTONE_88.md`](QA_MILESTONE_88.md)

## Milestone 89 acceptance evidence

- OAuth Origin, OIDC nonce, ID-token fallback, `NO_PREFIX`, expiry, and refresh semantics: [`src/lib/auth.ts`](../src/lib/auth.ts), [`src/lib/http.ts`](../src/lib/http.ts), and [`src/lib/oauth2.ts`](../src/lib/oauth2.ts)
- Automatic direct-send browser authorization plus cancellable status UI: [`src/App.tsx`](../src/App.tsx)
- Shared noninteractive pre-send acquisition for direct, runner, script, plugin, and integration HTTP execution: [`src/lib/http.ts`](../src/lib/http.ts) and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Request/folder ownership persistence and secret-policy coverage: [`src/lib/resources.ts`](../src/lib/resources.ts), [`src/lib/security.ts`](../src/lib/security.ts), and their focused tests
- Exact verification record: [`docs/QA_MILESTONE_89.md`](QA_MILESTONE_89.md)

## Milestone 90 acceptance evidence

- Shared interactive resolver contract that blocks protected dispatch until credentials return: [`src/lib/http.ts`](../src/lib/http.ts) and [`src/lib/http.test.ts`](../src/lib/http.test.ts)
- Direct, script/plugin, project, and integration resolver propagation with request-switch/project cancellation: [`src/App.tsx`](../src/App.tsx)
- Collection-run and runner-script authorization, persistence, and Cancel-run integration: [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Reusable lazy waiting/cancel surface: [`src/components/OAuthAuthorizationDialog.tsx`](../src/components/OAuthAuthorizationDialog.tsx)
- Exact verification record: [`docs/QA_MILESTONE_90.md`](QA_MILESTONE_90.md)

## Milestone 91 acceptance evidence

- Pure local-only runtime credential scrub/restore boundary with untrusted-input sanitization: [`src/lib/oauth2Tokens.ts`](../src/lib/oauth2Tokens.ts) and [`src/lib/oauth2Tokens.test.ts`](../src/lib/oauth2Tokens.test.ts)
- Git/folder project omission and owner-matched local restoration: [`src/lib/project.ts`](../src/lib/project.ts) and [`src/lib/project.test.ts`](../src/lib/project.test.ts)
- Encrypted-sync omission/restoration and publish-policy integration: [`src/lib/security.ts`](../src/lib/security.ts), [`src/App.tsx`](../src/App.tsx), and the security/project workbenches
- Typed invalid-refresh detection with interactive/noninteractive recovery: [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/oauth2.ts`](../src/lib/oauth2.ts), and their focused tests
- Exact verification record: [`docs/QA_MILESTONE_91.md`](QA_MILESTONE_91.md)

## Milestone 92 acceptance evidence

- MCP-to-request OAuth adapter, token propagation across sessions/discovery/invocation, and focused transport fixtures: [`src/lib/mcp.ts`](../src/lib/mcp.ts) and [`src/lib/mcpOAuth.test.ts`](../src/lib/mcpOAuth.test.ts)
- Project-scoped endpoint/client/scope authoring, token status, clearing, and shared authorization dialog integration: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- MCP runtime-token omission/restoration, incoming-token sanitization, import reset, and client-secret policy: [`src/lib/oauth2Tokens.ts`](../src/lib/oauth2Tokens.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/lib/security.ts`](../src/lib/security.ts)
- Exact verification record: [`docs/QA_MILESTONE_92.md`](QA_MILESTONE_92.md)

## Milestone 93 acceptance evidence

- Bearer challenge parsing, RFC 9728/RFC 8414/OIDC fallback construction, metadata validation, scope selection, guarded fetches, and dynamic registration: [`src/lib/mcpOAuthDiscovery.ts`](../src/lib/mcpOAuthDiscovery.ts)
- Unauthenticated probe, immediate local registration/token persistence, authorization retry, RFC 8707 resource binding, and insufficient-scope step-up: [`src/lib/mcp.ts`](../src/lib/mcp.ts) and [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- Local-only registered-client credential normalization, scrub/restore, import reset, and focused end-to-end negotiation fixtures: [`src/types.ts`](../src/types.ts), [`src/lib/oauth2Tokens.ts`](../src/lib/oauth2Tokens.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/lib/mcpOAuth.test.ts`](../src/lib/mcpOAuth.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_93.md`](QA_MILESTONE_93.md)

## Milestone 94 acceptance evidence

- Bounded RFC 6570 expression parsing, variable extraction, scalar/list/object expansion, encoding, modifiers, and focused examples: [`src/lib/mcpUriTemplate.ts`](../src/lib/mcpUriTemplate.ts) and [`src/lib/mcpUriTemplate.test.ts`](../src/lib/mcpUriTemplate.test.ts)
- Resource/template distinction, derived metadata, exact `resources/read` expansion, and OAuth/session-safe invocation: [`src/types.ts`](../src/types.ts), [`src/lib/mcp.ts`](../src/lib/mcp.ts), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Per-variable string controls, expanded-URI preview, malformed-template refusal, and template-aware operation counts: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx) and [`src/styles.css`](../src/styles.css)
- Exact verification record: [`docs/QA_MILESTONE_94.md`](QA_MILESTONE_94.md)

## Milestone 95 acceptance evidence

- Bounded top-level scalar JSON-Schema normalization, required/default/title/description/enum/const handling, coercion, and focused fixtures: [`src/lib/mcpParameterSchema.ts`](../src/lib/mcpParameterSchema.ts) and [`src/lib/mcpParameterSchema.test.ts`](../src/lib/mcpParameterSchema.test.ts)
- Guided prompt arguments and tool scalar fields synchronized with editable JSON, complex-field fallback, and primitive-aware initial values: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx)
- Client/family/name-isolated 1,000-entry draft retention plus operation/client reset coverage: [`src/components/IntegrationWorkbench.tsx`](../src/components/IntegrationWorkbench.tsx) and [`src/components/IntegrationWorkbench.test.ts`](../src/components/IntegrationWorkbench.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_95.md`](QA_MILESTONE_95.md)

## Milestone 98 acceptance evidence

- Workspace v23 Socket.IO request, argument, acknowledgement, and listener normalization plus sample authoring data: [`src/types.ts`](../src/types.ts), [`src/data/seed.ts`](../src/data/seed.ts), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- First-class Insomnia v4/v5 Socket.IO request and separate-payload import/export compatibility: [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts), and their focused tests
- Native Engine.IO v4/Socket.IO connect, namespace, heartbeat, emit, acknowledgement, listener, limit, and disconnect transport with loopback integration coverage: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs), [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Lazy request editor, event console, transport bridge, live listener controls, and runner sampling: [`src/components/SocketIoEditor.tsx`](../src/components/SocketIoEditor.tsx), [`src/components/StreamConsole.tsx`](../src/components/StreamConsole.tsx), [`src/lib/socketIo.ts`](../src/lib/socketIo.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), and [`src/App.tsx`](../src/App.tsx)
- Exact verification record: [`docs/QA_MILESTONE_98.md`](QA_MILESTONE_98.md)

## Milestone 99 acceptance evidence

- Polling-first Engine.IO target construction, bounded open-packet parsing, cache-busted GET/POST requests, server `maxPayload`, namespace handshake, and proxy/TLS/client-identity reuse: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs) and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Standards-based WebSocket probe/upgrade with header continuity and automatic polling fallback when the server omits or rejects upgrade support: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Independent long-poll receive task plus concurrent emit/ack/listener/heartbeat/disconnect command handling without HTTP/1 head-of-line deadlock: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Real polling-only and polling-to-WebSocket loopback fixtures covering namespace connect, emit, acknowledgement, incoming listener, transport evidence, and disconnect: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Exact verification record: [`docs/QA_MILESTONE_99.md`](QA_MILESTONE_99.md)

## Milestone 100 acceptance evidence

- Socket.IO type 5 binary-event and type 6 binary-ack parsing with namespace, attachment-count, acknowledgement-ID, JSON payload, count, and size validation: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Recursive array/object placeholder hydration into Node-compatible `{ type: "Buffer", data: [...] }` values with missing-index rejection: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Shared stateful attachment delivery across raw WebSocket binary frames and Engine.IO polling `b<base64>` packets, preserving listener filters and pending acknowledgement correlation: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Unit plus real upgraded-WebSocket and polling-only fixtures covering nested multi-attachment events, binary acknowledgements, console evidence, and ordinary event continuity: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Exact verification record: [`docs/QA_MILESTONE_100.md`](QA_MILESTONE_100.md)

## Milestone 101 acceptance evidence

- Workspace v24 stream-session model, bounded migration, orphan removal, and local catalog persistence: [`src/types.ts`](../src/types.ts), [`src/lib/storage.ts`](../src/lib/storage.ts), and [`src/lib/storage.test.ts`](../src/lib/storage.test.ts)
- Shared finite/zero/unlimited retention, active-environment visibility, chronological grouping, incremental event append, reconnect lifecycle, deletion, and clearing: [`src/lib/streamHistory.ts`](../src/lib/streamHistory.ts) and [`src/lib/streamHistory.test.ts`](../src/lib/streamHistory.test.ts)
- Live create/append/restore/select/delete/clear integration with abandoned-scope and late-event race guards: [`src/App.tsx`](../src/App.tsx) and [`src/components/StreamHistoryControls.tsx`](../src/components/StreamHistoryControls.tsx)
- Device-local project/sync boundaries and duplicate reset coverage: [`src/lib/project.ts`](../src/lib/project.ts), [`src/lib/security.ts`](../src/lib/security.ts), and their focused tests
- Exact verification record: [`docs/QA_MILESTONE_101.md`](QA_MILESTONE_101.md)

## Milestone 102 acceptance evidence

- Independent editable-request snapshots on every newly retained realtime session: [`src/types.ts`](../src/types.ts) and [`src/lib/streamHistory.ts`](../src/lib/streamHistory.ts)
- Shared structural restoration preserving current request identity/tree placement and rejecting missing, mismatched, or malformed legacy snapshots: [`src/lib/historicalRequest.ts`](../src/lib/historicalRequest.ts) and the history suites
- Selection and delete-to-latest restoration after live disconnect/race guards: [`src/App.tsx`](../src/App.tsx)
- Workspace v25 migration/import/export propagation with request-ID-scoped snapshot acceptance: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/interchange/apply.ts`](../src/lib/interchange/apply.ts), and their focused tests
- Exact verification record: [`docs/QA_MILESTONE_102.md`](QA_MILESTONE_102.md)

## Milestone 103 acceptance evidence

- Pinned-compatible event category derivation, message/error/close text search, and clear-through timestamp filtering: [`src/lib/streamHistory.ts`](../src/lib/streamHistory.ts) and [`src/lib/streamHistory.test.ts`](../src/lib/streamHistory.test.ts)
- Responsive lazy stream-console toolbar with WebSocket/Socket.IO type selection, shared search/count evidence, SSE-compatible disabled type control, and non-destructive clear view: [`src/components/StreamConsole.tsx`](../src/components/StreamConsole.tsx) and [`src/styles.css`](../src/styles.css)
- Session-ID reset propagation preventing filters/cutoffs from leaking across saved histories: [`src/App.tsx`](../src/App.tsx)
- Exact verification record: [`docs/QA_MILESTONE_103.md`](QA_MILESTONE_103.md)

## Milestone 104 acceptance evidence

- Shared native handshake result for status/message, flattened response headers, HTTP version, elapsed duration, and effective transport: [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Typed Tauri/browser bridge plus bounded metadata/timeline merge helpers: [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/lib/socketIo.ts`](../src/lib/socketIo.ts), and [`src/lib/streamHistory.ts`](../src/lib/streamHistory.ts)
- Live-retention-zero and saved-history selected-session metadata view with stream-aware Headers, Timeline, summary, and selector evidence: [`src/App.tsx`](../src/App.tsx) and [`src/components/StreamHistoryControls.tsx`](../src/components/StreamHistoryControls.tsx)
- Workspace v26 normalization and focused metadata/lifecycle/native-transport coverage: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/storage.test.ts`](../src/lib/storage.test.ts), and the stream suites
- Exact verification record: [`docs/QA_MILESTONE_104.md`](QA_MILESTONE_104.md)

## Milestone 105 acceptance evidence

- Real two-response SSE loopback covering initial event ID, server retry override, resumed request headers, second event delivery, metadata, explicit cancellation, and terminal close: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Test HTTP request capture now retains normalized headers so protocol fixtures can assert transport-visible resume/auth/content behavior rather than event output alone: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Exact verification record: [`docs/QA_MILESTONE_105.md`](QA_MILESTONE_105.md)

## Milestone 106 acceptance evidence

- Collision-checked CRLF multipart serialization with resolved metadata, duplicate text fields, optional content types, exact binary parts, header-line neutralization, and explicit invalid-file warnings: [`src/lib/codegen.ts`](../src/lib/codegen.ts)
- One shared inline byte payload emitted through cURL, JavaScript Fetch, Python Requests, Go, Java, and C#, plus standalone binary MIME/byte preservation: [`src/lib/codegen.ts`](../src/lib/codegen.ts)
- Focused byte-level framing, cross-target identity, boundary-collision, binary, and invalid-data coverage: [`src/lib/codegen.test.ts`](../src/lib/codegen.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_106.md`](QA_MILESTONE_106.md)

## Milestone 107 acceptance evidence

- Lazy URL-encoded/multipart controls for enablement, multiline editing, descriptions, ordering, files, and metadata plus focused transition/reorder tests: [`src/components/MultipartEditor.tsx`](../src/components/MultipartEditor.tsx) and [`src/components/MultipartEditor.test.ts`](../src/components/MultipartEditor.test.ts)
- Shared body-rendering policy, binary MIME defaults, browser/native/CLI/codegen propagation, and legacy request-history restoration: [`src/lib/http.ts`](../src/lib/http.ts), [`cli/brunomnia.ts`](../cli/brunomnia.ts), [`src/lib/codegen.ts`](../src/lib/codegen.ts), and [`src/lib/historicalRequest.ts`](../src/lib/historicalRequest.ts)
- Insomnia v4/v5 body policy/multiline/description/disabled/order round trips and workspace v27 migration: [`src/lib/interchange/insomnia.ts`](../src/lib/interchange/insomnia.ts), [`src/lib/interchange/exporters.ts`](../src/lib/interchange/exporters.ts), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Real native multipart wire capture plus exact binary MIME/body construction: [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Exact verification record: [`docs/QA_MILESTONE_107.md`](QA_MILESTONE_107.md)

## Milestone 108 acceptance evidence

- Operation-aware GraphQL document selection that honors `operationName` while ignoring comments, strings, fragments, and variable-default object literals: [`src/lib/graphql.ts`](../src/lib/graphql.ts) and [`src/lib/graphql.test.ts`](../src/lib/graphql.test.ts)
- Shared GraphQL-subscription routing, HTTP(S)-to-WS(S) conversion, required subprotocol input, exact serialized payload reuse, bounded runner sampling, and static OAuth/API-key continuity: [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/lib/http.ts`](../src/lib/http.ts), and [`src/components/AutomationWorkbench.tsx`](../src/components/AutomationWorkbench.tsx)
- Native `graphql-transport-ws` lifecycle with `connection_init`, ack-triggered UUID subscribe, typed incoming/outgoing events, terminal error/complete close, and a real loopback handshake/protocol test: [`src-tauri/src/models.rs`](../src-tauri/src/models.rs) and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- GraphQL stream console/history integration plus workspace v28 session normalization and request-version restoration: [`src/App.tsx`](../src/App.tsx), [`src/lib/streamHistory.ts`](../src/lib/streamHistory.ts), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Exact verification record: [`docs/QA_MILESTONE_108.md`](QA_MILESTONE_108.md)

## Milestone 109 acceptance evidence

- Request-local Rustls connector construction for native roots, explicit invalid-certificate authority, complete PEM identity parsing, and shared HTTP/WebSocket domain scoping: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs) and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Direct Rustls/native-root/PKI/Tokio-Rustls declarations constrained to the versions already present in the lock graph: [`src-tauri/Cargo.toml`](../src-tauri/Cargo.toml) and [`src-tauri/Cargo.lock`](../src-tauri/Cargo.lock)
- Repository-owned CA/server/client fixtures plus a real strict-validation/domain-mismatch/matching-mTLS WSS loopback: [`src-tauri/tests/fixtures/tls`](../src-tauri/tests/fixtures/tls) and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Existing frontend effective validation and client-identity input reused unchanged by WebSocket and GraphQL subscription execution: [`src/lib/protocol.ts`](../src/lib/protocol.ts) and [`src/components/ProtocolEditors.tsx`](../src/components/ProtocolEditors.tsx)
- Exact verification record: [`docs/QA_MILESTONE_109.md`](QA_MILESTONE_109.md)

## Milestone 110 acceptance evidence

- Shared boxed native WebSocket transport for direct TCP, HTTP/HTTPS proxy connections, nested target TLS, request-local validation, scoped client identity, and bracket-safe IPv6 domain matching: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs) and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Bounded HTTP CONNECT negotiation, default-protocol normalization, percent-decoded Basic credentials with control-character rejection, explicit proxy errors, and exact/suffix/port/IPv4/IPv6-CIDR no-proxy matching: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- WebSocket, converted GraphQL subscription, and Engine.IO WebSocket-upgrade reuse of the same effective frontend transport policy: [`src/lib/transport.ts`](../src/lib/transport.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Real authenticated proxy, direct bypass, nested WSS mTLS, HTTPS proxy, and polling-to-proxied-WebSocket Socket.IO loopbacks: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Exact verification record: [`docs/QA_MILESTONE_110.md`](QA_MILESTONE_110.md)

## Milestone 111 acceptance evidence

- Pinned `http-proxy-agent`-compatible absolute-form plain-WS request rewriting while leaving Tungstenite's generated headers and handshake verification intact: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Partial-write-safe async adapter, `http://` target authority/path/query construction, configured Basic authorization override, and default `Proxy-Connection` injection: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Protocol split retaining bounded authenticated CONNECT for WSS, including GraphQL subscriptions and HTTPS Socket.IO targets, while HTTP Socket.IO upgrades use forward-proxy form: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Updated plain HTTP proxy, TLS proxy, WSS mTLS tunnel, bypass, and Socket.IO upgrade loopbacks asserting the proxy-visible request form: [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Exact verification record: [`docs/QA_MILESTONE_111.md`](QA_MILESTONE_111.md)

## Milestone 112 acceptance evidence

- Effective secure-endpoint validation through Tonic's custom Rustls verifier API with request-local Never authority and no global TLS mutation: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs) and [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs)
- Domain-scoped PEM identity reuse from native HTTP, paired-material validation, native-root retention, TLS-handshake timeout continuity, and plain-endpoint isolation: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs) and [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs)
- Repository-owned CA/server/client fixtures plus a real strict-validation, mismatched-identity, and matching-mTLS gRPC TLS handshake sequence: [`src-tauri/tests/fixtures/tls`](../src-tauri/tests/fixtures/tls) and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Exact verification record: [`docs/QA_MILESTONE_112.md`](QA_MILESTONE_112.md)

## Milestone 113 acceptance evidence

- Validated `grpc:`/`grpcs:` normalization to Tonic's HTTP/HTTPS transport schemes with path/query preservation and explicit unsupported-scheme rejection: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Exact verification record: [`docs/QA_MILESTONE_113.md`](QA_MILESTONE_113.md)

## Milestone 114 acceptance evidence

- Bounded file/folder ingestion, common-root removal, path normalization, service-bearing entry selection, active-file persistence, and synchronized legacy source: [`src/lib/grpcProto.ts`](../src/lib/grpcProto.ts), [`src/lib/grpcProtoImport.ts`](../src/lib/grpcProtoImport.ts), and [`src/components/GrpcEditor.tsx`](../src/components/GrpcEditor.tsx)
- Workspace v29 legacy-source migration, malformed-tree repair, and native invocation serialization: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/grpc.ts`](../src/lib/grpc.ts), and their focused tests
- Isolated native tree reconstruction, repeated path validation, explicit entry compilation, imported descriptor inclusion, and a real cross-file proto compiler test: [`src-tauri/src/models.rs`](../src-tauri/src/models.rs) and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Exact verification record: [`docs/QA_MILESTONE_114.md`](QA_MILESTONE_114.md)

## Milestone 115 acceptance evidence

- Bounded workspace CA/client-certificate model, port-first/host-fallback wildcard selection, request-local override precedence, and focused tests: [`src/lib/certificates.ts`](../src/lib/certificates.ts) and [`src/lib/certificates.test.ts`](../src/lib/certificates.test.ts)
- Account-free certificate import/paste, enable/disable, list, and delete UI: [`src/components/CertificateManager.tsx`](../src/components/CertificateManager.tsx) and [`src/components/SecurityWorkbench.tsx`](../src/components/SecurityWorkbench.tsx)
- Shared HTTP/realtime/gRPC serialization plus native Reqwest/Rustls/Tonic trust extension and size enforcement: [`src/lib/http.ts`](../src/lib/http.ts), [`src/lib/protocol.ts`](../src/lib/protocol.ts), [`src/lib/grpc.ts`](../src/lib/grpc.ts), [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs), and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Workspace v30 local-only migration, project/sync preservation, and real HTTPS/WSS/gRPC private-CA loopbacks: [`src/lib/storage.ts`](../src/lib/storage.ts), [`src/lib/project.ts`](../src/lib/project.ts), [`src/lib/security.ts`](../src/lib/security.ts), and native transport tests
- Exact verification record: [`docs/QA_MILESTONE_115.md`](QA_MILESTONE_115.md)

## Milestone 116 acceptance evidence

- Mutually exclusive bounded workspace/request PEM or PFX model, base64 sizing, host/port selection, normalization, and request-local precedence: [`src/types.ts`](../src/types.ts), [`src/lib/certificates.ts`](../src/lib/certificates.ts), and [`src/lib/storage.ts`](../src/lib/storage.ts)
- Account-free workspace and request-local PFX import with masked passphrases and conflict-clearing editor behavior: [`src/components/CertificateManager.tsx`](../src/components/CertificateManager.tsx) and [`src/components/TransportEditor.tsx`](../src/components/TransportEditor.tsx)
- Pure-Rust modern/legacy PKCS#12 decoding into one shared Reqwest/Rustls/Tonic identity path with bounded IPC validation: [`src-tauri/src/client_identity.rs`](../src-tauri/src/client_identity.rs), [`src-tauri/src/http_client.rs`](../src-tauri/src/http_client.rs), [`src-tauri/src/streaming.rs`](../src-tauri/src/streaming.rs), and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Opt-in primary/secondary PFX script hydration, local-only workspace persistence, explicit-export behavior, and plaintext-publication checks: [`src/lib/scriptSandbox.ts`](../src/lib/scriptSandbox.ts), [`src/lib/project.ts`](../src/lib/project.ts), [`src/lib/security.ts`](../src/lib/security.ts), and their focused tests
- Repository-owned modern OpenSSL fixture plus generated modern/legacy bundles and real HTTPS, WSS, and gRPC mTLS loopbacks: [`src-tauri/tests/fixtures/tls`](../src-tauri/tests/fixtures/tls) and native transport tests
- Exact verification record: [`docs/QA_MILESTONE_116.md`](QA_MILESTONE_116.md)

## Milestone 117 acceptance evidence

- Pinned `grpcCalls` lifecycle audit covering `start`, `sendMessage`, `commit`, `cancel`, status/data/error/end events, and the absence of a separate gRPC proxy agent: [`docs/QA_MILESTONE_117.md`](QA_MILESTONE_117.md)
- Duplicate-safe bounded native session state, dynamic per-message validation, half-close/cancel behavior, and TLS/CA/PEM/PFX/metadata continuity: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs), [`src-tauri/src/models.rs`](../src-tauri/src/models.rs), and [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- Account-free interactive call controls, ordered 500-event console, environment resolution, and browser-development fallback: [`src/components/GrpcEditor.tsx`](../src/components/GrpcEditor.tsx), [`src/lib/grpc.ts`](../src/lib/grpc.ts), and [`src/styles.css`](../src/styles.css)
- Real HTTP/2 client-streaming, bidirectional send/commit, and cancellation loopbacks plus focused renderer command/channel tests: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs) and [`src/lib/grpc.test.ts`](../src/lib/grpc.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_117.md`](QA_MILESTONE_117.md)

## Milestone 118 acceptance evidence

- Pinned transient `GrpcRequestState` and response-pane audit for numeric status code, details, metadata, error fallback, and non-persisted response messages: [`docs/QA_MILESTONE_118.md`](QA_MILESTONE_118.md)
- Optional structured status fields on the shared IPC event contract plus bounded ASCII/binary initial, trailing, and error metadata capture: [`src-tauri/src/models.rs`](../src-tauri/src/models.rs) and [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs)
- Status badge, details, expandable metadata, ordered event continuity, and deterministic browser status simulation: [`src/components/GrpcEditor.tsx`](../src/components/GrpcEditor.tsx), [`src/lib/grpc.ts`](../src/lib/grpc.ts), [`src/types.ts`](../src/types.ts), and [`src/styles.css`](../src/styles.css)
- Real HTTP/2 success metadata and `INVALID_ARGUMENT` code/details/error-metadata assertions plus renderer channel-field preservation: [`src-tauri/src/grpc_client.rs`](../src-tauri/src/grpc_client.rs) and [`src/lib/grpc.test.ts`](../src/lib/grpc.test.ts)
- Exact verification record: [`docs/QA_MILESTONE_118.md`](QA_MILESTONE_118.md)

## Parity declaration rule

Brunomnia must not be described as feature-complete while any row is `Baseline`, `Early baseline`, or `Not started`. Before a parity release, re-read the current Insomnia documentation and changelog, add newly documented capability rows, and attach reproducible evidence for every row. Commercial availability in Insomnia does not remove a capability from this ledger; Brunomnia's implementation remains governed by [the free feature policy](FREE_FEATURE_POLICY.md).
