# Tauri migration map

Brunomnia uses a staged clean-room rewrite. The current repository is intentionally small enough to audit and run while protocol and ecosystem support are added behind stable interfaces.

## Milestone 1 — runnable native foundation

| Capability | Status | Notes |
| --- | --- | --- |
| Tauri 2 desktop shell | Complete | Native bundle configuration and app icons included |
| REST/HTTP transport | Complete | Rust `reqwest`, redirects, inherited/custom execution-time timeout with `0` disabled, arbitrary headers/body |
| Local persistence | Complete | Versioned JSON, atomic write to OS app-data directory |
| Collections and requests | Complete | Create, select, edit, search, and group requests |
| Environments | Complete | Local variables and template resolution |
| Authentication | Complete | None, Bearer, Basic, API key in header/query |
| Response inspection | Complete | Body, headers, cookies empty state, and timeline |
| History | Complete | Last 100 request results |
| Workspace import/export | Complete | Versioned Brunomnia JSON |
| Scripts and tests | Editor complete | Runtime execution is a later milestone |

## Milestone 2 — protocol breadth (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| GraphQL | Complete | Operation name, query and variables editor; native HTTP execution and response inspection |
| WebSocket | Complete | Native text-frame sessions, custom headers, connect/disconnect, ordered incoming/outgoing/system log |
| Server-Sent Events | Complete baseline | Native long-running sessions handle chunk boundaries, CRLF, comments, named events, multiline data, reconnect policy, server retry hints, and event-ID resume |
| gRPC schema discovery | Complete | Server Reflection v1 and pasted `.proto` compilation into a local descriptor pool |
| gRPC execution | Complete | Dynamic protobuf JSON mapping; unary, client-streaming, server-streaming and bidirectional calls |
| Rich HTTP bodies | Complete | None, JSON, text, URL-encoded, multipart text/files and binary files |
| Transport configuration | Complete for HTTP/SSE | Redirect policy, inherited/custom connect/HTTP timeout with `0` disabled, inherited/always/never API certificate validation, unlimited active SSE duration, HTTP proxy and PEM/PFX client identity |
| gRPC TLS | Complete baseline | System roots plus workspace CA trust, timeout, inherited/overridden validation, and host/port-scoped PEM or PFX/PKCS#12 client identity; custom proxy transport remains later closure |
| WebSocket TLS and proxy | Complete baseline | System roots and arbitrary handshake headers; Milestone 109 adds inherited validation overrides plus domain-scoped PEM identity, Milestone 110 adds authenticated HTTP/HTTPS custom proxy transport plus no-proxy handling, and Milestone 111 matches plain-WS absolute-form forwarding |
| Workspace migration | Complete | Version 1 workspaces migrate in place to the version 2 protocol schema |

Streaming gRPC currently returns up to 100 messages within the configured deadline. WebSocket binary frames are reported with their byte count; binary-frame composition is deferred. These bounds are product behavior, not commercial gates.

## Milestone 3 — design, test, and automation (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| OpenAPI design editor | Complete | OpenAPI 3.x YAML/JSON editing, formatting, resolved local/public-HTTPS multi-file preview, source-aware diagnostics, and request generation |
| OpenAPI linting | Complete | Pinned Spectral 1.22 OAS defaults, every runtime-exported safe built-in function, nested local/public-HTTPS ruleset extends, bounded native public-source resolution, and explicit refresh work without executing custom JavaScript |
| Request generation | Complete baseline | Generates or refreshes a runnable collection from servers, paths, parameters, and request-body examples |
| Pre-request scripts | Complete baseline | Two-second worker/VM boundary with environment mutation, request header mutation, and captured console output; Node modules, DOM, and script-originated network access are unavailable |
| After-response tests | Complete baseline | `insomnia.test`, response helpers, console output, and a focused `expect` matcher set with results in the response pane |
| Collection runner | Complete baseline | Ordered runs, 1–1000 iterations, JSON/CSV data, up to 10 retries, delays, cancellation, environment propagation, and stored reports |
| Local mocks | Complete baseline | Native loopback-only Axum server, method/path matching, path parameters, status/headers/body/delay/CORS, and timestamp/UUID/path tokens |
| Headless CLI | Complete baseline | Lint/generate/export plus collection/test runs using the shared OpenAPI and runner modules; package-backed version output, scoped parent/leaf help with local/global flags, unambiguous resource selection, bounded prompts, environment boundaries, and private test-source retention are covered |
| Workspace migration | Complete | Version 1 and 2 workspaces migrate in place to version 3 design, mock, and report resources |

Current compatibility bounds are tracked in [PARITY.md](PARITY.md). Milestone 241 closes desktop API-specification lint/reference parity; the headless CLI retains its separately documented local safe-rule boundary, and unrelated scripting, mock, protocol, and packaging gaps remain in their own ledger rows.

## Milestone 4 — import and export interoperability (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Import sources | Complete baseline | Local file, pasted text, and HTTP(S) URL with a 20 MB local conversion limit and pre-apply analysis |
| Insomnia import | Complete baseline | JSON v4 and multi-document YAML v5 collections, requests, environments, API designs, mocks, HTTP, GraphQL, WebSocket, and gRPC |
| Postman import | Complete baseline | Collection 2.0/2.1, nested items, variables, environments, supported auth/body modes, and best-effort script translation |
| Portable request import | Complete baseline | HAR 1.2 and one or more cURL commands, parsed locally without shell execution |
| API definition import | Complete baseline | OpenAPI 3.x, Swagger 2, and WSDL-to-SOAP request templates |
| Export scopes | Complete baseline | All data, selected collection, or selected API design |
| Export formats | Complete baseline | Brunomnia JSON, Insomnia v4 JSON, Insomnia v5 YAML, HAR 1.2, and raw OpenAPI |
| Conversion safety | Complete | Warning preview, collision-safe IDs, import records, source IDs, and unsupported-source metadata |
| Workspace migration | Complete | Versions 1–3 migrate in place to version 4 import records and source metadata |
| Compatibility fixtures | Complete | Project-owned fixtures for every import adapter plus Insomnia v4/v5 and HAR round-trip tests |

Compatibility bounds remain explicit: nested source folders are represented in flattened request names; Postman scripts are translated only for the supported permission-bounded API; local file references must be selected again; WSDL message schemas become editable SOAP placeholders; and binary payload bytes are not embedded in compatibility exports. Socket.IO was originally downgraded at this milestone and Milestone 98 now preserves it as a first-class protocol; MCP was also originally downgraded and Milestone 233 now preserves first-class v4/v5 MCP resources.

## Milestone 5 — request and authentication fidelity (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Advanced authentication | Complete baseline | Digest, OAuth 1.0/2.0, NTLM, AWS IAM v4, Hawk, Atlassian ASAP, and Netrc editors/execution; Digest, NTLM, and Netrc challenge/file behavior runs in the native transport |
| Cookie jar | Complete baseline | Persistent workspace jar, RFC-oriented domain/path/secure/expiry matching, Set-Cookie capture, editing/deletion, and per-request send/store controls |
| Chaining and dynamic values | Complete baseline | Latest-response body/status/header/URL chaining, JSONPath extraction, iteration/request-local/environment variables, UUID/time/Faker/encoding/hash/cookie/prompt/request tags, and actionable missing-dependency errors |
| Transport fidelity | Complete baseline | Proxy exclusions, exact/wildcard certificate domains, editable multipart filename/content type, duplicate parts, and text/file/binary payloads |
| WebSocket and runner fidelity | Complete baseline | Text and base64/file binary composition; bounded WebSocket/SSE collection-run samples with optional WebSocket startup frames |
| Custom lint | Complete | Desktop designs use the pinned Spectral runtime, all 13 functions actually exported by `@stoplight/spectral-functions` 1.10.1, nested selected YAML/HTTPS extends, and bounded multi-file/HTTPS references. The CLI retains its safe local subset and accepts `--ruleset`; Milestone 215 adds pinned file/stored-design/CI input resolution and sibling `.spectral*` discovery. |
| Script/test API | Complete baseline | Environment/base/collection/local/iteration variable APIs, replacement helpers, request getters/setters, response header/cookie helpers, console capture, and Jest/Chai-style expectation aliases |
| Interoperability and migration | Complete | Workspace v5, advanced Insomnia/Postman auth mapping, Insomnia v4/v5 cookie-jar round trips, and collision-safe cookie import |

Compatibility bounds at Milestone 5 were explicit: OAuth 2 authorization used a copied URL and manual returned code/token. Milestone 88 adds native system-browser loopback capture while retaining that browser-development fallback. Netrc contents were project data until the secrets milestone; MD5, file/external-vault template tags, full Faker/JSONPath breadth, and Spectral parity remained deferred. Milestone 131 later closes the File/external-vault/Faker/JSONPath dynamic-variable gaps, and Milestone 241 closes the desktop Spectral/multi-file/remote-source gap while preserving pinned custom-JavaScript rejection. Browser-only HTTP still obeys browser CORS and forbidden-header behavior. Milestone 109 closes WSS client identity and validation overrides, and Milestone 110 closes custom WebSocket proxy transport; headless CLI streaming/auth parity remains later closure work. The later permission-bounded scripting expansion is recorded in Milestone 12.

## Milestone 6 — Git Sync and extensibility (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Filesystem projects | Complete baseline | Stable split YAML for project metadata, collections, environments, designs, and mocks; a manifest limits cleanup to Brunomnia-owned paths and leaves unrelated repository files untouched |
| Git workflow | Complete baseline | Standard `.git` repositories with init/clone/status, staged and working diffs, stage/unstage, commit author overrides, local branch create/switch, remotes, pull, push, and merge |
| Conflict resolution | Complete baseline | Base/ours/theirs text views, editable resolutions, binary ours/theirs selection, deleted-side handling, staging, and explicit merge abort |
| Plugin installation | Complete baseline | Pasted JavaScript, one local package/file, or bounded direct/scoped directory discovery with reviewable relative JavaScript/JSON modules; every new/changed install starts disabled and clears inherited authority |
| Extension API | Complete baseline | Request/response hooks, custom template tags, request/folder/workspace/document actions, style-aware themes, local storage, notifications, documented request/response helpers, and mediated network/app/data calls |
| Extension isolation | Complete baseline | Two-second disposable Worker, one-megabyte source limit, blocked ambient network/DOM/module loading, explicit per-capability grants, sanitized theme colors, and import-time authority removal |
| Workspace migration | Complete | Versions 1–5 migrate to workspace v6 project, plugin, plugin-data, and theme fields; imported plugins are disabled and stripped of grants/data |
| Documentation and evidence | Complete | [Git project guide](GIT_PROJECTS.md), [plugin guide](PLUGINS.md), and [Milestone 6 verification](QA_MILESTONE_6.md) |

Compatibility bounds remain explicit: Git credential setup uses the user's installed Git and credential helper. Milestone 61 later adds bounded current-branch commit-history browsing; provider-specific authentication, guided repository onboarding, credential validation, and automatic repository discovery remain later work. Milestone 221 confirms that force push, forced or remote branch deletion, rebase, cherry-pick, and arbitrary un-checked-out remote-history browsing are not user-facing standard Insomnia Git requirements. Milestone 262 later closes the finite documented context/action/CLI slice, and Milestone 263 closes bounded direct/scoped directory discovery plus reviewable multi-file relative modules. Pinned plugins reload explicitly rather than through a file watcher. Remote package/dependency installation, the curated bare-module registry, native-module/broad Node compatibility, exact context-menu placement, and CLI host RPC/user-invoked actions remain in the parity ledger. Pinned realtime routes bypass hooks, so streaming hooks are not a parity requirement.

## Milestone 7 — collaboration, secrets, and governance (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Local secret vault | Complete baseline | AES-256-GCM envelope, PBKDF2-HMAC-SHA256 with 210,000 iterations, random salt/nonce, 0600 temporary files on Unix, atomic replacement, passphrase never persisted, explicit lock/reset, and `vault.*` request variables |
| Plaintext-secret policy | Complete baseline | Detects likely environment values (including disabled ones), credential headers/query fields, URL credentials, authentication, Netrc, and client-private-key values; blocks managed-project writes/stage/commit/push and encrypted-sync push until values use local-vault or external-vault references |
| External vaults | Complete baseline | AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, and HashiCorp Vault via installed official CLIs and their existing credential chains; 30-minute memory cache with a 20 MB/256-entry bound, 30-second process limit, 10 MB output limit, no shell, and a per-provider/reference/scope/field/version workspace allowlist |
| Encrypted collaboration | Complete baseline | Passphrase-derived AES-GCM shared file, filtered shareable scope, monotonic revisions, optimistic base-revision conflict rejection, pull, explicit force push, and compatibility with a user-controlled mounted share/WebDAV/sync folder |
| Local governance | Complete baseline | Owner/admin/editor/viewer actors, last-owner protection, storage policy controls, encrypted-sync and vault policy metadata, external-reference approval, bounded audit retention, and edit checks on sync/governance actions |
| Workspace migration | Complete | Versions 1–6 migrate to v7 collaboration/governance fields; malformed roles, policies, actors, audit events, revisions, and allowed storage modes are normalized safely |
| Documentation and evidence | Complete | [Security and encrypted sync guide](SECURITY_AND_SYNC.md) and [Milestone 7 verification](QA_MILESTONE_7.md) |

Compatibility bounds remain explicit: shared-file encryption uses one team passphrase rather than per-user public-key wrapping; synchronization is pull/push rather than real-time presence; server-mediated comments, per-resource Cloud Sync branches/history, offline merge UI, and automatic device discovery remain. Local roles are policy metadata and action checks, not strong identity authentication. Self-hosted SAML/OIDC login, SCIM provisioning, tamper-evident remote audit storage, provider SDK login flows, OS-keychain wrapping, and script access to external providers remain later closure work. Milestone 134 later closes explicitly granted HTTP/GraphQL CLI external-vault tags.

## Milestone 8 — MCP, AI, and service integrations (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| MCP project model | Complete baseline | Multiple disabled-by-default HTTP or STDIO clients, headers/auth/roots, cached tools/prompts/resources/resource templates, event records, workspace v8 migration, and split-YAML project serialization |
| MCP HTTP transport | Complete baseline | JSON-RPC initialization, session headers, JSON and JSON-bearing SSE responses, paginated discovery, invocation, loopback HTTP/remote HTTPS confinement, no redirects/cookies, and vault-backed bearer/Basic/custom-sensitive-header execution |
| MCP STDIO transport | Complete baseline | One project/client-scoped direct executable process without a shell, persistent initialization across discovery/invocation, reviewed template/vault-backed environment rows in an isolated `PATH`-plus-overrides child environment, serialized monotonic request IDs, explicit disconnect/configuration replacement, cancellation that retains the child, fatal-session cleanup, roots responses, bounded sessions/environment/stdout/stderr/events/parameters, deadline enforcement, and explicit refusal of unreviewed server sampling/elicitation requests |
| AI providers | Complete baseline | Optional OpenAI, Anthropic, Gemini, and custom/local OpenAI-compatible endpoints; hosted credentials execute only through local-vault or approved external-vault references |
| AI workflows | Complete baseline | Explicit mock generation from pasted prompt/spec/example input plus bounded, reviewable Git commit grouping/message suggestions; no Brunomnia account or provider is required |
| Konnect integration | Complete baseline | PAT-authenticated control-plane discovery and pull-only Gateway Service/Route mapping, local-field preservation, generated proxy-host variables, and a Skipped Routes collection for unsupported protocols |
| Security and migration | Complete | Imported integrations are disabled and credential fields cleared; endpoint/command changes revoke MCP enablement; AI/Konnect settings remain device-local; plaintext integration credentials are detected and blocked from managed publication |
| Documentation and evidence | Complete | [MCP, AI, and Konnect guide](MCP_AI_KONNECT.md) and [Milestone 8 verification](QA_MILESTONE_8.md) |

Compatibility bounds at this milestone were explicit: HTTP MCP OAuth discovery/redirect handling, long-lived streaming sessions, cancellation, interactive elicitation, reviewed sampling, notification response UI, persistent STDIO processes, per-client STDIO environment overrides, and a guided resource-template argument editor remained. Milestones 92–95 and 227 later close OAuth, redirects, and guided parameters; Milestone 228 closes active HTTP/STDIO discovery and invocation cancellation; Milestone 229 adds project-scoped reusable HTTP connections, protocol/session headers, explicit termination, and bounded expired-session replacement; Milestone 230 adds persistent project/client-scoped STDIO processes, explicit termination, retained-process cancellation, and fatal-session cleanup; Milestone 231 adds reviewed template/vault-rendered STDIO environment rows, clean child-environment isolation, and environment-triggered process replacement; Milestones 232–233 add bounded login-shell `PATH` discovery and first-class Insomnia MCP-resource interchange. Long-lived GET/POST SSE resumption/reconnect, interactive elicitation/sampling, and notification response UI remain. Custom/local AI means an OpenAI-compatible loopback endpoint; Brunomnia does not yet load `.gguf` files itself. MCP sampling is never silently forwarded. Konnect has a pull-only mapper and no live PAT fixture in the repository.

## Milestone 9 — GraphQL productivity and desktop preferences (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| GraphQL introspection | Complete baseline | Explicit and automatic URL/request-selection introspection through the existing native transport, with redirects/cookie storage disabled and bounded normalized schema caches |
| GraphQL authoring | Complete baseline | Query/variables composition, operation name, structural checks, cached root-field validation, root-field search/insertion, deprecation display, and type documentation browsing |
| GraphQL template boundary | Complete | Query template syntax remains literal to match Insomnia; variables retain local/vault/external template support |
| Request scheduling | Complete baseline | Initial delay, sequential repeat interval, stop-future-runs control, and a 1,000-send local safety bound |
| Desktop preferences | Complete baseline | System/dark/light appearance, comfortable/compact density, editor font size, preferred HTTP version, execution-time timeout and API/authentication certificate-validation defaults with request overrides, GraphQL auto-fetch, and delete confirmation |
| Keyboard shortcuts | Complete baseline | Ten device-local editable bindings, platform `Mod` abstraction, collision warnings, clearing/reset, URL focus, request create/duplicate/delete, history, sidebar, environment, send, Preferences, and palette actions |
| Workspace migration | Complete | Versions 1–8 migrate to v9 bounded GraphQL schema cache fields and normalized device-local preferences; imports receive safe defaults and project/encrypted-sync reads preserve local preferences |
| Documentation and evidence | Complete | [GraphQL and preferences guide](GRAPHQL_AND_PREFERENCES.md) and [Milestone 9 verification](QA_MILESTONE_9.md) |

Compatibility bounds at Milestone 9 were explicit: validation was structural plus cached root-field checking rather than a complete GraphQL language server, and subscriptions, full nested selection/argument/type validation, and introspection-disabled manual schema import remained open. Milestone 108 now adds pinned `graphql-transport-ws` subscriptions; the later source audit found no pinned persisted-query execution path, so that unsupported requirement was removed. Scheduled stop cancels future runs but does not abort a request already in flight. Preferences do not yet cover every upstream action, accessibility has not received a full assistive-technology audit, and release packaging remains macOS debug-app evidence rather than signed cross-platform distribution.

## Milestone 10 — resource hierarchy and environments (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Nested request resources | Complete baseline | Arbitrarily nested folders with collapse/search/counting, request placement, safe parent changes, and delete-to-parent behavior |
| Inherited folder configuration | Complete baseline | Root-to-leaf variables/headers/pre-request scripts, nearest optional authentication, and request-to-root after-response scripts across direct sends, GraphQL introspection, runner, and CLI |
| Resource documentation | Complete baseline | Editable collection, folder, and request Markdown source with a local plain-text preview |
| Environment hierarchy | Complete baseline | Base/sub-environment inheritance with child overrides, colors, parent changes, add/delete/reparent behavior, and resolved execution in desktop runner and CLI |
| Private environments | Complete baseline | Device-local private sub-environment trees omitted from Brunomnia/Insomnia exports, split-YAML projects, and encrypted collaboration; active IDs are repaired and inherited folder secrets remain policy-scanned |
| Interchange | Complete baseline | Insomnia v4/v5 nested folders and environment ancestry import/export without flattening request names; folder headers/auth/variables/scripts/docs round-trip within the supported compatibility model |
| Workspace migration | Complete | Versions 1–9 migrate to v10 normalized folder/environment fields, bounded ancestry, cycle repair, private-descendant propagation, and collision-safe imported references |
| Documentation and evidence | Complete | [Resource hierarchy guide](RESOURCE_HIERARCHY.md) and [Milestone 10 verification](QA_MILESTONE_10.md) |

Compatibility bounds at this milestone remain explicit: bulk folder actions, rendered Markdown, environment-tree reordering, richer collected-data UI, keyboard-equivalent tree reordering, and a full template-tag builder remain open. Milestone 144 later closes keyboard-equivalent collection-tree reordering. Private values are omitted rather than encrypted by private-environment storage itself; vault references remain the encrypted-secret path. Insomnia compatibility export cannot represent every Brunomnia hierarchy variant or unsupported protocol without the warnings already recorded by the interchange layer.

## Milestone 11 — request authoring and local client code (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| HTTP methods | Complete baseline | Standard-method suggestions plus bounded, token-valid custom methods through desktop, native transport, import/export, history, runner, and CLI models |
| Request parameters | Complete baseline | Explicit `{name}` path rows with encoded substitution, ordered repeated query keys, row enablement, descriptions, and multiline values |
| Body authoring | Complete baseline | Local JSON and conservative XML beautification without network calls or silent modification of unrecognized text |
| Client code generation | Complete baseline | Initial local previews for cURL, JavaScript Fetch, Python Requests, Go `net/http`, Java `HttpClient`, and C# `HttpClient`, using effective inherited configuration and the active environment; exact multipart and binary embedding was added in Milestone 106 and five more target families in Milestone 126 |
| Interchange | Complete baseline | OpenAPI path parameter generation plus Insomnia v4/v5 and Postman import/export preservation for custom methods, path rows, descriptions, and multiline values |
| Workspace migration | Complete | Versions 1–10 migrate to v11 bounded method tokens, normalized path/query/header/form/metadata rows, descriptions, and the Generate Code shortcut |
| Documentation and evidence | Complete | [Request authoring and client-code guide](REQUEST_AUTHORING.md) and [Milestone 11 verification](QA_MILESTONE_11.md) |

Compatibility bounds remain explicit: exact multipart and binary embedding was completed in Milestone 106, while generated snippets still do not reproduce runtime-specific Digest/OAuth 1/IAM/Hawk/ASAP/NTLM/Netrc signing, validate every target language, install dependencies, or run generated code. Those omissions produce visible warnings. The local XML formatter is intentionally conservative rather than a schema-aware canonicalizer. The scripting expansion is recorded separately in Milestone 12.

## Milestone 12 — permission-bounded scripting compatibility (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Script runtime | Complete baseline | Disposable desktop Worker, 1–60 second device-local deadline, top-level await, captured console output, tests, and blocked direct network/DOM/storage/import/eval authority |
| Variable scopes | Complete baseline | Environment/base alias, collection, local, iteration, and nearest-first parent-folder APIs; environment/collection/folder mutations persist for direct sends and propagate through runs |
| Request and response API | Complete baseline | URL/query, header, body, Basic/Bearer/API-key auth, proxy, inline-certificate mutation plus status/timing/text/JSON/header/cookie response helpers |
| Selected modules | Complete baseline | Local adapters for assert, atob/btoa, Chai expect, lightweight Lodash, querystring, timers, URL, util, and UUID without remote package loading |
| Secondary requests | Complete baseline | Off-by-default device-local grant, mediated HTTP(S) normalization, separate vault capability, five-request/256 KB input/5 MB response/10-second transport bounds, and no nested script/plugin execution |
| Vault scripts | Complete baseline | Off-by-default device-local grant exposes only current unlocked local entries through `insomnia.vault.get`, with no result/export/project/sync serialization |
| CLI safety | Complete baseline | Workspace JavaScript requires `--allow-scripts`; secondary requests additionally require `--allow-script-requests`; workspace data cannot self-grant either capability |
| Workspace migration | Complete | Versions 1–15 migrate to v16 with legacy-safe timeout/certificate overrides, safe script timeout and disabled network/vault grants; imports reset authority and shared reads preserve device-local preferences |
| Documentation and evidence | Complete | [Permission-bounded scripting guide](SCRIPTING.md) and [Milestone 12 verification](QA_MILESTONE_12.md) |

Compatibility bounds remain explicit: the full upstream library/Node module set, complete Chai/Lodash behavior, advanced auth/body helpers, separately persisted base-environment mutation, script access to external-vault providers, and broader Postman compatibility remain. The browser Worker is the desktop capability boundary; CLI scripts use Node `vm` and therefore require an explicit trusted-workspace flag rather than being represented as hostile-code isolation. Exact scope/helper/async/state-continuity work follows in Milestone 13.

## Milestone 13 — script contract fidelity and state continuity (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Variable contract | Complete baseline | `baseGlobals`/`globals`, collection environment/base aliases, uppercase/lowercase collection aliases, local/iteration aliases, documented local-to-global lookup priority, nearest-folder lookup, and disabled-row masking |
| Request helpers | Complete baseline | Query-string/object/repeated `addQueryParams`, keyed-array Basic/Bearer/API-key updates with second type argument, proxy URL getter, bounded certificate metadata, and bare-hostname HTTPS normalization |
| Async assertions | Complete baseline | Ordered synchronous/asynchronous test completion plus Chai `lengthOf`, `oneOf`, chain-returning type checks, and all/any object-key assertions in desktop and trusted CLI runs |
| Secondary continuity | Complete baseline | Secondary response records and `Set-Cookie` state feed later secondary/primary requests and request chaining in direct sends and collection runs |
| Postman translation | Complete baseline | Imported environment/collection/global/local/iteration/vault scopes, secondary requests, request operations, response helpers, tests, and expectations map to their matching permission-bounded Insomnia APIs |
| Runner scopes | Complete baseline | Global, collection, folder, iteration, and local maps remain separate through scripts and rendering; disabled collection/folder rows mask lower scopes |
| Verification fixture | Complete | The checked-in CLI fixture exercises ordered async Chai assertions under explicit `--allow-scripts` consent |
| Documentation and evidence | Complete | Updated [permission-bounded scripting guide](SCRIPTING.md) and [Milestone 13 verification](QA_MILESTONE_13.md) |

Compatibility bounds remain explicit: the full bundled module set, file-backed script bodies/certificates, complete Chai/Lodash APIs, external-vault script access, deprecated Postman interfaces, and stronger portable CLI isolation remain open. Distinct environment-store work follows in Milestone 14.

## Milestone 14 — distinct script environment stores (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Global stores | Complete baseline | Root global base and effective selected global stores are modeled independently, with base/selected aliasing only when no global sub-environment is active |
| Collection stores | Complete baseline | Every collection has an editable base plus selectable, creatable, renameable, and deletable sub-environments |
| Lookup and masking | Complete baseline | Base global → selected global → collection base → selected collection → root-to-leaf folders → iteration → local resolution, including disabled-row masking and set/unset mask repair |
| Execution paths | Complete baseline | Direct sends, collection runner, mediated secondary requests, and trusted CLI scripts receive and carry the same distinct store contract |
| Persistence | Complete baseline | Base/selected global, base/selected collection, and folder mutations persist to their owning rows without flattening inherited enabled global values |
| Interchange | Complete baseline | Postman collection variables map to collection base; Insomnia v4/v5 collection base/sub-environments round-trip; v5 standalone global environments remain separate |
| Workspace migration | Complete | Versions 1–12 migrate to v13 with normalized collection sub-environments and stale active selections cleared |
| Documentation and evidence | Complete | Updated [permission-bounded scripting guide](SCRIPTING.md) and [Milestone 14 verification](QA_MILESTONE_14.md) |

Compatibility bounds remain explicit: global sub-environment chains deeper than one level are exposed to scripts as one effective selected-global store, and disabled masks inherited through that effective store can be persisted on the selected environment after mutation. The remaining bundled-library name surface follows in Milestone 15; file-backed script helpers, deprecated Postman surfaces, and portable CLI isolation remain open.

## Milestone 15 — documented script-module surface (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Documented names | Complete baseline | All 13 external-library and 11 Node-module names in the current Insomnia scripts reference resolve locally, plus synchronous CSV compatibility aliases |
| Shared execution | Complete baseline | One self-contained factory supplies the disposable desktop Worker and explicitly trusted CLI VM, preventing their module contracts from drifting |
| Data and validation | Complete baseline | Common bounded AJV/TV4 schema, CSV, SHA-256/encoding, HTML/XML, date, Lodash, and Postman collection-model operations |
| Node compatibility | Complete baseline | Common assert, Buffer, EventEmitter, POSIX path, query-string, stream, string-decoder, timers, URL, util, UUID, and Punycode operations |
| Capability boundary | Complete | Unknown modules remain denied; adapters cannot read package files or load code from disk or the network; text/parser inputs are bounded to 5 MB |
| CLI verification | Complete | The checked-in offline fixture exercises schema, CSV, and SHA-256 adapters under explicit `--allow-scripts` consent |
| Documentation and evidence | Complete | Updated [permission-bounded scripting guide](SCRIPTING.md) and [Milestone 15 verification](QA_MILESTONE_15.md) |

Compatibility bounds remain explicit: resolving every documented module name does not imply full npm-package equivalence. Complete package versions/options, all JSON Schema drafts and references, full parser/DOM/stream behavior, additional cryptographic algorithms, locales/time zones, and the complete Postman SDK remain open. File-backed helpers follow in Milestone 16; external-vault scripts and stronger portable CLI isolation remain open. Deprecated Postman interfaces are not an upstream parity requirement because the current Insomnia reference explicitly marks them unsupported.

## Milestone 16 — permission-bounded script files (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Body files | Complete baseline | Documented binary `file` mode and text/file multipart rows, with template-resolved paths plus filename/content-type overrides |
| Certificate files | Complete baseline | Documented cert/key `src` and path aliases hydrate UTF-8 PEM into the existing domain-scoped native transport |
| Desktop boundary | Complete | Off-by-default device-local grant; no file primitive or bytes enter the Worker; bounded Rust host read occurs only after the Worker returns |
| CLI boundary | Complete | Trusted Node VM requires `--allow-scripts`, the separate `--allow-script-files` authority flag, and invocation-only `-f`/`--dataFolders` roots |
| Limits | Complete | Regular files only, 5 MB per file, 20 file references, and 20 MB aggregate per script result |
| Workspace migration | Complete | Versions 1–13 migrate to v14 with disabled script-file authority; imported/shared data cannot grant it |
| Verification fixture | Complete | The packaged CLI fixture proves denial without file authority/roots, canonical outside-root and symlink rejection, and exact attachment bytes with explicit consent |
| Documentation and evidence | Complete | Updated [permission-bounded scripting guide](SCRIPTING.md) and [Milestone 16 verification](QA_MILESTONE_16.md) |

Compatibility bounds remain explicit: PFX/PKCS#12 certificate sources and file-backed secondary requests are not supported, while the current primary-request body and PEM source-path contract is covered. External-vault scripts, stronger portable CLI isolation, full package behavior, and non-scripting ledger gaps remain open. Deprecated Postman interfaces remain explicitly unsupported by Insomnia itself.

## Milestone 17 — shared Chai assert compatibility (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Shared runtime | Complete baseline | Desktop Workers and the trusted CLI receive `require('chai').assert` from the same self-contained module factory |
| Assertion families | Complete baseline | Every currently documented public Chai `assert` method name resolves across equality, values/types, inclusion, properties, keys, lengths, numeric comparisons, members, mutations, throws, and object state |
| Executable coverage | Complete | Direct factory tests inventory the official name surface and exercise representative operations and getter overloads; serialized-Worker tests prove the same deep-property/member behavior |
| CLI verification | Complete | The checked-in offline fixture exercises the shared deep nested-property and key assertions with the existing safe-default script/file authority checks |
| Documentation and evidence | Complete | Updated [permission-bounded scripting guide](SCRIPTING.md) and [Milestone 17 verification](QA_MILESTONE_17.md) |

Compatibility bounds remain explicit: this is a broad clean-room `assert` baseline, not byte-for-byte Chai package equivalence. The finite chainable `expect` adapter, plugins, `should`, custom assertion extension hooks, exotic/cyclic deep identity, and every overload/error-detail nuance remain open alongside other package behavior and non-scripting ledger gaps.

## Milestone 18 — shared chainable Chai expect compatibility (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Shared runtime | Complete baseline | One self-contained chain factory supplies `insomnia.expect`, global `expect`, and `require('chai').expect` in desktop Workers and the trusted CLI |
| BDD surface | Complete baseline | Every currently documented Chai language chain, modifier, assertion name, and alias resolves, plus the existing Postman/Jest-style aliases |
| Assertion families | Complete baseline | Value/type/state, inclusion, equality, numeric/date, property/descriptor, length, matching, keys, throws, responses, predicates, approximation, members, mutations, and object state |
| Executable coverage | Complete | Direct inventory/behavior tests and serialized-Worker tests cover flags, aliases, nested/deep/ordered behavior, mutations, chaining, and custom failures |
| CLI verification | Complete | The checked-in offline fixture exercises shared deep nested inclusion and ordered member chains under the existing explicit trust flags |
| Documentation and evidence | Complete | Updated [permission-bounded scripting guide](SCRIPTING.md) and [Milestone 18 verification](QA_MILESTONE_18.md) |

Compatibility bounds remain explicit: this is a broad clean-room BDD surface, not Chai package-internal equivalence. Plugins, `should`, extension/overwrite hooks, exact error metadata, exotic/cyclic deep identity, and every overload nuance remain open alongside other bounded package behavior and non-scripting ledger gaps.

## Milestone 19 — permission-bounded secondary request files (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Documented bodies | Complete baseline | `insomnia.sendRequest()` supports the documented binary `file` body and multipart file rows alongside existing text body modes |
| Shared preparation | Complete | Desktop and trusted CLI use one normalizer/path resolver/host hydrator before invoking their mediated transport |
| Capability boundary | Complete | Network and file authorities are independent, off by default, device/invocation local, and both are required for a file-backed secondary request |
| Aggregate limits | Complete | Regular files only, 5 MB per file, 20 files and 20 MB across all secondary plus final primary attachments in one script execution |
| PEM identity | Complete baseline | Secondary request certificate/key source paths use the existing UTF-8 PEM hydration and domain-scoped native transport; PFX remains unsupported |
| Verification | Complete | Normalization, template paths, denial without a reader, exact binary/PEM hydration, multipart metadata, and cross-request aggregate budgets are executable |
| Documentation and evidence | Complete | Updated [permission-bounded scripting guide](SCRIPTING.md) and [Milestone 19 verification](QA_MILESTONE_19.md) |

Compatibility bounds remain explicit: PFX/PKCS#12, encrypted-key passphrases, a live external-network file fixture, external-vault scripts, stronger portable CLI isolation, exact package internals, and non-scripting ledger gaps remain open.

## Milestone 20 — collection-runner reports and CI reporters (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Shared formatter | Complete | Desktop and CLI artifacts use one deterministic, side-effect-free report formatter |
| Desktop export | Complete baseline | The latest saved run for the selected collection can be downloaded as versioned Brunomnia JSON or JUnit XML |
| Inso reporter names | Complete baseline | `dot`, `list`, `min`, `progress`, `spec`, and TAP reporters are accepted by `run test`, with JSON and JUnit available as additional CI formats |
| Failure fidelity | Complete baseline | Retry attempts, request status, duration, script assertion errors, runner errors, cancellation, and aggregate counts remain visible |
| Output safety | Complete | XML metacharacters and invalid control characters are sanitized; TAP diagnostics remain single-line and output is bounded by the already bounded saved report |
| CLI output | Complete | `--reporter`/`-r` selects a format without changing pass/fail exit codes. Milestone 212 later aligns collection `--output` with pinned metadata-safe JSON while retaining the reporter on stdout; test output still writes the selected reporter artifact. |
| Strict typecheck | Complete | Five scripting regressions exposed by a clean non-incremental TypeScript pass were repaired before accepting the release gate |
| Documentation and evidence | Complete | [Runner reports and CI](RUNNER_REPORTS.md) and [Milestone 20 verification](QA_MILESTONE_20.md) |

Compatibility bounds at this milestone were explicit: Brunomnia did not claim byte-identical Mocha reporter cosmetics. Request selection/drag ordering, response bodies in reports, `--bail`, test-name filtering, every Inso command/configuration flag, all protocol semantics, and signed container/install artifacts were open. Milestones 199–222 later close the audited user-facing command/flag surface, Milestone 223 adds the pinned non-root multi-architecture container plus keyless-signing release path, and Milestone 224 independently verifies its first published digest.

## Milestone 21 — collection-run request plans and bail (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Request selection | Complete baseline | Every collection request can be included or excluded from the next run without mutating collection membership |
| Run ordering | Complete baseline | A transient runner plan can be reordered by drag/drop or labeled up/down buttons and is passed explicitly to the shared engine |
| Plan confinement | Complete | Unknown IDs are ignored, duplicates run once, newly created requests enter enabled, and removed requests leave the plan |
| Bail | Complete baseline | Desktop and CLI can stop after the first failure only after configured retries are exhausted; reports distinguish bail from cancellation |
| CLI compatibility | Complete baseline | The current documented `--bail` flag is accepted without changing default full-run behavior or failure exit codes |
| Executable coverage | Complete | Tests prove selected order, de-duplication, unknown-ID confinement, retry exhaustion, skipped later requests/iterations, and report state |
| Documentation and evidence | Complete | Updated [runner reports and CI guide](RUNNER_REPORTS.md) and [Milestone 21 verification](QA_MILESTONE_21.md) |

Compatibility bounds remain explicit: the request plan is device-session state rather than a named saved preset. Per-request iteration counts, response-body report export, test-name filtering, all protocol runner semantics, and the rest of the Inso flag/command surface remain open.

## Milestone 22 — bounded collection-run response evidence (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Response snapshots | Complete baseline | Successful attempts retain status text, bounded headers, a body preview, original response size, and explicit truncation state |
| Per-attempt bounds | Complete | At most 32 KB of UTF-8 content, including 16 KB body and 64 bounded headers, is stored for one attempt |
| Report bound | Complete | One mutable 1 MB content budget spans every attempt in a report; later snapshots remain metadata-only once it is exhausted |
| UTF-8 safety | Complete | Byte truncation backs up to a valid code-point boundary, including for multi-byte body/header content |
| Desktop inspection | Complete baseline | Pointer or keyboard selection opens status, timing, header, body-preview, size, and truncation details for live and saved results |
| Portable evidence | Complete baseline | Versioned JSON includes response snapshots; text/TAP/JUnit reporters remain intentionally concise |
| Executable coverage | Complete | Seventy response attempts prove per-item/header/body limits, UTF-8 boundaries, and the shared aggregate budget |
| Documentation and evidence | Complete | Updated [runner reports and CI guide](RUNNER_REPORTS.md) and [Milestone 22 verification](QA_MILESTONE_22.md) |

Compatibility bounds remain explicit: snapshots are previews, not full request/response console archives. Request headers/bodies, redirect traces, cookie deltas, syntax-highlighted viewers, arbitrary-size bodies, binary rendering, and full protocol-specific runner consoles remain open.

## Milestone 23 — bounded collection-run request evidence (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Request snapshots | Complete baseline | Attempts retain protocol, method, resolved/redacted URL, configured headers, body mode/summary/size, and explicit truncation state |
| Secret handling | Complete baseline | Named authorization/cookie/token/secret/password/passphrase/API-key headers and query parameters are replaced with `[redacted]`; request body content is never stored |
| Body metadata | Complete baseline | JSON/text/GraphQL/gRPC/WebSocket sizes, URL-encoded field names, multipart field/file names with payload estimates, and binary filename/size are recorded without content |
| Snapshot bounds | Complete | At most 16 KB of UTF-8 content per attempt and 500 KB per report, with URL/header/summary sub-limits and UTF-8-safe truncation |
| URL continuity | Complete baseline | Native/browser responses, deterministic demo responses, streams, and the CLI return the executed URL where their transport exposes it |
| Desktop inspection | Complete baseline | The existing attempt pane shows request evidence above the bounded response snapshot for live and saved results |
| Executable coverage | Complete | Tests prove resolution, named-secret redaction, body-content omission, per-item limits, and the 70-attempt aggregate budget |
| Documentation and evidence | Complete | Updated [runner reports and CI guide](RUNNER_REPORTS.md) and [Milestone 23 verification](QA_MILESTONE_23.md) |

Compatibility bounds remain explicit: configured headers do not include every transport-added cookie or advanced-auth signing header, and body sizes describe configured payload content rather than exact multipart wire framing. Arbitrary custom secret names cannot be inferred; request URLs, non-redacted headers, field names, and filenames can still be sensitive.

## Milestone 24 — persistent collection-resource ordering (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Mixed sibling order | Complete baseline | Collections retain one sanitized order list spanning folders and requests, while old workspaces fall back to their established array order |
| Native drag targets | Complete baseline | Collections reorder around collection titles; requests and folders reorder around resource edges; a folder center reparents inside it; a collection title moves a resource to its root |
| Cross-collection moves | Complete baseline | Requests move directly and folders move with their complete descendant folder/request subtree without changing resource IDs |
| Hierarchy safety | Complete | Same-collection folder cycles, missing parents/targets, and cross-collection ID collisions are rejected without mutating the workspace |
| Persistence and imports | Complete | Workspace migration removes unknown/duplicate order IDs and appends valid omissions; merged imports remap order IDs with their resources |
| Search confinement | Complete | Reordering is disabled while the collection tree is filtered so a partial view cannot silently redefine hidden sibling order |
| Executable coverage | Complete | Resource tests cover mixed rendering, sibling ordering, reparenting, subtree transfer, cycle rejection, and collection ordering; migration tests cover malformed order metadata |
| Documentation and evidence | Complete | Updated [resource hierarchy guide](RESOURCE_HIERARCHY.md) and [Milestone 24 verification](QA_MILESTONE_24.md) |

Compatibility bounds at this milestone remain explicit: the sidebar depends on native pointer drag/drop. Milestone 144 later closes keyboard-equivalent reordering; multi-select/bulk resource actions and environment-tree ordering remain open. Milestone 152 later closes arbitrary mixed sibling order for the supported hierarchical Insomnia v4/v5 adapters without pretending flat formats carry the same tree.

## Milestone 25 — headless test-name filtering (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Inso flag compatibility | Complete baseline | `run test` accepts the current documented `-t` and `--testNamePattern <regex>` spellings plus a kebab-case convenience alias |
| Validation boundary | Complete | Invalid or over-1,000-character regexes fail before request execution, script evaluation, or report writes |
| Callback filtering | Complete baseline | Unmatched dynamically registered `insomnia.test` callbacks are not invoked in trusted CLI scripts or disposable desktop Workers |
| Result confinement | Complete | Clean request attempts with zero matched tests are omitted; transport, HTTP, and script failures remain visible even without a name match |
| Portable evidence | Complete | Reports retain the exact pattern and matched-test execution count; text reporters include the count and JSON retains both fields |
| Retry/bail compatibility | Complete | Matching assertion failures retain existing retry and retry-aware bail semantics; clean unmatched attempts do not create failures |
| Executable coverage | Complete | Shared tests cover pre-network validation, pattern propagation, omission, failure retention, Worker callback skipping, and report metadata; an offline CLI smoke covers both a single match and zero matches |
| Documentation and evidence | Complete | Updated [runner reports and CI guide](RUNNER_REPORTS.md) and [Milestone 25 verification](QA_MILESTONE_25.md) |

Compatibility bounds at this milestone were explicit: Brunomnia discovered named tests inside request after-response scripts, so the request and top-level script executed before dynamic registrations could be filtered. This was not the same persistence model as Insomnia's standalone unit-test-suite resources. Later milestones add persistent suite identity/selection, configuration-file discovery, proxy/data-folder flags, and Milestone 218 closes test-only `--keepFile`. Milestone 222 confirms the pinned user-facing command/flag inventory and closes shared global-option diagnostics; remaining Inso work is exact error/edge semantics rather than a missing command family.

## Milestone 26 — persistent SSE reconnect controls (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Long-running native sessions | Complete baseline | SSE uses the effective positive timeout for connection establishment, or no header deadline at zero, without applying a total deadline to an active response stream |
| Reconnect policy | Complete baseline | Per-request automatic reconnect toggle, 100–60,000 ms delay, and 0–1,000 retry limit; zero means retry until explicit disconnect |
| Protocol resume | Complete baseline | Valid `id:` values are retained and sent as `Last-Event-ID`; numeric `retry:` values can replace the local delay within the same bounds |
| Cancellation | Complete | Explicit disconnect cancels an active read, reconnect delay, or reconnect attempt and removes the session |
| Persistent authoring | Complete | Reconnect settings are stored per request and malformed/imported values receive bounded safe defaults |
| Event feedback | Complete baseline | The ordered stream log records reconnect attempts, reopened connections, transport errors, and final closure; the request status reflects reconnecting state |
| Executable coverage | Complete baseline | Frontend tests cover defaults/import bounds; native tests cover chunk parsing, metadata, and bounded/unlimited policy; the sandbox prevents a live listener fixture |
| Documentation and evidence | Complete | [SSE streams guide](SSE_STREAMS.md) and [Milestone 26 verification](QA_MILESTONE_26.md) |

Compatibility bounds remain explicit: the native transport behavior is source- and unit-tested, but this environment cannot bind the loopback listener needed for a deterministic disconnect/reconnect integration fixture. Browser development mode remains a deterministic stream demo. Event searching/export, streaming plugin hooks, and collection-run reconnect semantics remain open.

## Milestone 27 — preferred HTTP versions (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | Device-local Default, HTTP 1.0, HTTP 1.1, HTTP/2, and HTTP/2 Prior Knowledge values match the current upstream settings surface |
| HTTP/1 execution | Complete | HTTP 1.0/1.1 selections constrain the native client and set the corresponding request version across redirects and challenge-auth retries |
| HTTP/2 execution | Complete baseline | Standard HTTP/2 uses TLS negotiation with HTTP/1 fallback; Prior Knowledge creates an HTTP/2-only native client |
| Execution breadth | Complete baseline | Main HTTP/GraphQL/SSE, introspection, collection runs, script/plugin secondary calls, imports, OAuth, AI, MCP, Konnect, and Git AI requests inherit the preference |
| Response evidence | Complete | Native responses serialize their negotiated protocol into live/saved response summaries and the timeline; SSE open/reopen records include it |
| Device-local safety | Complete | Existing data defaults to negotiation, unknown values normalize to default, project/sync reads preserve the device choice, and workspace imports reset it |
| Executable coverage | Complete baseline | Frontend tests cover migration, invocation input, stream input, and immutability; native tests cover every mode and HTTP/1 request versions; live negotiation fixtures remain sandbox-limited |
| Documentation and evidence | Complete | Updated [GraphQL and preferences guide](GRAPHQL_AND_PREFERENCES.md) and [Milestone 27 verification](QA_MILESTONE_27.md) |

Compatibility bounds remain explicit: browser development mode cannot select its network stack's HTTP version. The sandbox cannot bind local HTTP/1 and HTTP/2 peers, so negotiated wire versions are not claimed as live integration-tested here. HTTP/3 is not offered by the current upstream settings UI and is not claimed.

## Milestone 28 — transparent response compression (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Codec breadth | Complete baseline | Native HTTP-family clients advertise and decode gzip, Brotli, deflate, and zstd through explicitly locked reqwest features |
| Header semantics | Complete | Automatic negotiation is skipped when a request already supplies `Accept-Encoding` or `Range`; decoded responses omit stale encoding/length headers through the native client contract |
| Decode fallback | Complete baseline | An ordinary request whose body fails specifically during decoding is repeated once with every automatic decoder disabled; unrelated body/transport failures are not retried |
| Execution breadth | Complete baseline | Shared native clients cover HTTP, GraphQL, OAuth, integrations, secondary requests, and SSE; invalidly encoded SSE reconnect behavior remains distinct |
| Size evidence | Complete | Response size continues to describe the UTF-8 decoded body exposed to the renderer and stored history, not compressed wire bytes |
| Executable coverage | Complete baseline | Both decoder-enabled and decoder-disabled client configurations compile/build under every preferred HTTP mode; live codec fixtures remain sandbox-limited |
| Documentation and evidence | Complete | Updated [request authoring guide](REQUEST_AUTHORING.md) and [Milestone 28 verification](QA_MILESTONE_28.md) |

Compatibility bounds remain explicit: the sandbox cannot bind deterministic compressed-response peers, so codec wire fixtures are not claimed here. The fallback necessarily repeats a request after a server returns an undecodable body, matching upstream behavior; users should avoid invalid content encodings on non-idempotent endpoints. Compressed wire-byte accounting, raw/decoded toggles, and invalidly encoded SSE fallback remain open.

## Milestone 29 — native maximum redirect policy (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | Device-local maximum redirects defaults to 10, accepts zero and positive integer ceilings, and uses `-1` for unlimited redirects as documented by the current upstream setting |
| Request precedence | Complete | A request with Follow HTTP redirects disabled always uses a no-follow native policy regardless of the device maximum |
| Finite execution | Complete | Zero rejects the first redirect; positive values configure reqwest's explicit hop limit and return a transport error when reached |
| Unlimited execution | Complete baseline | `-1` uses a custom follow policy without a hop ceiling; ordinary requests retain a positive total deadline and SSE header establishment follows the effective timeout, including disabled zero |
| Execution breadth | Complete baseline | HTTP, GraphQL, SSE/reconnect, introspection, collection runs, scripts/plugins, imports, OAuth, AI, MCP, Konnect, and Git AI inherit the device preference |
| Device-local safety | Complete | Existing data defaults to 10, malformed values normalize safely, project/sync reads preserve the device value, and workspace imports reset it |
| Executable coverage | Complete baseline | Frontend tests cover migration, invocation/stream input, and request immutability; native tests cover disabled, zero, finite, and unlimited policy selection; live redirect chains remain sandbox-limited |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 29 verification](QA_MILESTONE_29.md) |

Compatibility bounds remain explicit: browser development mode uses Fetch and cannot enforce a redirect-count ceiling. The sandbox cannot bind a deterministic redirect fixture, so hop behavior is source/unit/build-verified rather than live integration-tested. Redirect-chain timeline entries, per-request numeric overrides, WebSocket handshake redirects, and broader network diagnostics remain open.

## Milestone 30 — response history retention and environment filtering (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | Device-local response history defaults to 20 per request, accepts zero and positive integer limits, uses `-1` for retain-all, and offers active-environment filtering like the current upstream settings |
| Persistent identity | Complete | New entries retain a local response ID plus request/environment identity; existing device data receives deterministic legacy IDs and an empty environment boundary |
| Retention policy | Complete baseline | Positive limits keep the newest scoped results, zero removes saved results for the scope while preserving the live response, and `-1` retains all; other requests remain untouched |
| Environment semantics | Complete | With filtering enabled, visibility, response template tags, and future pruning use the active environment; limits apply per request/environment pair |
| Response selection | Complete baseline | Switching requests restores the newest eligible saved response, and a response-summary selector reopens older body/header/timeline evidence |
| Execution breadth | Complete baseline | Primary requests, collection runs, and script secondary calls retain history consistently; OAuth/plugin/integration calls remain execution dependencies rather than user-request history entries |
| Device-local safety | Complete | Imports reset preferences, malformed limits normalize, managed project/sync reads preserve local entries/preferences, and shareable payloads omit response history |
| Executable coverage | Complete baseline | Frontend tests cover finite/zero/unlimited retention, environment scoping, migration, template filtering, and secondary-response storage; rendered QA remains intentionally omitted |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 30 verification](QA_MILESTONE_30.md) |

Compatibility bounds remain explicit: limit changes prune only when the relevant request next stores a response. The selector does not yet delete, pin, compare, export, or search individual saved responses. The legacy global 100-send activity log remains separate. Large/unlimited response retention can grow the device-local workspace file, and body pre-allocation limits remain open.

## Milestone 31 — global redirect default and per-request inheritance (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | Device-local Follow redirects by default is enabled on new devices and safely normalized/import-reset like the current upstream setting |
| Request inheritance | Complete | Requests persist Use Preferences, Always, or Never; explicit modes take precedence over the device default, and Never takes precedence over the numeric ceiling |
| Legacy safety | Complete | Existing false booleans migrate to Never, existing enabled requests migrate to Use Preferences, and contradictory stored booleans are normalized from the explicit mode |
| Execution breadth | Complete baseline | Primary HTTP/GraphQL, Event Streams, collection runs, script/plugin calls, URL imports, OAuth, and HTTP-backed integrations receive the device default; security-sensitive internal requests keep explicit Never policies |
| Interchange | Complete baseline | Insomnia v4 `settingFollowRedirects` and v5 `settings.followRedirects` preserve `global`, `on`, and `off` on import/export |
| Browser behavior | Complete baseline | Browser Fetch follows the resolved device/request choice; its own redirect-count ceiling and protocol remain browser-controlled |
| Executable coverage | Complete baseline | Frontend tests cover global inheritance, both explicit overrides, migration, native invocation, stream configuration, and Insomnia v4/v5 round trips; rendered and live redirect fixtures remain intentionally omitted |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 31 verification](QA_MILESTONE_31.md) |

Compatibility bounds remain explicit: redirect-hop timeline entries, per-request numeric ceilings, WebSocket handshake redirect controls, and live chain fixtures remain open. Browser Fetch does not expose its hop ceiling. Internal adapter requests that deliberately disable redirects do not inherit the device default.

## Milestone 32 — size-bounded response timeline evidence (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | Device-local Max timeline chunk size defaults to 10 KiB, accepts nonnegative integers, and treats zero as the current upstream 1 KiB fallback |
| Outgoing evidence | Complete baseline | Resolved text, JSON, GraphQL, and repeated URL-encoded data below the threshold remain visible; exact-limit and oversized data become size-only hidden markers |
| Structured/binary safety | Complete baseline | Binary content remains filename/size-only; multipart evidence lists configured values/files and logical size without claiming generated wire framing |
| Response evidence | Complete baseline | Timeline entries retain status, decoded aggregate body size, timing, and negotiated native protocol without duplicating the response body |
| Persistence and selection | Complete | Timeline entries follow their saved response ID, survive device-local migration, and reopen with older response history selections |
| Execution breadth | Complete baseline | Native and browser HTTP/GraphQL plus collection-run and script/plugin secondary requests use the same evidence policy; internal integration results carry it when surfaced by their callers |
| Device-local safety | Complete | Unknown values default to 10, negative values clamp to zero, workspace imports reset the preference, and project/sync publication continues to omit response history |
| Executable coverage | Complete baseline | Frontend tests cover text, form, multipart, exact thresholds, zero fallback, IEC sizes, native invocation attachment, preference migration, and timeline normalization; rendered QA remains intentionally omitted |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 32 verification](QA_MILESTONE_32.md) |

Compatibility bounds remain explicit: reqwest and browser Fetch do not expose libcurl debug callback chunks, so Brunomnia records one prepared outgoing payload and one decoded aggregate response summary. Raw transport-added headers, TLS/connect diagnostics, redirect hops, exact multipart wire framing, compressed wire-byte accounting, and Event Stream handshake timeline files remain open.

## Milestone 33 — global request timeout and per-request inheritance (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | Device-local Request timeout defaults to 30,000 ms, is read at execution time, accepts nonnegative integers, and uses `0` to disable deadlines like current upstream |
| Request inheritance | Complete | New requests persist Use Preferences; Custom retains a per-request deadline and takes precedence over the device value |
| Legacy safety | Complete | Workspace v14 and earlier requests with saved timeouts migrate to Custom, while requests without a saved transport timeout adopt inheritance |
| Execution breadth | Complete baseline | Primary HTTP/GraphQL, Event Streams, gRPC, collection runs, CLI, script/plugin calls, URL imports, OAuth, and HTTP-backed integrations receive the effective timeout |
| Disabled deadlines | Complete baseline | Browser Fetch omits its AbortSignal; native HTTP omits client connect/total deadlines; SSE omits the response-header timer; gRPC omits channel/RPC and response-stream deadlines |
| Internal safety | Complete | GraphQL introspection, AI, MCP, Konnect, and bounded script subrequests retain deliberate custom deadlines instead of inheriting an unlimited preference |
| Import behavior | Complete baseline | Ordinary cURL imports inherit the preference; explicit `--max-time`, including zero, becomes a custom request timeout |
| Executable coverage | Complete baseline | Frontend tests cover inheritance, zero, explicit overrides, legacy migration, native invocation, stream configuration, and cURL defaults; native compile/lint passes and rendered/live timeout fixtures remain intentionally omitted |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 33 verification](QA_MILESTONE_33.md) |

Compatibility bounds remain explicit: WebSocket connection APIs do not expose the same total request timer as HTTP, an active SSE response intentionally has no lifetime deadline after headers, and no rendered or live slow-server fixture is claimed in this phase. Brunomnia's per-request Custom mode is an additional local capability; current Insomnia exposes the device preference globally.

## Milestone 34 — certificate-validation defaults and request inheritance (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | Separate on-by-default device-local validation settings exist for API requests and OAuth/authentication traffic, matching current upstream's `validateSSL` and `validateAuthSSL` split |
| Request inheritance | Complete | New requests persist Use Preferences; Always/Never override the API device default for native transports |
| Authentication separation | Complete baseline | OAuth token requests ignore the API request mode and resolve the authentication validation preference, matching current upstream token behavior; Milestone 88 adds automated system-browser loopback callback capture |
| Legacy safety | Complete | Workspace v15 and earlier request booleans migrate to Always/Never, while requests without a saved transport validation value adopt inheritance |
| Execution breadth | Complete baseline | Native HTTP/GraphQL, Event Streams, gRPC, collection runs, script/plugin calls, URL imports, OAuth tokens, Git-AI, and HTTP-backed integrations receive the effective setting |
| Browser/CLI safety | Complete baseline | Browser Fetch keeps browser-owned TLS verification; the CLI rejects an effective Never mode instead of weakening Node TLS globally |
| Import behavior | Complete baseline | Ordinary cURL imports inherit the API preference; explicit `--insecure` becomes a Never override |
| Executable coverage | Complete baseline | Frontend tests cover both defaults, explicit modes, legacy migration, OAuth separation, native invocation, stream configuration, and cURL defaults/override; rendered and live untrusted-certificate fixtures remain intentionally omitted |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 34 verification](QA_MILESTONE_34.md) |

Compatibility bounds at Milestone 34 were explicit: browser engines own TLS validation, and the original CLI Node Fetch path could not safely disable it per request. Milestone 210 later replaces that CLI path with request-scoped Undici dispatchers while browser behavior remains unchanged. Native OAuth callback capture does not change provider TLS policy and browser development retains manual authorization. Brunomnia's request-level Always/Never modes are an additional local capability; current Insomnia exposes the API and authentication choices globally.

## Milestone 35 — proxy defaults and request inheritance (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | Device-local manual proxy enablement, separate HTTP/HTTPS URLs, and a no-proxy list match the current upstream setting shape; manual mode defaults off |
| Request inheritance | Complete | New requests persist Use Preferences; Custom and Direct explicitly override the device preference |
| Legacy safety | Complete | Workspace v16 and earlier requests with a saved proxy URL/exclusion list migrate to Custom, while empty legacy proxy fields adopt inheritance |
| Native execution | Complete baseline | Native HTTP, GraphQL, OAuth, integration, secondary-request, and Event Stream setup resolve the effective proxy after URL templating; protocol-specific manual URLs and no-proxy exclusions reach reqwest |
| System behavior | Complete baseline | With manual mode off, reqwest uses its supported system/environment proxy discovery; Direct disables proxy discovery for the request |
| Import and script behavior | Complete baseline | Ordinary cURL imports inherit preferences; explicit cURL/script proxy changes become Custom overrides |
| Browser/CLI safety | Complete baseline | Browser development mode retains browser-owned routing; the CLI refuses an effective manual proxy because its bundled Node Fetch transport has no scoped proxy agent |
| Executable coverage | Complete baseline | Frontend tests cover system/manual protocol selection, no-proxy forwarding, both overrides, legacy migration, native invocation, stream input, and cURL behavior; native compile/lint passes and rendered/live proxy fixtures remain intentionally omitted |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 35 verification](QA_MILESTONE_35.md) |

Compatibility bounds at Milestone 35 were explicit: reqwest's discovery is not claimed to reproduce Electron session PAC resolution. Browser engines own development-mode proxy routing. Milestone 110 later closes inherited/per-request custom WebSocket proxy transport, and Milestone 210 closes explicit/environment HTTP/HTTPS proxy plus no-proxy routing for the CLI. PAC-authenticated system discovery remains outside those explicit paths. Brunomnia's request-level Custom/Direct modes are an additional local capability; current Insomnia exposes proxy selection globally. Milestone 117's pinned source audit confirms current Insomnia does not install its HTTP/HTTPS proxy agent on `@grpc/grpc-js` channels, removing custom gRPC proxying from the parity backlog.

## Milestone 36 — bulk request-header and query-parameter editors (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | Separate device-local header and query-parameter bulk-mode settings default off, matching the current upstream settings model |
| Request-pane switching | Complete | Headers and query parameters toggle directly between Bulk Edit and Regular Edit; the selected mode persists across requests on the device |
| Bulk syntax | Complete baseline | One `name: value` pair is parsed per nonblank line, only the first colon separates the value, and duplicate order is retained |
| Row semantics | Complete baseline | Enabled nonblank rows are serialized; editing bulk text replaces the list with enabled name/value rows, matching upstream omission of disabled rows and descriptions |
| Protocol breadth | Complete baseline | HTTP, GraphQL, WebSocket, and SSE request headers share the bulk editor; query rows remain the common ordered request model while path parameters and gRPC metadata stay structured |
| Device-local safety | Complete | Managed projects and encrypted-sync pulls preserve local choices, imports reset them off, malformed values cannot enable them, and workspace v17 and earlier data migrates to v18 defaults |
| Executable coverage | Complete baseline | Focused tests cover formatting, first-colon parsing, duplicate order, blank/disabled omission, default/import normalization, preference preservation, and interchange versioning; rendered QA remains intentionally omitted |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 36 verification](QA_MILESTONE_36.md) |

Compatibility bounds remain explicit: bulk mode intentionally cannot represent disabled rows or descriptions, so the first text edit removes them as current Insomnia does. Brunomnia uses its bounded text editor rather than CodeMirror template highlighting/autocomplete. Path parameters, gRPC metadata, folder headers, and environment rows remain in their structured editors.

## Milestone 37 — editor and request-layout preferences (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | Device-local vertical layout, line wrapping, tabs/spaces, 1–16 indent width, and font-ligature controls use the current upstream defaults |
| Request/response layout | Complete baseline | The normal desktop split remains horizontal/responsive; forced vertical mode stacks request above response at every width |
| Editor presentation | Complete baseline | Code surfaces apply wrapping, horizontal overflow, CSS tab width, editor font size, and inherited ligature behavior immediately |
| Tab editing | Complete baseline | Tab inserts a literal tab or bounded spaces, selected lines indent together, and Shift-Tab removes one matching level without consuming content |
| Device-local safety | Complete | Managed projects and encrypted-sync pulls preserve local choices, imports reset defaults, malformed booleans cannot opt in, indent width clamps safely, and workspace v18 and earlier data migrates to v19 |
| Executable coverage | Complete baseline | Focused tests cover tab/space insertion, selection indentation/outdentation, content safety, normalization, import reset, preference preservation, and interchange versioning; rendered QA remains intentionally omitted |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 37 verification](QA_MILESTONE_37.md) |

Compatibility bounds remain explicit: Brunomnia's automatic vertical breakpoint is 1,000 px rather than current Insomnia's 880 px, while forced vertical behavior is equivalent. Plain bounded textareas do not claim CodeMirror key maps, autocompletion, linting, folding, bracket helpers, or template-token presentation. Custom interface/monospace font families remain open.

## Milestone 38 — separate interface and editor typography (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | Device-local interface/editor family fields and separate 8–24 px size controls match current upstream bounds and 13/11 px defaults |
| Live font families | Complete baseline | Nonblank interface and monospace CSS family lists override the built-in stacks independently; clearing either field restores its fallback |
| Live font sizes | Complete baseline | Interface size applies at the app shell and editor size drives bounded code surfaces independently |
| Legacy safety | Complete | Existing Brunomnia `fontSize` values remain editor sizes; new/imported data receives the split defaults during workspace v20 migration |
| Input safety | Complete baseline | Newlines become spaces, non-string families normalize empty, family lists cap at 512 characters, and both sizes clamp to 8–24 px |
| Device-local safety | Complete | Managed projects and encrypted-sync pulls preserve local choices while imports reset both families and sizes |
| Executable coverage | Complete baseline | Focused tests cover defaults, bounds, family normalization, import reset, explicit preservation, and interchange versioning; rendered/font-availability QA remains intentionally omitted |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 38 verification](QA_MILESTONE_38.md) |

Compatibility bounds remain explicit: font family fields depend on fonts installed on the device and provide no discovery picker. The app-shell size affects inherited interface typography, but Brunomnia still has deliberately fixed pixel sizes in dense controls and does not claim a complete typographic scaling audit. Rendered verification remains omitted by standing direction.

## Milestone 39 — path-scoped script data folders (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | A device-local allowed-data-folder list complements the existing off-by-default script file grant, matching current Insomnia's explicit folder setting |
| Native containment | Complete baseline | Rust canonicalizes the requested file and existing directory roots, requires component-aware containment, and rejects traversal, outside-root files, and symlink escapes before reading bytes |
| Execution breadth | Complete | Primary requests, secondary requests, and collection-run scripting pass the same roots into body, multipart, and PEM attachment hydration |
| Device-local safety | Complete | Folder roots and the file grant are omitted from managed projects/encrypted revisions, preserved across device-local upgrades, and reset on workspace import |
| Input bounds | Complete baseline | Preferences retain at most 100 unique nonblank roots of at most 4,096 characters; empty, missing, and non-directory roots grant no access |
| Executable coverage | Complete baseline | Frontend tests cover defaults, normalization, deduplication, import stripping, explicit preservation, and workspace v21 interchange; native tests cover allowed reads, limits, missing roots, outside roots, and symlink escape |
| Documentation and evidence | Complete | Updated [scripting](SCRIPTING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 39 verification](QA_MILESTONE_39.md) |

Compatibility bounds remain explicit: Brunomnia's desktop grant is read-only and applies to mediated script attachments; it does not implement upstream's described folder writes or automatically allow the OS temporary/application-data directories. Roots are typed rather than selected through a folder picker. The trusted CLI retains its separate invocation flag and does not consume the device list. Canonical checks close ordinary traversal and symlink escapes but do not claim a capability-secure directory handle against adversarial filesystem races.

## Milestone 40 — authentication password visibility (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference surface | Complete baseline | A device-local Reveal saved authentication passwords setting defaults off and strictly normalizes, matching current Insomnia's `showPasswords` default |
| Authentication breadth | Complete baseline | Request and inherited-folder editors apply the choice to Bearer, Basic/Digest/NTLM, API key, OAuth 1/2, AWS IAM, and Hawk secret fields |
| Per-field inspection | Complete baseline | When the global preference is off, every marked secret exposes an accessible Show/Hide control without changing the underlying value |
| Sensitive boundary | Complete | Vault unlock/entry disclosure and encrypted-sync passphrases remain independently masked; display choices do not affect execution, storage, exports, logs, or clipboard behavior |
| Device-local safety | Complete | Managed projects and encrypted-sync pulls preserve the local choice, workspace imports reset it off, and malformed truthy values cannot enable it |
| Executable coverage | Complete baseline | Focused tests cover default masking, global reveal, per-field reveal, strict normalization, import reset, explicit preservation, and workspace v22 interchange |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 40 verification](QA_MILESTONE_40.md) |

Compatibility bounds remain explicit: this milestone covers saved request and folder authentication secrets. Integration credential fields remain independently masked, ordinary headers/environment values are not reclassified as passwords, and rendered/browser interaction QA remains omitted by standing direction. Current Insomnia's exact CodeMirror masking/copy affordances are not claimed.

## Milestone 41 — integration credential visibility (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current preference extension | Complete baseline | The existing device-local false-default `showPasswords` choice now covers stored integration credentials as well as request/folder authentication |
| Integration breadth | Complete baseline | MCP bearer tokens and Basic passwords, AI-provider keys/references, and Konnect token references are masked by default and share the global reveal choice |
| Per-field inspection | Complete baseline | Every integration credential exposes an accessible Show/Hide control while the global preference is off |
| Disclosure lifecycle | Complete | Enabling the global choice clears temporary local disclosure; switching MCP clients remounts its panel so revealed state cannot carry to another client |
| Sensitive boundary | Complete | Visibility remains presentation-only; storage, vault resolution, policy checks, execution, exports, logs, and independent vault/sync passphrase controls are unchanged |
| Executable coverage | Complete baseline | Focused tests cover default masking, global reveal, and one-field reveal; the complete frontend, native, CLI, and macOS app gates remain green within the recorded sandbox limit |
| Documentation and evidence | Complete | Updated [MCP/AI/Konnect](MCP_AI_KONNECT.md), [request authoring](REQUEST_AUTHORING.md), [GraphQL and preferences](GRAPHQL_AND_PREFERENCES.md), and [Milestone 41 verification](QA_MILESTONE_41.md) |

Compatibility bounds remain explicit: arbitrary MCP headers and ordinary request headers/environment values are not reclassified as credential fields. Local-vault value disclosure and vault/encrypted-sync passphrases retain independent controls. Rendered/browser interaction, password-manager behavior, and exact upstream randomized mask/copy presentation remain outside this source-verified milestone by standing direction.

## Milestone 42 — response history actions (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Delete selected response | Complete baseline | The response summary removes the selected persisted result by ID and immediately selects the newest remaining visible result |
| Clear environment history | Complete baseline | Clear removes only the active request/environment scope, preserving the same request in other environments and every other request |
| Current-compatible scope | Complete baseline | The active-environment clear boundary follows current Insomnia's `removeResponsesForRequest(requestId, activeEnvironmentId)` route behavior even when cross-environment display is enabled |
| Persistent behavior | Complete | Actions update the device-local response store and normal autosave path; project files and encrypted-sync revisions continue to omit response history |
| Accessible controls | Complete baseline | Delete and Clear have explicit accessible names; Delete requires a selected saved response and Clear reports/disables from the active-environment count |
| Executable coverage | Complete baseline | Focused tests cover exact-ID deletion, request/environment-scoped clearing, preservation boundaries, and existing retention/visibility behavior |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 42 verification](QA_MILESTONE_42.md) |

Compatibility bounds remain explicit: selecting an older response does not restore the request version that produced it. Response compare/export/search and WebSocket/SSE history actions remain open. Rendered/browser interaction QA remains omitted by standing direction.

## Milestone 43 — historical request versions (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Request snapshot capture | Complete baseline | Every newly persisted direct-send, collection-run, and script-subrequest response carries an independent structured clone of the editable request version |
| Historical selection | Complete baseline | Selecting a saved response restores the matching request's authoring state while preserving its stable ID and current folder position |
| Delete fallback | Complete baseline | Deleting the selected response activates and restores the newest remaining visible version when a valid snapshot exists |
| Legacy and hostile-data safety | Complete | Missing snapshots, snapshots for another request ID, and malformed snapshots remain response-only; asynchronous restoration aborts if the user switches requests |
| Device-local boundary | Complete | Snapshots travel only with the existing device-local response store and remain omitted from managed projects and encrypted-sync revisions |
| Bundle boundary | Complete | Snapshot validation/restoration is lazy-loaded in a 939-byte chunk; the 499,964-byte main chunk remains below Vite's warning threshold |
| Executable coverage | Complete baseline | Focused tests cover independent cloning, matching restoration, folder preservation, invalid/mismatched refusal, storage survival, and secondary-request capture |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 43 verification](QA_MILESTONE_43.md) |

Compatibility bounds remain explicit: legacy response entries cannot reconstruct request versions they never stored. Restoring a request version does not restore its historical collection/folder placement, selected environment, cookies, plugin state, or vault contents. Milestone 150 later aligns the restore ignore list with pinned Insomnia by preserving the current name, documentation/description, and source linkage as well. Response comparison/export/search and persistent streaming histories remain open. Rendered/browser interaction QA remains omitted by standing direction.

## Milestone 44 — response body downloads (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Raw response export | Complete baseline | Every non-streaming response can download the displayed UTF-8 body without mutation through the local browser/WebView download path |
| Prettified JSON export | Complete baseline | JSON content types expose a separate action that formats valid JSON with two spaces and preserves invalid JSON verbatim |
| Filename and media evidence | Complete baseline | Artifacts use a bounded filesystem-safe request name, timestamp, content-type-derived extension, and normalized media type |
| Historical breadth | Complete | The action operates on the currently selected live or persisted historical response rather than only the latest send |
| Bundle boundary | Complete | Response artifact/download code is lazy-loaded in a sub-1 KB chunk, and the existing code-generation dialog moves to its own 7,616-byte chunk; the main bundle falls to the recorded no-warning size |
| Executable coverage | Complete baseline | Focused tests cover raw fidelity, JSON formatting, invalid-JSON fallback, case-insensitive content types, safe filenames, and unknown-type fallback |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 44 verification](QA_MILESTONE_44.md) |

Compatibility bounds at this milestone were explicit: the response model stored decoded UTF-8 text, so byte-exact binary download was not yet claimed. Milestone 51 later resolves decoded entity-byte storage and raw export; native save dialogs and persistent streaming history remain open. Rendered/browser interaction QA remains omitted by standing direction.

## Milestone 45 — selected-response diagnostics (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| HTTP debug export | Complete baseline | HTTP and GraphQL responses export a deterministic status line, displayed response headers, blank separator, and displayed UTF-8 body as text |
| Selected-response HAR | Complete baseline | The displayed live or saved response exports as one HAR 1.2 entry with request/response metadata, duration, size, protocol, redirect target, and body content |
| Historical request fidelity | Complete baseline | A selected saved response uses its matching structured request snapshot, including historical URL, method, configured headers, and supported body metadata |
| Query and payload breadth | Complete baseline | Actual URL query pairs retain order and duplicates; JSON, text, GraphQL, URL-encoded, and multipart metadata map to HAR post data without inventing binary bytes |
| Deterministic artifact boundary | Complete | Files use bounded safe request names and timestamps; invalid receipt dates fall back deterministically; export is local and lazy-loaded |
| Executable coverage | Complete baseline | Focused tests cover transcript ordering, status/header/body fidelity, single-entry HAR structure, historical metadata, duplicate query keys, payload sizing, redirects, and malformed URL/date fallbacks |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 45 verification](QA_MILESTONE_45.md) |

Compatibility bounds remain explicit: debug/HAR artifacts are textual diagnostics over decoded aggregate evidence and a header map, not raw libcurl events. Milestone 51 later preserves exact decoded entity bytes for raw download, but these diagnostics still cannot preserve raw wire ordering, duplicate response-header fields, TLS evidence, redirect hops, compressed bytes, or arbitrary binary representation. HAR request headers and bodies come from the saved editable request snapshot and cannot reconstruct transport-added headers, resolved secret values, request cookies, or multipart framing. Rendered/browser interaction QA remains omitted by standing direction.

## Milestone 46 — response filters and history navigation (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| JSON response filtering | Complete baseline | Read-only JSON previews accept root, dot/bracket property, index, wildcard, and recursive-property JSONPath selectors and render the ordered result array |
| XML response filtering | Complete baseline | XML previews use the WebView's standards-based DOM parser and XPath evaluator, wrapping serialized matches in a deterministic result element |
| Filter history | Complete baseline | Current and ten unique newest-first filters persist per request, reload safely, reapply from a menu, clear without altering history, and discard stale request keys during normalization |
| History chronology | Complete baseline | Saved responses group into the five current Insomnia time buckets using matching five-minute, two-hour, local-day, and local-week boundaries |
| History evidence | Complete baseline | Every choice exposes receipt time, status, saved method where available, actual URL, duration, and stored body size before selection |
| Preview isolation | Complete | Filtering never mutates the stored response or raw, pretty, debug, and HAR artifact inputs; invalid selectors return bounded visible errors |
| Bundle boundary | Complete | The evaluator and filtered preview lazy-load in a 4,641-byte chunk while the main production bundle remains below the warning threshold |
| Executable coverage | Complete baseline | Focused tests cover JSONPath traversal, wildcards, recursive descent, invalid selectors, language detection, filter-history bounds, chronological grouping, and hostile persisted metadata |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 46 verification](QA_MILESTONE_46.md) |

Compatibility bounds at Milestone 46 were explicit: the dependency-free JSONPath baseline did not implement predicates, unions, slices, or script expressions. Milestone 131 later replaces it with JSONPath Plus 10.4 and closes those selector gaps. XPath execution depends on the standards-based desktop/browser DOM rather than the Node-only test runner. Response filter metadata is bounded but remains part of the local workspace store. The pinned current Insomnia history component has no response-comparison action, so the earlier generic comparison gap is removed rather than implemented without source evidence. Rendered/browser interaction QA remains omitted by standing direction.

## Milestone 47 — large-response preview safety (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Source-matched thresholds | Complete | Strict greater-than checks use the pinned upstream 5 MiB large and 100 MiB huge constants, with finite/non-negative normalization |
| Large response guard | Complete baseline | Responses over 5 MiB avoid preview prettification, filter evaluation, line splitting, and DOM row construction until explicitly shown |
| Session reveal | Complete baseline | Show anyway reveals only the current response; Always show applies to subsequent 5–100 MiB responses for the current renderer session |
| Huge response guard | Complete baseline | Responses over 100 MiB remain hidden and cannot reach the filtered/pretty preview surface |
| Download escape hatch | Complete baseline | Both guards expose the established raw response artifact without forcing a preview render |
| Non-preview isolation | Complete | Status, headers, cookies, timeline, tests, history selection, and explicit export actions remain available while Preview is blocked |
| Bundle boundary | Complete | Threshold and guarded-preview logic stays in the lazy response-preview chunk; the main production bundle remains below the warning threshold |
| Executable coverage | Complete baseline | Focused tests pin both byte constants, exact-boundary behavior, strict greater-than transitions, and invalid/negative normalization |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 47 verification](QA_MILESTONE_47.md) |

Compatibility bounds at this milestone were explicit: Brunomnia loaded decoded UTF-8 response text into workspace state before Preview received it. This phase prevented expensive renderer transformations but did not implement filesystem-backed/deferred bodies or byte-exact binary export. Milestone 51 later preserves decoded entity bytes and exact raw downloads; filesystem-backed/deferred reads, compressed wire bytes, and pre-allocation limits remain open. The 100 MiB guard remains absolute even after Always show. Rendered/browser interaction QA remains omitted by standing direction.

## Milestone 48 — response preview modes (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Per-request mode selection | Complete baseline | The pinned friendly/source/raw values appear as Visual Preview, Source Code, and Raw Data and persist independently for each request |
| Source mode | Complete baseline | Existing JSON/XML detection, JSONPath/XPath filtering, match evidence, and textual prettification remain available with line numbers |
| Raw mode | Complete baseline | The stored UTF-8 inspection string renders without prettification, active filters, or line numbers; Copy also uses that string |
| Visual JSON/text baseline | Complete baseline | JSON retains safe filtered/prettified presentation and other non-HTML text falls back to the established source renderer |
| Visual HTML baseline | Complete baseline | `text/html` renders in a sandboxed iframe with no permissions and an injected default-deny CSP that permits only inline style and data-backed images/fonts |
| Mode/filter isolation | Complete | Raw and HTML visual modes do not evaluate hidden filters; switching back restores the bounded per-request filter state without mutating the response |
| Large-response composition | Complete | The 5/100 MiB guard wraps every mode, while the mode selector remains available without forcing body evaluation |
| Bundle boundary | Complete | Preview modes and visual rendering stay in the lazy response-preview chunk; the main production bundle remains below the warning threshold |
| Executable coverage | Complete baseline | Storage tests cover valid raw persistence, invalid/legacy fallback to source, bounded filters, and stale-key removal; the clean TypeScript and app builds verify every mode branch |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 48 verification](QA_MILESTONE_48.md) |

Compatibility bounds at this milestone were explicit: Visual Preview did not yet implement byte-backed image, PDF, audio, CSV-table, multipart, or charset-aware viewers. CSV and decoded-text multipart arrive in Milestones 49–50; Milestone 51 preserves underlying decoded entity bytes; Milestone 52 adds image/PDF/audio viewers; and Milestone 53 resolves declared charsets while Raw/Copy remain inspection-string surfaces. HTML visual mode intentionally blocks scripts, forms, privileged navigation, and remote resources; it is safer but less interactive than upstream's optional JavaScript WebView. Byte-backed multipart viewers remain open. Rendered/browser interaction QA remains omitted by standing direction.

## Milestone 49 — CSV response preview (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Friendly CSV routing | Complete baseline | Visual Preview routes CSV media types into a scrollable selectable table while Source and Raw retain their established textual paths |
| CSV quoting | Complete baseline | The parser preserves quoted delimiters, doubled quotes, quoted CRLF/newlines, empty fields, and ordinary UTF-8 text |
| Delimiter detection | Complete baseline | Comma, tab, semicolon, and pipe candidates are counted outside quoted content on the first record with deterministic comma tie-breaking |
| Empty/error handling | Complete | Empty lines are skipped, empty cells remain, no-row input gets a visible state, and unterminated quoted fields produce a bounded error instead of partial data |
| Render limits | Complete | Tables cap at 10,000 rows, 200 columns, and 250,000 cells with a visible truncation notice, composing with the existing 5 MiB preview guard |
| Safe cell rendering | Complete | React text nodes escape cell values; no CSV content is inserted as HTML or executed |
| Bundle boundary | Complete | CSV parsing and table rendering stay in the lazy response-preview chunk; the main production bundle is unchanged and remains below the warning threshold |
| Executable coverage | Complete baseline | Focused tests cover quoting, escaped quotes, multiline fields, CRLF, delimiter detection, empty rows/cells, malformed quotes, and every safety limit |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 49 verification](QA_MILESTONE_49.md) |

Compatibility bounds remain explicit: delimiter inference is a deterministic four-candidate baseline rather than Papa Parse's complete dialect inference. The viewer does not infer headers, column types, encodings, or formulas and does not virtualize table rows. The upstream keyboard-select-all behavior is left to ordinary browser/table selection because rendered/browser interaction QA remains omitted by standing direction.

## Milestone 50 — multipart response preview (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| MIME boundary parsing | Complete baseline | Visual Preview accepts quoted/unquoted boundaries, CRLF/LF framing, final closing delimiters, preambles/epilogues, and boundary-like non-delimiter content |
| Part metadata | Complete baseline | Up to 100 parts retain disposition name/filename, deterministic title, decoded UTF-8 size, content type, and up to 100 unfolded headers |
| Part navigation | Complete baseline | A selector changes the active part without leaving Preview and shows its name/filename plus stored decoded size |
| Header inspection | Complete baseline | Each selected part can toggle a bounded case-preserving header table |
| Textual part preview | Complete baseline | JSON parts prettify and other parts render decoded source text with line numbers; preview caps at 1,000,000 characters with a visible notice |
| Part export | Complete baseline | Save part writes the complete stored decoded text with a bounded safe filename and content-type-derived extension when no filename exists |
| Error/limit safety | Complete | Missing, overlong, incomplete, or malformed boundary/header evidence yields visible errors; excess parts are ignored with an explicit truncation notice |
| Bundle boundary | Complete | MIME parsing, part actions, and viewer UI stay in the lazy response-preview chunk; the main production bundle is unchanged |
| Executable coverage | Complete baseline | Focused tests cover quoted boundaries, CRLF/LF, folded headers, names/filenames, multiple parts, invalid/incomplete input, part limits, exact artifact content, and filename safety |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 50 verification](QA_MILESTONE_50.md) |

Compatibility bounds at this milestone were explicit: parsing operated on the decoded UTF-8 response string, so arbitrary binary part bytes could be lossy. Milestone 54 later replaces that parser and Save part artifact with exact entity-byte slices plus per-part charset decoding. Part rendering remains textual and does not recursively invoke the HTML/CSV/image/PDF/audio viewers. Header count and part count are bounded; filename parameters do not yet implement RFC 5987/2231 extended encoding. Save part uses the browser/WebView download path rather than a native save dialog. Rendered/browser interaction QA remains omitted by standing direction.

## Milestone 51 — byte-preserving HTTP responses (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Native response bytes | Complete baseline | Reqwest responses are consumed as decoded entity bytes, report the actual byte length, and keep the existing one-time content-decode fallback |
| Browser response bytes | Complete baseline | Fetch consumes `arrayBuffer()` rather than lossy `text()` and applies the same deterministic UTF-8 inspection contract |
| Compact persistence | Complete baseline | Valid UTF-8 is exactly reconstructable from the stored text; only lossy UTF-8 decoding adds a Base64 sidecar, which survives device-local response history normalization |
| Byte-exact raw export | Complete baseline | Raw/download actions emit exact decoded entity bytes for live and selected historical responses while prettified JSON and diagnostic exports remain intentionally textual |
| Plugin continuity | Complete baseline | Response plugins read exact buffers; binary replacement bodies retain bytes and text replacement bodies clear stale binary state |
| Size evidence | Complete | Response size now records decoded entity bytes rather than the UTF-8 length of replacement-character display text |
| Bundle boundary | Complete | Byte helpers add no dependency and the renderer remains below the production chunk warning threshold; response artifact UI stays lazy-loaded |
| Executable coverage | Complete baseline | Focused Rust/browser/helper/download/storage/plugin tests cover valid UTF-8 deduplication, invalid UTF-8 preservation, corrupt persisted fallback, raw export, and plugin-source continuity |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 51 verification](QA_MILESTONE_51.md) |

Compatibility bounds remain explicit: preserved bytes are the HTTP entity after reqwest/browser content decoding, not compressed wire bytes. Brunomnia still buffers bodies before applying preview limits and persists them in the device-local workspace instead of Insomnia's filesystem-backed/deferred body paths. Charset-aware text decoding, byte-backed multipart parsing, image/PDF/audio viewers, native save dialogs, and raw transport/header timelines remain open. Rendered/browser interaction QA remains omitted by standing direction.

## Milestone 52 — byte-backed media response previews (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Media routing | Complete baseline | Visual Preview recognizes normalized declared `image/*`, `application/pdf`, and `audio/*` media types while Source and Raw retain textual inspection behavior |
| Exact byte artifacts | Complete | Every viewer receives a correctly typed Blob built from the Phase 51 decoded entity bytes, including responses whose UTF-8 inspection text is lossy |
| Image viewer | Complete baseline | Images scale within a centered scrollable surface without HTML insertion or a remote request |
| PDF viewer | Complete baseline | PDFs render in a titled full-surface iframe backed by a local Blob URL |
| Audio viewer | Complete baseline | Audio uses accessible native WebView controls in a bounded centered layout |
| Lifecycle and errors | Complete | Media URLs are created only after the large-response guard, revoked on unmount/change, and paired with explicit preparing, empty-body, creation, and decoder-error states |
| Export continuity | Complete baseline | Raw export remains byte-exact and now derives common PDF/image/audio plus octet-stream filename extensions without a new dependency |
| Bundle boundary | Complete | Media parsing/artifact/UI code stays in the lazy response-preview/download chunks; the 497,345-byte main bundle is unchanged and below the warning threshold |
| Executable coverage | Complete baseline | Focused tests cover case/parameter normalization, invalid media types, exact invalid-UTF-8 byte recovery, Blob type/content, and binary extension behavior; complete frontend/native/CLI/app gates remain green within the recorded sandbox limit |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 52 verification](QA_MILESTONE_52.md) |

Compatibility bounds at this milestone were explicit: routing trusted the declared Content-Type rather than sniffing media signatures. Actual image/audio codecs and embedded PDF controls depend on the operating-system WebView, and corrupt-media load events vary by engine. Viewers still require the complete body in memory and do not implement zoom/waveform/transcript tooling. Milestones 53–55 later add charset-aware text and byte-backed recursive multipart viewing. Filesystem-backed response bodies and interactive HTML remain open. Rendered/browser interaction QA remains omitted by standing direction.

## Milestone 53 — charset-aware response text (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Charset parsing | Complete baseline | Content-Type lookup is case-insensitive, accepts quoted/unquoted parameters, bounds labels, and defaults missing values to UTF-8 |
| Current aliases | Complete | `utf8`, `utf16le`, `ucs2`, `ucs-2`, `latin1`, `binary`, and `win1250` through `win1258` map to the pinned Insomnia labels; other WebView-supported labels pass through |
| Transport parity | Complete baseline | Native and browser HTTP responses decode from the same exact entity-byte helper before timelines, plugins, scripts, filters, previews, or text exports consume the body |
| Byte continuity | Complete | Legacy single-byte, UTF-16, malformed UTF-8, and leading-BOM bodies retain a Base64 sidecar whenever the decoded inspection string cannot reconstruct the original bytes |
| Fallback safety | Complete | Unsupported decoder labels fall back to the prior UTF-8 replacement behavior without discarding raw bytes |
| Downstream continuity | Complete | JSON/XML/CSV/multipart text, Raw/Source/Copy, templates, plugins, scripts, HAR/debug, history, and media all receive the appropriate decoded text or exact-byte surface |
| Bundle boundary | Complete | The dependency-free decoder adds 868 bytes to the main renderer, which remains below the warning threshold at 498,213 bytes |
| Executable coverage | Complete baseline | Focused tests cover aliases, quoted/case-insensitive parameters, Windows-1252, UTF-16LE valid-byte edge cases, UTF-8 BOM preservation, browser/native integration, corrupt Base64 fallback, and ordinary UTF-8 deduplication |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 53 verification](QA_MILESTONE_53.md) |

Compatibility bounds at this milestone were explicit: decoding followed the declared charset and did not sniff encodings. Available pass-through labels depend on the operating-system WebView's Encoding Standard implementation; invalid/unsupported labels fall back to UTF-8 rather than bundling an independent codec table. Text diagnostics contain the decoded inspection string, while raw export retains decoded entity bytes. Milestones 54–55 later add byte-backed recursive multipart parsing. Filesystem-backed bodies, content sniffing, and raw wire evidence remain open. Rendered/browser interaction QA remains omitted by standing direction.

## Milestone 54 — byte-backed multipart responses (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Entity-byte parsing | Complete baseline | Boundary and header separators are located in a one-code-unit-per-byte index string, then every part is sliced from the exact Phase 51 entity buffer |
| Framing continuity | Complete | Quoted/unquoted boundaries, CRLF/LF, closing markers, preambles/epilogues, line-boundary enforcement, folded headers, and existing malformed-input errors retain Phase 50 behavior |
| Exact part evidence | Complete | Each part carries original bytes and true byte count alongside its bounded headers, disposition metadata, filename, and decoded inspection string |
| Part charsets | Complete baseline | Declared part Content-Type charsets use the shared Phase 53 alias/fallback decoder without altering the stored bytes |
| Exact part export | Complete baseline | Save part writes the original byte slice through Blob/object URL, preserves safe supplied filenames, and adds useful JSON/HTML/XML/CSV/PDF/bin fallbacks |
| Preview bounds | Complete | Parsing stays behind the outer 5/100 MiB response guard, keeps the 100-part/100-header caps, and truncates only the displayed 1,000,000-character text, never exported bytes |
| Bundle boundary | Complete | Parser/viewer changes remain in the lazy response-preview chunk; the main bundle grows only 18 bytes to 498,231 bytes and remains warning-free |
| Executable coverage | Complete baseline | Focused tests cover binary NUL/`0xff`/`0x80` payloads, exact artifact bytes, Windows-1252 part text, original byte sizes, and every prior boundary/header/error/limit case |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 54 verification](QA_MILESTONE_54.md) |

Compatibility bounds at this milestone were explicit: the dependency-free parser materialized a one-byte-index string in addition to the already buffered response, unlike upstream's streaming `multiparty` adapter. Part headers are treated as byte-preserving Latin-1-style code units rather than implementing RFC 2047, and filename parameters do not implement RFC 5987/2231. Milestone 55 later routes selected sections recursively through the friendly viewers. Save part uses the browser/WebView path rather than a native dialog. Rendered/browser interaction QA remains omitted by standing direction.

## Milestone 55 — recursive multipart friendly viewers (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Selected-part dispatch | Complete baseline | The selected section routes by declared Content-Type into JSON/text, safe HTML, bounded CSV, exact-byte image/PDF/audio, or another multipart viewer |
| Exact media continuity | Complete | Multipart media Blob artifacts consume the original part `Uint8Array`, never a replacement-character inspection string or re-encoding |
| Nested multipart navigation | Complete baseline | Every expanded nested level has its own bounded selector, header toggle, exact Save part action, and malformed-input evidence |
| MIME boundary fidelity | Complete | Aggregate and part Content-Type values retain parameter casing so case-sensitive outer and nested boundaries remain parseable while routing stays case-insensitive |
| Lazy expansion | Complete | Only the currently selected nested path is rendered and parsed; switching parts remounts that section viewer and leaves siblings unexpanded |
| Recursion safety | Complete | Nested multipart parsing stops after five levels and leaves selected nested sections over 5 MiB collapsed with exact-save guidance |
| Existing safety continuity | Complete | The outer 5/100 MiB gate, 100-part/100-header caps, 1,000,000-character plain-text cap, network-blocked HTML sandbox, CSV bounds, and Blob URL cleanup remain active |
| Bundle boundary | Complete | All recursion code remains in the lazy response-preview chunk; the main renderer stays at 498,231 bytes without a chunk warning |
| Executable coverage | Complete baseline | Focused tests cover direct media byte slices, nested case-sensitive boundaries, recursive parsing, and exact depth/byte guard thresholds alongside the prior multipart/media suite |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 55 verification](QA_MILESTONE_55.md) |

Compatibility bounds at this milestone were explicit: recursive routing still trusted declared Content-Type instead of sniffing content, and safe HTML remained script/form/network disabled. Milestone 56 later adds the pinned JSON and leading-doctype detection order. Recursion beyond five levels and nested multipart sections above 5 MiB require exact Save part inspection outside the viewer. The parser still buffers each expanded selected aggregate and materializes its byte-index string. MIME RFC 2047 and filename RFC 5987/2231 decoding, Content-ID attachment resolution, a native save dialog, and rendered interaction QA remain open.

## Milestone 56 — response content detection (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Upstream routing order | Complete baseline | Friendly routing first tries valid JSON, then a leading HTML doctype, then the original Content-Type, matching the pinned Insomnia viewer precedence |
| Misleading-header JSON | Complete | Any complete entity that parses as UTF-8 JSON routes as `application/json` before declared image/media/text/binary handling |
| Common HTML errors | Complete baseline | A case-insensitive HTML doctype in the trimmed first 100 entity bytes routes to the existing safe HTML viewer when the header is not already `text/html` |
| Recursive continuity | Complete | The same detection runs for selected multipart parts before their JSON/HTML/media/CSV/nested routing decision |
| MIME parameter fidelity | Complete | Empty, malformed, or unmatched bodies return the original Content-Type verbatim so case-sensitive multipart boundary values remain intact |
| Safety continuity | Complete | Detection remains behind the established outer response gate; HTML work is prefix-bounded, parse failures are swallowed, and the body/header evidence is never mutated |
| Bundle boundary | Complete | Detection stays in the lazy response-preview graph; the main renderer remains byte-identical at 498,231 bytes without a chunk warning |
| Executable coverage | Complete baseline | Focused tests cover misleading image/text types, JSON scalars, doctype position, non-doctype markup, empty bodies, and exact boundary-parameter preservation |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 56 verification](QA_MILESTONE_56.md) |

Compatibility bounds at this milestone were explicit: JSON detection decoded the complete entity as UTF-8 and parsed it, matching upstream rather than performing streaming or charset-statistical detection. HTML detection required a doctype inside the first 100 bytes; bare markup, XML, media signatures, and other file formats were not sniffed. Milestone 57 later adds opt-in isolated inline scripts. Detection changes only the viewer route and never rewrites stored Content-Type evidence.

## Milestone 57 — opt-in HTML preview JavaScript (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| User-visible preference | Complete baseline | Preferences exposes the pinned HTML JavaScript choice without an account or entitlement; Brunomnia keeps the authority off by default instead of upstream's enabled default |
| Inline interaction | Complete baseline | Opt-in HTML previews receive `sandbox="allow-scripts"` and a CSP `script-src 'unsafe-inline'`, enabling ordinary inline DOM interaction without same-origin authority |
| Constrained authority | Complete | External scripts, `eval`, fetch/XHR/WebSocket/EventSource, subresource network loads, forms, popups, modals, downloads, parent DOM access, and top navigation stay ungranted |
| Safe-default continuity | Complete | With the grant off, the prior empty sandbox and script-blocking CSP remain byte-for-byte policy equivalents |
| Recursive continuity | Complete | Top-level, content-detected, saved-history, and selected multipart HTML use the same preference and preview component |
| Device boundary | Complete | Strict boolean normalization, import reset, folder/Git omission, encrypted-pull preservation, defaults reset, and the loading workspace all keep authority device-local |
| Visible state | Complete | Every script-enabled HTML surface shows an amber warning naming the retained restrictions |
| Bundle hygiene | Complete | Canonical loading-state defaults remove a duplicate preferences literal; the main renderer shrinks to 497,440 bytes and remains warning-free while preview/settings code stays lazy |
| Executable coverage | Complete baseline | Focused tests assert safe/scripted CSP and sandbox output plus false-default, strict normalization, import reset, and true-value persistence |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [preferences](GRAPHQL_AND_PREFERENCES.md), [parity ledger](PARITY.md), and [Milestone 57 verification](QA_MILESTONE_57.md) |

Compatibility bounds at this milestone were explicit: this was a safer iframe composition rather than Electron's dedicated response WebView. Brunomnia did not yet inject the response URL as a base or provide a remote-resource mode, and it omitted same-origin/form/popup/download/top-navigation tokens. Milestone 58 later adds validated response-URL base injection and reset while retaining those sandbox restrictions. Inline script CPU/memory use is not preempted, so the preference is for trusted responses only. Rendered interaction QA remains omitted by standing direction.

## Milestone 58 — response URL-aware HTML previews (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` still inserts the response URL as an HTML `<base>` before loading its response WebView |
| Response URL base | Complete baseline | Valid HTTP(S) URLs are normalized, attribute escaped, and injected before response-controlled markup so the first base wins even without an existing `<head>` |
| Relative navigation | Complete baseline | Relative links resolve against the actual live or historical response URL and navigate only the response iframe |
| Recursive continuity | Complete | Content-detected top-level HTML and every selected multipart HTML section inherit the same top-level response URL |
| Reset control | Complete | A visible Reset preview action remounts the original stored response after same-frame navigation |
| URL and referrer safety | Complete | Malformed and non-HTTP(S) base values are rejected; both iframe and injected document request no referrer |
| Original-document confinement | Complete | Automatic remote CSS/image/font/script/fetch loading remains blocked, while the existing opaque sandbox continues to omit form, popup, download, same-origin, parent, and top-navigation authority |
| Executable coverage | Complete baseline | Focused tests cover default/script policy continuity, URL normalization, first-base precedence, relative resolution, attribute escaping, and scheme rejection |
| Bundle boundary | Complete | Base composition remains in the lazy response-preview graph; the main renderer is 497,469 bytes without a chunk warning |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 58 verification](QA_MILESTONE_58.md) |

Compatibility bounds at this milestone were explicit: this remained a Tauri iframe rather than Electron's response WebView. A followed page stayed opaque and sandboxed but used its own CSP; with `allow-scripts` active, that destination could execute its own scripts and network requests. Brunomnia did not yet auto-load response-document remote subresources or expose upstream's response-link disable preference. Milestone 59 later adds the preference to textual response viewers. The Reset action is a Brunomnia recovery affordance. Rendered interaction QA remains omitted by standing direction.

## Milestone 59 — response viewer links (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` defaults `disableResponsePreviewLinks` false and applies it to JSON/source CodeEditor link callbacks, not HTML WebView navigation |
| User-visible preference | Complete | Preferences exposes **Disable links in response viewer** with the same false default and no account or entitlement requirement |
| Text-viewer coverage | Complete baseline | Friendly JSON and Source Code render bounded clickable HTTP(S) targets; Raw Data and disabled mode retain plain text |
| XML compatibility | Complete baseline | The four upstream XML entities are decoded for the external target without rewriting displayed or copied response text |
| Native external open | Complete baseline | A dedicated Tauri command validates and caps the URL, then invokes the platform opener with an argument vector and no command shell |
| Browser-development fallback | Complete | Browser mode opens a normalized target with `noopener,noreferrer`; browser popup policy remains authoritative |
| Bounded detection | Complete | Detection caps each URL at 8 KiB and each line at 100 clickable targets while preserving unmatched text and trailing punctuation |
| Device boundary | Complete | Strict boolean normalization, import reset, folder/Git omission, encrypted-pull preservation, defaults reset, and the loading workspace keep the preference device-local |
| Failure visibility | Complete | Native validation/spawn errors appear below the response viewer instead of navigating the Brunomnia WebView |
| Executable coverage | Complete baseline | Focused tests cover text segmentation, punctuation, XML decoding, scheme/length rejection, default/import/normalization/persistence behavior, and native URL validation |
| Bundle boundary | Complete | Link logic remains in the lazy response-preview graph; the main renderer is 497,677 bytes without a chunk warning |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [preferences](GRAPHQL_AND_PREFERENCES.md), [parity ledger](PARITY.md), and [Milestone 59 verification](QA_MILESTONE_59.md) |

Compatibility bounds at this milestone were explicit: Brunomnia's dependency-free tokenizer was not CodeMirror's link extension and did not claim every URL grammar or editor gesture. It recognized absolute HTTP(S) text only, opened links in the default browser, and intentionally left Raw Data inert. The native opener had compile/test coverage on macOS; Windows `rundll32` and Linux `xdg-open` branches still needed release-host integration fixtures. Automatic original-document remote resources remained open until Milestone 60. Rendered link interaction QA remained omitted by standing direction.

## Milestone 60 — opt-in HTML remote resources (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` loads response HTML in an unrestricted Electron WebView with its response URL as base and JavaScript controlled separately |
| User-visible authority | Complete baseline | Preferences exposes a free, device-local **Allow remote resources in HTML response previews** grant; Brunomnia deliberately defaults it off instead of upstream's implicit enabled behavior |
| Static remote content | Complete baseline | Remote-only mode permits HTTP(S) CSS, images, fonts, media, and frames plus local data/blob media while scripts and network APIs stay blocked |
| Dual-grant active content | Complete baseline | External HTTP(S) scripts, HTTP(S)/WebSocket connections, and blob/HTTP(S) workers require both remote-resource and JavaScript grants |
| Constrained authority | Complete | Every mode blocks forms, popups, modals, downloads, same-origin/parent/top access, objects, and `eval`; ordinary CORS and mixed-content rules remain active |
| Recursive continuity | Complete | Live, saved-history, content-detected, and recursively selected multipart HTML share the same two grants and response URL base |
| Device boundary | Complete | Strict boolean normalization, import reset, folder/Git omission, encrypted-pull preservation, defaults reset, and the loading workspace keep the grant device-local |
| Visible state | Complete | Remote-only, script-only, and dual-grant modes show authority-specific warnings outside the iframe |
| Executable coverage | Complete baseline | Focused tests cover all four policy combinations, base continuity, forbidden sources, strict preference normalization/import reset, and supported local persistence |
| Bundle boundary | Complete | Policy composition stays in the lazy response-preview graph; the main renderer is 497,969 bytes without a chunk warning |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [preferences](GRAPHQL_AND_PREFERENCES.md), [parity ledger](PARITY.md), and [Milestone 60 verification](QA_MILESTONE_60.md) |

Compatibility bounds remain explicit: this is an explicit two-grant CSP/sandbox model rather than upstream's implicit unrestricted response WebView. It does not grant forms, popups, downloads, same-origin access, objects, `eval`, parent/top navigation, non-HTTP(S) resources, or WebView-level certificate/proxy overrides. Cross-origin and mixed-content failures remain platform policy. Rendered network/interaction QA remains omitted by standing direction.

## Milestone 61 — bounded Git commit history (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes a History table with message, relative time, author name, and author-email tooltip; its local Git layer requests 35 entries and may fetch the current remote first |
| History list | Complete baseline | Git Sync exposes the 35 newest commits reachable from local `HEAD`, with full/short IDs, subject, author identity, strict ISO author time, parents, and local ref decorations |
| Commit inspection | Complete baseline | Selecting a commit renders its metadata, file statistics, rename/copy-aware patch, and root/merge parents without mutating the working tree |
| Bounded native boundary | Complete | Requests clamp to 1–100 commits, text remains capped at 2 MB, Git uses direct argument arrays, and patch lookup accepts only a full hexadecimal SHA-1/SHA-256 identifier verified as a commit object |
| Empty repository | Complete | An unborn repository returns an ordinary empty history instead of surfacing Git's missing-`HEAD` failure |
| Network behavior | Complete | History is deliberately local and side-effect-free; unlike upstream, opening it never performs an implicit fetch or credential prompt |
| Executable coverage | Complete baseline | Native fixtures verify newest-first limits, author/parent/ref parsing, patch contents, malicious revision rejection, and unborn repositories |
| Bundle boundary | Complete | History stays in the existing lazy Git workbench; the main renderer remains below the 500 kB warning line |
| Documentation and evidence | Complete | Updated [Git projects](GIT_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 61 verification](QA_MILESTONE_61.md) |

Compatibility bounds remain explicit: the history follows local `HEAD`, not every local/remote branch, and does not fetch. Commit-message bodies, signatures, graph lanes, searching, pagination beyond the bounded request, checkout/revert/reset actions, and binary patch rendering remain outside this baseline. Rendered interaction QA remains omitted by standing direction.

## Milestone 62 — remote Git branch workflows (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` separates local and remote-only branches, refreshes remote refs, and exposes **Fetch and checkout** for a selected remote branch |
| Remote discovery | Complete baseline | Git status includes sorted remote/branch/tracking-ref records from configured remote-tracking refs and excludes symbolic remote `HEAD` pointers |
| Explicit refresh | Complete baseline | **Fetch and prune branches** updates the selected configured remote, prunes deleted refs, skips tags, and reports native Git credential/network failures in the workbench |
| Tracking checkout | Complete baseline | **Fetch + checkout** refreshes the exact branch, verifies its full remote-tracking ref, rejects a duplicate local name, creates the same-named local tracking branch, and reloads project YAML |
| Argument safety | Complete | Branches pass `git check-ref-format`; remotes must already exist and cannot be option-shaped; all Git calls use argument arrays and exact refs without a shell |
| Credential boundary | Complete | Fetch uses the installed Git credential helper or SSH agent; Brunomnia stores no provider token and introduces no account or entitlement check |
| Executable coverage | Complete baseline | A local bare-repository fixture covers fetch, slash-containing branch discovery, symbolic-ref filtering, upstream tracking, duplicate rejection, and malicious remote-option rejection |
| Bundle boundary | Complete | Remote workflows stay in the lazy Git workbench and the main renderer remains below the 500 kB warning line |
| Documentation and evidence | Complete | Updated [Git projects](GIT_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 62 verification](QA_MILESTONE_62.md) |

Compatibility bounds remain explicit: this phase reads configured remote-tracking refs and fetches through the installed Git client. It does not discover repositories from provider accounts, store provider credentials, delete or rename remote branches, browse un-checked-out remote history, fetch tags, or add force/advanced refspec controls. Rendered interaction QA remains omitted by standing direction.

## Milestone 63 — guarded local Git branch deletion (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes deletion for non-current local branches from its branch manager with an explicit confirmation step |
| User-visible deletion | Complete baseline | Git Sync lists every non-current local branch in a dedicated deletion selector and refreshes status immediately after success |
| Confirmation policy | Complete | The action honors Brunomnia's existing device-local **Confirm destructive actions** preference and names the selected branch in its warning |
| Native safety | Complete baseline | Full branch-name validation, exact local existence, current-branch rejection, argument-only execution, and `git branch -d` prevent option injection and refuse unmerged history loss |
| Remote isolation | Complete | Deleting a local branch does not delete its remote-tracking ref; it becomes eligible for the remote-only tracking workflow when applicable |
| Executable coverage | Complete baseline | A repository fixture covers current-branch refusal, merged deletion, unmerged refusal with ref preservation, and option-shaped name rejection |
| Bundle boundary | Complete | Deletion stays in the lazy Git workbench and the main renderer remains below the 500 kB warning line |
| Documentation and evidence | Complete | Updated [Git projects](GIT_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 63 verification](QA_MILESTONE_63.md) |

Compatibility bounds remain explicit: Brunomnia does not expose force deletion, remote-branch deletion, branch rename, bulk deletion, or provider-side branch protection metadata. Git's reachability check is authoritative, so a branch that is not merged into the current `HEAD` remains intact. Rendered confirmation/interaction QA remains omitted by standing direction.

## Milestone 64 — confirmed Git working-tree discard (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes confirmed per-file and all-unstaged discard actions in its Git staging workflow |
| Selected/all UI | Complete baseline | Git Sync exposes **Discard selected unstaged** and **Discard all unstaged** with counts, disabled states, progress, errors, and the existing destructive-action confirmation policy |
| Index preservation | Complete | Tracked files restore from the index rather than `HEAD`, so staged content remains staged when later working-tree edits are discarded |
| Untracked cleanup | Complete baseline | Selected untracked files are removed through bounded path arguments; ignored files and unrelated untracked files are untouched |
| Conflict protection | Complete | Discard refuses the whole request during merge/rebase/conflict state instead of overwriting a resolution in progress |
| Path/selection safety | Complete | Every path must be safe, repository-relative, currently changed, selected, and genuinely unstaged; staged-only and stale selections are rejected |
| Project continuity | Complete | Managed YAML reloads after discard, while files not represented by project resources remain under ordinary Git/filesystem ownership |
| Executable coverage | Complete baseline | A repository fixture proves staged-index preservation, tracked worktree restore, selected untracked removal, clean working diff, staged-only refusal, and traversal rejection |
| Bundle boundary | Complete | Discard stays in the lazy Git workbench and the main renderer remains below the 500 kB warning line |
| Documentation and evidence | Complete | Updated [Git projects](GIT_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 64 verification](QA_MILESTONE_64.md) |

Compatibility bounds remain explicit: this is a permanent discard after optional confirmation, with no trash/recovery layer. It does not discard staged changes, ignored files, active conflicts, submodule internals, or arbitrary directories as a unit. Git and filesystem errors may leave an earlier path group applied before a later group fails; no cross-file transaction is claimed. Rendered confirmation/interaction QA remains omitted by standing direction.

## Milestone 65 — confined per-file Git diff review (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` lets the staging workflow select one staged/unstaged file and compare its before/after content |
| File selector | Complete baseline | The diff header lists only files relevant to the current **Unstaged** or **Staged** mode and retains an aggregate-all option |
| Tracked files | Complete baseline | Native Git returns an exact file-scoped unified diff against the index or `HEAD`, preserving staged-versus-working semantics and deletion evidence |
| Untracked text | Complete baseline | Safe UTF-8 untracked files receive a direct text preview under the shared 2 MB Git output cap instead of an empty aggregate diff |
| Binary/large handling | Complete | Binary untracked files fail explicitly; oversized files show a bounded size notice; symlinks and escaping paths are rejected before reads |
| Stale/mode protection | Complete | The native command requires a current status entry and the requested staged/unstaged state; changing modes clears the file selection |
| Executable coverage | Complete baseline | A repository fixture covers tracked working/staged patches, untracked UTF-8 content, binary refusal, mode mismatch, and traversal rejection |
| Bundle boundary | Complete | Per-file review stays in the lazy Git workbench and the main renderer remains below the 500 kB warning line |
| Documentation and evidence | Complete | Updated [Git projects](GIT_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 65 verification](QA_MILESTONE_65.md) |

Compatibility bounds remain explicit: Brunomnia renders a unified textual patch/direct untracked preview rather than upstream's side-by-side semantic editor. Binary tracked changes use Git's ordinary binary diff marker; binary untracked files have no byte/hex viewer. Rename/copy presentation follows Git's path-filter behavior, and no syntax-aware diff or hunk staging is claimed. Rendered interaction QA remains omitted by standing direction.

## Milestone 66 — bulk staging and resilient commit-and-push (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes selected/all stage and unstage controls plus separate **Commit** and **Commit and push** actions in its Git staging modal |
| Selected/all staging | Complete baseline | Git Sync filters current non-conflicted status into selected/all stageable and unstageable sets, with accurate disabled states and shared progress/error handling |
| Secret/conflict safety | Complete | Every staging path still passes native relative-path validation, bulk staging observes the plaintext-secret policy, and conflicts remain owned by the explicit resolution workbench |
| Commit-and-push | Complete baseline | The shared commit path clears stale suggestions/history, records the committed status first, and optionally pushes the resulting branch tip through the configured Git remote |
| Partial-failure reporting | Complete | A rejected or unavailable push reports that the commit was created locally; Brunomnia neither claims atomicity nor attempts to rewrite the new local commit |
| Executable coverage | Complete baseline | A two-file repository fixture proves one-call staging and unstaging, both staged patches, an empty index afterward, and preserved working-tree changes |
| Bundle boundary | Complete | Bulk controls and commit orchestration remain in the lazy Git workbench while the main renderer stays below the 500 kB warning line |
| Documentation and evidence | Complete | Updated [Git projects](GIT_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 66 verification](QA_MILESTONE_66.md) |

Compatibility bounds remain explicit: commit-and-push is a two-step local/network operation, not an atomic transaction. A successful local commit is intentionally preserved when authentication, connectivity, branch protection, non-fast-forward policy, or another remote rule rejects the push. Stage/unstage all omits conflicted files, and there is no hunk-level staging, commit amendment, signing UI, force push, or automatic retry. Rendered interaction QA remains omitted by standing direction.

## Milestone 67 — clean-tree branch-merge preflight (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` refuses branch-manager merges when its current changes query reports staged or unstaged work |
| Native preflight | Complete | Brunomnia resolves an existing local target, then requires no staged, unstaged, untracked, conflicted, merge-in-progress, or rebase-in-progress state before invoking Git merge |
| Preservation | Complete | A rejected preflight does not start a merge or rewrite the index/worktree; users explicitly commit or discard their current work first |
| Existing merge flow | Complete baseline | Clean-tree merges retain the established no-fast-forward/no-autocommit invocation, three-way conflict resolution, binary side selection, and abort path |
| Executable coverage | Complete baseline | A repository fixture proves both unstaged and staged work are rejected, local content/index evidence remains present, and no `MERGE_HEAD` is created |
| Documentation and evidence | Complete | Updated [Git projects](GIT_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 67 verification](QA_MILESTONE_67.md) |

Compatibility bounds remain explicit: Brunomnia intentionally requires a completely clean tracked/untracked working state before branch merge even where native Git could merge non-overlapping local edits. This does not add stash, autostash, rebase, cherry-pick, hunk staging, force operations, or automatic conflict cleanup. Rendered interaction QA remains omitted by standing direction.

## Milestone 68 — commit-and-push remote access preflight (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` validates repository credentials before creating commits requested with the push option |
| Native preflight | Complete baseline | A dedicated read-only command validates the configured remote name and runs `git ls-remote --heads` through the installed Git credential helper/SSH path |
| Commit ordering | Complete | Commit-and-push awaits remote access before invoking commit, preventing clear connectivity and private-remote access failures from creating an avoidable local commit |
| Repository preservation | Complete | Validation changes no files, index entries, refs, or `HEAD`; it returns the native Git failure through the shared workbench error path |
| Later push failure | Complete | Write authorization, branch policy, non-fast-forward races, and post-preflight outages can still reject push; the already-created local commit remains explicit and retryable |
| Executable coverage | Complete baseline | A local bare-remote fixture proves successful access leaves `HEAD` and status unchanged and an unknown configured remote is refused before Git execution |
| Bundle boundary | Complete | The renderer remains below the 500 kB warning line and remote access runs in a blocking native task rather than the UI thread |
| Documentation and evidence | Complete | Updated [Git projects](GIT_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 68 verification](QA_MILESTONE_68.md) |

Compatibility bounds remain explicit: `ls-remote` proves reachability and any access required to list heads, not a specific credential's validity on a publicly readable repository, write permission, or branch acceptance. Provider-native token introspection remains later work. There is also an unavoidable race between preflight, local commit, and push; Brunomnia preserves the commit and reports any later push failure rather than attempting history rewriting. The installed Git client owns credential prompts/helpers, and no provider token or hosted Brunomnia account is introduced. Rendered interaction QA remains omitted by standing direction.

## Milestone 69 — ordered reviewed Git commit groups (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` accepts an ordered list of commit messages/file groups, unstages the index, then stages and commits each group sequentially |
| Plan validation | Complete | Brunomnia accepts 1–8 reviewed groups with non-empty bounded messages, requires every path to be a current non-conflicted change, and rejects duplicate assignment within or across groups |
| Ordered execution | Complete baseline | Existing staged files are first returned to the working set; each reviewed group alone is staged and committed in displayed order with the configured optional author overrides |
| Optional push | Complete baseline | **Commit groups + push** runs the remote-access preflight before index mutation and pushes the resulting branch only after every group succeeds |
| Partial-progress recovery | Complete | A stage/commit failure refreshes current status and reports the completed count without rewriting earlier commits; a later push failure preserves all new local commits |
| Executable coverage | Complete baseline | Pure plan tests cover order, stale/conflicted paths, duplicates, empty/bounded inputs; a two-file Git fixture proves distinct ordered commits and a clean final tree |
| Bundle boundary | Complete | Validation/orchestration remains in the lazy Git workbench and the main renderer remains below the 500 kB warning line |
| Documentation and evidence | Complete | Updated [Git projects](GIT_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 69 verification](QA_MILESTONE_69.md) |

Compatibility bounds remain explicit: grouped commits are sequential and non-atomic. Files omitted from the reviewed plan remain unstaged. A failure can occur after earlier groups have committed, and Brunomnia reports rather than rewrites that history. Groups cannot be manually reordered/edited as a table, and there is no hunk assignment, squash, amend, signing, automatic retry, or provider-native push-permission proof. Rendered interaction QA remains omitted by standing direction.

## Milestone 70 — Git push-readiness state (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` computes and persists whether the current Git repository has changes ready to push, separately from its local log |
| Native status | Complete baseline | Every Git status result now carries `canPush`: tracked branches require a positive ahead count; an untracked local branch requires a valid `HEAD` plus at least one remote |
| Unpublished evidence | Complete baseline | A committed branch with a remote but no upstream is identified as **Unpublished branch** instead of looking identical to an unborn/no-remote state |
| Guarded standalone push | Complete | **Push** requires the exact configured remote, a named branch, computed ready state, no current operation, and the existing plaintext-secret policy |
| Commit workflows | Complete | Commit-and-push and grouped commit-and-push remain available while the branch is currently even with its upstream because their commit step creates the new pushable tip |
| Executable coverage | Complete baseline | A local bare-remote fixture proves no-remote, unpublished, equal-upstream, one-ahead, and post-push states without external network access |
| Bundle boundary | Complete | Status/UI additions remain in the lazy Git workbench and the main renderer remains below the 500 kB warning line |
| Documentation and evidence | Complete | Updated [Git projects](GIT_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 70 verification](QA_MILESTONE_70.md) |

Compatibility bounds remain explicit: readiness is local-ref evidence, not a live remote or permission check. Remote-tracking refs may be stale until fetch, and branch protection, authentication, write authorization, non-fast-forward races, and server availability are evaluated only by preflight/push. No force push, automatic fetch, background polling, provider account, or hosted entitlement is introduced. Rendered interaction QA remains omitted by standing direction.

## Milestone 71 — actionable Git push failures (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` distinguishes non-fast-forward, authentication-required, tag-exists, HTTP, and generic push rejection paths |
| Non-fast-forward | Complete baseline | Native `non-fast-forward`, `fetch first`, and remote-newer evidence becomes a stable instruction to pull and resolve before retrying |
| Authentication/access | Complete baseline | Common HTTPS credential, HTTP 401/403, SSH public-key/permission, write-access, and repository-not-found evidence receives actionable installed-Git guidance |
| Unknown failures | Complete | Unclassified failures retain Git's bounded stderr/stdout instead of collapsing to an ambiguous boolean or empty message |
| Local preservation | Complete | Classification occurs after a failed non-force push and never mutates refs, index, worktree, or an earlier commit-and-push/grouped-commit result |
| Executable coverage | Complete baseline | Two local clones produce a real divergent bare remote; the rejected primary push reports pull/resolve guidance, keeps its local tip, and remains ready to push |
| Documentation and evidence | Complete | Updated [Git projects](GIT_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 71 verification](QA_MILESTONE_71.md) |

Compatibility bounds remain explicit: classification uses stable native Git text patterns and cannot normalize every localized/version/provider-specific message. Branch pushes do not include tags, so upstream's tag-exists category is not applicable to this command. Brunomnia does not auto-pull, retry, force push, rebase, rewrite commits, or add provider credentials. Rendered interaction QA remains omitted by standing direction.

## Milestone 72 — native nothing-to-push defense (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` checks `canPush` inside its push action and returns **Nothing to push** before remote mutation |
| Native recheck | Complete | Push independently reloads status after validating the exact remote/branch and rejects an equal or behind-only current branch targeting its own tracked remote |
| Network avoidance | Complete | The no-op result is returned before spawning `git push`, complementing rather than trusting the renderer's disabled state |
| Alternate targets | Complete | A different explicit branch or a current branch tracking another remote is not rejected using unrelated current-upstream readiness evidence |
| Executable coverage | Complete baseline | The local bare-remote readiness fixture now repeats push after an equalized successful push and receives **Nothing to push** |
| Documentation and evidence | Complete | Updated [Git projects](GIT_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 72 verification](QA_MILESTONE_72.md) |

Compatibility bounds remain explicit: readiness uses last-known local remote-tracking refs and can be stale until fetch. Alternate explicit branch/remote pushes proceed to native Git because current-branch status cannot prove they are empty. No background fetch, force push, retry, or provider call is added. Rendered interaction QA remains omitted by standing direction.

## Milestone 73 — reviewable request/response AI mock context (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes active-response-to-route extraction and model-backed spec text/URL mock generation |
| Explicit source selection | Complete baseline | The mock workbench keeps manual input and adds opt-in active-request and latest-active-response sources with optional additional instructions |
| Disclosure boundary | Complete baseline | The exact prepared context is reviewable; configured credentials, credential-named values, URL user information, cookies, and binary bytes are redacted or omitted without resolving environment/vault values |
| Bounded generation | Complete | Context and additional instructions are independently bounded, their composed input is capped at 190,000 characters, and existing structured-output validation remains unchanged |
| Executable coverage | Complete baseline | Focused tests prove current-request extraction, active-environment latest-response selection, credential redaction, context-only generation, bounds, and missing-source errors |
| Documentation and evidence | Complete | Updated [AI integration guide](MCP_AI_KONNECT.md), [parity ledger](PARITY.md), and [Milestone 73 verification](QA_MILESTONE_73.md) |

Compatibility bounds remain explicit: redaction recognizes credential-shaped fields but is not a general data-loss-prevention system, so users must review domain data in the displayed context. URL fetching, direct response-to-route conversion without AI, binary response interpretation, `.gguf` loading, and hosted/self-host mock deployment remain open. No context is attached until selected. Rendered interaction QA remains omitted by standing direction.

## Milestone 74 — direct response-to-mock route creation (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes an active-response extractor that derives a URL pathname and omits `Content-Length` before creating or replacing a mock route |
| Local direct conversion | Complete baseline | The selected local mock server can receive a new editable route from the active request's latest response without an account, model, network call, or entitlement check |
| Route fidelity | Complete | Saved request method, response URL path/status/text body, and response headers are copied; decoded-body length, encoding, connection, and transfer headers are omitted |
| Safety bounds | Complete | Binary responses are refused instead of lossy string conversion, text bodies are capped at 10,000,000 characters, unknown methods fall back to GET, and invalid URLs fall back to `/new-route` |
| Executable coverage | Complete baseline | Focused tests prove method/path/status/body/header conversion, transport-header removal, non-UTF text support, invalid-source fallbacks, and binary/oversize refusal |
| Documentation and evidence | Complete | Updated [AI integration guide](MCP_AI_KONNECT.md), [parity ledger](PARITY.md), and [Milestone 74 verification](QA_MILESTONE_74.md) |

Compatibility bounds remain explicit: this phase creates a new route in the currently selected server; response-to-existing-route overwrite and server selection from the request response pane remain open. Mock routes remain text-backed, so binary bodies are refused. Running native mock instances still require restart to consume route edits. Rendered interaction QA remains omitted by standing direction.

## Milestone 75 — selected-route response overwrite (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` overwrites an existing mock route from the active response by patching body, status, MIME/header data only |
| Selected-route action | Complete baseline | The mock route editor can explicitly replace the selected route's status, headers, and body from the active request's latest response |
| Authored-field preservation | Complete | Route identity, name, method, path, enabled state, and delay remain untouched so hand-authored routing and scenario behavior are not discarded |
| Shared safety boundary | Complete | Existing-route overwrite reuses text/binary detection, 10,000,000-character body bounds, decoded-body transport-header removal, and active-environment latest-response selection |
| Executable coverage | Complete baseline | Focused tests prove response-field replacement, authored-field preservation, stable header IDs, and binary refusal on overwrite |
| Documentation and evidence | Complete | Updated [AI integration guide](MCP_AI_KONNECT.md), [parity ledger](PARITY.md), and [Milestone 75 verification](QA_MILESTONE_75.md) |

Compatibility bounds remain explicit: overwrite targets the selected route in the selected mock server; Brunomnia does not yet expose the server/route chooser inside the request response pane. Binary bodies remain refused, and a running native mock instance must be restarted to consume route edits. Rendered interaction QA remains omitted by standing direction.

## Milestone 76 — reviewed specification-URL AI mocks (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` routes specification URLs through its model-backed mock-generation worker; its route model remains text-backed rather than binary |
| Two-step consent | Complete baseline | **Fetch for review** downloads the source locally; only the separate mock-creation action sends the displayed source to the configured model |
| Confined fetch | Complete | HTTP(S)-only URL validation, no URL user information, stored auth/cookie/script/environment/vault exclusion, configured transport policy, 2xx/text checks, and a post-buffer 5 MB response limit |
| Disclosure and bounds | Complete | Credential-shaped URL query values are redacted from model context, source URLs lose fragments, exact fetched content is reviewable, and the context remains inside the 94,000-character source and 190,000-character composed-input bounds |
| Executable coverage | Complete baseline | Focused tests prove URL normalization/refusal, credential rejection/redaction, text-type handling, context truncation, and empty/binary/oversize response errors |
| Documentation and evidence | Complete | Updated [AI integration guide](MCP_AI_KONNECT.md), [parity ledger](PARITY.md), and [Milestone 76 verification](QA_MILESTONE_76.md) |

Compatibility bounds remain explicit: fetch response size is checked after the shared HTTP transport buffers it, and arbitrary examples/secrets inside a fetched specification are model input exactly as displayed. Signed query parameters are used for the fetch but credential-shaped values are removed from model context. Brunomnia does not resolve multi-file remote references or add provider/plugin-specific dynamic mock syntax in this phase. Rendered interaction QA remains omitted by standing direction.

## Milestone 77 — request-aware dynamic mock output (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Current [Insomnia dynamic-mocking documentation](https://developer.konghq.com/insomnia/dynamic-mocking/) defines Liquid `req.headers`, `req.queryParams`, `req.pathSegments`, raw/parsed `req.body`, and the `default` filter as request-aware response inputs |
| Native request context | Complete baseline | The loopback handler exposes case-insensitive headers, decoded query parameters, ordered URL path segments, raw UTF-8 bodies, parsed JSON including arrays, parsed URL-encoded forms, and existing route path parameters |
| Safe output subset | Complete baseline | Bounded `{{ … }}` output evaluation supports documented bracket/dot access and `| default: "value"`; unsupported syntax is preserved rather than evaluated or silently destroyed |
| Resource boundary | Complete | Request bodies are inspected only after a route match and capped at 1,000,000 bytes; oversized or non-UTF-8 bodies expose no body value while static response rendering continues |
| Executable coverage | Complete baseline | Pure renderer/body-parser fixtures and an async handler-level request prove header/query/path/JSON/form/default behavior without opening a listener |
| Documentation and evidence | Complete | Added [local mock server guide](MOCK_SERVERS.md), updated [parity ledger](PARITY.md), and recorded [Milestone 77 verification](QA_MILESTONE_77.md) |

Compatibility bounds remain explicit: conditional `assign`/`if`/`unless`/`raw` tags, multipart field parsing, Faker variables, additional Liquid filters, repeated-value arrays, percent-decoded path segments, and live route hot reload remain open. Unknown output syntax remains literal for later phases. Rendered interaction QA remains omitted by standing direction.

## Milestone 78 — bounded Liquid mock controls (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Local values | Complete baseline | `{% assign name = expression %}` stores up to 100 response-local values of 10,000 bytes each for later output or conditions |
| Conditional output | Complete baseline | Nested `if`/`unless`, optional `else`, truthiness, and `==`/`!=` comparisons select response fragments without evaluating JavaScript or shell code |
| Literal regions | Complete baseline | `raw`/`endraw` copies template-looking text unchanged and accepts whitespace-normalized tag delimiters |
| Resource limits | Complete | Evaluation stops after 1,000 template-token operations, before a 21st nested conditional, or after 5,000,000 dynamically inserted bytes; the unprocessed remainder stays literal |
| Failure posture | Complete | Unknown filters/tags, invalid assignments, unmatched controls, and over-limit content remain reviewable text instead of acquiring broader execution semantics |
| Executable coverage | Complete baseline | Native fixtures prove assignment, comparisons, nested/inverted branches, `else`, raw output, unsupported-tag preservation, and both evaluation limits |
| Documentation and evidence | Complete | Updated [local mock server guide](MOCK_SERVERS.md), [parity ledger](PARITY.md), and [Milestone 78 verification](QA_MILESTONE_78.md) |

Compatibility bounds remain explicit: this is a documented safe subset rather than a general Liquid engine. Multipart field parsing, Faker variables, `elsif`, loops/includes, broader operators/filters, repeated-value arrays, percent-decoded path segments, and live route hot reload remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 79 — complete documented mock Faker surface (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Kong's current [Faker variables list](https://developer.konghq.com/insomnia/faker-variables/) and [pinned Mockbin allowlist](https://github.com/Kong/insomnia-mockbin/blob/c2a388563ea8259f9b235e4b3dfe87f64d568014/lib/routes/bins/run.js) expose 118 property-style names through `faker` |
| Name coverage | Complete baseline | Every currently documented identifier, color, text/date, network, name/address, job, image, finance, company, database, file, and commerce name renders through `{{ faker.name }}` |
| Local generation | Complete | Values are generated in the native process without an account, hosted mock service, network fetch, JavaScript engine, or new dependency |
| Template continuity | Complete | Faker values work in output, assignments, and conditions, use the existing token/expansion limits, and leave unknown names literal |
| Output safety | Complete | Image variables return strings only; no remote image is fetched. Every generated value is non-empty and remains below 1,000 bytes in executable coverage |
| Executable coverage | Complete baseline | A table-driven native test evaluates all 118 names, focused shape checks cover representative types, and the response renderer proves known/unknown Faker handling |
| Documentation and evidence | Complete | Updated [local mock server guide](MOCK_SERVERS.md), [parity ledger](PARITY.md), and [Milestone 79 verification](QA_MILESTONE_79.md) |

Compatibility bounds remain explicit: Brunomnia preserves the documented variable names and output categories, not FakerJS implementation identity. Its compact built-in English corpus, exact values, locale breadth, probability distributions, and date semantics can differ from upstream. Multipart field parsing, `elsif`, broader Liquid operators/filters, repeated-value arrays, percent-decoded path segments, and live route hot reload remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 80 — multipart mock request fields (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | The pinned [Mockbin body parser](https://github.com/Kong/insomnia-mockbin/blob/c2a388563ea8259f9b235e4b3dfe87f64d568014/lib/middleware/body-parser.js) accepts form-data/mixed/related/alternate bodies, exposes text-decoded part values by field name, and promotes repeats to arrays |
| Media-type coverage | Complete baseline | `multipart/form-data`, `multipart/mixed`, `multipart/related`, and `multipart/alternate` accept case-insensitive media types and quoted or unquoted boundaries |
| Field access | Complete baseline | Text and valid-UTF-8 file-part content render through `req.body.name`; repeated names render through zero-based dotted indices such as `req.body.tag.0` |
| Structural fidelity | Complete | Preambles/epilogues, CRLF or LF framing, multiline values, filename-bearing parts, and boundary-looking content that is not a delimiter are handled without exposing multipart headers as values |
| Resource limits | Complete | Existing 1 MB body inspection combines with 100 parts, 16,000 header bytes per part, 200 boundary bytes, and 1,000 field-name bytes; malformed/over-limit multipart produces no parsed field object |
| Executable coverage | Complete baseline | Pure parser fixtures cover all four media types, quoted boundaries, repeats, file/multiline content, false delimiters, injection refusal, part/header caps, and an async handler-level render without binding a socket |
| Documentation and evidence | Complete | Updated [local mock server guide](MOCK_SERVERS.md), [parity ledger](PARITY.md), and [Milestone 80 verification](QA_MILESTONE_80.md) |

Compatibility bounds remain explicit: multipart content must fit the existing bounded valid-UTF-8 request body; binary file content therefore exposes no body context. Filenames, content types, and per-part headers are not template properties, matching the upstream simple-field surface. Repeated query and URL-encoded values remain last-value strings rather than arrays. Percent-decoded path segments and live route hot reload remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 81 — request collections and decoded paths (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Mockbin passes Express `req.query`, Node `querystring.parse()` form data, and decoded wildcard path parameters into Liquid; Node's current [query-string contract](https://nodejs.org/api/querystring.html) promotes repeats to arrays and defaults to 1,000 parsed keys |
| Repeated collections | Complete baseline | Query and URL-encoded form pairs preserve decoded insertion order, promote the second value to an array, and retain at most the first 1,000 pairs like the upstream parser |
| Access syntax | Complete baseline | Dot properties, quoted bracket properties, numeric brackets, and numeric dotted indices compose across request query, path, JSON, form, and multipart values |
| Key fidelity | Complete | Quoted brackets address keys containing dots; valid missing paths render empty/default, while malformed access syntax remains literal for review |
| Path decoding | Complete baseline | Path segments and route `{parameter}` values decode valid UTF-8 percent octets, keep `+` literal, retain malformed/invalid-UTF-8 escapes, and allow encoded literals to match decoded route text |
| Executable coverage | Complete baseline | Pure fixtures prove repeat ordering/indexing, dotted-key access, the exact 1,000-pair boundary, form `+` handling, encoded slash/non-ASCII paths, invalid UTF-8 preservation, and async handler-level query/path rendering |
| Documentation and evidence | Complete | Updated [local mock server guide](MOCK_SERVERS.md), [parity ledger](PARITY.md), and [Milestone 81 verification](QA_MILESTONE_81.md) |

Compatibility bounds remain explicit: bracket expressions support quoted literal properties and numeric indices, not dynamic index variables or arbitrary Liquid expressions. Multipart filename/content-type/header metadata, live route hot reload, and the response-pane server/route chooser remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 82 — live native mock-route updates (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Shared running state | Complete baseline | Each native listener reads routes through a server-scoped asynchronous snapshot store instead of retaining only its startup configuration |
| Editor synchronization | Complete baseline | Route additions, deletions, enablement, method/path, status, delay, headers, and body edits are debounced per running server and sent through a dedicated Tauri command |
| Request consistency | Complete | A request clones the route it matches before body parsing or delay, so an in-flight response stays internally consistent while the next request observes the newest route set |
| Lifecycle safety | Complete | Stop removes only its own running generation, and delayed cleanup cannot erase a quickly restarted server with the same workspace ID |
| Executable coverage | Complete baseline | Socket-free handler coverage proves route replacement without rebinding; the real loopback fixture proves the same base URL serves the edited route and response |
| Documentation and evidence | Complete | Updated [local mock server guide](MOCK_SERVERS.md), [parity ledger](PARITY.md), and [Milestone 82 verification](QA_MILESTONE_82.md) |

Compatibility bounds remain explicit: editing the server host or port still requires a restart because those values define the listener itself. Updates are device-local and debounced rather than a collaborative hosted deployment stream. Multipart metadata properties, broader Liquid syntax, and response-pane server/route selection remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 83 — free response-pane mock extraction (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes a dedicated response extractor with mock-server and mock-route selectors, create/overwrite actions, and route navigation while gating local-project creation behind cloud or enterprise conditions |
| Free local workflow | Complete | Brunomnia exposes the same response-tab workflow for local HTTP/GraphQL responses and saved history with no account, project-type, organization, plan, or entitlement check |
| Server and route creation | Complete baseline | **Create new local server** chooses the first free loopback port from 4010, while existing-server creation accepts editable method/path and rejects a shadowing method/path conflict |
| Existing-route overwrite | Complete | The selected route keeps its identity, method, path, name, enabled state, and delay while response status, bounded headers, and text body are replaced |
| Live and historical sources | Complete baseline | Selected saved responses and live responses retained with a zero-history preference can both be transformed; failed, streaming, gRPC, binary, and oversized sources remain refused or unavailable |
| Navigation and running state | Complete baseline | **Go to mock** opens the exact server/route; response-pane changes issue an immediate native update when that local server is already running |
| Bundle boundary | Complete | The extractor and conversion engine load only when the Mock response tab opens; the main production JavaScript chunk remains below the 500 kB warning line |
| Documentation and evidence | Complete | Updated [local mock server guide](MOCK_SERVERS.md), [parity ledger](PARITY.md), and [Milestone 83 verification](QA_MILESTONE_83.md) |

Compatibility bounds remain explicit: create uses an inline method/path editor instead of Insomnia's separate modal. Mock bodies remain text-backed, and hosted/self-host deployment is outside this local listener workflow. Rendered interaction QA remains omitted by standing direction.

## Milestone 84 — LiquidJS condition semantics (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Kong developer-doc commit `73995e32ed758882a290c945807225d7442b483e` documents only `assign`/`if`/`unless`/`raw` and the `default` filter; Mockbin commit `fe06c386407e6df5fd5b6004daae4e105c202572` runs LiquidJS 10.27 with that exact tag/filter allowlist |
| Typed condition values | Complete baseline | Parsed JSON numbers, booleans, arrays, objects, and null retain type; query/form/header/path values remain strings; assignments retain rather than stringify those values |
| Operator surface | Complete baseline | LiquidJS 10.27 equality, inequality, four relational operators, string/array `contains`, unary `not`, and same-precedence right-associative `and`/`or` work with quoted-operator and Unicode-safe scanning |
| Branch grammar | Complete baseline | Ordered `elsif` branches work inside both `if` and `unless`; the first `unless` condition is inverted while later `elsif` conditions use ordinary truthiness like LiquidJS |
| Truthiness and literals | Complete baseline | Only false/nil/missing are falsey; empty strings, empty arrays, objects, and zero are truthy; `empty` and `blank` comparison literals are supported |
| Default filter | Complete baseline | False, nil, empty strings, and empty arrays use the fallback while zero and non-empty typed values remain unchanged |
| Existing safety bounds | Complete | The 1,000-token, 20-level, 100-local, 10,000-byte-local, and 5 MB dynamic-expansion limits continue to bound all new branches and operators |
| Documentation and evidence | Complete | Updated [local mock server guide](MOCK_SERVERS.md), [parity ledger](PARITY.md), and [Milestone 84 verification](QA_MILESTONE_84.md) |

Compatibility bounds at this milestone were explicit: Brunomnia preserved unsupported syntax as reviewable text instead of reproducing Mockbin's template-error HTTP 500. Milestone 85 closes that behavior gap. Exact LiquidJS token diagnostics, escaped-string behavior, runtime wall-clock/memory accounting, and object identity are not claimed. Filters and tags outside the upstream allowlist remain intentionally unavailable. Rendered interaction QA remains omitted by standing direction.

## Milestone 85 — Mockbin template failures (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Mockbin commit `fe06c386407e6df5fd5b6004daae4e105c202572` uses LiquidJS 10.27 with non-strict variables, strict filters, and only `assign`/`if`/`unless`/`raw` plus `default`; render errors become a structured HTTP 500 body |
| Permissive variables | Complete baseline | Missing request/local paths, unknown output roots, and unknown Faker names render as empty strings while `default` still supplies its documented fallback values |
| Strict syntax rejection | Complete baseline | Unsupported filters/tags, malformed or unclosed outputs/controls, duplicate or misplaced branches, and invalid assignments return render errors even when invalid syntax is inside an unselected branch |
| Bounded failure behavior | Complete | A 1,000,000-character source ceiling joins existing token, nesting, local-count, assigned-value, and dynamic-expansion ceilings; crossing a limit returns an error instead of exposing a literal unprocessed remainder |
| HTTP error contract | Complete baseline | The native handler returns status 500 and `{"error":"Error rendering body template","message":"<diagnostic>"}` with JSON content type, CORS, and route identity headers |
| Executable coverage | Complete baseline | Pure renderer fixtures cover permissive missing values, unsupported syntax, malformed controls, invalid assignments, and every resource ceiling; a socket-free handler fixture proves the structured 500 contract |
| Documentation and evidence | Complete | Updated [local mock server guide](MOCK_SERVERS.md), [parity ledger](PARITY.md), and [Milestone 85 verification](QA_MILESTONE_85.md) |

Compatibility bounds at this milestone were explicit: Brunomnia matched the observable permissive-variable/strict-syntax failure contract, not exact LiquidJS token locations or wording. Milestone 86 closes ordinary escaped-string, quoted-delimiter, and computed-property behavior. Runtime wall-clock/memory accounting, object identity, and exact FakerJS corpus/distribution identity remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 86 — Liquid tokenizer and computed properties (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | LiquidJS 10.27 commit `a8fd734b5ec4e0a6ffd1501a5961edc1e241be17` token/string/expression fixtures define quote-aware output/tag boundaries, JavaScript-style named/Unicode/octal escapes, dynamic bracket keys, nested property expressions, and array/string helper properties |
| Quote-aware token boundaries | Complete baseline | `}}`, `%}`, `{%`, operators, brackets, and pipes inside escaped quoted values remain content; Unicode scanning never slices through a multibyte character |
| String literal escapes | Complete baseline | Single/double quotes support LiquidJS backslash, named control, one-to-four-digit hexadecimal Unicode, one-to-three-digit octal, and pass-through unknown escapes |
| Computed properties | Complete baseline | Literal/numeric/dynamic brackets can nest, resolve request fields or typed locals, preserve case-insensitive header lookup, and expose array/string `size`/`first`/`last` helpers under the existing expression-depth bound |
| Filter tokenization | Complete baseline | The allowed `default` filter can be chained, while quoted pipes stay inside fallback strings and every other filter remains rejected |
| Whole-branch syntax | Complete baseline | Output syntax in inactive conditional branches is preflighted, so unsupported filters, malformed properties, or unclosed quoted outputs cannot hide behind runtime branch selection |
| Executable coverage | Complete baseline | Native fixtures reproduce pinned escaped-string and dynamic/nested-property examples, quoted control delimiters, local typed traversal, chained defaults, Unicode-safe scanning, and inactive-branch rejection |
| Documentation and evidence | Complete | Updated [local mock server guide](MOCK_SERVERS.md), [parity ledger](PARITY.md), and [Milestone 86 verification](QA_MILESTONE_86.md) |

Compatibility bounds remain explicit: range literals, property access rooted directly on quoted/range values, exact diagnostics/token locations, JavaScript lone-surrogate and object/Drop identity, and runtime wall-clock/memory accounting remain open. Filters and tags outside Mockbin's allowlist remain intentionally unavailable. Rendered interaction QA remains omitted by standing direction.

## Milestone 87 — local project catalog and recovery (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes project/workspace creation, switching, settings, duplication, export/import, deletion, and a Local Vault project type whose availability is controlled by organization storage rules |
| Free local catalog | Complete baseline | The top-bar manager creates, switches, renames, duplicates the active project, and deletes any non-last project with no account, organization, project-type, license, or entitlement branch |
| Independent native storage | Complete | A bounded catalog points to separately stored project JSON files; saves use same-directory temporary files, rollback-safe replacement, and the previous valid primary as a rotating backup |
| Migration and reconstruction | Complete baseline | The legacy `workspace.json` becomes `local-workspace`; an absent/corrupt catalog is restored from its backup or rebuilt from valid project files; if every project is unreadable, a fresh project opens without deleting damaged evidence |
| Recovery workflow | Complete baseline | Invalid primary files open only through a valid backup, autosave remains blocked, and a modal requires explicit restore or switching to another healthy project; invalid files and deleted project/backup/vault files are retained under recovery/trash directories |
| Project-scoped vaults | Complete | Each catalog ID owns a separate AES-256-GCM vault path and in-memory session; switching clears the session, deleting moves the encrypted vault to trash, and the legacy vault is copied only into the migrated legacy project |
| Runtime isolation | Complete baseline | Project changes wait for active/scheduled sends, persist current edits, disconnect streams, stop native mocks, clear protocol/schema/script state, and preserve device preference choices across projects |
| Browser parity | Complete baseline | Browser development uses separate primary/backup project keys plus rotating catalog backup, corruption detection, explicit restore, and soft-deleted/recovery keys |
| Bundle boundary | Complete | Catalog, project manager, command palette, and cookie manager are lazy chunks; the 178-module production build keeps main JavaScript at 499.16 kB without a chunk warning |
| Executable coverage | Complete baseline | Native fixtures cover legacy migration, lifecycle, catalog reconstruction, corrupt-primary restore, trash retention, vault isolation/migration, and last-project protection; frontend fixtures cover browser lifecycle plus project/catalog backup recovery |
| Documentation and evidence | Complete | [Local project guide](LOCAL_PROJECTS.md), updated [parity ledger](PARITY.md), and [Milestone 87 verification](QA_MILESTONE_87.md) |

Compatibility bounds at this milestone were explicit: Brunomnia groups collections, designs, mocks, environments, and MCP resources inside one catalog project instead of reproducing Insomnia's separate typed-workspace records beneath each project. Project/workspace manual sorting, inactive-project duplication, deleted-project restoration UI, multi-version backup browsing, automatic folder/Git discovery, and cloud/provider onboarding remained open; Milestone 96 closes deleted-project restoration and Milestone 97 closes inactive duplication plus within-catalog ordering. Rendered interaction QA remains omitted by standing direction.

## Milestone 88 — native OAuth 2 callback capture (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` supports authorization-code and implicit system/default-browser flows, PKCE, state, access/refresh/identity tokens, and implicit access/ID/combined response types |
| Native callback boundary | Complete baseline | Tauri accepts only bounded plain-HTTP `localhost`, `127.0.0.1`, or `::1` redirects, preserves explicit ports or allocates an ephemeral port, rewrites `redirect_uri`, opens the system browser without a command shell, and accepts only bounded callback GET requests on the configured path |
| State and PKCE | Complete | Missing state and enabled-but-empty PKCE verifiers are generated with Web Crypto; the native listener requires non-empty bounded state and ignores mismatched callbacks |
| Code grant | Complete baseline | A received code and the listener's exact redirect URL are passed through the authentication-certificate-aware token request; one-time code/verifier data is cleared and the configured redirect is retained after exchange |
| Implicit grant | Complete baseline | A local CSP-constrained bridge converts browser fragments to loopback query parameters; access-token, ID-token, and combined response types persist access/identity tokens and token type |
| Lifecycle | Complete | Duplicate flow IDs are rejected, readiness reports the exact browser/callback URLs, explicit cancel and request-switch cleanup stop listeners, and unattended flows expire after five minutes |
| Manual fallback | Complete | Browser-only development and providers that cannot use loopback redirects retain copied authorization URLs plus manual code/token fields |
| Bundle boundary | Complete | Authentication loads only when its tab opens; the 179-module build emits a 13.78 kB auth chunk and keeps main JavaScript at 490.67 kB without a warning |
| Executable coverage | Complete baseline | Frontend fixtures cover state/PKCE generation, response normalization, code and implicit mapping, identity-token exchange, errors, readiness, and cancellation; native loopback fixtures cover code capture, rejection, and cancellation |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 88 verification](QA_MILESTONE_88.md) |

Compatibility bounds remain explicit: automatic capture does not support HTTPS, custom schemes, or non-loopback redirects; the manual copied-URL path remains for those providers. There is no embedded authorization browser, reusable browser-session control, device authorization grant, dynamic client registration, or live third-party provider fixture. Exact cross-platform browser/provider behavior remains release validation work. Rendered interaction QA remains omitted by standing direction.

## Milestone 89 — OAuth 2 token lifecycle and send integration (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` stores access/refresh/identity tokens and expiry separately, auto-refreshes expired credentials, supports Origin on initial token calls, maps ID-only implicit responses into the request token, adds OIDC nonce, and recognizes `NO_PREFIX` |
| Token model | Complete baseline | Brunomnia retains access, refresh, identity, token type, and normalized expiry metadata with local request/folder auth; token fields remain masked and participate in direct plaintext-secret inspection |
| Direct-send acquisition | Complete baseline | A protected direct send reuses a valid token, exchanges a pasted code, fetches password/client-credential grants, refreshes an expired token, or launches the cancellable system-browser flow before any protected request leaves the app |
| Shared send guard | Complete baseline | HTTP/GraphQL sends across direct, runner, script/plugin secondary, import, AI, and HTTP-backed integration paths renew noninteractive credentials or fail before network dispatch when interactive authorization is still required |
| Folder ownership | Complete | Tokens acquired for inherited authentication update the closest configured ancestor rather than silently detaching the request from folder auth; runner renewals use the same owner rule |
| OIDC and header semantics | Complete baseline | ID-only implicit results populate both identity and effective request tokens, combined results retain both, generated nonces accompany ID-token response types, Origin reaches initial token calls, and `NO_PREFIX` emits the raw token |
| Refresh controls | Complete baseline | The Auth tab refreshes through a saved refresh token instead of replaying an authorization code, clears all token material explicitly, and retains a manual Fetch path for noninteractive grants |
| Bundle boundary | Complete | OAuth lifecycle code remains a 3.20 kB lazy chunk, the Auth editor remains an 11.97 kB lazy chunk, and the 179-module production build keeps main JavaScript at 495.46 kB without a warning |
| Executable coverage | Complete baseline | Focused fixtures cover nonce/raw prefix, ID-only fallback, callback-plus-exchange, current/expired/missing credentials, refresh parameters, Origin, pre-send renewal/refusal, folder ownership, expiry normalization, and secret scans |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 89 verification](QA_MILESTONE_89.md) |

Compatibility bounds at this milestone were explicit: direct request sends could initiate interactive browser authorization while runners and secondary/integration requests returned an actionable error when a new login was required. Milestone 90 closes that execution-breadth gap. OAuth tokens remain in project authentication data rather than an OS-keychain-wrapped unsynced token model. Invalid-refresh recovery does not yet automatically restart an interactive grant, and no live provider or cross-platform browser fixture is claimed. Rendered interaction QA remains omitted by standing direction.

## Milestone 90 — interactive OAuth execution breadth (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Shared resolver boundary | Complete | The HTTP execution context can request interactive OAuth credentials; protected dispatch remains blocked until a complete auth snapshot returns, then the same pre-send persistence callback receives it |
| Collection runner | Complete baseline | Authorization-code and implicit requests can open the system browser during a run, display exact URLs, exchange/store tokens, continue the active attempt, and reuse the credential in later iterations |
| Secondary execution | Complete baseline | Direct-request scripts, runner scripts, plugin network calls, and user-triggered project/integration HTTP operations share the same app- or runner-owned resolver rather than bypassing OAuth |
| Cancellation | Complete | Direct request switching, project switching, component teardown, the waiting dialog, and Runner Cancel all terminate the matching native flow without canceling unrelated flow IDs |
| Ownership | Complete | Main and runner acquisitions still persist request- or closest-folder-owned token state through the common ownership helper |
| Browser boundary | Complete | Browser development keeps the manual copied-URL path and returns an explicit Tauri-required error instead of pretending it can bind a listener |
| Bundle boundary | Complete | The reusable dialog is a 1.06 kB lazy chunk; OAuth remains 3.20 kB, Auth remains 11.97 kB, Automation is 50.94 kB, and the 180-module build keeps main JavaScript at 495.10 kB without a warning |
| Executable coverage | Complete baseline | Transport fixtures prove resolver ordering, token persistence, protected Authorization output, and refusal without a resolver; existing callback, cancellation, runner, type, bundle, and app-build gates remain green |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 90 verification](QA_MILESTONE_90.md) |

Compatibility bounds at this milestone were explicit: an interactive flow pauses the current sequential runner attempt; Brunomnia does not pre-authorize every request before a run or open multiple login windows concurrently. OAuth tokens still traveled with project/sync data and invalid-refresh recovery remained open; Milestone 91 closes both gaps. Embedded-browser session controls and live cross-platform provider fixtures remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 91 — local-only OAuth credentials and refresh recovery (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia's OAuth2Token model is `canSync=false`, stores access/refresh/identity/expiry separately from auth configuration, and treats 401 or `invalid_grant` refresh failures as unusable credentials that require fresh acquisition |
| Shareable omission | Complete baseline | Authorization codes, PKCE verifiers, access/identity/refresh tokens, and expiry are stripped from folder/Git split YAML and encrypted-sync payloads while client/auth configuration remains shareable |
| Local restoration | Complete | Project reload and encrypted pull sanitize incoming runtime fields first, then restore only matching local request/folder OAuth owner state; new resources and changed auth types receive no token |
| Publishing policy | Complete | Git/folder autosave, stage/commit/push checks, and encrypted-sync preflight scan the exact scrubbed payload, so local OAuth runtime state neither leaks nor falsely blocks publication |
| Refresh rejection | Complete baseline | Typed token errors recognize HTTP 401 and OAuth `invalid_grant`; interactive grants restart through the shared browser resolver, while client/password grants clear stale state and retry their configured noninteractive grant |
| Transient callback state | Complete | Automatic callback exchange uses the exact listener redirect, then restores configured redirect/state and clears one-time code/verifier values; canceled editor flows restore their pre-flow auth snapshot |
| Trust boundary | Complete | Runtime fields supplied only by incoming project/sync data are discarded before local merge, preventing a shared file from injecting bearer credentials |
| Executable coverage | Complete baseline | Pure scrub/merge fixtures cover request/folder owners, non-mutation, type changes, new resources, and incoming injection; project/sync tests cover omission/restoration; OAuth tests cover both refresh-recovery paths |
| Documentation and evidence | Complete | Updated [security and sync](SECURITY_AND_SYNC.md), [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 91 verification](QA_MILESTONE_91.md) |

Compatibility bounds remain explicit: runtime credentials still reside in the encrypted/local catalog project document rather than a dedicated OS-keychain-wrapped database, and explicit full-workspace/interchange exports retain their existing user-controlled credential behavior. Configured OAuth client secrets remain shareable only when policy allows them. Embedded-browser session controls and live cross-platform provider fixtures remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 92 — manually configured MCP OAuth (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` uses authorization code, refresh, PKCE, protected-resource/authorization-server discovery, optional dynamic registration, default-browser callback, and separately persisted token metadata for MCP HTTP authentication |
| OAuth request adapter | Complete baseline | MCP configuration maps into the shared authorization-code OAuth lifecycle with PKCE S256, generated state, ephemeral loopback callback, public-client body credentials, or vault-backed confidential-client Basic credentials |
| Lifecycle propagation | Complete | Acquired/refreshed access, refresh, identity, expiry, and token-type state carries through initialize, initialized notification, every discovery page, and invocation, then returns to the owning MCP client |
| Authoring and control | Complete baseline | The integration workbench edits authorization/token endpoints, client ID/secret, scope, and state; reports current/expired/non-expiring status; clears runtime tokens; and reuses the app-wide authorization waiting/cancel surface |
| Local-only runtime | Complete | MCP OAuth runtime fields are omitted from folder/Git and encrypted-sync payloads, restored only to a matching local OAuth client ID, discarded when injected by incoming data, and cleared on untrusted workspace import |
| Secret policy | Complete | Runtime tokens do not create publish-policy false positives, while configured OAuth client secrets must be complete local/external-vault references and are cleared on import |
| Executable coverage | Complete baseline | Focused fixtures cover adapter semantics, client propagation, persistence omission/restoration/injection, auth-type changes, import clearing, normalization, and plaintext-client-secret scanning |
| Bundle boundary | Complete | The 181-module production build keeps OAuth at 3.77 kB, the integration workbench at 34.67 kB, and main JavaScript at 497.52 kB without a chunk warning |
| Documentation and evidence | Complete | Updated [MCP/AI/Konnect](MCP_AI_KONNECT.md), [security and sync](SECURITY_AND_SYNC.md), [parity ledger](PARITY.md), and [Milestone 92 verification](QA_MILESTONE_92.md) |

Compatibility bounds remain explicit: endpoint metadata must be entered manually. `WWW-Authenticate` protected-resource metadata discovery, RFC 8414/OIDC authorization-server discovery, and dynamic client registration remain open, as do long-lived HTTP streams and live third-party fixtures. Runtime credentials remain in the encrypted/local catalog project document rather than an OS-keychain-wrapped database. Rendered interaction QA remains omitted by standing direction.

## Milestone 93 — MCP OAuth discovery and dynamic registration (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Challenge negotiation | Complete baseline | An OAuth-selected client without complete configuration probes the MCP endpoint unauthenticated, parses quoted/unquoted Bearer `resource_metadata`, `scope`, and error parameters, and retries the original JSON-RPC operation only once after acquisition |
| Protected-resource discovery | Complete baseline | The advertised URL, path-aware RFC 9728 well-known URL, and root fallback are tried in order; HTTPS/loopback confinement, bounded JSON, required authorization servers, and hierarchical RFC 8707 resource matching prevent unrelated metadata from driving authorization |
| Authorization-server discovery | Complete baseline | Path-aware RFC 8414, prefixed OIDC, and appended OIDC locations are tried with exact issuer checks, absolute endpoint validation, and advertised authorization-code/PKCE S256 compatibility checks; legacy root defaults remain available |
| Dynamic registration | Complete baseline | Missing client IDs use the advertised registration endpoint or legacy `/register`, request authorization-code/refresh plus loopback redirect and `none` authentication, and accept bounded public, Basic, or post client metadata |
| Authorization semantics | Complete baseline | Discovered flows use the shared system-browser callback, generated state, PKCE S256, RFC 8707 resource, configured/challenge/resource/server scope priority, expiry-aware refresh, rejected-refresh recovery, and one insufficient-scope step-up |
| Local persistence | Complete | Registered ID/secret/issued/expiry/auth-method data persists immediately by MCP client owner, survives local catalog use, and is omitted/sanitized/restored with OAuth token runtime state across folder/Git and encrypted sync |
| Security boundary | Complete | Metadata/registration requests carry no MCP auth, cookies, scripts, or redirects; accept only HTTPS or loopback HTTP; use 30-second deadlines; cap parsed JSON at 1 MiB; and never write successful registration secrets to event logs |
| Executable coverage | Complete baseline | Focused fixtures cover challenge and path construction, complete 401→resource metadata→server metadata→registration→token→initialize sequencing, immediate persistence, runtime isolation, and 403 scope escalation |
| Bundle boundary | Complete | Discovery remains inside the lazy integration path; the 182-module build keeps OAuth at 3.77 kB, Integration at 43.80 kB, and main JavaScript at 498.95 kB without a warning |
| Documentation and evidence | Complete | Updated [MCP/AI/Konnect](MCP_AI_KONNECT.md), [security and sync](SECURITY_AND_SYNC.md), [parity ledger](PARITY.md), and [Milestone 93 verification](QA_MILESTONE_93.md) |

Compatibility bounds at this milestone were explicit: URL-based client-ID metadata documents, metadata redirects, multiple authorization-server failover after valid protected-resource metadata, DPoP, and live third-party fixtures remained open. Milestone 227 later confirms pinned Insomnia's provider never exposes the SDK's optional `clientMetadataUrl`, removing that false requirement, and adds bounded per-hop metadata redirects. Multiple-server failover, DPoP, and live third-party fixtures remain open. Runtime credentials remain in the encrypted/local catalog project document rather than an OS-keychain-wrapped database. Rendered interaction QA remains omitted by standing direction.

## Milestone 94 — guided MCP resource templates (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` distinguishes resources from `uriTemplate` entries, derives every template variable as a required string field, previews SDK `UriTemplate.expand`, and sends the expansion through `resources/read` |
| Resource model | Complete | Ordinary URI and URI-template source remain distinct, template variables are derived in stable unique order during discovery/migration, and cached project metadata preserves both without treating a template as an already concrete URI |
| RFC 6570 expansion | Complete baseline | Bounded simple/reserved/fragment/label/path/path-parameter/query/continuation operators support comma variables, explode, scalar prefix, UTF-8 percent encoding, and scalar/list/object values with RFC empty-value behavior |
| Guided operation UI | Complete baseline | Selecting a template creates required string controls, resets stale operation parameters, and previews the exact expanded URI; ordinary resources show their immutable URI while tools/prompts retain JSON parameters |
| Invocation | Complete | HTTP and STDIO resource reads resolve the selected cached template immediately before `resources/read`; malformed/oversized templates and oversized expansions fail before transport while OAuth/session client updates remain intact |
| Bounds | Complete | Template source is capped at 8,192 characters, expressions/variables at 100, scalar prefix at 10,000 code points, and expanded output at 32,768 characters |
| Executable coverage | Complete baseline | RFC examples cover scalar/reserved/fragment/prefix, list/object/path/query/explode/empty semantics, variable deduplication, malformed syntax, discovery mapping, migration derivation, and concrete resource URI resolution |
| Bundle boundary | Complete | RFC expansion remains in the lazy integration chunk; the 183-module build keeps Integration at 49.05 kB and main JavaScript at 499.20 kB without a chunk warning |
| Documentation and evidence | Complete | Updated [MCP/AI/Konnect](MCP_AI_KONNECT.md), [parity ledger](PARITY.md), and [Milestone 94 verification](QA_MILESTONE_94.md) |

Compatibility bounds remain explicit: Brunomnia's guided template values are strings like pinned upstream's generated schema; direct helper coverage also handles arrays/objects. Rich JSON-Schema forms for tool inputs and prompt arguments, editor history per primitive, template subscriptions, and live third-party fixtures remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 95 — guided MCP prompt and tool parameters (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` builds required string schemas for prompt arguments, renders complete tool `inputSchema` through RJSF, mirrors form data into a JSON overview, and keys parameter state by primitive type/name |
| Prompt builder | Complete baseline | Every advertised prompt argument receives a string control, description, and required marker; edits synchronize with JSON and invoke `prompts/get` using the same typed object |
| Tool scalar builder | Complete baseline | Up to 200 top-level string/number/integer/boolean properties support nullable scalar unions, title, description, required, defaults, enum, const, and type-preserving controls |
| Complex fallback | Complete | The original baseline kept nested objects, arrays, references, compositions, union-only, and additional properties losslessly editable in JSON; Milestone 234 later adds bounded recursive guided controls without removing that authoritative fallback |
| Bidirectional editing | Complete baseline | Guided edits serialize deterministic pretty JSON, direct JSON edits immediately drive every visible control, and malformed JSON is retained for correction but rejected before invocation |
| Per-primitive state | Complete | Draft keys include MCP client, tool/prompt/resource family, and exact primitive name; revisiting restores that JSON while client switches reset the active selection, and least-recently-updated retention is bounded to 1,000 drafts |
| Executable coverage | Complete baseline | Fixtures cover order, required/default/title/description/enum/const/nullable inference, complex fallback, scalar coercion, typed option identity, draft isolation, and retention bounds |
| Bundle boundary | Complete | Parameter normalization stays in the lazy Integration chunk; the 184-module build keeps Integration at 53.62 kB and main JavaScript at 499.20 kB without a warning |
| Documentation and evidence | Complete | Updated [MCP/AI/Konnect](MCP_AI_KONNECT.md), [parity ledger](PARITY.md), and [Milestone 95 verification](QA_MILESTONE_95.md) |

Compatibility bounds at this milestone were explicit: recursive object/array controls, `oneOf`/`anyOf`/`allOf`, `$ref` resolution, format widgets, conditional dependencies, schema-level validation messages, and persistent drafts across app restarts remained open. Milestone 234 later closes bounded recursive/local-reference/composition/conditional/dependency forms plus advisory validation; specialized format widgets, remote references, uncommon draft keywords, byte-identical RJSF/AJV diagnostics, and persisted drafts remain. The JSON overview preserves full invocation capability for every schema. Rendered interaction QA remains omitted by standing direction.

## Milestone 96 — recently deleted project restoration (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Recovery inventory | Complete baseline | Native and browser stores group workspace, rotating backup, and optional encrypted-vault artifacts by validated project ID and deletion timestamp, classify workspace/backup/unavailable recovery state, sort newest first, and expose at most 1,000 entries per listing |
| Native restoration | Complete | Restore requires a valid primary or backup, rejects catalog/file conflicts and the 500-project ceiling, rebuilds the active primary plus valid backup and vault, rolls back newly created files if catalog persistence fails, and preserves malformed deleted JSON under recovery |
| Browser restoration | Complete baseline | Namespaced local-storage snapshots receive the same ID/timestamp validation, conflict checks, backup promotion, invalid-source preservation, catalog reinsertion, active-project selection, and consumed-trash cleanup |
| Project manager | Complete baseline | The lazy top-bar manager exposes a collapsible Recently deleted section with deletion time, recovery source, vault evidence, conflict/unreadable disabled states, and Restore-and-open action; deleting while expanded refreshes the inventory |
| Runtime isolation | Complete | Restoring runs through the same guarded project transition as create/open/delete, persisting current edits, refusing active sends, stopping project runtimes, clearing transient protocol/vault state, and adopting the restored project snapshot |
| Bounds and safety | Complete baseline | IDs remain path-safe, timestamps must be non-negative safe integers, native enumeration accepts regular files with exact suffixes only, invalid snapshots cannot restore, and successful restore consumes its valid trash artifacts |
| Executable coverage | Complete baseline | Native lifecycle coverage now verifies grouped listing, status/name/backup/vault evidence, active restoration, encrypted-vault bytes, and consumed trash; browser coverage verifies backup-based recovery, invalid-primary preservation, catalog reinsertion, and empty post-restore inventory |
| Bundle boundary | Complete | Recovery inventory state and UI remain in the lazy 6.47 kB WorkspaceSwitcher chunk; the 184-module build keeps the catalog at 10.38 kB and main JavaScript at 499.42 kB without a warning |
| Documentation and evidence | Complete | Updated [local project guide](LOCAL_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 96 verification](QA_MILESTONE_96.md) |

Compatibility bounds at this milestone were explicit: restoration reuses the deleted project ID and therefore refuses a current-ID or orphan-file collision instead of offering rename-on-restore. Original catalog creation/update/open timestamps are not stored in the trash snapshot, the manager has no permanent purge or retention-policy controls, and only the newest 1,000 deletion groups are listed even though older files remain retained. General multi-version backup browsing, exact project-to-typed-workspace hierarchy, manual ordering, discovery, and cloud/provider onboarding remained open; Milestone 97 closes manual within-catalog ordering. Rendered interaction QA remains omitted by standing direction.

## Milestone 97 — inactive duplication and persistent project ordering (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` exposes Duplicate / Move from every non-MCP workspace card, asks for a name and destination project, duplicates through an Insomnia v5 export including private environments, navigates to the copy, and supports workspace drag reordering within a project |
| Inactive source read | Complete | Native and browser catalogs can read a valid primary or recoverable backup for any catalog member without changing the active project, last-opened selection, or runtime state |
| Duplicate workflow | Complete baseline | Every healthy project exposes Duplicate, prompts for the new name, deep-copies the full resource tree and private environments, clears local response/activity/runner evidence, resets Git and shared-file targets, applies current device preferences, creates a fresh ID, and opens the copy |
| Persistent ordering | Complete | Native and browser stores validate source/target IDs plus before/after placement, atomically persist catalog order, preserve the active project and workspace document, and retain order across future loads |
| Drag interaction | Complete baseline | A dedicated reorder handle uses HTML drag data, before/after midpoint targeting, visible insertion markers, and dragging feedback without making project open/action controls the drag source |
| Keyboard ordering | Complete | The same focusable handle maps Arrow Up/Down to adjacent before/after placement and Home/End to first/last placement while all operations honor the shared project busy guard |
| Runtime isolation | Complete | Reordering saves the active workspace but does not stop requests, reset workbench state, or switch projects; duplication uses the full guarded project transition and adopts the new copy only after source read and creation succeed |
| Executable coverage | Complete baseline | Native fixtures prove inactive reads, before/after order persistence, unchanged active data, and invalid-position rejection; browser fixtures prove inactive duplication, deep resource cloning, local-target reset, order persistence, and copy activation |
| Bundle boundary | Complete | Read/duplicate/reorder logic stays in the lazy 11.94 kB catalog chunk and controls stay in the lazy 7.80 kB switcher; the 184-module build keeps main JavaScript at 499.35 kB without a warning |
| Documentation and evidence | Complete | Updated [local project guide](LOCAL_PROJECTS.md), [parity ledger](PARITY.md), and [Milestone 97 verification](QA_MILESTONE_97.md) |

Compatibility bounds remain explicit: Brunomnia still maps one catalog entry to one combined project document instead of reproducing Insomnia's project containing separately typed collection/design/document/mock/MCP workspaces. Duplication therefore targets the same local catalog rather than another project/organization, and cross-project move semantics are not representable yet. General discovery, cloud/provider onboarding, permanent trash controls, original deleted-catalog metadata, and multi-version backup browsing remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 98 — first-class Socket.IO requests (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` was checked across the Socket.IO request/payload/response models, main-process transport, editor/listener surfaces, and smoke fixture |
| Request model and migration | Complete baseline | Workspace v23 retains custom Engine.IO path, ordered JSON/text arguments, optional acknowledgements, and up to 500 enabled/disabled named listeners with bounded normalization and safe defaults |
| Native transport | Complete baseline | Engine.IO v4 over WebSocket handles URL-path namespaces, custom paths, query/headers/cookies, Bearer connect auth, heartbeat packets, namespace connect/disconnect, emits, acknowledgement IDs, listener filtering, and 1 MiB packet limits |
| Authoring and console | Complete baseline | A lazy protocol editor controls path, event, argument order/mode, acknowledgement, and listeners; a lazy ordered console shows incoming, outgoing, and system events while listeners can toggle during a live session |
| Runner sampling | Complete baseline | Collection runs connect the same native/browser path, emit the authored event, wait for incoming listener or acknowledgement evidence within a bounded window, and persist the resulting event snapshot |
| Insomnia interchange | Complete baseline | v4/v5 imports preserve Socket.IO identity, inline or separate payloads, custom path, event arguments, acknowledgement, and listener state; v4/v5 exports emit first-class Socket.IO request and payload records |
| Executable coverage | Complete baseline | Frontend fixtures cover argument rendering, migration, and v4/v5 import/export; native unit and real loopback integration fixtures cover handshake, namespace, emit, acknowledgement, incoming listener, and disconnect |
| Bundle boundary | Complete | Socket.IO bridge/editor/console and gRPC/project helpers remain lazy; the 188-module production build keeps Socket.IO at 2.13 kB and main JavaScript at 497.66 kB with no chunk warning |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 98 verification](QA_MILESTONE_98.md) |

Compatibility bounds at this milestone were explicit: the native baseline connected directly through the Engine.IO WebSocket transport instead of negotiating polling/fallback transports. Milestone 99 closes that negotiation gap. Binary Socket.IO attachment packets remain reported but not decoded, and richer message persistence/search/export, streaming plugin hooks, and live third-party compatibility fixtures remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 99 — Socket.IO polling negotiation and WebSocket upgrade (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia uses `socket.io-client` 4.8.1 with default polling-first transport selection, listens for Engine.IO upgrade evidence, and passes headers/query/cookies/proxy/TLS/client identities through the manager |
| Polling handshake | Complete baseline | Native Engine.IO v4 builds HTTP(S) polling URLs with reserved-query replacement and cache busting, parses bounded open packets, validates session IDs, honors server `maxPayload`, and joins root or URL-path namespaces through GET/POST polling |
| WebSocket upgrade | Complete baseline | Advertised upgrades use the existing SID, preserve headers, exchange `2probe`/`3probe`, send upgrade packet `5`, and continue the same namespace session over WebSocket |
| Polling fallback | Complete baseline | Servers with no WebSocket upgrade or a failed pre-upgrade probe retain polling for emits, acknowledgement correlation, named listeners, ping/pong, namespace errors/disconnect, and explicit client disconnect |
| Transport policy | Complete baseline | Polling reuses the existing redirect, timeout, proxy, certificate-validation, no-proxy, and domain-scoped PEM identity client; at Milestone 99, custom proxy/identity or disabled validation intentionally remained on polling rather than silently dropping policy during upgrade, and Milestone 110 later closes that upgrade gap |
| Concurrency and bounds | Complete | A dedicated long-poll receive task permits concurrent POST commands without HTTP/1 head-of-line deadlock; every response/packet remains UTF-8 and 1 MiB bounded, listener/argument limits remain enforced, and teardown aborts the pending poll |
| Executable coverage | Complete baseline | Unit coverage checks polling/WebSocket URL construction and packets; real polling-only and polling-to-WebSocket fixtures both cover connect, emit, acknowledgement, incoming listener, transport evidence, and disconnect |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 99 verification](QA_MILESTONE_99.md) |

Compatibility bounds at Milestone 99 were explicit: binary Socket.IO attachments were reported but not decoded, and WebSocket upgrade was skipped when custom proxy/client identity or disabled certificate-validation policy was active. Milestone 100 closes receive-side binary event and acknowledgement hydration; Milestone 110 later closes the policy-preserving upgrade gap. Persistent message collections/search/export, streaming plugin hooks, and live third-party fixtures remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 100 — Socket.IO binary event and acknowledgement hydration (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia exposes JSON/Text payload arguments, lets `socket.io-client` reconstruct incoming binary values, writes listener/ack arrays through `JSON.stringify`, and displays resulting objects as formatted JSON |
| Binary packet parsing | Complete baseline | Native Socket.IO type 5 events and type 6 acknowledgements parse bounded attachment counts, namespaces, optional event ack IDs, required acknowledgement IDs, and JSON placeholder payloads |
| Attachment transport | Complete baseline | WebSocket binary frames and Engine.IO polling `b<base64>` packets feed the same pending packet state; up to 100 attachments and 1 MiB total are accepted before hydration |
| Recursive hydration | Complete | Placeholders nested in arrays or objects validate their numeric index and become Node-compatible `{ type: "Buffer", data: number[] }` values before event delivery |
| Event and acknowledgement continuity | Complete | Hydrated events retain namespace/listener filtering, hydrated acknowledgements retain pending emit correlation, and ordinary text events continue immediately after a binary packet |
| Failure behavior | Complete baseline | Invalid counts, payloads, base64, missing indexes, unexpected attachments, text interleaving, and count/size overflow produce visible system errors and close the malformed stream instead of exposing partial data |
| Executable coverage | Complete baseline | Unit coverage proves nested multi-attachment event and binary-ack hydration; upgraded-WebSocket and polling-only loopbacks both prove binary ack, binary named event, ordinary event continuity, and disconnect |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 100 verification](QA_MILESTONE_100.md) |

Compatibility bounds at Milestone 100 were explicit: upstream's current editor does not expose a distinct binary-send argument mode, so no separate binary authoring control is claimed. Milestone 110 later closes WebSocket upgrade under custom proxy/client identity or disabled certificate validation. Persistent message collections/search/export, streaming plugin hooks, and live third-party fixtures remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 101 — persistent realtime response history (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia stores WebSocket and Socket.IO connections as response models with file-backed event logs, applies `maxHistoryResponses`, filters by active environment, and uses the shared chronological history selector with request restoration, delete-current, and clear-history actions; Event Stream responses follow the same response loader/history path |
| Workspace schema | Complete | Workspace v24 adds validated `StoredStreamSession` records for WebSocket, Socket.IO, and SSE; migration removes orphaned request references, normalizes event identity/direction/protocol/timestamps, and bounds sessions plus event text |
| Incremental lifecycle | Complete baseline | A session is retained when connection starts and every incoming, outgoing, system, reconnect, error, and close record is appended through functional workspace updates; terminal timestamps clear when reconnecting/open evidence resumes |
| History behavior | Complete baseline | The response pane restores the newest eligible session on request, environment, filter, and local-project changes, groups prior sessions into the upstream chronological sections, disconnects a different live session before selection, and supports exact delete plus active-environment clear |
| Retention and privacy | Complete | Existing positive/zero/unlimited history and environment-filter preferences govern stream sessions; event logs retain the newest 5,000 entries and about 5 million text characters, remain device-local across project/sync boundaries, and reset on project duplication |
| Race safety | Complete baseline | Session IDs and synchronous view-scope refs prevent late old-session events or delayed disconnect actions from replacing a newly selected request/workspace console or status; connections completing after scope abandonment are closed |
| Executable coverage | Complete baseline | Focused history, storage migration, local-project preservation, encrypted-sync omission, and duplicate-reset tests pass alongside the existing native transport suites |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 101 verification](QA_MILESTONE_101.md) |

Compatibility bounds remain explicit: stream history does not yet restore historical request versions, persist native timeline/handshake headers beside each event log, search or export saved events, or expose streaming plugin hooks. The renderer still keeps bounded logs in workspace memory rather than upstream-style file-backed event-log paths. Rendered interaction QA remains omitted by standing direction.

## Milestone 102 — realtime request-version restoration (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned WebSocket and Socket.IO response services create a compressed request version for each response; the shared history dropdown restores that version on selection, and deleting the current response restores the newest remaining response version |
| Snapshot creation | Complete | Every newly retained WebSocket, Socket.IO, or SSE session captures an independent structured clone of the editable request before inherited runtime configuration is applied |
| Historical selection | Complete baseline | Selecting a saved session disconnects a different live connection, swaps the event log, and restores the captured request only if the same request remains active after the asynchronous disconnect |
| Delete continuity | Complete baseline | Deleting the selected stream session restores the newest remaining eligible session and its request version; clearing the active environment history intentionally leaves the current request unchanged |
| Structural safety | Complete | Stream and ordinary response history share one validated restore helper that requires matching identity and complete protocol/body/auth/transport structures while preserving the current request ID and folder placement; legacy or malformed snapshots remain history-only |
| Workspace schema | Complete | Workspace v25 adds an optional stream request snapshot, preserves only snapshot objects whose ID matches the owning request, and propagates the version through project reads, replacement/merge imports, and scoped exports |
| Executable coverage | Complete baseline | Focused tests prove snapshot independence/restoration, legacy migration, request-ID scoping, interchange versions, project preservation, and encrypted-sync omission |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 102 verification](QA_MILESTONE_102.md) |

Compatibility bounds remain explicit: stream history still does not retain handshake/timeline headers or upstream-style filesystem event-log paths, and saved-event search/export plus streaming plugin hooks remain open. Request restoration follows Brunomnia's existing structural snapshot contract rather than Insomnia's compressed request-version database. Rendered interaction QA remains omitted by standing direction.

## Milestone 103 — realtime event filtering, search, and clear view (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned realtime responses expose All/Message/Open/Close/Error type filtering except on cURL-backed Event Stream, case-insensitive message/error/close search, and a local `clearEventsBefore` cutoff that resets with the response ID; no dedicated event-log export action exists |
| Event categorization | Complete baseline | Open, close/closed, and error records map directly; incoming/outgoing records map to Message; remaining system transport/listener/reconnect evidence stays visible under All but not the four selected upstream categories |
| Search behavior | Complete | Case-insensitive search examines message data and error/close text while excluding open and informational system entries, matching the pinned event predicate |
| Clear-view behavior | Complete baseline | Clear view stores the newest displayed timestamp, hides records at or before it without mutating saved history, and allows later live events to appear immediately |
| Session isolation | Complete | Type, query, and cutoff state reset whenever the selected live or historical session ID changes, preventing one response's local view from leaking into another |
| Responsive UI | Complete baseline | The lazy stream console adds a wrapping toolbar with protocol-aware type selection, search, visible/total count, and a clearly labeled non-destructive clear action |
| Executable coverage | Complete baseline | Focused tests prove category mapping, exact search eligibility, type filtering, and timestamp cutoff behavior; the full renderer/native/package gates remain required before publication |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 103 verification](QA_MILESTONE_103.md) |

Compatibility bounds remain explicit: Brunomnia renders complete event cards rather than upstream's virtualized summary/detail split, and sessions still lack handshake headers plus a dedicated timeline/console tab. Saved logs are bounded in workspace memory instead of upstream file paths. Rendered interaction QA remains omitted by standing direction.

## Milestone 104 — realtime handshake metadata and lifecycle timelines (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned WebSocket responses retain status/message, HTTP version, response headers, elapsed time, event-log path, and timeline path; Socket.IO responses retain URL, elapsed time, and a timeline containing target/path/upgrade/close evidence; Event Stream uses ordinary response headers/timeline |
| Shared native output | Complete | WebSocket, Socket.IO, and SSE connect commands return status/message, bounded flattened headers, negotiated HTTP version, elapsed handshake duration, and effective transport without changing their existing event channels |
| Transport evidence | Complete baseline | WebSocket returns its 101 upgrade response; SSE returns its initial successful HTTP response; Socket.IO returns the Engine.IO polling handshake headers/version plus final polling or WebSocket transport and namespace-connect duration |
| Persisted timeline | Complete baseline | Sessions start with URL and optional Socket.IO path, add handshake status/transport, and append bounded open/upgrade/reconnect/error/close lifecycle entries with elapsed milliseconds |
| Retention-zero continuity | Complete | A transient selected-session view mirrors event and metadata updates even when retention is `0`; retained sessions persist the same evidence and historical selection restores it |
| Renderer inspection | Complete baseline | Streaming Headers and Timeline tabs use selected stream metadata, the summary shows handshake duration/version, and history choices include status where upstream does plus elapsed/event counts |
| Workspace schema | Complete | Workspace v26 validates bounded metadata fields, up to 500 response headers with bounded names/values, and the existing bounded timeline normalizer while leaving legacy sessions metadata-optional |
| Executable coverage | Complete baseline | Focused frontend tests cover metadata/timeline merge and migration; native upgraded and polling Socket.IO loopbacks assert returned status/version/transport before full release gates |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 104 verification](QA_MILESTONE_104.md) |

Compatibility bounds at Milestone 104 were explicit: timeline rows are bounded structured workspace records rather than upstream filesystem streams, duplicate response headers remain flattened, and failed pre-response connections have errors but no fabricated status/headers. Milestone 109 closes WSS validation/client identity, and Milestone 110 closes custom WebSocket proxy transport. Streaming plugin hooks and live third-party fixtures remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 105 — live SSE reconnect and resume evidence (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Initial transport | Complete | A real reqwest SSE connection reaches a loopback HTTP server, sends `Accept: text/event-stream`, receives status/version/headers metadata, parses a named event, and retains its event ID |
| Server retry policy | Complete | The first response's `retry: 100` overrides the authored 1,000 ms delay within the existing 100–60,000 ms safety clamp and produces matching reconnect evidence |
| Last-Event-ID resume | Complete | The second real GET is captured and proves `Last-Event-ID: order-1`; its resumed named event reaches the same Tauri event channel |
| Reconnect lifecycle | Complete | The channel records initial open/data, reconnecting with the server delay, reconnected open, and resumed data in order |
| Cancellation | Complete | Explicit disconnect cancels the pending next reconnect, removes the native session handle, and produces a terminal closed event without requiring a third server response |
| Metadata continuity | Complete | The same fixture asserts returned HTTP 200, HTTP/1.1, content type, and Server-Sent Events transport metadata before consuming events |
| Executable coverage | Complete | The focused four-thread loopback runs through the production `connect_sse`, `open_sse`, parser, reconnect, header, channel, and `disconnect_sse` paths |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 105 verification](QA_MILESTONE_105.md) |

Compatibility bounds remain explicit: Event Stream logs/timelines remain bounded workspace records rather than upstream filesystem paths, and streaming plugin hooks plus external third-party compatibility matrices remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 106 — self-contained multipart and binary client code (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia renders the effective request into HAR body text or multipart parameters and delegates its broader target/client matrix to HTTPSnippet |
| Exact multipart body | Complete baseline | Enabled resolved text/file parts are serialized once with CRLF framing, duplicate names, optional text content types, filenames, MIME types, exact file bytes, and a deterministic collision-checked boundary |
| Header safety | Complete | Multipart name, filename, and content-type line breaks are neutralized with visible warnings; quoted parameters escape backslashes and quotes; unattached or malformed file bytes are omitted explicitly rather than corrupting the body |
| Header continuity | Complete | Any stale authored multipart Content-Type is replaced by the exact generated boundary, while a standalone binary body receives its saved MIME type only when the request has no explicit Content-Type |
| Six target emitters | Complete baseline | cURL decodes through a temporary file with GNU/BSD `base64` fallback; JavaScript Fetch, Python Requests, Go, Java, and C# decode the same Base64 body in memory |
| Standalone binary | Complete | All six targets receive the exact saved binary bytes instead of the prior omission warning |
| Executable coverage | Complete | Focused tests decode generated multipart bytes, prove framing/metadata/templates/duplicates/binary values/boundary collision handling, compare the common payload across every target, and exercise invalid-file warnings |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 106 verification](QA_MILESTONE_106.md) |

Compatibility bounds remain explicit: Milestone 126 expands Brunomnia to eleven selected clients across eleven of HTTPSnippet's twenty target families, but alternate clients and nine target families remain. Brunomnia does not install target dependencies, reproduce runtime-only advanced auth signing, comprehensively validate every emitted language, or execute snippets. Inline byte payloads make previews self-contained but can be large. Rendered interaction QA remains omitted by standing direction.

## Milestone 107 — request-body controls and native wire fidelity (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia's request body model contains MIME/text/file/parameter modes; body parameters expose name, value, description, disabled, multiline/content-type, filename, and type fields plus one request-level disable-render switch, but no arbitrary per-part-header collection |
| Lazy row editors | Complete baseline | URL-encoded and multipart rows support enablement, Text/Multiline/File modes where applicable, descriptions, explicit up/down ordering, removal, and add; both editors live in one lazy chunk instead of growing the near-threshold startup bundle |
| Body rendering policy | Complete | Workspace v27 adds a default-on per-request switch shared by direct/browser/runner/CLI/codegen paths for raw body text, GraphQL variables, URL-encoded names/values, and multipart names/values/filenames/content types |
| Binary MIME defaults | Complete | Desktop native and CLI sends add the saved binary MIME type only when no enabled Content-Type exists; explicit authored headers remain authoritative |
| Interchange | Complete baseline | Insomnia v4 `settingDisableRenderRequestBody`, v5 `settings.renderRequestBody`, URL-encoded/multipart descriptions, disabled state, multiline/content type, and ordering round-trip through the supported adapters; Postman form descriptions/multiline values are retained |
| Native wire evidence | Complete | A real loopback request asserts multipart Content-Type/boundary, multiline JSON text, edited filename/MIME, disabled omission, exact `00 ff 0a 0d` file bytes, and successful response handling; request construction separately proves binary MIME default/override behavior |
| Historical compatibility | Complete | Pre-v27 requests and historical snapshots default body rendering on; stored multipart mode flags normalize to booleans without losing values or metadata |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 107 verification](QA_MILESTONE_107.md) |

Compatibility bounds remain explicit: selected local files are persisted as approved bytes rather than reusable template-selected absolute paths; browser-development FormData cannot assign a custom MIME type to text parts without file-shaped Blob semantics; and broader third-party multipart encoding fixtures remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 108 — GraphQL subscription transport (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia detects the selected GraphQL `subscription`, converts HTTP(S) to WS(S), negotiates `graphql-transport-ws`, sends `connection_init`, subscribes after `connection_ack`, and closes on protocol `error` or `complete` |
| Operation selection | Complete baseline | Brunomnia honors operation name, sole anonymous operations, comments, strings, fragments, directives, and object/list variable defaults without routing ordinary queries or mutations away from HTTP |
| Native protocol lifecycle | Complete | Tauri forces the required subprotocol, sends exact init and UUID subscribe envelopes, preserves the HTTP GraphQL payload shape, types ordered protocol events, and closes on terminal server messages |
| Request continuity | Complete baseline | Resolved path/query rows, cookies, enabled headers, Basic/Bearer/API-key auth, and an existing OAuth 2 token reach the subscription handshake; Milestone 109 adds WSS validation/identity and Milestone 110 adds custom proxy/no-proxy continuity, while advanced signing remains open |
| Realtime UI and history | Complete baseline | GraphQL subscriptions use Connect/Disconnect, the realtime summary/console/headers/timeline, finite/zero/unlimited history, environment filtering, historical request restoration, filtering/search, clear-view, delete, and clear |
| Collection runner | Complete baseline | Operation-aware GraphQL subscriptions use the shared bounded stream sampler instead of being sent as ordinary HTTP |
| Workspace schema | Complete | Workspace v28 accepts bounded GraphQL stream sessions while retaining the existing validation and local-only history boundary |
| Executable coverage | Complete | Frontend operation/routing/history/storage tests and a real native `graphql-transport-ws` loopback verify subprotocol, init, ack, subscribe payload, next, complete, close, and session cleanup |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 108 verification](QA_MILESTONE_108.md) |

Compatibility bounds remain explicit: full GraphQL language-service validation/autocomplete, richer schema workflows, streaming plugin hooks, advanced signing, filesystem-backed event logs, PAC-authenticated system proxy discovery, and broad third-party fixtures remain open. Milestone 110 later closes custom proxy transport. Rendered interaction QA remains omitted by standing direction.

## Milestone 109 — WSS validation and scoped client identity (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia applies global certificate validation plus filtered client certificates to WSS, including GraphQL subscriptions, and supplies certificate/key pairs only for matching hosts |
| Effective validation | Complete | The existing global and per-request API validation resolver now reaches native WebSocket handshakes; the default/native-root path remains unchanged and Never uses a request-local Rustls verifier |
| PEM identity | Complete | Complete certificate chains and PKCS#1/PKCS#8/SEC1 keys parse in memory, are installed only for WSS, and reuse exact/wildcard/comma/newline domain matching from native HTTP |
| GraphQL continuity | Complete | GraphQL subscriptions use the same native WebSocket connector, so their converted WSS endpoint receives identical validation and identity behavior |
| Dependency boundary | Complete | Rustls, native roots, PKI types, and Tokio-Rustls become direct dependencies at versions already present in the lockfile; no remote runtime service or entitlement is introduced |
| Executable coverage | Complete | One real WSS loopback rejects an untrusted server under validation, proves a domain-mismatched identity is omitted and rejected by mTLS, then succeeds with validation disabled plus a matching client identity |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 109 verification](QA_MILESTONE_109.md) |

Compatibility bounds at Milestone 109 were explicit: custom WebSocket proxy transport, redirect-chain evidence, upstream filesystem-backed event/timeline logs, streaming plugin hooks, and broad third-party fixtures remained open. Milestone 110 closes the custom proxy gap and lets Socket.IO upgrade without losing proxy/client-identity/validation authority. The other bounds remain. Rendered interaction QA remains omitted by standing direction.

## Milestone 110 — custom WebSocket proxy transport (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned WebSocket and Socket.IO execution selects protocol-specific HTTP/HTTPS proxy agents, while GraphQL subscriptions share the WebSocket path |
| Shared connector | Complete | Direct and proxied sessions use one boxed async transport that composes proxy TLS, bounded CONNECT, target WSS, request-local validation, and scoped PEM identity without process-global state |
| Proxy policy | Complete baseline | Inherited manual, request-custom, and Direct modes reach WebSocket execution; HTTP/HTTPS proxy URLs, optional percent-decoded Basic credentials, default `http://` normalization, and exact/suffix/port/IP-CIDR no-proxy entries work |
| Protocol continuity | Complete | WebSocket, GraphQL subscription, and Socket.IO upgrade use the same connector; failed Socket.IO upgrades still retain the established polling fallback with an actionable note |
| Resource and error bounds | Complete | Proxy response headers stop at 64 KiB, only HTTP 200 establishes the tunnel, unsupported schemes and invalid credentials/statuses fail explicitly, and the effective request timeout bounds connect/TLS/tunnel/handshake phases |
| Executable coverage | Complete | Real loopbacks cover authenticated proxy routing to an otherwise unresolvable target, direct CIDR bypass, WSS-over-proxy mTLS, an untrusted HTTPS proxy under request-local Never validation, and polling-to-proxied-WebSocket Socket.IO upgrade |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 110 verification](QA_MILESTONE_110.md) |

Compatibility bounds at Milestone 110 were explicit: PAC-authenticated system proxy discovery, upstream filesystem-backed event/timeline streams, streaming plugin hooks, broad third-party proxy matrices, and exact upstream forward-proxy behavior for plain WS servers that reject CONNECT remained open. Milestone 111 closes the exact plain-WS request-form gap; the other bounds remain. Rendered interaction QA remains omitted by standing direction.

## Milestone 111 — exact plain-WS forward proxying (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia selects `http-proxy-agent` for plain WS; its pinned 7.0.2 implementation changes the client request path to an absolute `http://host[:port]/path?query` URI, injects configured Basic authorization, and adds `Proxy-Connection` when absent |
| Absolute request form | Complete | Brunomnia rewrites only Tungstenite's first generated request line, preserving its Host, upgrade, key, subprotocol, authored headers, and response verification unchanged |
| Async transport safety | Complete | The adapter maps partial proxy writes back to the original handshake buffer, refuses incomplete/non-GET input, delegates later WebSocket frames directly, and supports both plain and TLS-protected proxy connections |
| Authentication continuity | Complete | Percent-decoded URL Basic credentials override an authored proxy-authorization row like the pinned agent; an existing proxy-connection row is preserved and otherwise receives `Keep-Alive` |
| Protocol split | Complete | Plain WS and HTTP Socket.IO upgrades use forward-proxy form; WSS, GraphQL subscriptions, and HTTPS Socket.IO upgrades retain the bounded authenticated CONNECT plus nested TLS/identity path |
| Executable coverage | Complete | Real HTTP and HTTPS proxy endpoints parse and complete absolute-form WebSocket upgrades, Socket.IO proves polling-to-forwarded-upgrade continuity, WSS still asserts authenticated CONNECT/mTLS, and no-proxy bypass remains direct |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 111 verification](QA_MILESTONE_111.md) |

Compatibility bounds remain explicit: PAC-authenticated system proxy discovery, digest/NTLM proxy authentication, upstream filesystem-backed event/timeline streams, streaming plugin hooks, and broad third-party proxy matrices remain open. Rendered interaction QA remains omitted by standing direction.

## Milestone 112 — gRPC validation and scoped identity (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia passes `rejectUnauthorized` plus filtered PEM client certificate/key material into secure gRPC channel credentials and uses insecure credentials for plain gRPC |
| Effective validation | Complete | HTTPS gRPC channels resolve device/per-request API validation; Never installs the existing request-local Rustls verifier through Tonic's public custom-verifier API without global state |
| Scoped identity | Complete | Certificate/key pairing is validated only for secure endpoints, and identity attaches only when shared exact/wildcard/comma/newline/IPv6 domain matching selects the endpoint host |
| Native-root continuity | Complete | Validation-on channels with identity explicitly retain all enabled native roots; channels requiring no override keep Tonic's ordinary automatic TLS connector |
| Timeout and plaintext boundary | Complete | The effective timeout covers connection, RPC, response streams, and custom TLS handshakes; plain HTTP/2 endpoints neither parse nor attach TLS identity material |
| Executable coverage | Complete | A real sequential TLS server observes strict rejection of its untrusted certificate, mTLS rejection when the identity domain mismatches, and successful mTLS negotiation when it matches |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 112 verification](QA_MILESTONE_112.md) |

Compatibility bounds remain explicit: importable proto trees, custom CA/PFX identity, richer reflection/schema workflows, interactive streaming lifecycle controls, and broad third-party fixtures remain open. A later Milestone 117 audit confirms custom gRPC proxy transport is not present in the pinned upstream channel path. Rendered interaction QA remains omitted by standing direction.

## Milestone 113 — authored gRPC URL schemes (complete)

Brunomnia now accepts pinned-compatible `grpc://` and `grpcs://` endpoints, normalizes them internally to Tonic's HTTP/HTTPS schemes, preserves authority/path/query, and keeps the authored request URL unchanged. HTTP/HTTPS aliases continue to work, unsupported ambient schemes fail explicitly, and the secure classification feeds Milestone 112 validation/identity behavior. See [Milestone 113 verification](QA_MILESTONE_113.md).

## Milestone 114 — importable gRPC proto trees (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia stores imported proto files as a relative tree and materializes that tree in a temporary compilation directory so imports resolve without reading arbitrary ambient files |
| Persisted tree model | Complete | Workspace v29 stores bounded proto files plus active and compile-entry paths, synchronizes the entry source to legacy `protoText`, and migrates older single-source requests to `schema.proto` |
| File and folder authoring | Complete baseline | Requests can replace their tree from selected files or a directory, preserve nested paths after removing one common root, switch the edited file, and explicitly select the compiler entry |
| Dual-boundary validation | Complete | Renderer and Rust command reject absolute/traversing/non-proto/duplicate paths and enforce 500 files, 1 MiB per file, 10 MiB total, and 512-character relative paths |
| Native compilation | Complete | Tauri recreates only validated files below a fresh temporary root and opens the selected entry through Protox with imported descriptors and source information included |
| Executable coverage | Complete | Frontend tests cover path normalization, root stripping, entry choice, migration, and command payloads; native tests compile a real service importing messages from another folder and reject unsafe/duplicate paths |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 114 verification](QA_MILESTONE_114.md) |

Compatibility bounds remain explicit: custom CA/PFX identity, richer reflection/metadata/schema workflows, interactive streaming lifecycle controls, and broad third-party fixtures remain open. A later Milestone 117 audit confirms custom gRPC proxy transport is not present in the pinned upstream channel path. The gRPC ledger row stays Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 115 — workspace CA and PEM certificate manager (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia keeps one non-synced workspace CA record plus non-synced host-scoped client certificate records and passes selected PEM/CA material into HTTP, WebSocket, Socket.IO, authentication, and gRPC transports |
| Workspace manager | Complete baseline | Security & Sync imports/pastes, enables/disables, lists, and removes one CA plus up to 100 PEM certificate/key identities without an account or entitlement check |
| Selection behavior | Complete | Port-aware wildcard matches win first; hostname-only fallback runs only when no exact-port record matches, and request-local Transport PEM material remains an explicit override |
| Transport continuity | Complete | Shared frontend resolution reaches primary and secondary HTTP/GraphQL, OAuth, GraphQL introspection, WebSocket/subscriptions, Socket.IO, SSE, runners, plugins, integrations, and gRPC; native roots remain enabled alongside custom CA roots |
| Device-local persistence | Complete | Workspace v30 bounds malformed records, omits certificates from split-YAML/Git and encrypted-sync payloads, and restores current-device records after project reload or sync pull |
| Native safety | Complete | Renderer and IPC enforce 100-record, 5 MiB CA, and 1 MiB certificate/key limits; malformed PEM fails explicitly without process-global verifier changes |
| Executable coverage | Complete | Focused frontend tests cover matching, precedence, migration, local-only boundaries, and exact command payloads; real private-CA HTTP, WSS, and gRPC loopbacks prove native trust extension |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [security guide](SECURITY_AND_SYNC.md), [parity ledger](PARITY.md), and [Milestone 115 verification](QA_MILESTONE_115.md) |

Compatibility bounds remain explicit: PFX/PKCS#12 identities, certificate-path compatibility exports, richer gRPC metadata/schema workflows, and broad third-party certificate fixtures remain open. A later Milestone 117 audit confirms custom gRPC proxy transport is not present in the pinned upstream channel path. Related ledger rows stay Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 116 — PFX/PKCS#12 client identities (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia models PFX/PKCS#12 plus passphrase as the mutually exclusive alternative to PEM certificate/key paths and forwards the selected identity through HTTP, realtime, authentication, scripting, and gRPC transports |
| Workspace and request editors | Complete baseline | Workspace v31 and request-local Transport import binary `.p12`/`.pfx` bundles up to 5 MiB, mask passphrases, clear conflicting PEM material, retain port-first host matching, and introduce no account or entitlement gate |
| Native decoding | Complete | One pure-Rust resolver verifies base64/size/mutual-exclusion bounds, supports modern PBES2/PBKDF2/AES-256 and legacy PKCS#12 encryption, selects the first private-key chain, and emits request-local in-memory PEM for Reqwest, Rustls, and Tonic |
| Transport continuity | Complete | Workspace or request-local PFX identity reaches HTTP/GraphQL, OAuth/authentication, introspection, WebSocket/subscriptions, Socket.IO polling/upgrade, SSE, runners, plugins, integrations, and all secure gRPC operations |
| Script files | Complete baseline | Opt-in primary and secondary script requests accept `pfx.src`/`pfxPath` plus passphrase under the existing path allowlist, 5 MB per-file, 20-file, and 20 MB aggregate boundaries; the Worker receives only inert paths |
| Local and publication boundaries | Complete | Workspace PFX bytes/passphrases remain excluded from split-YAML/Git and encrypted-sync payloads while explicit Brunomnia JSON export includes them; request-local PFX secrets join the plaintext-publication guardrail |
| Executable coverage | Complete | Frontend tests cover matching, precedence, scripts, migration, persistence, explicit export, and publication checks; native tests decode modern/legacy and OpenSSL-produced bundles and complete real HTTPS, WSS, and gRPC mTLS handshakes |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [scripting](SCRIPTING.md), [security guide](SECURITY_AND_SYNC.md), [parity ledger](PARITY.md), and [Milestone 116 verification](QA_MILESTONE_116.md) |

Compatibility bounds remain explicit: certificate-path compatibility import/export, encrypted PEM-key passphrases, richer gRPC metadata/schema workflows, and broader third-party certificate fixtures remain open. Milestone 210 later adds request-scoped portable CLI PEM/PFX client-certificate transport. A later Milestone 117 audit confirms custom gRPC proxy transport is not present in the pinned upstream channel path. Related ledger rows stay Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 117 — interactive gRPC streaming lifecycle (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned `main/ipc/grpc.ts` keeps active calls in `grpcCalls`, exposes `start`/`sendMessage`/`commit`/`cancel`, forwards status/data/error/end events, and creates direct `@grpc/grpc-js` channels without a separate HTTP/HTTPS proxy agent |
| Persistent native sessions | Complete | Tauri owns up to 100 duplicate-safe sessions with 256-command queues, 1 MiB schema-validated messages, generation-safe cleanup, normal end, half-close, cancel, and close-all behavior |
| Call-shape coverage | Complete | Unary and server-streaming calls send their initial object at start; client and bidirectional streams accept independent messages and preserve incoming delivery after commit |
| Policy continuity | Complete | Interactive setup shares endpoint normalization, templated metadata, timeout, validation, workspace CA, and host/port-scoped PEM or PFX/PKCS#12 identity resolution with reflection and one-shot calls |
| Account-free editor | Complete baseline | Body controls expose Start, Send message, Commit, Cancel, Clear, state/call type, errors, and the newest 500 ordered events without login, organization, plan, or entitlement checks |
| Executable coverage | Complete | Renderer tests verify channel wiring, environment resolution, certificate payloads, and lifecycle commands; a real in-process HTTP/2 server verifies client-streaming aggregation, bidi replies, half-close, and cancel |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 117 verification](QA_MILESTONE_117.md) |

Compatibility bounds remain explicit: structured status fidelity, Buf Schema Registry reflection, reflected request examples, disable-user-agent behavior, richer connection-error guidance, and broader third-party fixtures remain open. Pinned Insomnia keeps call messages transient, so persisted gRPC call history is not a parity requirement. The gRPC ledger row stays Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 118 — structured gRPC status fidelity (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned renderer `GrpcRequestState` stores transient request/response messages plus `StatusObject` code/details/metadata and an error fallback; the response pane renders a numeric status tag and does not persist call history |
| Native status contract | Complete | Shared IPC events add optional numeric code, canonical name, details, and repeated metadata without changing WebSocket, Socket.IO, GraphQL subscription, or SSE event behavior |
| Metadata capture | Complete | Interactive calls merge at most 500 initial and trailing values, retain ASCII text, retain binary metadata's base64 wire representation, and attach error-status metadata before the ordered error/end events |
| Response presentation | Complete baseline | The gRPC console shows success/error status color, code/name, details, expandable metadata, and the original ordered status event while browser development emits the same shape |
| Executable coverage | Complete | A real Tonic server proves `0 OK` response metadata and `3 INVALID_ARGUMENT` details/error metadata; renderer tests prove structured channel fields survive ID normalization |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 118 verification](QA_MILESTONE_118.md) |

Compatibility bounds remain explicit: Buf Schema Registry reflection, reflected request examples, disable-user-agent behavior, richer connection-error guidance, and broader third-party fixtures remain open. Milestone 119 later closes request examples. The gRPC ledger row stays Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 119 — descriptor-generated gRPC request stubs (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned reflection walks protobuf request descriptors through `mockRequestMethods`, attaches one example to each reflected method, and enables an explicit button that replaces the current body |
| Descriptor generator | Complete | Rust emits valid protobuf JSON for strings/ID UUIDs, every numeric family, booleans, bytes, first enum values, nested messages, repeated fields, maps, JSON names, and one branch per oneof |
| Safety bounds | Complete | Generation stops after 500 fields or three recursive levels, truncates cycles to an empty object, and never executes schema code or reads filesystem paths |
| Schema continuity | Complete baseline | The schema IPC returns examples for reflection and imported proto trees; browser preview retains an empty compatible stub, and method changes expose the selected descriptor's example |
| Account-free authoring | Complete | **Use stub** replaces the body only after an explicit click and has no login, organization, plan, or entitlement check |
| Executable coverage | Complete | A native fixture asserts camel-cased JSON names, UUID IDs, nested/repeated/map/enum/bytes/oneof values, and recursive truncation |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 119 verification](QA_MILESTONE_119.md) |

Compatibility bounds remain explicit: Buf Schema Registry reflection, disable-user-agent behavior, richer connection-error guidance, and broader third-party fixtures remain open. The gRPC ledger row stays Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 120 — Buf Schema Registry reflection (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned `reflectionApi.enabled` means the Buf Schema Registry Connect API, not ordinary gRPC server reflection; URL, API key, module, and optional User-Agent suppression are request fields |
| Native registry transport | Complete | Binary Connect unary POST retrieves `FileDescriptorSet`, preserves request timeout/TLS/CA/PEM/PFX/proxy policy against the registry host, enforces HTTP/1.1 and a 10 MiB response ceiling, and maps 401/404 to focused guidance |
| Account-free editor | Complete | A third **Buf registry** source exposes templated URL/module/API key plus masked secret and disable-user-agent controls without login, organization, plan, or entitlement checks |
| Persistence and interchange | Complete | Workspace v32 bounds registry fields, scans plaintext keys before publication, and imports/exports the actual Insomnia v4/v5 reflection API semantics |
| Executable coverage | Complete | A real loopback server asserts binary protobuf fields, endpoint path, Connect/content headers, Bearer auth, User-Agent presence/absence, descriptor decoding, and 401/404 handling; renderer tests cover template and certificate routing |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 120 verification](QA_MILESTONE_120.md) |

Compatibility bounds remain explicit: richer gRPC connection-error guidance and broader third-party fixtures remain open. The gRPC ledger row stays Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 121 — actionable gRPC connection guidance (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned `ui/utils/grpc.ts` recognizes self-signed server chains, required client certificates, cancellation, wrong TLS version, invalid local roots, unsupported reflection, and unimplemented methods |
| Cross-runtime classification | Complete | One context-aware helper accepts upstream Node/grpc-js phrases plus Tonic/Rustls `UnknownIssuer`, `CertificateRequired`, and title-case status equivalents without broadly relabeling unknown failures |
| Schema-load presentation | Complete | Reflection failures use the focused title in the response summary and include explanation plus the exact native error in the response body |
| Live-call presentation | Complete | Start/send/commit/cancel catches and asynchronous native error events share multiline guidance while structured status events remain unchanged |
| Executable coverage | Complete | A table-driven renderer fixture covers all seven categories, reflection-versus-method disambiguation, and exact preservation of unrecognized errors |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 121 verification](QA_MILESTONE_121.md) |

Compatibility bounds remain explicit: broader third-party gRPC fixtures remain open. The gRPC ledger row stays Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 122 — gRPC reflection version compatibility (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Insomnia's lockfile pins `Kong/grpc-reflection-js` commit `f806b5a0dc2092b7a6fb54dfb66c38fb58231774`; its generated RPC path is explicitly `grpc.reflection.v1alpha` |
| Version negotiation | Complete | Ordinary reflection tries stable v1 first and falls back to v1alpha only when the transport status or protocol error response is code 12/`UNIMPLEMENTED` |
| Policy continuity | Complete | Both versions reuse one endpoint/channel, metadata, timeout, validation, CA, and domain-scoped PEM/PFX identity configuration |
| Descriptor continuity | Complete | Service filtering, per-symbol requests, duplicate file suppression, response validation, descriptor decoding, request stubs, and size limits are version-independent |
| Executable coverage | Complete | Real v1 and v1alpha-only Tonic servers advertise the same descriptor set; both load the expected service and return reusable encoded descriptors |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 122 verification](QA_MILESTONE_122.md) |

Compatibility bounds remain explicit: a live external third-party gRPC server matrix remains open. The gRPC ledger row stays Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 123 — Insomnia gRPC proto-resource interchange (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | `ProtoFile` stores name/text, `ProtoDirectory` stores name, v4 resources export both model types, and the recursive writer excludes the synthetic root name from relative import paths |
| V4 import | Complete | Referenced entry ancestry must terminate at the same workspace; only files below its root are reconstructed with sanitized relative paths and shared proto-tree limits |
| V4 export | Complete | Every proto-backed request receives deterministic root/subdirectory/file resources and a `protoFileId` that resolves to its compile entry |
| V5 boundary | Complete | Current v5 YAML carries only a database ID and no proto contents; import/export warn explicitly, preserve the unavailable ID as metadata, and do not claim a working source |
| Executable coverage | Complete | A nested two-file tree with a cross-directory import round-trips through JSON resources with exact paths/text/entry; v5 import and export warnings are asserted |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 123 verification](QA_MILESTONE_123.md) |

Compatibility bounds remain explicit: Insomnia v5 cannot carry its database-backed proto contents in collection YAML. Other import/export gaps remain in the ledger, and rendered interaction QA remains omitted by standing direction.

## Milestone 124 — default User-Agent policy parity (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned rendering computes suppression from the top-level request flag or an authored set whose User-Agent rows are all disabled; native HTTP/realtime transports add `insomnia/<version>` only when no authored row exists |
| Shared request model | Complete | Workspace v33 moves the legacy nested gRPC field to top-level `disableUserAgentHeader`, removes the stale nested value, and preserves explicit opt-out across local, project, catalog, history, and import paths |
| HTTP and CLI execution | Complete | Native Tauri and Node CLI HTTP/GraphQL sends add `brunomnia/0.1.0` by default, retain enabled custom values, and suppress the default for either explicit opt-out or disabled authored rows; browser Fetch remains untouched |
| Realtime execution | Complete | WebSocket, GraphQL subscription, SSE, and Socket.IO polling/upgrade inputs share the same policy without adding plugin hook behavior absent from pinned Insomnia |
| Account-free authoring | Complete | Regular edit exposes the read-only default toggle, bulk edit remains authored text only, and deleting the last authored User-Agent through either mode enables suppression rather than silently restoring the product header |
| Interchange | Complete | Insomnia v4/v5 import/export preserves the request-level field for ordinary, WebSocket, Socket.IO, and gRPC resources, and Buf reflection reads the same field |
| Executable coverage | Complete | Focused helper, native HTTP, browser exclusion, all four realtime routes, gRPC, migration, and v4/v5 round-trip regressions cover default/custom/disabled/removed cases |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 124 verification](QA_MILESTONE_124.md) |

Compatibility bounds remain explicit: browser Fetch controls its own User-Agent, as required by the web platform. Pinned Insomnia realtime connect routes bypass plugin request/response hooks, so streaming hooks are not a parity requirement. Ledger rows stay Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 125 — calculated HTTP Accept and Host headers (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned regular HTTP headers show read-only `Accept: */*`, calculated Host, and conditional User-Agent rows; bulk returns authored enabled text before rendering any calculated rows |
| Default Accept execution | Complete | Native Tauri and CLI HTTP/GraphQL sends add `Accept: */*` only when no enabled authored Accept exists, preserving custom, empty, and disabled-row semantics |
| Calculated Host presentation | Complete | Regular HTTP/GraphQL authoring shows the runtime-calculated Host placeholder without persisting or overriding transport URL authority |
| Bulk/editor continuity | Complete | Calculated rows never enter bulk text or authored request state; final User-Agent removal still writes request-level suppression in either editor mode |
| Browser boundary | Complete | Browser Fetch retains its browser-managed Accept behavior and receives no synthetic JavaScript header |
| Executable coverage | Complete | Pure calculated-row/default tests plus native HTTP and browser exclusions cover absent, enabled, disabled, custom, protocol, and non-mutation cases |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 125 verification](QA_MILESTONE_125.md) |

Compatibility bounds remain explicit: WebSocket and Socket.IO calculated handshake rows require transport-level extension parity before they can be claimed. Ledger rows stay Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 126 — local client-code target expansion (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia depends on HTTPSnippet 3.0.10, exposes every package target and client in its Generate Client Code modal, selects each target's declared default client, persists the last choice locally, and generates through main-process HAR conversion |
| Target-family expansion | Complete baseline | Node.js native HTTP, PHP cURL, Ruby `Net::HTTP`, Swift `URLSession`, and Rust Reqwest join the existing six selected clients, representing eleven of the pinned package's twenty target families |
| Request fidelity | Complete | Every added emitter consumes the same inherited/environment-resolved URL, method, headers, supported static authentication, body, warnings, multipart framing, and binary MIME policy as the existing emitters |
| Exact payload bytes | Complete | Added clients encode text from exact UTF-8 bytes and reuse materialized multipart/binary Base64, with in-memory decoding and no source-path dependency |
| Escaping and syntax evidence | Complete baseline | Node/Swift use JSON literals, PHP/Ruby use escaped single-quoted literals, and Rust chooses collision-safe raw-string delimiters; generated fixtures pass available Node, Ruby, Swift, and Rust parsers while PHP remains unavailable locally |
| Account-free presentation | Complete | The existing local Code dialog enumerates the expanded target list automatically with no login, organization, plan, telemetry, hosted conversion, or entitlement check |
| Executable coverage | Complete | Stable target order, all-target generation, exact UTF-8 body bytes, escaped metadata, exact multipart/binary identity, malformed-file warnings, and four target-language parser checks pass |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 126 verification](QA_MILESTONE_126.md) |

Compatibility bounds remain explicit: Milestone 127 later closes the nine-family gap, while alternate clients remain open alongside runtime-only advanced signing, dependency installation, comprehensive target-language validation, and generated-code execution. The Client code generation ledger row stays Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 127 — complete HTTPSnippet target-family coverage (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | HTTPSnippet 3.0.10 registers twenty target families in a deterministic order; eight remaining families declare one functional default client, while HTTP declares default key `1.1` but registers only client key `http1.1`, which makes pinned Insomnia's default lookup fail for that target |
| Family coverage | Complete baseline | C libcurl, Clojure clj-http, Crystal native, HTTP/1.1, Kotlin OkHttp, Objective-C NSURLSession, OCaml CoHTTP, PowerShell Invoke-WebRequest, and R httr complete one selected client for every pinned target family in registry order |
| Request fidelity | Complete | Every new emitter consumes the shared inherited/environment-resolved method, URL, headers, supported static authentication, body, MIME, warning, and exact multipart materialization contract |
| Executable byte fidelity | Complete | C emits bounded hexadecimal arrays, OCaml emits byte-exact decimal escapes, and Clojure/Crystal/Kotlin/Objective-C/PowerShell/R decode the same UTF-8 or multipart/binary Base64 bytes in memory |
| Raw HTTP representation | Complete baseline | HTTP/1.1 emits CRLF origin-form requests with calculated Host and UTF-8 Content-Length; arbitrary bytes remain exact Base64 with an explicit warning because a Unicode text preview cannot directly carry every octet |
| Account-free presentation | Complete | The local Code dialog exposes all twenty families with no login, organization, plan, telemetry, hosted conversion, or entitlement check |
| Executable coverage | Complete | Stable pinned-family ordering, custom methods, resolved URLs, exact multipart/binary/UTF-8 bytes, MIME, escaped metadata, raw HTTP framing/warnings, and available C/Objective-C parser checks pass |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 127 verification](QA_MILESTONE_127.md) |

Compatibility bounds remain explicit: Milestone 128 later closes HTTPSnippet's alternate-client and two-level persisted-selection gaps. Runtime-only advanced signing, per-client formatting/transport options, dependency installation, comprehensive target-language validation, and generated-code execution remain open. The Client code generation ledger row stays Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 128 — full HTTPSnippet client matrix (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned HTTPSnippet 3.0.10 exposes thirty-nine clients across twenty ordered families; Insomnia shows separate target/client dropdowns, changes families to the declared default client, stores both choices locally, and defaults initially to Shell/cURL |
| Full client registry | Complete baseline | Nineteen alternate clients complete the exact family/client key and order matrix alongside the existing twenty selected clients, including RestSharp, Java/JavaScript/Node variants, Guzzle/pecl-http, Invoke-RestMethod, Python `http.client`, Faraday, HTTPie, and Wget |
| Picker parity | Complete | The local dialog has separate Target and Client selectors, declared-default switching, Shell/cURL initial fallback, invalid saved selection recovery, and device-local target/client persistence |
| Request fidelity | Complete | Every alternate consumes the same inherited/environment-resolved method, URL, headers, supported static authentication, MIME, warnings, and exact UTF-8/multipart/binary payload contract |
| Explicit client limits | Complete | RestSharp and Faraday emit focused unsupported-method output plus warnings for methods outside their pinned client sets; raw HTTP retains its decode-before-send binary warning |
| Account-free presentation | Complete | Every target and client is local and available without login, organization, plan, telemetry, hosted conversion, or entitlement checks |
| Executable coverage | Complete | Exact registry/default order, saved-selection resolution, all-client request generation, exact payload identity, alternate-client markers, and available JavaScript/Node/Python/Ruby/Shell parser checks pass |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 128 verification](QA_MILESTONE_128.md) |

Compatibility bounds remain explicit: the pinned modal does not pass per-client converter options, install dependencies, validate target programs, or execute snippets, so those are not parity requirements. Milestone 129 later closes OAuth 1/Hawk/ASAP materialization. Request-plugin hooks, cookie-jar inclusion, and Node native Content-Length remain open. The Client code generation ledger row stays Baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 129 — generated advanced-auth materialization (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned export renders the request, applies request plugins, parses GraphQL, and builds HAR; absent authored Authorization is filled for API key, Basic, Bearer, OAuth 2, OAuth 1, Hawk, or ASAP, while IAM/Digest/NTLM/Netrc remain outside this static-header path |
| OAuth 1 and Hawk | Complete | The async preview reuses the shared signing engine against the exact prepared URL, headers, and text/form/GraphQL body, then regenerates any selected client without retaining the prior omission warning |
| Atlassian ASAP | Complete | PKCS#8 RS256 JWT generation carries issuer/audience/subject/key ID/additional claims, generated ID, and the pinned ten-minute expiry shared by runtime sends and generated snippets |
| Header precedence | Complete | Any authored case-insensitive Authorization header suppresses automatic signing and remains unchanged, matching pinned HAR export |
| OAuth 2 correction | Complete | `NO_PREFIX` emits the raw saved access token rather than the literal prefix string |
| Async presentation | Complete baseline | Target changes show an immediate local preview, replace it with signed output when ready, ignore stale completions, and surface signing failures as visible warnings without sending a request |
| Executable coverage | Complete | Deterministic OAuth 1 and Hawk fixtures, generated-key ASAP claims, authored precedence, OAuth 2 raw-token behavior, and full client-code regressions pass |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 129 verification](QA_MILESTONE_129.md) |

Compatibility bounds remain explicit: Milestone 130 later closes request-plugin hooks, cookie-jar inclusion, and Node native Content-Length injection. The Client code generation ledger row stays Baseline at this milestone, and rendered interaction QA remains omitted by standing direction.

## Milestone 130 — complete generated-request preparation (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia renders the inherited request and cookie jar, applies request hooks, parses GraphQL, optionally adds Content-Length only for Node native, materializes static auth when no authored Authorization exists, and converts HAR locally |
| Shared rendering order | Complete | Client-code generation and live HTTP now share one full request renderer for environment, response, cookie, dynamic, plugin, and approved external-vault tags; generation runs request hooks only after rendering, matching pinned export order |
| Request plugins | Complete | Every async preview executes enabled request hooks with existing explicit grants, preserves plugin-local store changes, exposes notifications as review warnings, ignores stale preview completion, and never sends the generated request itself |
| Cookie jar | Complete | Matching non-expired path/domain/secure cookies are included only when request cookie sending is enabled; pinned URI encoding is preserved and an authored Cookie header remains authoritative |
| Node native length | Complete | Only the Node native target receives an automatic Content-Length, calculated from exact prepared UTF-8 or binary bytes including zero-length requests, without replacing an authored case-insensitive header |
| Executable coverage | Complete | Full template-before-hook ordering, hook mutations, matching/nonmatching cookies, authored Cookie precedence, Node-only UTF-8 length, authored length precedence, advanced auth, and all-client regressions pass |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 130 verification](QA_MILESTONE_130.md); the Client code generation row is Complete |

Compatibility bounds remain explicit: Digest, NTLM, Netrc, and IAM remain transport/challenge-managed rather than static HAR Authorization headers. Pinned Insomnia does not expose converter options, dependency installation, target-program validation, or snippet execution, so those are not parity requirements. Other ledger rows remain Baseline or Early baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 131 — complete dynamic variables and guided tags (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned Insomnia uses `@faker-js/faker` 9.7 for 118 named generators, JSONPath Plus 10.x with its safe evaluator, mediated UTF-8 File reads, local/external/plugin tags, and guided tag definitions rather than handwritten approximations |
| Exact Faker engine | Complete | The shared renderer lazily loads Faker 9.7 and maps all 118 pinned names to the same modules/functions, preserving output categories, locale corpus, distributions, image strings, and date behavior without network calls |
| Full JSONPath Plus | Complete | Dynamic tags, stored-response chaining, and response-preview filters use JSONPath Plus 10.4 safe predicates, unions, slices, recursive descent, type selectors, and expressions; tags select the first match while previews retain every match |
| Confined File tags | Complete | Desktop File tags reuse the off-by-default file grant, canonical allowed roots, symlink/traversal rejection, regular-file checks, 5 MB bound, and UTF-8 decoding across primary/plugin/integration sends, OAuth/schema traffic, collection runs, and generated code |
| Guided builder | Complete | The account-free Tags dialog builds fourteen built-in/external families and appends or replaces compatible syntax across names/values for HTTP, WebSocket, Socket.IO, Buf registry, and gRPC execution fields |
| Shared safety | Complete | Concurrent field rendering uses independent parser state; JSONPath expressions use the package safe evaluator, File access exposes one mediated read callback, and browser/ungranted/out-of-root access fails explicitly |
| Executable coverage | Complete | All 118 Faker functions, advanced JSONPath selectors/failures, Base64 variants, timestamp aliases, explicit cookie URLs, File mediation, concurrent raw tags, destination enumeration/insertion, and shared HTTP/code-generation regressions pass |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [security boundaries](SECURITY_AND_SYNC.md), [parity ledger](PARITY.md), and [Milestone 131 verification](QA_MILESTONE_131.md); the dynamic-variables row is Complete |

Compatibility bounds remain explicit: desktop File tags inherit the existing 5 MB approved-root safety ceiling. Milestone 133 later closes the missed pinned timestamp/OS/hash/prompt/request/response plus gRPC/realtime rendering gaps, and Milestone 134 later adds separately granted portable CLI File/external-vault rendering. Other ledger rows remain Baseline or Early baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 132 — close gRPC endpoint and live-server parity (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Current upstream audit | Complete | Pinned `parseGrpcUrl` treats a scheme-less host as plaintext, preserves `unix:` targets, recognizes `grpc:`/`grpcs:`, and current Kong documentation uses public plaintext/TLS `grpcb.in` examples for all four call shapes |
| Endpoint grammar | Complete | Scheme-less `host:port`, `grpc:`, `grpcs:`, `http:`, and `https:` inputs normalize to the correct Tonic authority and TLS mode |
| Unix-domain sockets | Complete | Unix desktop builds connect absolute `unix:` paths through Tonic's HTTP/2 connector, with a real local reflection server proving descriptor discovery |
| Default TLS | Complete | Every secure channel installs Tonic native roots even when no custom CA or client identity is selected; custom trust, identity, and request-local Never behavior remain layered on that path |
| Official external matrix | Complete | The opt-in native test passes reflection and unary calls on `grpcb.in:9000` plus trusted TLS reflection, unary, server-streaming, client-streaming, and bidirectional calls on `grpcs://grpcb.in:9001` |
| Executable coverage | Complete | Local endpoint normalization, modern/v1alpha reflection, Unix reflection, custom CA/mTLS/validation, all call lifecycles, and the ignored-by-default public matrix cover every claimed path |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 132 verification](QA_MILESTONE_132.md); the gRPC row is Complete |

Compatibility bounds remain explicit: the public matrix is opt-in so ordinary offline test runs remain deterministic. Pinned Insomnia keeps gRPC messages transient and does not install its HTTP/HTTPS proxy agent on gRPC channels, so persisted call history and custom gRPC proxying are not parity requirements. Other ledger rows remain Baseline or Early baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 133 — exact local template-tag correction (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Corrective upstream audit | Complete | A second pass over pinned `local-template-tags.ts`, realtime interpolation, and gRPC send paths found behavior omitted by Milestone 131: date-fns custom formats, the full OS contract, MD5, six prompt arguments, broad request fields, raw/XPath/large-integer/multi-result response extraction, resend rules, and non-HTTP rendering |
| Exact local engines | Complete | date-fns 3.6, JSON BigInt 1.0, XPath 0.0.34, a patched non-vulnerable XML DOM, Web Crypto SHA, js-md5, and a native seven-function OS bridge reproduce the observable pinned contracts without hosted services |
| Prompt and response behavior | Complete | A queued masked dialog supports preview defaults, explicit/implicit storage keys, save-last-value behavior, request-scoped clearing, active-environment response selection, raw/header/url/body fields, JSONPath/XPath, preserved large integers, multiple JSONPath results, and guarded dependent resends |
| Protocol propagation | Complete | Direct gRPC schema/call/session messages and WebSocket, GraphQL subscription, SSE, and Socket.IO connection/outbound paths now use the same async renderer as HTTP, including runner execution and mediated File/external secrets |
| Guided builder | Complete | OS, MD5, custom time, six prompt arguments, complete request/response controls, realtime payload/listener fields, and Buf registry fields form fourteen account-free families and destinations |
| Dependency safety | Complete | Production dependency audit reports no known vulnerabilities; the XML DOM uses patched 0.8.13 instead of vulnerable pinned 0.9.8/0.8.11 releases while preserving the required DOM/XPath behavior |
| Executable coverage | Complete | Focused TypeScript tests cover exact local behavior, dependent-response environment filtering, async direct gRPC, all realtime connection families, Socket.IO emits, and guided destinations; native coverage verifies the OS bridge |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), corrected [Milestone 131 verification](QA_MILESTONE_131.md), and added [Milestone 133 verification](QA_MILESTONE_133.md) |

Compatibility bounds remain explicit: desktop File tags retain approved-root mediation; Milestone 134 later gives trusted portable CLI runs separate process-only File/external-vault grants. The XML DOM version intentionally differs from vulnerable pinned transitive choices without changing claimed XPath behavior. Other ledger rows remain Baseline or Early baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 134 — portable CLI template parity (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned headless audit | Complete | Pinned Inso loads an in-memory database, runs pre-request scripts, interpolates the mutated request for send, skips request plugins, executes transport, transforms the response, and runs after-response scripts; its CLI accepts data-folder and transport overrides at invocation time |
| Shared async rendering | Complete | Brunomnia CLI HTTP/GraphQL execution now uses the same full request renderer as desktop execution for environment/Faker/UUID/time/OS/Base64/hash/JSONPath/cookie/request/response/File/external values before URL construction and transport policy checks |
| Trusted File authority | Complete | `--allow-template-files` enables 5 MB UTF-8 reads for paths under invocation-only `-f`/`--dataFolders` roots; the broader `--allow-script-files` authority implies it, canonical containment rejects traversal/symlink escapes, and imported workspace data cannot enable flags or roots |
| External-vault adapters | Complete | `--allow-external-vaults` gates exact workspace-allowlisted AWS/GCP/Azure/HashiCorp references through direct official-CLI argument arrays, 30-second/10 MB process bounds, strict output parsing, and a 20 MB/256-entry in-memory cache |
| Response and cookie continuity | Complete | CLI sends inject eligible cookies, retain Set-Cookie mutations, execute response-tag dependencies with recursion guards, and return the just-created response even when the configured saved-history limit is zero |
| Rendered transport policy | Complete | Workspace certificate matching and the original Node Fetch transport-policy refusals occur after full URL rendering; Milestone 210 later replaces those refusals with request-scoped proxy/TLS/identity dispatchers |
| Executable coverage | Complete | Pure adapter tests cover arguments, approval, parsing, UTF-8 rejection, caching, and aggregate eviction; a bundled localhost-only smoke proves default/rootless denial, outside-root and symlink rejection, valid template/script reads, Node OS/hash/custom time, zero-history dependent response execution, and cookie continuity |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [security boundaries](SECURITY_AND_SYNC.md), [parity ledger](PARITY.md), CLI README guidance, and [Milestone 134 verification](QA_MILESTONE_134.md) |

Compatibility bounds at this milestone were explicit: the CLI remained a `Baseline` capability. Interactive prompt tags, desktop-local `vault.*` state, plugin-provided tags, streaming protocols, Inso commands/configuration flags, signed containers, and stronger portable script isolation were open. Milestone 210 later closes request-scoped insecure TLS, custom CA, client identity, and explicit proxy transport; Milestone 222 confirms the pinned user-facing command/flag inventory and shared global-option behavior; Milestone 223 adds the digest-pinned non-root multi-architecture container and keyless signing workflow; Milestone 224 verifies the first GHCR digest and Sigstore identity; Milestone 225 adds explicit-grant stored-plugin tags in resource-limited Node workers; Milestone 226 adds pinned Cosmiconfig executable formats behind a separate grant in resource-limited workers. External providers require the corresponding installed official CLI and ambient credential chain; no real provider credentials are used in automated tests. Other ledger rows remain Baseline or Early baseline, and rendered interaction QA remains omitted by standing direction.

## Milestone 135 — complete GraphQL authoring parity (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned upstream audit | Complete | Pinned Insomnia uses GraphQL 16.10, CodeMirror GraphQL language tooling, parsed operation selection, typed variables, remote/automatic introspection, an input-value deprecation toggle, local introspection JSON import, and searchable navigable schema documentation |
| Exact language engines | Complete | GraphQL 16.10 and `graphql-language-service` 5.5 provide AST formatting/selection, line-column diagnostics, nested schema validation, completion, hover, and selected-operation variable coercion rather than handwritten approximations |
| Operation and editor workflow | Complete | Parsed named-operation choices follow document edits and cursor position; multi-operation documents require a selection, completion replaces only the active token with keyboard/pointer control, and query template syntax remains literal |
| Schema acquisition | Complete | Rendered authenticated remote fetch/refresh, automatic URL/deprecation refresh, standard 20 MB introspection JSON import, local-schema persistence, input-value deprecation queries, and in-editor acquisition failures cover the pinned workflows |
| Complete normalized model | Complete | Bounded caches retain roots, directives, descriptions, full type references, interfaces, possible types, input/enum/default/deprecation/one-of metadata, and scalar specification URLs; workspace v34 marks older partial remote caches stale |
| Documentation explorer | Complete | Root insertion, schema-wide type/field search, object/interface/union/input/enum navigation, argument signatures, deprecation display, directive listing, and validated external scalar links remain local and account-free |
| Executable coverage | Complete | GraphQL tests cover complete introspection reconstruction, nested diagnostics, typed variables, completion/hover/search, import/query toggles, formatting, operation parsing/cursor selection, insertion, subscription routing, and pure completion insertion |
| Documentation and evidence | Complete | Updated [GraphQL/preferences](GRAPHQL_AND_PREFERENCES.md), [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), and [Milestone 135 verification](QA_MILESTONE_135.md); the GraphQL row is Complete |

Compatibility bounds remain explicit: introspection/imports and normalized schema collections have documented local resource ceilings, remote introspection deliberately disables redirects and cookie storage, and GraphQL query text remains literal while variables support templates. These safeguards do not remove a pinned authoring workflow or introduce an entitlement. The GraphQL ledger row is Complete; 23 rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction QA remains omitted by standing direction.

## Milestone 136 — complete SSE and shared realtime event inspection (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned realtime audit | Complete | Pinned WebSocket, Socket.IO, GraphQL-subscription, and Event Stream responses share response history, NDJSON-backed event retrieval, event selection, message detail, Friendly/Source/Raw preview, raw copy/export, search, type filtering except cURL Event Stream, clear-view, headers/cookies, and timeline presentation |
| Selectable event detail | Complete | Incoming/outgoing rows now open a bounded detail pane while open/error/close/informational rows retain their effective list-only behavior; selection clears on session changes or retention eviction |
| Preview and Socket.IO arguments | Complete | The existing request-persistent Friendly/Source/Raw choice pretty-prints valid JSON or preserves source text, and Socket.IO Friendly mode exposes up to 100 ordered arguments separately |
| Copy and exact export | Complete | Raw copy uses the unformatted message text; text and JSON export preserve authored bytes, while WebSocket binary Base64 is decoded back to exact bytes with a deterministic safe filename |
| Compact event list | Complete | Rows show bounded one-line summaries and binary byte counts rather than rendering up to 1 MiB of message data in every list entry; the complete selected message remains inspectable |
| Storage equivalence | Complete | Pinned response models point to NDJSON event/timeline files; Brunomnia persists the same bounded values directly in device-local project data, preserving incremental updates, history selection, filtering, deletion, clearing, and reload without making an Electron path user-visible |
| SSE lifecycle | Complete | Existing native parsing, retry hints, event IDs, `Last-Event-ID`, bounded/unlimited reconnect, explicit cancellation, metadata/timeline/history, runner sampling, and real loopback evidence combine with the completed shared response pane |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), README, and [Milestone 136 verification](QA_MILESTONE_136.md); the Server-Sent Events row is Complete |

Compatibility bounds remain explicit: stream sessions retain the newest 5,000 events and about five million text characters, migration caps each loaded message at 1,048,576 characters, and per-message export is not misrepresented as a whole-log export. Inline local persistence differs from pinned NDJSON only below the user-visible response model. The Server-Sent Events row is Complete; WebSocket and Socket.IO remain `Baseline` because PAC-authenticated system proxy discovery is still open. Twenty-two parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction QA remains omitted by standing direction.

## Milestone 137 — complete WebSocket redirect and proxy parity (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Corrective pinned proxy audit | Complete | Pinned WebSocket uses explicit manual HTTP/HTTPS proxy agents only when global proxying and request proxy use are enabled; pinned Socket.IO uses them only when global proxying is enabled. Neither path resolves Electron PAC/system proxies, so the prior ledger gap was false |
| Redirect policy | Complete | Native WebSocket and GraphQL-subscription upgrades now honor effective follow/off policy plus zero, finite, and unlimited maximums; the same connector covers Socket.IO WebSocket upgrade attempts |
| Redirect locations | Complete | Relative and absolute WS(S) `Location` values resolve against the current hop; missing, malformed, non-UTF-8, or non-WS(S) locations fail explicitly without scheme downgrades by accident |
| Header safety | Complete | Every hop regenerates Connection/Upgrade/version/key headers and retains same-origin authored headers; a scheme, hostname, or effective-port change strips Host, Authorization, and Cookie so the target authority is regenerated safely |
| Per-hop transport policy | Complete | Each target rebuild re-applies direct/manual/custom HTTP or HTTPS proxy selection, Basic proxy credentials, no-proxy matching, WSS validation, workspace CA, and domain-scoped PEM/PFX identity |
| Executable redirect evidence | Complete | Loopback tests prove relative redirects, fresh handshake keys, same-origin header retention, cross-origin credential stripping, disabled redirects, and zero/finite/unlimited limit decisions |
| Existing WebSocket surface | Complete | Exact text/binary frames, subprotocols, GraphQL subscriptions, proxy/TLS/client identity, event/history/timeline metadata, runner sampling, selection/filter/search/clear, Friendly/Source/Raw preview, copy, export, delete, and clear remain account-free |
| Documentation and evidence | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), README, and [Milestone 137 verification](QA_MILESTONE_137.md); the WebSocket row is Complete |

Compatibility bounds remain explicit: `-1` is an iterative no-ceiling redirect mode, each handshake/proxy/TLS operation retains the configured per-hop timeout, and redirects accept only WS(S). Pinned realtime proxy code is manual/direct rather than PAC-aware. Socket.IO stays `Baseline` because its default automatic reconnection after transient Engine.IO loss remains open; initial connect errors and explicit disconnects are not treated as reconnectable. The WebSocket row is Complete; 21 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction QA remains omitted by standing direction.

## Milestone 138 — complete Socket.IO reconnection parity (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Persistent session ownership | Complete | One native task now retains the command channel, active listeners, acknowledgement sequence, and offline emit queue across replacement Engine.IO transports |
| Transient failure classification | Complete | Post-connect Engine.IO close, WebSocket close/error/end, polling failure/end, heartbeat-send failure, and emit transport failure enter reconnect; namespace disconnect, malformed/oversized data, initial failure, and explicit stop remain terminal |
| Default reconnect policy | Complete | Attempts are unlimited, use Socket.IO-compatible randomized exponential delays beginning at 500–1,500 ms, and cap at five seconds |
| Fresh negotiation | Complete | Every attempt obtains a new Engine.IO session, rejoins the namespace, retries an advertised WebSocket upgrade, and can recover through polling fallback while preserving rendered request/auth/proxy/redirect/TLS/identity policy |
| Offline continuity | Complete | Listener additions/removals apply during delay or handshake; emits requested offline queue in order and flush after reopen, while already-sent events and obsolete acknowledgements are not duplicated |
| Cancellation and evidence | Complete | Explicit disconnect cancels delay or negotiation, removes the live-session handle, and retains close/reconnecting/error/open/upgrade/closed evidence in the existing account-free history/timeline surface |
| Executable recovery evidence | Complete | A real polling server ends the first Engine.IO session, accepts a fresh session and namespace, receives an emit queued offline, and proves an offline listener swap before explicit disconnect |
| Documentation and ledger | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), README, and [Milestone 138 verification](QA_MILESTONE_138.md); the Socket.IO row is Complete |

Compatibility bounds remain explicit: the backoff is bounded in time per attempt but has no attempt ceiling, queued emits are memory-resident for the live session, and no event already handed to the failed transport is replayed. Reconnect reuses the initially rendered values, matching the pinned client's fixed connection options; it does not rerun templates or plugin hooks. The Socket.IO row is Complete; 20 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction QA remains omitted by standing direction.

## Milestone 139 — complete request-body parity (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Raw MIME authoring | Complete | JSON and text bodies now expose an editable MIME control with pinned JSON/XML/YAML/EDN/Plain Text suggestions, arbitrary values, synchronized Content-Type, and mode-safe stale-header replacement |
| URL-encoded fidelity | Complete | Native and browser paths preserve enabled order, repeated names, empty names, empty values, percent encoding, and disabled-row omission |
| Multipart row inclusion | Complete | Completely blank enabled rows are skipped like pinned multipart construction, while empty-name rows carrying text or file values remain valid and ordered |
| Multipart metadata and bytes | Complete | One-line/multiline text MIME, edited file names/types, duplicate names, generated boundaries, and exact binary bytes remain covered by native loopback plus browser/editor/interchange tests |
| File safety boundary | Complete | Pinned reusable absolute paths are represented by user-approved persisted bytes, preserving the send/export/generation action without ambient future filesystem reads |
| Cross-surface behavior | Complete | Direct native/browser sends, runners, CLI, scripts/plugins, imports/exports, and generated clients retain the applicable body rendering, ordering, metadata, and exact-byte contract |
| Documentation and ledger | Complete | Updated [request authoring](REQUEST_AUTHORING.md), [parity ledger](PARITY.md), README, and [Milestone 139 verification](QA_MILESTONE_139.md); Request bodies is Complete |

Compatibility bounds remain explicit: browser development's `FormData` cannot attach a custom MIME type to a text part without fabricating file disposition, so only packaged/native and portable generated execution claim that metadata. Approved bytes replace reusable filesystem paths by design. Neither difference omits a packaged Tauri user action. The Request bodies row is Complete; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction QA remains omitted by standing direction.

## Milestone 140 — expand Konnect protocol mapping parity (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Corrective pinned capability audit | Complete | Pinned Konnect is pull-only and explicitly skips SNI plus L4 protocols; bidirectional writes and SNI/TCP/UDP execution are removed as false parity requirements |
| HTTP route expansion | Complete | Every supported HTTP/HTTPS protocol, path, and valid custom/default method combination receives a stable request instead of collapsing each route to one GET/path |
| WebSocket and gRPC routes | Complete | WS/WSS paths map to WebSocket requests; gRPC/GRPCS paths map to gRPC requests with service/method and route metadata |
| Regex paths | Complete | Named and unnamed regex segments become bounded editable `{path}` rows; unresolved complex patterns receive one explicit fallback parameter |
| Safe remote fields | Complete | Nested Liquid/template syntax is stripped from names, paths, methods, hosts, headers, expressions, and protocol fields before local rendering can see them |
| Managed/local merge | Complete | Stable deduplicated combination keys replace remote-managed URL/path/header/metadata state, remove stale managed fields, preserve user values for surviving path parameters, retain local request behavior, and keep collection hierarchy/environment/documentation state |
| Explicit skipped routes | Complete | Missing-service, expression-router, SNI, and L4 routes remain inspectable with source-backed reasons rather than becoming misleading HTTP requests |
| Executable mapping evidence | Complete | Focused tests cover 12 HTTP/WS/gRPC combinations, protocol proxy defaults, regex parameters, sanitization, three skip classes, legacy local and collection preservation, duplicate-key defense, and gRPC stale-metadata replacement |

Compatibility bounds at this milestone remain explicit: Brunomnia still pulls one selected control plane into the current project rather than reconciling every control plane into typed projects/workspaces. Milestone 140 uses reviewable protocol-specific loopback proxy defaults and defers control-plane `proxy_urls` retention to Milestone 141. Automatic route-folder hierarchy, reviewed expression-router conversion, and a credentialed live-tenant fixture remain open. Service integrations stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction QA remains omitted by standing direction.

## Milestone 141 — Konnect control-plane proxy defaults (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Control-plane discovery model | Complete | Bounded HTTP/HTTPS/WS/WSS/gRPC/GRPCS `proxy_urls` survive API discovery and workspace persistence with protocol, host, port, template, and resource-count validation |
| HTTP-like family defaults | Complete | The first HTTP/HTTPS/WS/WSS authority seeds protocol-specific HTTP, HTTPS, WS, and WSS URL variables with standard-port omission and nonstandard-port retention |
| gRPC defaults | Complete | Exact gRPC and GRPCS entries seed their matching full URL variables with explicit ports and bracketed IPv6 authority handling |
| Safe fallback and merge | Complete | Missing families keep reviewable loopback values; empty or untouched managed loopback rows can adopt later remote defaults while custom rows and edited values remain unchanged |
| Executable evidence | Complete | Focused mapper, transport-boundary, persistence-migration, environment-merge, and integration regressions cover remote sanitization, malformed-value rejection, family mapping, IPv6, fallback replacement, custom preservation, and missing-row creation |

Compatibility bounds remain explicit: the selected control plane must first be discovered so its proxy metadata is local, and no credentialed tenant fixture is stored in the repository. Automatic all-control-plane project/workspace reconciliation, route-folder hierarchy, and reviewed expression-router conversion remain open. Service integrations stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction QA remains omitted by standing direction.

## Milestone 142 — Konnect route-folder hierarchy (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Route folders | Complete | Every supported route receives one stable source-backed top folder named from the sanitized route name or ID |
| HTTP path/protocol folders | Complete | Multi-path or multi-protocol HTTP routes receive pinned-compatible resolved-path subfolders with protocol prefixes when needed; methods share their path/protocol folder |
| WS and gRPC folders | Complete | WS/WSS and gRPC/GRPCS routes receive protocol subfolders only when multiple family protocols are present |
| Request naming | Complete | Managed requests use resolved paths, raw complex-regex fallback text, or route display names in the same decision order as pinned sync |
| Safe reconciliation | Complete | Matching managed folders retain IDs, expansion, headers/auth/variables/scripts/tests/docs; remote names/parents update, stale managed folders disappear, local folders survive, orphaned local children return to root, and manual local request placement is retained |
| Persistence and ordering | Complete | Folder source metadata survives workspace migration, generated mixed-resource order is valid and deduplicated, and existing local collection hierarchy/order/environment/docs remain intact |
| Executable evidence | Complete | Focused mapping, migration, and resource-helper regressions prove eleven-folder HTTP/WS/gRPC structure, request placement, name semantics, local override, stable managed state, stale cleanup, source persistence, and generic hierarchy behavior |

Compatibility bounds remain explicit: preserving a user's manual local-folder request placement can leave an otherwise valid managed route folder empty instead of deleting local organization as pinned sync does. Automatic all-control-plane project/workspace reconciliation, reviewed expression-router conversion, and a credentialed live-tenant fixture remain open. Service integrations stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction QA remains omitted by standing direction.

## Milestone 143 — Konnect expression-router conversion (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Method expressions | Complete | Deduplicated uppercase `http.method ==` predicates constrain generated methods, including flat OR combinations |
| Path expressions | Complete | Exact `http.path ==` and prefix `http.path ^=` predicates become deduplicated executable paths and retain default-method expansion when no method is extractable |
| Host/header expressions | Complete | `http.host ==` becomes the managed Host row; `http.headers.<name> ==` becomes a managed normalized header with underscore-to-hyphen lowercase conversion |
| Partial expressions | Complete | Unsupported predicates are ignored when another supported field is extractable, preserving pinned over-approximation and method/path cross-product behavior |
| Explicit skips and bounds | Complete | `tls.sni`, fully unextractable, and over-100,000-character expressions remain visible with exact reasons rather than becoming misleading requests |
| Executable evidence | Complete | Pure parser and mapping matrices cover deduplication, exact/prefix paths, normalized headers, partial extraction, unsupported negation/regex predicates, SNI, size bounds, two-protocol mapping, folders, and managed constraints |

Compatibility bounds remain explicit: the pinned parser deliberately ignores unsupported predicates when any safe field is found and can over-approximate correlated OR branches into a method/path cross-product; Brunomnia matches and documents that behavior instead of claiming a full Kong expressions evaluator. Automatic all-control-plane project/workspace reconciliation and a credentialed live-tenant fixture remain open. Service integrations stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction QA remains omitted by standing direction.

## Milestone 144 — keyboard collection-tree reordering (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Mixed sibling movement | Complete | Focused request and folder controls use Option/Alt + Arrow Up/Down or Home/End for before/after and first/last placement through the same validated move primitive as drag/drop |
| Indent/outdent | Complete | Option/Alt + Right indents into a preceding folder; Option/Alt + Left moves a nested request/folder after its parent at the grandparent level |
| Collection ordering | Complete | Focused collection controls support Option/Alt + Arrow Up/Down/Home/End without treating indent/outdent as valid collection operations |
| Safety and discoverability | Complete | Search disables keyboard moves, impossible and boundary operations are no-ops, focusable controls advertise `aria-keyshortcuts`, and titles describe macOS Option plus cross-platform Alt behavior |
| Executable evidence | Complete | A pure planner regression applies real moves across mixed siblings, indent/outdent, first placement, collection placement, and invalid boundaries; strict TypeScript proves all focusable wiring |

Compatibility bounds remain explicit: keyboard moves operate one resource at a time and do not add multi-select/bulk tree actions. Rendered interaction and assistive-technology QA remain omitted by standing direction, so this milestone claims source semantics, focusable controls, shortcut metadata, pure move evidence, full regression suites, and packaged-app verification rather than observed focus visuals. Richer resource actions, environment-tree ordering, collected-data breadth, explicit legacy response-only labeling, richer libcurl-style header/text timeline evidence, and arbitrary mixed-order compatibility exports remain. Collections stays `Baseline`; 19 parity rows remain incomplete.

## Milestone 145 — deep folder duplication (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Descendant duplication | Complete | Folder settings duplicate the selected root, every nested folder, and every descendant request while retaining hierarchy and behavior |
| Fresh identities | Complete | Folder/request IDs plus folder rows, request path/query/header/form/multipart rows, gRPC metadata, and Socket.IO argument/listener IDs regenerate without collisions |
| Source detachment | Complete | Duplicated folders and requests drop import/Konnect source metadata so synchronization cannot mutate or delete the local copies |
| Mixed order | Complete | The copied subtree retains its internal persisted order and is inserted immediately after the complete original subtree without disturbing unrelated siblings |
| Executable evidence | Complete | A deterministic pure regression proves hierarchy, request placement, fresh row/protocol IDs, source detachment, adjacent order, and invalid-target no-op behavior; strict TypeScript proves folder-dialog wiring |

Compatibility bounds remain explicit: duplication stays within the current collection, matching the ordinary pinned folder action; cross-workspace copy/move continues through existing drag/settings paths rather than this command. Multi-select/bulk resource actions, request pinning/new-tab state, environment-tree ordering, collected-data breadth, explicit legacy response-only labeling, richer libcurl-style header/text timeline evidence, and arbitrary mixed-order compatibility exports remain. Collections stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction QA remains omitted by standing direction.

## Milestone 146 — sub-environment ordering and duplication (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned source behavior | Complete | The pinned environment editor reorders sub-environments before/after siblings and duplicates a selected sub-environment as `Name (Copy)` immediately after its source |
| Persistent pointer ordering | Complete | Native drag/drop reorders only valid same-parent sub-environment siblings through a pure workspace operation; base, self, and cross-parent drops are no-ops |
| Keyboard equivalence | Complete | Focused sub-environments expose Option/Alt + Arrow Up/Down/Home/End through a pure before/after planner and advertised `aria-keyshortcuts` |
| Safe duplication | Complete | The copy retains parent, values, color, and private state; regenerates environment and variable-row IDs; removes import provenance; and does not duplicate descendants |
| Executable evidence | Complete | A deterministic regression proves sibling order, nested-child stability, keyboard planning, invalid cross-parent/base operations, adjacent copy placement, fresh IDs, provenance removal, and descendant exclusion; strict TypeScript proves dialog wiring |

Compatibility bounds remain explicit: pinned Insomnia exposes these actions only for sub-environments, so Brunomnia base environments remain immovable and non-duplicable through this surface even though its richer model can contain multiple base trees. Parent changes remain an explicit editor field instead of an implied cross-parent drop. Multi-select/bulk resource actions, request pinning/new-tab state, collected-data breadth, explicit legacy response-only labeling, richer libcurl-style header/text timeline evidence, and arbitrary mixed-order compatibility exports remain. Collections stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 147 — device-local request pinning (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned source behavior | Complete | Pinned Insomnia stores `pinned` in non-sync `RequestMeta`, exposes Pin/Unpin from request actions, and renders a separate filtered pinned-request list above the ordinary collection tree |
| Device-local state | Complete | Brunomnia stores bounded per-project request IDs in local UI storage rather than request/workspace data, keeping pins out of exports, folder/Git projects, collaboration, and compatibility payloads |
| Pinned list | Complete | Valid pins render once in collection resource order, honor the current request search, expose collection context, and select the original request without changing hierarchy |
| Safe reconciliation | Complete | Malformed storage, duplicate IDs, missing requests, deleted requests, project switches, and unavailable local storage cannot pollute workspace data or crash request editing |
| Executable evidence | Complete | Pure tests prove safe parsing, uniqueness, current-workspace reconciliation, toggle no-ops, removal, resource-order listing, and filtering; strict TypeScript proves active and pinned-list controls |

Compatibility bounds remain explicit: this milestone closes request pin metadata and its sidebar projection, not Insomnia's separate persistent temporary/permanent document-tab context, tab history, close/reopen behavior, or tab drag ordering. Multi-select/bulk resource actions, document-tab state, collected-data breadth, explicit legacy response-only labeling, richer libcurl-style header/text timeline evidence, and arbitrary mixed-order compatibility exports remain. Collections stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 148 — persistent request document tabs (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Temporary navigation | Complete | Ordinary request selection opens or replaces one italic temporary tab; existing open tabs activate without duplication |
| Permanent tabs | Complete | Command/Ctrl-click, middle-click, double-click, explicit keep, editing, and sending promote or open permanent request tabs |
| Persistent lifecycle | Complete | Bounded per-project local state preserves tab order, temporary status, active ID, recent active history, and recently closed IDs without entering workspace/project/export/sync data |
| Close/reopen/navigation | Complete | Closing the active tab prefers recent valid history then the preceding tab; latest-valid reopen, Command/Ctrl+Tab cycling, reverse cycling, and Command/Ctrl+W/Shift+T shortcuts work |
| Ordering and reconciliation | Complete | Native pointer drag persists before/after tab order; duplicate/malformed/deleted/stale IDs are bounded and repaired while request names, methods, and protocols remain live workspace projections |
| Executable evidence | Complete | Pure tests prove parsing, single-temporary enforcement, replacement, promotion, close history, reopen, cycle, drag order, deletion repair, and fallback creation; strict TypeScript proves the full request-tab strip |

Compatibility bounds remain explicit: pinned Insomnia can close its final tab and navigate to a separate project dashboard, while Brunomnia's always-present request workbench deliberately keeps one request tab open. This milestone covers request documents, not Insomnia's broader folder/environment/mock/spec/runner tab types or close-all/close-others context menu. Multi-select/bulk resource actions, collected-data breadth, explicit legacy response-only labeling, richer libcurl-style header/text timeline evidence, and arbitrary mixed-order compatibility exports remain. Collections stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 149 — corrective collection bulk-action audit (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Current tree selection | Corrected | Pinned `project-navigation-sidebar.tsx` explicitly configures `selectionMode="single"` and derives one selected key from the active route |
| Legacy tree behavior | Corrected | Pinned `debug.tsx` renders one active request selection and each collection row receives one document; its pinned-request list is also single-select |
| Action contracts | Corrected | `request-actions-dropdown.tsx` and `request-group-actions-dropdown.tsx` accept one request or folder and dispatch singular rename/duplicate/delete/move/configuration actions |
| Existing bulk surfaces | Preserved | Bulk query/header text editors and multi-request runner selection remain implemented and are unrelated to collection-tree resource selection |
| Ledger correction | Complete | The stale multi-select/bulk collection-tree gap is removed without adding behavior absent from pinned Insomnia or changing Brunomnia product code |

Compatibility bounds remain explicit: this audit does not assert that Insomnia has no multi-selection anywhere; runner result tables, plugin settings, Git history, and other domain-specific lists can be multi-select. The corrected claim is limited to collection-tree resources and their actions. Collected-data breadth, explicit legacy response-only labeling, richer libcurl-style header/text timeline evidence, and arbitrary mixed-order compatibility exports remain. Collections stays `Baseline`; 19 parity rows remain incomplete. No rendered interaction claim is made.

## Milestone 150 — response collected-data and restore fidelity (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned response model | Complete | Pinned ordinary responses retain `requestTestResults`, `settingSendCookies`, `settingStoreCookies`, collection-environment identity in `environmentId`, global-environment identity in `globalEnvironmentId`, and a `requestVersionId` |
| Collected test results | Complete baseline | Direct sends retain bounded pre-request plus after-response assertions; collection runs attach their completed combined assertions; dependent, script, and plugin sends explicitly retain an empty set when no test phase runs |
| Cookie and environment evidence | Complete baseline | Every persistent response-writer records effective send/store cookie controls and separate global/collection environment identities; historical selection restores assertions and the Cookies view reports the saved policy |
| Restore semantics | Complete | Historical versions restore editable execution fields while preserving the current ID, name, documentation, source linkage, and folder placement, matching pinned Insomnia's ignored identity/name/description/parent metadata |
| Legacy behavior | Complete | Entries without a valid request version remain selectable response evidence and are explicitly labeled non-restorable; fabricating a version from response data is not a pinned parity requirement |
| Persistence hardening | Complete | Migration bounds assertion counts and strings, admits only boolean cookie settings and bounded environment IDs, and preserves older response-only entries without inventing snapshots |
| Executable evidence | Complete baseline | Focused history/storage/runner/script tests, strict TypeScript, the full frontend/native suites, production build, CLI artifact, dependency audit, and macOS debug-app bundle verify the milestone without rendered Browser QA |

Compatibility bounds remain explicit: response history remains device-local and stores bounded values directly instead of Insomnia's database plus filesystem body/timeline paths. Raw header ordering and libcurl-style redirect/network text remain absent from the persisted timeline. Milestone 151 later confirms that pinned Insomnia filters SSL data, summarizes incoming chunks, bounds outgoing body text, and has no byte-exact diagnostic export. Collections stays `Baseline`; 19 parity rows remain incomplete. Legacy response-only entries are compatible behavior, not an open reconstruction task. Rendered interaction QA remains omitted by standing direction.

## Milestone 151 — corrective response diagnostic audit (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned debug surface | Corrected | `response-debug-modal.tsx` loads a response timeline into a read-only prefixed text viewer; it does not export a byte-exact wire transcript |
| Pinned capture policy | Corrected | The libcurl debug callback drops SSL data, empty chunks, and cookie-jar additions; it UTF-8-decodes small outgoing data, hides larger outgoing data, and replaces each incoming data chunk with a byte-count message |
| Optional body display | Corrected | `getResponseTimeline(response, true)` reads the separately stored response body as UTF-8 text and appends it to the viewer; this is not compressed-wire or exact binary evidence |
| Ledger placement | Complete | The false byte-exact export requirement is removed from Collections. The real missing HeaderIn/HeaderOut/Text redirect/network evidence remains named under REST/HTTP execution |
| Existing extras | Preserved | Brunomnia's deterministic response transcript and HAR downloads remain useful account-free extensions without being mislabeled as pinned timeline parity |
| Product delta | Complete | No product code changes are required for this corrective audit; M150's verified renderer, CLI, native suites, dependency audit, and arm64 app bundle remain unchanged |

Compatibility bounds remain explicit: Brunomnia still lacks persisted raw duplicate-header order and libcurl-style redirect/network text. Pinned Insomnia itself excludes SSL bytes, summarizes incoming body chunks, bounds outgoing body text, and offers no byte-exact diagnostic export, so those excluded bytes are not retained as a false parity requirement. Collections remains `Baseline` for broader document-tab coverage; 19 parity rows remain incomplete. No rendered interaction claim is made.

## Milestone 152 — mixed compatibility-export ordering (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned ordering contract | Complete | Pinned request/folder models carry `metaSortKey`; v5 maps it to `meta.sortKey`, validates it in request/folder metadata, and restores it during import |
| Insomnia v4 export | Complete | Brunomnia emits depth-first mixed request/folder resources with sibling `metaSortKey` values while retaining protocol payload/proto side resources outside the collection-order contract |
| Insomnia v4 import | Complete | Complete sibling sort metadata rebuilds nested `resourceOrder`; legacy/partial sibling metadata falls back to source resource-array order without fabricating incomparable keys |
| Insomnia v5 export | Complete | Nested collection arrays follow current mixed `resourceOrder`, and every request/folder carries a sibling `meta.sortKey` |
| Insomnia v5 import | Complete | Each nested sibling array prefers complete finite `meta.sortKey` values, otherwise preserves source array order, then records the resulting depth-first `resourceOrder` |
| Shared tree correctness | Complete | `orderedCollectionChildren` now requires an actual request match before applying root fallback, preventing nested folder IDs from appearing as blank root requests |
| Executable evidence | Complete baseline | Focused v4/v5 root and nested mixed-order round trips, raw sort-key assertions, legacy importer suites, resource-helper regressions, strict TypeScript, full release suites, and packaged-app verification cover the milestone |

Compatibility bounds remain explicit: this milestone guarantees arbitrary mixed sibling order for Brunomnia's supported hierarchical Insomnia v4/v5 adapters, not a fictional universal hierarchy in flat HAR, raw OpenAPI, or formats Brunomnia does not export. Existing binary/external-file/script/protocol downgrade warnings remain. Import and export formats stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction QA remains omitted by standing direction.

## Milestone 153 — request-tab Close Other Tabs (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned action audit | Complete | Pinned `tab-list.tsx` exposes only `Close All` and `Close Other Tabs`; `closeOtherTabs` reserves the selected tab, batch-closes every other tab, and activates/navigates the reserved tab when necessary |
| Pure state mutation | Complete | Brunomnia retains the selected temporary/permanent tab unchanged, makes it active, clears stale active history, appends every removed ID to bounded closed-tab history, and rejects missing/single-tab operations |
| Discoverable control | Complete baseline | Right-clicking any request tab or pressing Shift+F10/Menu on its focusable tab opens a labeled menu; outside pointer input or Escape dismisses it, and the action disables when no other tab exists |
| Reopen continuity | Complete | Closed IDs use the existing newest-valid reopen path, while the reserved tab is removed from closed history and never duplicated |
| Executable evidence | Complete baseline | Focused lifecycle tests, strict React/TypeScript compilation, full frontend/native suites, CLI/audit gates, and a rebuilt macOS app verify the milestone without rendered Browser QA |

Compatibility bounds remain explicit: pinned Close All empties the tab list and navigates to the project dashboard. Brunomnia does not yet have that project-dashboard route and deliberately retains one request-workbench tab, so it does not relabel Close Others as Close All. Broader folder/environment/mock/spec/runner tabs and true Close All remain. Collections stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 154 — final-tab dashboard and Close All (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned route audit | Complete | Closing the sole active tab and batch-closing every tab both append closed history, clear active/list state, and navigate to the project route; scratchpad is the pinned route-only exception |
| Intentional empty state | Complete | Per-project local tab state distinguishes an intentional dashboard from an uninitialized/invalid empty state, so ordinary startup still creates a valid temporary fallback while Close All survives reconciliation and restart |
| Final and batch close | Complete | The tab close control and Command/Ctrl+W can close the final request; Close All removes every visible tab in order, bounds and deduplicates closed IDs, clears active history, and opens the dashboard |
| Project dashboard | Complete baseline | The request area becomes a project resource dashboard with collection/request/design/mock totals, collection/design/mock resource cards, new-request and newest-valid reopen actions, while the collection sidebar remains available |
| Reopen paths | Complete | Sidebar selection, dashboard collection cards, new request, automation collection opening, and Command/Ctrl+Shift+T leave dashboard state and open a request tab without changing persisted workspace content |
| Executable evidence | Complete baseline | Focused pure-state tests, strict React/TypeScript compilation, full frontend/native suites, CLI/audit gates, and a rebuilt macOS app verify the milestone without rendered Browser QA |

Compatibility bounds remain explicit: this dashboard adapts pinned project-file navigation to Brunomnia's local project model and supported collection/design/mock resources. Folder/environment/mock/spec/runner resources still do not participate in the shared document-tab strip. Collections stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 155 — shared request and folder document tabs (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned document audit | Complete | Pinned `BaseTab` includes `request` and `folder`; request-group route navigation creates or reuses the same temporary/permanent tab state and the shared tab component closes either type identically |
| Legacy-safe tab model | Complete | Existing request-only per-project JSON parses as typed request tabs, while new folder tabs persist their type; one bounded temporary slot, active history, drag order, close/reopen, Close All/Others, and dashboard state are shared |
| Folder navigation | Complete baseline | Folder-name selection opens a temporary tab, Command/Ctrl-click or middle/double-click opens permanently, selected styling follows the active document route, and the separate chevron still controls expansion |
| Folder pane | Complete baseline | The document workbench edits Variables, Headers, Auth, pre/after scripts, Docs, name, and parent while preserving the existing settings modal for duplicate/delete actions; edits promote temporary tabs |
| Request continuity | Complete | Request inline rename/pin/folder controls and response workbench remain unchanged behind the extracted strip; hidden request send/edit/generate shortcuts remain suppressed while a folder is active |
| Executable evidence | Complete baseline | Focused mixed-type lifecycle tests, strict React/TypeScript compilation, full frontend/native suites, CLI/audit gates, and a rebuilt macOS app verify the milestone without rendered Browser QA |

Compatibility bounds remain explicit: environment, collection/design, mock-server/route, runner, and test-suite resources still do not participate in the shared strip. Folder pane field labels adapt Brunomnia's existing `Variables` name where pinned currently says `Environment`, but the same inherited key/value scope is edited. Collections stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 156 — workspace and folder Runner document tabs (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned Runner audit | Complete | Pinned tabs use `runner_<workspaceId>` or `runner_<folderId>`, create through ordinary route synchronization, promote when a run starts, and retain per-runner context keyed by the synthetic ID |
| Shared tab lifecycle | Complete baseline | Typed Runner tabs persist beside request/folder documents and share the one temporary slot, explicit keep, run promotion, active history, cycling, drag order, middle/ordinary/final/all/other close, reopen, and dashboard behavior |
| Workspace launch | Complete | Activity rail and command-palette Runner actions open or activate the workspace synthetic tab rather than bypassing document state through a separate workbench section |
| Folder launch | Complete baseline | Every folder pane exposes Run folder; its synthetic tab locks the owning collection and folder, includes direct plus nested descendants in collection order, and cannot silently broaden a deleted/missing target to the full collection |
| Embedded workbench | Complete baseline | The existing account-free runner UI renders beneath the shared strip with collection/environment selection, request order, iterations, retries, delay, bail, data, protocol samples, result evidence, and JSON/JUnit exports intact |
| Executable evidence | Complete baseline | Focused synthetic-tab and target-resolution tests, strict React/TypeScript compilation, full frontend/native suites, CLI/audit gates, and a rebuilt macOS app verify the milestone without rendered Browser QA |

Compatibility bounds remain explicit: pinned Runner context retains unsaved per-runner controls while switching tabs; Brunomnia currently retains persisted reports but remounts unsaved controls when leaving the Runner pane. Environment, collection/design, mock-server/route, and test-suite resources still do not participate in the shared strip. Collections and Collection runner stay `Baseline`; 19 parity rows remain incomplete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 157 — isolated Runner document drafts (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned context audit | Complete | Pinned Runner context is keyed by the synthetic Runner document ID and retains the active collection, environment, iterations, delay, and ordered request selection while another tab is active |
| Per-document draft | Complete baseline | Every open workspace/folder Runner keeps its collection, environment, iterations, retries, bail, delay, stream window, data, and ordered enabled request plan in an isolated in-memory draft |
| Switch rehydration | Complete | Runner workbenches remount by synthetic document key, initialize from only that document's draft, and reconcile removed collections, environments, or requests against the current workspace |
| Lifecycle cleanup | Complete | Single close, Close All, and Close Other Tabs discard only the affected Runner drafts; deleted-folder reconciliation prunes its now-invalid synthetic draft without touching other workspaces or Runners |
| Execution continuity | Complete | Draft publication does not persist reports or execution output into tab state, and run promotion plus all M156 target scoping and account-free execution behavior remain unchanged |
| Executable evidence | Complete baseline | Focused draft/tab regressions, strict React/TypeScript compilation, full frontend/native suites, CLI/audit gates, and a rebuilt macOS app verify the milestone without rendered Browser QA |

Compatibility bounds remain explicit: drafts are session-memory context for currently open Runner documents, matching the pinned unsaved-context behavior rather than silently persisting control edits into project files; closing a Runner intentionally discards its draft. Environment, collection/design, mock-server/route, and test-suite resources still do not participate in the shared strip. Collections and Collection runner stay `Baseline`; 19 parity rows remain incomplete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 158 — project Environment document tab (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned tab audit | Complete | Pinned `BaseTab` includes `environment`; an environment-scoped workspace resource becomes one ordinary tab whose resource ID, name, URL, and temporary/permanent lifecycle follow the shared tab context |
| Local identity mapping | Complete baseline | Brunomnia exposes one namespaced Environment synthetic document per local project, avoiding collisions with request/folder IDs while representing the project's complete global base/sub-environment workspace |
| Shared lifecycle | Complete | The Environment document persists with typed tab storage and shares temporary replacement/promotion, active history, cycling, drag order, middle/final/all/other close, reopen, and dashboard behavior |
| Editor workbench | Complete baseline | The prior modal is a full document pane with base/sub-environment selection, immediate active-environment switching, name/parent/color/privacy/variables, inherited-value evidence, drag/keyboard ordering, add, duplicate, and guarded delete |
| Entry and recovery paths | Complete | Top-bar edit, the configured shortcut, command palette, and project-dashboard resource card all open or activate the same document; edits promote a temporary tab and legacy stored tab JSON remains readable |
| Tab correctness | Complete | Non-resource synthetic Runner/Environment names render as fixed tab labels instead of misleading editable Request inputs; request/folder inline rename and request pin controls remain unchanged |
| Executable evidence | Complete baseline | Focused typed-tab/environment-resource regressions, strict React/TypeScript compilation, full frontend/native suites, CLI/audit gates, and a rebuilt macOS app verify the milestone without rendered Browser QA |

Compatibility bounds remain explicit: this document represents Brunomnia's project-global environment tree. Collection base/sub-environments remain in each collection's existing settings pane rather than fabricating a second pinned environment-workspace route. Mock-server/route, collection/design document, and test-suite resources still do not participate in the shared strip. Collections stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 159 — API design document tabs (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned document audit | Complete | Pinned `inferTabType` maps every design-scoped workspace to `document`; ordinary resource navigation supplies its workspace ID/name and the shared tab context owns lifecycle |
| Typed design resources | Complete baseline | Each Brunomnia `ApiDesign` ID is a valid `document` reference with a fixed design icon/name; legacy stored tab JSON remains readable and removed designs reconcile out of open/history/closed state |
| Shared lifecycle | Complete | Multiple designs persist beside request/folder/Environment/Runner documents and share temporary replacement/promotion, active history, cycling, drag order, middle/final/all/other close, reopen, and dashboard behavior |
| Targeted workbench | Complete baseline | The existing OpenAPI editor, formatter, custom rules, structural lint evidence, preview, and collection generation bind to the active design tab; selecting another design opens/activates its document rather than mutating hidden local selection |
| Edit and generation continuity | Complete | Name/document/ruleset/format/generate actions promote temporary designs; request generation atomically preserves that design tab before opening the generated collection request |
| Entry paths | Complete | Activity rail, command palette, and project-dashboard design cards open the shared document; an empty project creates and opens a valid starter OpenAPI design through the same path |
| Executable evidence | Complete baseline | Focused typed-tab/OpenAPI regressions, strict React/TypeScript compilation, full frontend/native suites, CLI/audit gates, and a rebuilt macOS app verify the milestone without rendered Browser QA |

Compatibility bounds at this historical milestone were explicit: it changed document navigation, not the API-design engine's then-existing scope. Milestone 241 later closes the pinned Spectral, safe remote/local ruleset extension, multi-file reference, and diagnostic-tooling gap. Mock-server/route and test-suite resources did not yet participate in the shared strip at M159, and collection workspaces remained represented by their request/folder documents rather than a separate collection tab. Rendered interaction and assistive-technology QA remained omitted by standing direction.

## Milestone 160 — mock server and route document tabs (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned mock audit | Complete | Pinned `inferTabType` maps mock-server workspaces to `mockServer` and route resources to `mockRoute`; route tabs carry method tags and both flow through ordinary resource navigation |
| Typed mock resources | Complete baseline | Every local mock server and route ID is a valid typed document reference; current names/methods drive fixed tab labels, and deleted routes reconcile from open/history/closed state |
| Shared lifecycle | Complete | Server and route tabs coexist with all prior document types and share temporary replacement/promotion, active history, cycling, drag order, middle/final/all/other close, reopen, and dashboard behavior |
| Targeted workbench | Complete baseline | The native local-mock workbench derives its server and optional route from the active tab; server documents show route navigation without silently selecting a route, while route documents expose the full editable response pane |
| Resource navigation | Complete | Server selector, route list, create-from-response, new/AI route creation, route deletion, activity rail, command palette, dashboard cards, and response-pane Go to mock actions open or activate the correct resource tab |
| Mutation continuity | Complete | Route field/header/body/overwrite edits promote temporary route documents; creating a route follows one-temporary-tab replacement semantics, deletion activates its server, and live native route synchronization remains scoped per server |
| Executable evidence | Complete baseline | Focused typed-tab/response-to-route regressions, strict React/TypeScript compilation, full frontend/native suites, CLI/audit gates, and a rebuilt macOS app verify the milestone without rendered Browser QA |

Compatibility bounds remain explicit: this milestone changes mock navigation, not the existing local mock engine's named Liquid/Faker/AI/hosting bounds. Pinned hosted/self-host deployment workflows and exact runtime identity remain outside Brunomnia's local-only baseline. Test-suite resources still do not participate in the shared strip, collection workspaces remain represented by request/folder documents, and raw-JSON environment editing remains. Collections and Mock servers stay `Baseline`; 19 parity rows remain incomplete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 161 — collection workspace document tabs (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned workspace audit | Complete | Pinned `inferTabType` returns `collection` for an ordinary request workspace, distinct from design/environment/mock scopes, and builds its tab from workspace ID/name through ordinary navigation |
| Local identity mapping | Complete baseline | Every Brunomnia collection ID is a valid `collection` document reference; this adapts the project's multi-collection local model without inventing upstream workspace records |
| Shared lifecycle | Complete | Collection documents coexist with all prior types and share temporary replacement/promotion, active history, cycling, drag order, middle/final/all/other close, reopen, persistence, and dashboard behavior |
| Embedded configuration | Complete baseline | The previous modal is a full collection document with name, base/selected sub-environment variables, add/select/rename/delete environment actions, and Markdown documentation/preview |
| Entry paths | Complete | New collection creation opens its document, sidebar Configure and dashboard cards open or activate it, and empty collections are navigable without requiring a placeholder request |
| Request continuity | Complete | Collection request/folder resources remain independent tabs and sidebar targets; generated collections still open their first generated request, preserving M159's source-to-request handoff |
| Executable evidence | Complete baseline | Focused typed-tab/resource regressions, strict React/TypeScript compilation, full frontend/native suites, CLI/audit gates, and a rebuilt macOS app verify the milestone without rendered Browser QA |

Compatibility bounds remain explicit: pinned ordinary workspaces contain the request tree itself, while Brunomnia's collection document intentionally exposes collection-level configuration and keeps request/folder editors as separate resources in the same strip. Milestone 162 closes standalone test-suite documents; raw-JSON environment editing remains. Collections stays `Baseline`; 19 parity rows remain incomplete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 162 — standalone unit-test-suite documents (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned model audit | Complete | Pinned `UnitTestSuite` stores name/sort key, `UnitTest` stores name/code/request ID/sort key, the document tab type is `testSuite`, and the UI supports suite/test CRUD, ordering, request selection, JavaScript editing, individual/all execution, and results |
| Persisted model | Complete baseline | Workspace v35 stores bounded ordered suites/tests plus bounded local run history; malformed IDs, names, scripts, sort keys, request references, logs, durations, and orphaned results normalize safely |
| Shared document lifecycle | Complete | Every suite ID is a typed `testSuite` document with temporary replacement/promotion, history, cycling, drag order, middle/final/all/other close, reopen, dashboard recovery, and deletion reconciliation |
| Suite workbench | Complete baseline | A source-styled three-pane document provides suite create/open/rename/delete/order, test create/rename/delete/order, HTTP/GraphQL request selection, collapsible JavaScript editors, run-one/run-all controls, and saved result selection |
| Execution bridge | Complete baseline | Disposable Workers wrap each test as one async assertion and expose bounded default/ID-targeted `insomnia.send()` with pinned-shaped status/statusMessage/data/lowercase headers/responseTime output alongside the existing Chai surface |
| Request continuity | Complete baseline | Named sends use the active global plus selected collection/folder configuration, complete renderer, OAuth, enabled plugins, cookies, dependent responses, history retention, and optional script file/vault/secondary-request grants; deleting a request clears live test references without rewriting historical results |
| Entry paths | Complete | Activity rail, command palette, project-dashboard resources, suite list, and new-suite actions all open the same shared document; edits, reordering, and execution promote a temporary suite |
| Executable evidence | Complete baseline | Focused model/tab/sandbox/storage regressions, 66-file frontend suite, strict production build, native/CLI/audit gates, and a rebuilt arm64 macOS app verify the milestone without rendered Browser QA |

Compatibility bounds remain explicit: pinned v4/v5 standalone-suite interchange and CLI suite identity/selection remain open, while realtime/gRPC requests are not offered in the pinned HTTP-request selector contract. Raw-JSON environment editing and broader ledger gaps also remain. Collections, Collection runner, Headless CLI, and Import/export stay `Baseline`; 19 parity rows remain incomplete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 163 — raw JSON environments (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned editor audit | Complete | Pinned raw/table editors require a root object, reject NeDB-unsafe and reserved root keys, prevent invalid raw-to-table switches, warn before table losses, and convert object/array values to JSON-typed rows while keeping scalars as strings |
| Persisted model | Complete | Workspace v36 stores optional String/JSON row types and per-scope Table/Raw modes for global, collection base/sub-, and folder environments with bounded migration defaults |
| Shared conversion | Complete | One bounded converter formats rows, parses raw objects, preserves stable row IDs, validates nested keys/depth/size/count, drops disabled/earlier duplicate rows only after confirmation, and safely retains special object keys |
| Reusable editor | Complete baseline | Every supported environment surface uses one labeled Table/Raw control; JSON rows open a validated code editor, raw errors remain visible, and invalid drafts block Table mode |
| Runtime values | Complete | Typed objects and arrays retain compact root JSON plus bounded nested dot paths across HTTP/templates, global/collection/folder script stores, runners, unit tests, and collection configuration |
| Interchange | Complete baseline | Brunomnia v36 preserves modes/types; Insomnia v4 preserves raw/table plus disabled KV rows; Insomnia v4/v5 preserve object/array data without stringifying it |
| Executable evidence | Complete baseline | Focused 87-test coverage, 67-file/483-test frontend regressions, strict build, CLI smoke, 105 native tests, formatting/check/clippy, clean audit, and a rebuilt arm64 app verify the milestone |

Compatibility bounds remain explicit: Insomnia v5 has no compatible KV-pair/editor-mode field, so v5 imports use Raw mode while preserving typed data. Rendered Browser QA remains omitted by the standing local-browser restriction. Collections and Import/export stay `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete.

## Milestone 164 — standalone suite ownership, interchange, and CLI selection (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned model/CLI audit | Complete | Pinned suites are workspace children, v4 stores `unit_test_suite` plus `unit_test` resources, v5 stores suites only on specification documents, and Inso selects one suite by name/ID or all workspace suites through an API-spec/workspace ID in sort-key order |
| Collection ownership | Complete baseline | Workspace v37 requires one owning collection per suite as Brunomnia's workspace adaptation; legacy suites infer ownership from referenced requests or the first collection, and cross-collection references clear safely |
| Workbench scoping | Complete | Suite creation selects an owner, the editor exposes owner selection, request choices and named/default sends stay inside that collection, and moving a suite clears now-invalid request references |
| Interchange import | Complete baseline | Insomnia v4/v5 suite/test resources map to collection-owned models with source request IDs resolved; collision-safe artifact application rekeys suites, tests, collections, and request references together |
| Interchange export | Complete baseline | V4 emits ordered suite/test resources under each owning workspace with exported request IDs; v5 emits ordered suites on matching linked specification documents and warns when a selected collection has no representable spec |
| CLI suite execution | Complete baseline | `run test` selects one suite or every linked API-spec suite, runs persistent tests in order, exposes pinned-shaped default/ID-targeted `insomnia.send()`, and preserves regex, retries, bail, environments, cookies, chaining, reporters, and explicit trusted grants |
| Executable evidence | Complete baseline | Focused 67-test coverage, 67-file/484-test frontend regressions, direct suite/API-spec CLI runs, localhost trust/chaining smoke, strict TypeScript/Rust gates, clean audit, and a rebuilt arm64 app verify the milestone without rendered Browser QA |

Compatibility bounds remain explicit: Insomnia v5 cannot represent standalone suites on collection-only documents, so Brunomnia emits a downgrade warning unless a linked API specification is selected. Milestone 210 later closes portable CLI per-request TLS/proxy/client-identity authority, Milestones 211–222 close the audited pinned user-facing command/flag inventory plus bounded static configuration/global-option behavior, Milestone 225 adds stored-plugin template tags, Milestone 226 adds explicit-grant bounded JavaScript/TypeScript configuration, and Milestone 242 replaces the CLI's structural lint subset with the pinned Spectral runtime plus bounded local/public source resolution. Milestone 243 then confirms that plugin-directory/host-RPC and desktop-vault requirements were false cross-surface requirements and closes the Headless CLI row. Rendered Browser QA remains omitted by the standing local-browser restriction. Collection runner and Import/export stay `Baseline`; the historical milestone count remains unchanged, so Brunomnia is not declared feature-complete.

## Milestone 165 — remaining parity closure and release hardening

- Re-audit the current Insomnia documentation and release notes against [PARITY.md](PARITY.md)
- Close remaining response-viewer, nested-resource, protocol, scripting, extension, collaboration, and CLI gaps
- Cross-platform installers, signing/notarization guidance, accessibility audit, load/performance testing, and broader recovery tests
- Declare parity only after every ledger row has reproducible evidence

## Milestone 244 — direct local GGUF inference (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned source audit | Complete | Pinned Insomnia stores models in app-data `llms`, lists regular `.gguf` files, preserves temperature/top-P/top-K/random-seed/repeat-penalty defaults and ranges, and isolates native inference in Electron utility processes |
| Model storage boundary | Complete | Brunomnia creates the same logical app-data folder, persists only a selected filename, and rejects traversal, non-GGUF entries, symlinked folders/files, non-files, and canonical root escapes |
| Native inference | Complete | Pinned `llama-cpp-2` loads the model, applies an embedded chat template when available, uses an 8K context and 4,096-token output cap, applies the five pinned controls, stops on EOG, skips non-text control tokens, and decodes UTF-8 statefully |
| Crash isolation | Complete | One hidden invocation of the Tauri executable handles each bounded JSON request over pipes; the UI process enforces output/diagnostic limits, kills ten-minute workers, and reports native failure without loading llama.cpp into the main process |
| Desktop UI and persistence | Complete | Workspace v40 adds normalized GGUF settings, model discovery/refresh/open-folder/select controls, advanced options, explicit activation/testing, and local-only disclosure while hiding URL/key fields |
| Executable evidence | Complete | Focused adapter/dispatch/migration and native path/symlink tests pass; an ignored opt-in test loads checksum `66967fbece6dbe97886593fdbb73589584927e29119ec31f08090732d1861739` and completes real Metal-backed inference |

Compatibility bounds remain explicit: Brunomnia does not download, update, or bundle model files, and direct inference remains a desktop capability rather than a browser or headless-CLI authority. The fixed context/output limits are safety constraints. GGUF loading closes the AI row's only named gap; exactly 15 parity rows remain incomplete, so Brunomnia is not declared feature-complete.

## Milestone 245 — built-in OAuth browser and custom callbacks (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned source audit | Complete | Pinned Insomnia defaults authorization-code requests to an Electron `BrowserWindow`, always uses it for implicit grants, detects arbitrary configured redirects across navigation/redirect/failure paths, reuses a persisted isolated partition, applies auth proxy/TLS settings, handles client-certificate selection, and exposes explicit plus restart-time session clearing |
| Browser choice | Complete baseline | Workspace v41 stores pinned-compatible **Use system browser** state, defaults false/unset to the built-in browser, keeps implicit grants embedded, and round-trips the field through Insomnia v4/v5 interchange |
| Redirect capture | Complete | The Tauri window structurally matches bounded configured scheme/credentials/host/port/path plus configured query pairs, rejects lookalike paths, extracts query and fragment code/token/error responses, verifies state, catches navigation and completed loads, folds popup requests into the same isolated window, and returns the configured redirect for code exchange |
| Session lifecycle | Complete baseline | A persisted UUID selects an OAuth-only data directory and Apple custom data-store identifier; explicit clear and the device-local clear-on-restart setting rotate that ID without granting remote pages a matching Tauri capability |
| Proxy and lifecycle | Complete baseline | The embedded window applies the authorization scheme's manual HTTP/SOCKS5 proxy unless shared host/suffix/port/IP-CIDR No proxy policy bypasses it; readiness identifies embedded/system mode, user close, explicit cancel, duplicate IDs, popup navigation failure, and five-minute timeout settle the exact flow and destroy its window |
| System fallback | Complete | Authorization-code requests can retain the existing shell-free system browser with bounded plain-HTTP loopback listener, ephemeral port rewrite, fragment bridge, state validation, cancellation, and timeout |
| Executable evidence | Complete baseline | Focused frontend migration/interchange/IPC tests and native structural matcher/extraction/session/loopback/cancellation tests pass alongside strict TypeScript, Rust format/check/clippy, full suites, CLI/audit, and packaged-app gates recorded in the milestone verification file |

Compatibility bounds remain explicit: Tauri/Wry does not expose Insomnia's per-session certificate-verification callback or Electron client-certificate picker, so embedded-browser insecure-TLS override and explicit workspace client-identity selection remain open. No credentialed live provider or cross-platform rendered fixture is claimed. Request authentication stays `Baseline`; exactly 15 parity rows remain incomplete, so Brunomnia is not declared feature-complete.

## Milestone 246 — typed project-file inventory and duplication (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned model audit | Complete | Pinned `Project` parents separately typed `Workspace` records with `collection`, `design`, `mock-server`, `environment`, or `mcp` scope; the file dropdown launches a v5 export/import duplicate into a selected project and the separate project route can reparent a workspace |
| Typed local inventory | Complete baseline | The top-bar manager derives every collection, API design, local mock server, root global-environment tree, and MCP client as one labeled project file without adding an account, organization, or entitlement branch |
| Duplicate model | Complete baseline | Collection folders/requests/environments/rows/proto/Socket.IO identities, linked design collections/suites/tests, mock routes, environment descendants, and MCP rows rekey collision-safely; references remap and the source remains unchanged |
| Security and history | Complete baseline | Private environment descendants copy, MCP duplicates start disabled with runtime OAuth state cleared, and response/stream/runner/unit-test/MCP connection histories do not copy; Milestone 251 later narrows cookie/certificate copying to the selected file |
| Catalog integration | Complete | Same-project and cross-project duplication read healthy source/target documents, write only the destination through the existing rotating-backup path, open the destination, and work identically in native and browser catalogs |
| Manager workflow | Complete baseline | A lazy Project files panel lists all five scopes and opens an accessible named duplicate dialog with healthy destination selection, explicit copy disclosure, busy gating, and destination navigation |
| Executable evidence | Complete baseline | Focused five-scope/rekey/reference/catalog regressions and strict TypeScript compilation cover the new model and UI wiring; broader frontend/native/build/release gates are recorded in the milestone verification file |

Compatibility bounds remain explicit: Brunomnia retains one atomic versioned document per local project instead of separate physical records, and this milestone implements pinned duplication rather than true workspace reparenting. Milestones 247, 250, and 251 later close move, empty-project, and per-file cookie/certificate ownership. Local projects and Collections stay `Baseline`; exactly 15 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 247 — identity-preserving typed project-file moves (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned move audit | Complete | Pinned `move-workspace` validates source/destination records and updates the workspace parent ID; unlike the v5-backed duplicate route, authored identities and descendant resources remain unchanged |
| Scope ownership | Complete baseline | Collections carry suites, suite results, Runner reports, activity, responses, stream sessions, and response-viewer state; Documents additionally carry their hidden generated collection; mocks carry routes, environments carry complete descendant trees, and MCP clients carry connection history |
| Identity and collision policy | Complete | Every moved authored/evidence identity stays byte-for-byte stable; the destination's full document/evidence identity set is checked first and a collision refuses with duplicate guidance rather than silently rekeying or overwriting |
| Source emptying | Complete | Workspace v43 retains the v42 behavior that lets moving the final Collection, generated-Collection Document, or root Environment leave the source with zero typed files and clears stale active identities without manufacturing replacements |
| Catalog persistence | Complete baseline | Destination data writes first through rotating backup, source removal writes second, and any source failure triggers bounded restoration of both original documents; a save-generation guard invalidates stale active-project autosaves before switching |
| Manager workflow | Complete baseline | Every typed Project files row offers Move when another healthy project exists; the explicit destination dialog excludes the source, discloses identity/evidence/fallback behavior, locks during active work, and opens the destination after success |
| Executable evidence | Complete baseline | Focused ownership, hidden-design-collection, evidence, placeholder, collision, catalog, and same-project refusal regressions plus strict compilation cover the move flow; broader gates are recorded in the verification file |

Compatibility bounds remain explicit: local projects still use one atomic document rather than separately persisted workspace records, while Milestone 251 later makes cookies and certificates file-owned and transfers only the selected file state. Preferences and policies remain project-level. Milestone 250 closes the former fallback-source limitation. Local projects and Collections stay `Baseline`; exactly 15 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 250 — genuinely empty local projects (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned project audit | Complete | Pinned local-project creation writes only a `Project` model; its project route lists zero workspaces and renders Welcome, Send a request, Create document, and Import actions until the first typed file exists |
| Empty persistence | Complete | Workspace v43 preserves explicit zero-length Collection and Environment arrays while legacy v41 empty documents retain their repair behavior; initial, named, duplicated-empty, and final-file-move projects survive browser/native persistence without hidden typed files |
| Final-file moves | Complete | Moving the last Collection, a Document with its generated Collection, or a root Environment clears stale active IDs and leaves the source empty while retaining destination-first rollback and authored identity guarantees |
| Requestless runtime | Complete baseline | The renderer shows the project dashboard whenever no document tab exists and uses an ephemeral No Environment context for requestless/design-only work rather than persisting a placeholder; Send a request creates the first real Collection |
| First-file workflow | Complete baseline | The empty dashboard exposes pinned-shaped Send a request, Create document, and Import actions; explicit Environment, Mock, MCP, collection, and other existing creation paths remain available without an account or entitlement check |
| Executable evidence | Complete baseline | Focused v43 migration/catalog/move/static-render regressions, strict TypeScript, full frontend/native suites, build/package, CLI, audit, and signed-image evidence are recorded in the milestone verification file |

Compatibility bounds remain explicit: Brunomnia still stores one atomic project document rather than separate physical workspace records; Milestone 251 moves cookie/certificate ownership to typed files within that document. Empty-project behavior no longer blocks either row; exactly 15 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 251 — workspace-owned cookies and certificates (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned ownership audit | Complete | Pinned Insomnia parents cookie jars, CA certificates, and client certificates to a workspace, loads them by workspace ID on the workspace route, creates a default jar with each workspace, and marks these records non-syncable |
| Persisted model | Complete baseline | Workspace v43 stores bounded independent cookie/certificate state by typed file ID, keeps v42 global fields only as migration inputs, clears them after migration, and maps generated collections to their owning API Design |
| Legacy migration | Complete | Ambiguous v42 global cookies and certificates clone independently to every typed file because historical ownership cannot be inferred; malformed/oversized values retain existing normalization bounds and empty projects retain an empty state map |
| Runtime isolation | Complete baseline | Direct and dependent HTTP/GraphQL, OAuth, schema loading, gRPC, realtime, scripts, codegen, Runner, unit tests, plugins, MCP/integrations, mocks, and portable CLI execution resolve cookies and certificates from the owning file and persist cookie mutations only there |
| Lifecycle and transfer | Complete | New typed files receive default empty state; selected-file duplication clones only that state, moves transfer it, imports assign imported jars to new files, scoped Brunomnia/Insomnia exports emit owning jars, and generated collections inherit design state |
| Local-only boundary | Complete | Folder/Git project writes and encrypted collaboration payloads omit all file state, while reload/pull merges preserve the current device-local map; top-level compatibility fields remain empty |
| Executable evidence | Complete baseline | Focused migration, ownership, isolation, transfer, import/export, project/sync, strict TypeScript, full frontend/native, CLI/build/audit, package, and signed-image evidence is recorded in the milestone verification file |

Compatibility bounds remain explicit: Brunomnia continues to store typed file state inside one atomic project document rather than separate database records, and Insomnia v5 certificate interchange remains constrained by its document schema. Cloud discovery and provider onboarding remain open. Local projects and persistence stays `Baseline`; exactly 15 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 252 — authoritative physical typed-file records (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Physical format | Complete | One bounded project manifest stores project-level state and an ordered identity-bound record index; each visible Collection, Document, Mock Server, root Environment branch, and MCP Client has one authoritative record, with a Document's generated Collection and every file's cookies/certificates stored beside its owner |
| Native persistence | Complete | App-data saves stage a complete manifest/record generation, rotate the prior valid generation into a matching backup, roll back failed replacement, reject symlinked/non-regular record stores, and preserve corrupt manifests plus records for recovery |
| Browser persistence | Complete | Browser catalogs use generation-specific local-storage records referenced by primary/backup manifests, retain exact records through delete/restore, remove only identity-scoped records during purge/Empty, and migrate aggregate documents on first catalog initialization or save |
| Recovery lifecycle | Complete | Read, catalog reconstruction, rename, duplicate/move saves, snapshot creation/restore, backup restore, delete/trash/list/restore/purge/Empty, runtime-credential wrapping, and genuinely empty projects assemble through the same format; one corrupt record makes the primary recoverable from its last valid backup rather than silently dropping a file |
| CLI continuity | Complete | The packaged CLI detects a native physical manifest, accepts only bounded `record-00000.json` sibling files in a regular non-symlink directory, enforces per-file/aggregate size limits, binds payload identities to the manifest, and assembles the ordinary workspace before migration/execution |
| Executable evidence | Complete | Shared splitter/assembler, browser catalog, CLI filesystem, native format, corruption fallback, credential, backup, snapshot, trash, and legacy-migration regressions plus the full release gates are recorded in the milestone verification file |

Compatibility bounds remain explicit: immutable project snapshots remain self-contained aggregate recovery artifacts, while active native/browser project persistence is physically split by typed file. Cloud discovery and provider onboarding remain open, so Local projects and persistence stays `Baseline`. Collections, requests, environments, and history is now `Complete`; exactly 14 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 253 — automatic all-region Konnect reconciliation (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned sync audit | Complete | Pinned Insomnia scans `us`, `eu`, `au`, `in`, and `sg`, creates/updates one Project per control plane and one Collection workspace per Gateway Service, fetches service Routes at concurrency five, deletes stale service workspaces/projects only when safe, reports counts/progress/duration, and never pushes Gateway configuration |
| Regional API contract | Complete | Brunomnia uses exact page-number control-plane and offset Service/Route pagination, bounded repeated-offset defense, 30-second requests, five retries for `429`, standard regional origin derivation, and the pinned Singapore permission-gap behavior |
| Managed project model | Complete | Workspace v44 stores bounded control-plane region/cluster/deployment and coordinator ownership metadata; one credential-free local project per control plane receives a root Environment and source-backed service Collections while preserving local route/folder/environment work |
| Inactive persistence | Complete | Browser and native catalogs create managed projects without changing the active project; the renderer invalidates stale coordinator autosaves, locks project switching during reconciliation, refreshes the sidebar, and never copies the PAT into managed projects |
| Safe reconciliation | Complete | A pure planner consumes one existing project per region/control-plane key, removes duplicates/stale projects only in successful regions, retains failed-region projects and cached discovery, and strips ownership metadata from imported/shared/duplicated documents |
| Evidence and UI | Complete | The Konnect workbench exposes Sync all, live progress, created/updated/deleted/skipped counts, duration, skipped regions, and bounded skipped-route reasons; focused browser/native/pagination/retry/reconciliation regressions and an opt-in live tenant fixture cover the path |
| Current docs audit | Complete | The full Kong Developer Insomnia tree at `73995e32ed758882a290c945807225d7442b483e` contains one service integration page, Konnect, so no newly documented adapter remains |

Compatibility bounds remain explicit: managed project ownership is scoped to the local coordinator rather than a Brunomnia account or hosted organization, preserving the account-free architecture. Credentialed live execution remains opt-in and is skipped without environment-provided tenant authority. Service integrations is now `Complete`; exactly 13 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 254 — provider-guided Git onboarding (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned provider audit | Complete | Pinned Insomnia exposes reusable GitHub, GitLab, custom, and native credentials; provider validation; GitHub/GitLab repository APIs; author-email selection; manual URL fallback; branch selection; repository scans; and clone-location onboarding |
| Reusable credential store | Complete | Up to 100 GitHub, GitLab, or custom HTTP(S) records are device-global and reusable across projects; credential names, providers, usernames, and tokens are authenticated inside one bounded AES-256-GCM payload whose random master key remains in macOS Keychain, while projects persist only a selected credential ID |
| Provider validation and discovery | Complete | GitHub validates `/user`, optionally discovers `/user/emails`, and paginates pullable `/user/repos`; GitLab validates `/user` and paginates membership `/projects`, with bounded 30-second/no-redirect/2 MB page and 20-page/2,000-repository limits |
| Transient Git authentication | Complete | GitHub, GitLab, and custom credentials are validated against the exact HTTP(S) remote host and passed to Git through host-scoped environment-backed credential helpers; tokens never enter command arguments, repository configuration, project YAML, exports, collaboration payloads, or duplicated workspaces. Installed Git helpers and SSH agents remain the native fallback |
| Guided repository workflow | Complete baseline | One four-step flow selects/adds/edits/removes credentials, shows validation identity, automatically lists provider repositories, permits manual URLs, discovers remote branches, offers provider author emails, requires a selected-branch scan, and clones the exact branch into the chosen destination |
| Bounded remote scan | Complete | A temporary depth-one filtered no-checkout clone reads only the selected branch tree, reports up to 50,000 repository files plus Brunomnia, Insomnia, and common API-spec counts, and is removed automatically; branch/ref parsing and local-bare-remote fixtures cover the behavior without external authority |
| Existing-project continuity | Complete | Fetch, remote-branch checkout, pull, push, remote-access preflight, direct commit-and-push, and grouped commit-and-push all reuse the selected global credential; changing the remote to an incompatible host refuses before exposing provider credentials |

Compatibility bounds remain explicit: built-in GitHub/GitLab authentication uses user-created provider tokens rather than a Brunomnia-hosted OAuth client or account broker; custom credentials deliberately support user-selected HTTP as well as HTTPS to match the pinned generic provider. System Git helpers and SSH remain available for enterprise hosts and native authentication. Git Sync and version control is now `Complete`; exactly 12 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 255 — corrective local-project boundary audit (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned project-type audit | Complete | Pinned `project-type-select.tsx` defines Local Vault, Cloud Sync, and Git Sync as three separate storage types; Local Vault is device-local/offline, Cloud Sync is organization-backed, and Git Sync uses the provider flow completed in Milestone 254 |
| Local persistence | Complete | Account-free create/switch/rename/duplicate/reorder/delete/trash/restore/snapshot flows, genuinely empty projects, project-scoped vaults, typed-file duplication/moves, per-file cookies/certificates, physical records, backups, corruption recovery, legacy migration, and CLI assembly already cover the pinned local storage contract |
| Cloud boundary | Complete | Pinned organization synchronization reads an authenticated user session, downloads organizations/projects, and redirects into a discovered cloud project; those capabilities belong only to Cloud sync and collaboration and remain honestly open in that row |
| Git boundary | Complete | Local Vault may add Git Sync, but credential/provider/repository onboarding and the ordinary Git lifecycle are owned by the now-complete Git Sync row rather than duplicated as local-persistence gaps |
| No false requirement | Complete | Local-project completion does not claim hosted organization discovery, real-time collaboration, comments, cloud branches/history, or per-user key wrapping; it removes only the cross-row double counting |

Compatibility bounds remain explicit: Brunomnia's richer local snapshots, physical typed-file records, and browser fallback are account-free extensions, not substitutes for the still-open Cloud Sync service. Local projects and persistence is now `Complete`; exactly 11 parity rows remain incomplete, so Brunomnia is not declared feature-complete. No executable behavior changed in this corrective audit.

## Milestone 256 — embedded OAuth authentication challenges (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Corrective pinned audit | Complete | Pinned `authorize-user-in-window.ts` has exactly two explicit certificate behaviors: session-wide auth TLS validation and Electron's client-certificate event; its smoke suite uses one local OIDC fixture rather than a credentialed provider/OS matrix |
| Safe WebKit hook | Complete | The OAuth window starts on `about:blank`, installs WebKit's optional authentication-challenge selector on Wry's existing navigation-delegate class, registers a per-WebView policy, and only then navigates to the authorization URL; destruction removes the policy |
| Server trust | Complete | Enabled validation delegates to platform trust, disabled auth validation returns a credential for the exact WebKit server-trust challenge, repeated failed challenges cancel, and all other HTTP/proxy/authentication variants keep platform default handling |
| Client identity | Complete | The frontend reuses port-first/host-fallback file-owned certificate selection; bounded PEM, modern/legacy PKCS#12, EC SEC1/PKCS#8, and RSA PKCS#1 material becomes an in-memory Security.framework identity without adding private material to macOS Keychain |
| Origin confinement | Complete | A configured identity is offered only when the challenge protocol, case-insensitive host, and effective port match the original authorization origin; redirects cannot solicit that identity from another origin |
| Executable evidence | Complete | IPC regressions, Security.framework identity/credential construction, optional-selector registration, challenge classification, full 655-test frontend and 161-test native suites, strict build/clippy/audit, CLI smokes, and an app-only Tauri bundle verify the closure |

Compatibility bounds remain explicit: macOS is Brunomnia's packaged desktop target for this WebKit implementation. Provider-specific hosted credentials are not required to reproduce a protocol and TLS challenge contract that the pinned project itself tests with a local OIDC provider. Rendered interaction QA remains omitted by standing direction. Request authentication is now `Complete`; exactly 10 parity rows remain incomplete, so Brunomnia is not declared feature-complete.

## Milestone 257 — complete REST/HTTP execution (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Wire/content accounting | Complete | Native compressed transfer bytes and decoded entity bytes remain distinct through response badges, history, timeline, plugins, Runner, and HAR |
| Response compatibility | Complete | Pinned JSON/doctype sniffing, default HTML authority, response-URL-relative resources, and bounded nested multipart viewing match the exposed workbench operations |
| Transport evidence | Complete | Negotiated encoding/protocol, redirects, duplicate final headers, effective URL, connection/TLS/proxy summaries, and classified failures remain visible without fabricating libcurl callback internals |
| Verification | Complete | Focused/full frontend and native regressions, strict builds, CLI smokes, app packaging, and signed-container evidence are recorded in [Milestone 257 verification](QA_MILESTONE_257.md) |

Compatibility bounds distinguish user-visible HTTP operations from Electron/libcurl implementation identity. `REST/HTTP execution` is `Complete`; nine parity rows remained incomplete after this milestone.

## Milestone 258 — complete permission-bounded scripting (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Portable isolation | Complete | Trusted CLI scripts execute in disposable resource-limited Workers around a restricted VM with mediated file/network/vault authority |
| Vault contract | Complete | The pinned read-only `get`, `has`, `replaceIn`, and `toObject` surface works while mutations remain denied |
| Encrypted identities | Complete | Modern and legacy password-protected PEM keys join existing PEM/PFX transport selection without persisting decrypted key material |
| Verification | Complete | Worker/sandbox, identity, full frontend/native, CLI smoke, build, package, and signed-container evidence are recorded in [Milestone 258 verification](QA_MILESTONE_258.md) |

Compatibility bounds do not claim npm-package implementation identity or filesystem-write/external-provider script APIs that pinned Insomnia does not expose. `Pre-request and after-response scripts` is `Complete`; eight parity rows remained incomplete after this milestone.

## Milestone 259 — complete Runner and automated tests (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Data files | Complete | Runner upload uses pinned `chardet` 2.1.1 detection with the existing 41-label picker and portable decoders |
| Result statistics | Complete | Saved/live request cards use compressed wire bytes when native transport supplies them and decoded fallback otherwise |
| Pinned operation audit | Complete | Planning, execution, live feedback, flow control, filtering, history, cancellation, result cards, tabs, CLI commands, and report operations have executable coverage |
| Verification | Complete | Focused/full frontend, native, build, CLI smoke, package, and signed-container evidence are recorded in [Milestone 259 verification](QA_MILESTONE_259.md) |

Compatibility bounds omit shared transport internals and package-maintainer commands that are not distinct Runner operations. `Collection runner and automated tests` is `Complete`; seven parity rows remained incomplete after this milestone.

## Milestone 260 — deployable account-free mock servers (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Deployment artifact | Complete | The mock workbench exports a bounded versioned route file with no account, organization, credential, or entitlement state |
| Shared headless runtime | Complete | Tauri and standalone executables reuse the same renderer, support graceful stop and safe live reload, and preserve the last valid routes during partial writes |
| Portable hosting | Complete | A pinned non-root multi-architecture OCI workflow supports Docker, Kubernetes, reverse proxies, and user-selected public infrastructure |
| Verification | Complete | Frontend/native/standalone suites, strict checks, live-reload smokes, constrained container execution, signing, attestations, and transparency evidence are recorded in [Milestone 260 verification](QA_MILESTONE_260.md) |

Compatibility bounds do not claim a Brunomnia-operated hosting service; public DNS, TLS, reachability, and infrastructure belong to the user's host. `Mock servers` is `Complete`; six parity rows remained incomplete after this milestone.

## Milestone 261 — complete import and export operations (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Legacy and batch import | Complete | Insomnia v1–v3 migrate through the pinned v4 model; files/folders apply multiple artifacts with per-file failures and replacement isolation |
| Postman data dumps | Complete | Stored/deflate ZIPs receive manifest classification, CRC/size checks, bounded streaming expansion, and strict encryption/ZIP64/multidisk refusal |
| MCP URL import | Complete | Bounded credential-free HTTP(S) URLs create first-class disabled clients whose credential/runtime fields remain cleared |
| Selective export | Complete | Request subsets retain ancestor folders/order and matching or unbound standalone tests across compatible collection formats |
| Private-value consent | Complete | Effectively private environment trees are omitted by default and included only through an explicit warning-bearing control |
| Verification | Complete | Legacy, batch/ZIP, MCP, selection, and consent regressions plus TypeScript, full frontend, and production-build gates are recorded in [Milestone 261 verification](QA_MILESTONE_261.md) |

Compatibility bounds remain explicit for database-only v5 proto references, partially translatable deprecated scripts, external local-file paths, WSDL sample placeholders, and formats without binary embedding. `Import and export formats` is now `Complete`; exactly five parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 262 — documented plugin context and CLI hooks (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Request/response context | Complete baseline | Documented body/header/parameter/auth/environment/cookie/settings methods, URL-encoding persistence, exact response bytes, duplicate headers, and bounded body streams work behind read/write grants |
| Host context | Complete baseline | Normalized secondary requests, dialogs/prompts, clipboard clear/read/write, desktop paths, save-path prompting, and raw/URI import plus Insomnia/HAR export use explicit host RPC and separate app/data/private grants |
| Actions and themes | Complete baseline | Request-group actions receive the selected group and descendant requests; request/workspace/document models remain available; style targets and bounded sanitized raw CSS augment parsed theme colors |
| Local source lifecycle | Complete baseline | Nested Insomnia package display metadata is recognized, package roots remain linked, and explicit reload disables changed code and removes every prior grant |
| CLI execution | Complete baseline | `--allow-plugins` runs granted request hooks, response hooks, and template tags for collection/suite HTTP/GraphQL sends in disposable resource-limited workers without host RPC or persistent writes |
| Verification | Complete | Context/action/runtime, request/storage/interchange, full frontend, production build, native package-reader, aggregate Rust, format, and strict clippy evidence is recorded in [Milestone 262 verification](QA_MILESTONE_262.md) |

Compatibility bounds at M262 remained explicit: remote/npm installation, dependency resolution, external plugin-directory discovery, exact upstream context-menu placement, broad Node/native-module/plugin-ecosystem compatibility, and CLI host RPC/user-invoked actions were open. Milestone 263 closes bounded manual directory discovery and relative package modules, while pinned source confirms file watching is not an upstream operation. Pinned realtime routes bypass hooks. `Plugins and extension API` therefore remains `Baseline`; exactly five parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 263 — bounded multi-file plugin packages (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Pinned loader audit | Complete | Pinned source scans the default/extra roots and their `node_modules`, descends scoped folders, requires an `insomnia` manifest, and reloads explicitly; no file watcher exists |
| Native package map | Complete baseline | Direct reads and directory discovery canonicalize roots, reject traversal/symlinks, exclude dot/dependency folders, and retain only bounded UTF-8 JavaScript/JSON files plus the declared entry |
| Relative CommonJS | Complete baseline | Package-local `./`/`../`, extension, JSON, and directory-index resolution uses one operation-local cache with isolated `module`, `exports`, `require`, `__dirname`, and `__filename` values |
| Review and authority | Complete baseline | Every retained module is selectable for review, permission inference covers the full package, new/changed code starts disabled without data/grants/theme authority, and unchanged rediscovery preserves reviewed grants |
| Portable persistence | Complete baseline | Bounded module maps survive workspace migration and the opt-in CLI uses the same relative loader while continuing to deny host RPC, persistent writes, and arbitrary bare dependencies |
| Verification | Complete | Package discovery, module loading/denial, persistence, focused/full frontend, production/CLI build, aggregate native, formatting, and strict clippy evidence is recorded in [Milestone 263 verification](QA_MILESTONE_263.md) |

Compatibility bounds remain explicit: remote npm/custom-registry installation, dependency download, the pinned curated bare-module registry (`path`, `crypto`, `events`, `uuid`, and `ajv`), Node/native dependency behavior for host hooks/actions, exact context-menu placement, broader ecosystem compatibility, and CLI host RPC/user-invoked actions remain. `Plugins and extension API` stays `Baseline`; exactly five parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Milestone 264 — pinned curated plugin modules (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| Registry contract | Complete baseline | Baseline `buffer`/`path`/`crypto`, grantable `events`, exact manifest and unavailable denials, aliases, operation-local caching, and heavy-library lazy inclusion match the pinned registry boundary |
| Crypto compatibility | Complete baseline | Synchronous MD5/SHA-1/SHA-256/SHA-384/SHA-512 chained digests, hex/base64 output, algorithm-aware HMAC, 64 KiB-clamped random bytes, and random UUIDs pass host-reference vectors |
| Vendored libraries | Complete baseline | Deterministically generated exact `uuid` 11.1.1 and `ajv` 8.18.0 bundles pass pinned version, v1/v3/v4/v5/namespace, nested/schema/error/reuse, and heavy-grant regressions |
| Review and authority | Complete baseline | Native manifests parse bounded `insomnia.permissions.modules`; complete package inference merges requests, unavailable names stay visible, and edit/reload/changed discovery/import clears module grants while unchanged rediscovery preserves reviewed authority |
| Portable execution | Complete baseline | Desktop and opt-in CLI workers share the same curated registry without exposing Node process/global authority or adding host RPC/persistent writes |
| Verification | Complete | Vendored freshness, focused/full frontend, production/CLI build, focused/aggregate native, formatting, and strict clippy evidence is recorded in [Milestone 264 verification](QA_MILESTONE_264.md) |

Compatibility bounds remain explicit: remote/custom-registry installation, dependency download and native dependency behavior for host-loaded hooks/actions, exact context-menu placement, broader ecosystem compatibility, and CLI host RPC/user-invoked actions remain. `Plugins and extension API` stays `Baseline`; exactly five parity rows remain incomplete, so Brunomnia is not declared feature-complete. Rendered interaction and assistive-technology QA remain omitted by standing direction.

## Architectural boundaries

- Protocol implementations live in Rust crates and expose serializable commands/events.
- The React renderer owns presentation and transient editor state, never unrestricted network access.
- Workspace migrations are explicit, versioned, and reversible through export.
- Cloud or hosted integrations are adapters; local project access cannot depend on them.
- No milestone introduces commercial entitlement checks. See [FREE_FEATURE_POLICY.md](FREE_FEATURE_POLICY.md).
- The source-backed feature comparison lives in [PARITY.md](PARITY.md); roadmap completion alone is not evidence of parity.
