# Tauri migration map

Brunomnia uses a staged clean-room rewrite. The current repository is intentionally small enough to audit and run while protocol and ecosystem support are added behind stable interfaces.

## Milestone 1 — runnable native foundation

| Capability | Status | Notes |
| --- | --- | --- |
| Tauri 2 desktop shell | Complete | Native bundle configuration and app icons included |
| REST/HTTP transport | Complete | Rust `reqwest`, redirects, 60-second timeout, arbitrary headers/body |
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
| Server-Sent Events | Complete | Native incremental parser handles chunk boundaries, CRLF, comments, named events and multiline data |
| gRPC schema discovery | Complete | Server Reflection v1 and pasted `.proto` compilation into a local descriptor pool |
| gRPC execution | Complete | Dynamic protobuf JSON mapping; unary, client-streaming, server-streaming and bidirectional calls |
| Rich HTTP bodies | Complete | None, JSON, text, URL-encoded, multipart text/files and binary files |
| Transport configuration | Complete for HTTP/SSE | Redirect policy, timeout, certificate validation, HTTP proxy and PEM client identity |
| gRPC TLS | Complete | System trust roots, timeout and PEM client identity |
| WebSocket TLS | Baseline | System trust roots and arbitrary handshake headers; custom proxy/client identity is deferred |
| Workspace migration | Complete | Version 1 workspaces migrate in place to the version 2 protocol schema |

Streaming gRPC currently returns up to 100 messages within the configured deadline. WebSocket binary frames are reported with their byte count; binary-frame composition is deferred. These bounds are product behavior, not commercial gates.

## Milestone 3 — design, test, and automation (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| OpenAPI design editor | Complete baseline | OpenAPI 3.x YAML/JSON editing, formatting, parsed preview, and version/title/operation metadata |
| OpenAPI linting | Complete baseline | Structural rules cover document metadata, paths, operations, responses, operation IDs, and path parameters; Spectral-compatible custom rulesets are deferred |
| Request generation | Complete baseline | Generates or refreshes a runnable collection from servers, paths, parameters, and request-body examples |
| Pre-request scripts | Complete baseline | Two-second worker/VM boundary with environment mutation, request header mutation, and captured console output; Node modules, DOM, and script-originated network access are unavailable |
| After-response tests | Complete baseline | `insomnia.test`, response helpers, console output, and a focused `expect` matcher set with results in the response pane |
| Collection runner | Complete baseline | Ordered runs, 1–1000 iterations, JSON/CSV data, up to 10 retries, delays, cancellation, environment propagation, and stored reports |
| Local mocks | Complete baseline | Native loopback-only Axum server, method/path matching, path parameters, status/headers/body/delay/CORS, and timestamp/UUID/path tokens |
| Headless CLI | Complete baseline | Lint/generate/export plus collection/test runs using the shared OpenAPI and runner modules |
| Workspace migration | Complete | Version 1 and 2 workspaces migrate in place to version 3 design, mock, and report resources |

Current compatibility bounds are explicit: linting is not yet Spectral ruleset parity; the script API is a safe compatibility subset; mock templating is not yet Liquid/Faker parity; browser-only mock start/stop is a UI simulation because a browser cannot bind a server; CLI collection execution currently supports HTTP and GraphQL; and streaming runner semantics for WebSocket/SSE are deferred.

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

Compatibility bounds remain explicit: nested source folders are represented in flattened request names; Postman scripts are translated only for the supported permission-bounded API; local file references must be selected again; WSDL message schemas become editable SOAP placeholders; Socket.IO becomes a WebSocket baseline and MCP becomes an HTTP baseline with source metadata; and binary payload bytes are not embedded in compatibility exports.

## Milestone 5 — request and authentication fidelity (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Advanced authentication | Complete baseline | Digest, OAuth 1.0/2.0, NTLM, AWS IAM v4, Hawk, Atlassian ASAP, and Netrc editors/execution; Digest, NTLM, and Netrc challenge/file behavior runs in the native transport |
| Cookie jar | Complete baseline | Persistent workspace jar, RFC-oriented domain/path/secure/expiry matching, Set-Cookie capture, editing/deletion, and per-request send/store controls |
| Chaining and dynamic values | Complete baseline | Latest-response body/status/header/URL chaining, JSONPath extraction, iteration/request-local/environment variables, UUID/time/Faker/encoding/hash/cookie/prompt/request tags, and actionable missing-dependency errors |
| Transport fidelity | Complete baseline | Proxy exclusions, exact/wildcard certificate domains, editable multipart filename/content type, duplicate parts, and text/file/binary payloads |
| WebSocket and runner fidelity | Complete baseline | Text and base64/file binary composition; bounded WebSocket/SSE collection-run samples with optional WebSocket startup frames |
| Custom lint | Complete baseline | Safe local Spectral-style `rules`/`given`/`then` support for truthy/falsy/defined/enumeration/length/pattern/casing; CLI accepts `--ruleset` |
| Script/test API | Complete baseline | Environment/base/collection/local/iteration variable APIs, replacement helpers, request getters/setters, response header/cookie helpers, console capture, and Jest/Chai-style expectation aliases |
| Interoperability and migration | Complete | Workspace v5, advanced Insomnia/Postman auth mapping, Insomnia v4/v5 cookie-jar round trips, and collision-safe cookie import |

Compatibility bounds remain explicit: OAuth 2 authorization uses a copied authorization URL and manual returned code/token rather than an embedded callback listener; Netrc contents are project data until the secrets milestone; MD5, file/external-vault template tags, full Faker/JSONPath breadth, and arbitrary Spectral JavaScript/functions/remote `extends` remain deferred. Browser-only HTTP still obeys browser CORS and forbidden-header behavior. WebSocket custom proxy/client identity and headless CLI streaming/auth parity remain later closure work. The later permission-bounded scripting expansion is recorded in Milestone 12.

## Milestone 6 — Git Sync and extensibility (complete)

| Capability | Status | Notes |
| --- | --- | --- |
| Filesystem projects | Complete baseline | Stable split YAML for project metadata, collections, environments, designs, and mocks; a manifest limits cleanup to Brunomnia-owned paths and leaves unrelated repository files untouched |
| Git workflow | Complete baseline | Standard `.git` repositories with init/clone/status, staged and working diffs, stage/unstage, commit author overrides, local branch create/switch, remotes, pull, push, and merge |
| Conflict resolution | Complete baseline | Base/ours/theirs text views, editable resolutions, binary ours/theirs selection, deleted-side handling, staging, and explicit merge abort |
| Plugin installation | Complete baseline | Pasted JavaScript or a local dependency-free CommonJS file/package; every install starts disabled and changing source clears grants |
| Extension API | Complete baseline | Request/response hooks, custom template tags, request/workspace/document actions, themes, local storage, notifications, and mediated network/prompt/clipboard calls |
| Extension isolation | Complete baseline | Two-second disposable Worker, one-megabyte source limit, blocked ambient network/DOM/module loading, explicit per-capability grants, sanitized theme colors, and import-time authority removal |
| Workspace migration | Complete | Versions 1–5 migrate to workspace v6 project, plugin, plugin-data, and theme fields; imported plugins are disabled and stripped of grants/data |
| Documentation and evidence | Complete | [Git project guide](GIT_PROJECTS.md), [plugin guide](PLUGINS.md), and [Milestone 6 verification](QA_MILESTONE_6.md) |

Compatibility bounds remain explicit: Git credential setup uses the user's installed Git and credential helper; commit-history browsing, provider-specific onboarding, rebase/cherry-pick, and automatic project discovery remain later work. The plugin adapter intentionally does not install remote packages or arbitrary npm dependencies, and it implements a focused Insomnia-style CommonJS/context subset rather than the entire plugin ecosystem. Streaming request hooks, file watching/hot reload, plugin dependency resolution, and complete hook/context/template-argument compatibility remain in the parity ledger.

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

Compatibility bounds remain explicit: shared-file encryption uses one team passphrase rather than per-user public-key wrapping; synchronization is pull/push rather than real-time presence; server-mediated comments, per-resource Cloud Sync branches/history, offline merge UI, and automatic device discovery remain. Local roles are policy metadata and action checks, not strong identity authentication. Self-hosted SAML/OIDC login, SCIM provisioning, tamper-evident remote audit storage, provider SDK login flows, OS-keychain wrapping, script access to external providers, and headless external-vault parity remain later closure work.

## Milestone 8 — MCP, AI, and service integrations (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| MCP project model | Complete baseline | Multiple disabled-by-default HTTP or STDIO clients, headers/auth/roots, cached tools/prompts/resources/resource templates, event records, workspace v8 migration, and split-YAML project serialization |
| MCP HTTP transport | Complete baseline | JSON-RPC initialization, session headers, JSON and JSON-bearing SSE responses, paginated discovery, invocation, loopback HTTP/remote HTTPS confinement, no redirects/cookies, and vault-backed bearer/Basic/custom-sensitive-header execution |
| MCP STDIO transport | Complete baseline | Direct executable/argument spawning without a shell, initialization, discovery/invocation, roots responses, bounded stdout/stderr/events/parameters, deadline enforcement, and explicit refusal of unreviewed server sampling/elicitation requests |
| AI providers | Complete baseline | Optional OpenAI, Anthropic, Gemini, and custom/local OpenAI-compatible endpoints; hosted credentials execute only through local-vault or approved external-vault references |
| AI workflows | Complete baseline | Explicit mock generation from pasted prompt/spec/example input plus bounded, reviewable Git commit grouping/message suggestions; no Brunomnia account or provider is required |
| Konnect integration | Complete baseline | PAT-authenticated control-plane discovery and pull-only Gateway Service/Route mapping, local-field preservation, generated proxy-host variables, and a Skipped Routes collection for unsupported protocols |
| Security and migration | Complete | Imported integrations are disabled and credential fields cleared; endpoint/command changes revoke MCP enablement; AI/Konnect settings remain device-local; plaintext integration credentials are detected and blocked from managed publication |
| Documentation and evidence | Complete | [MCP, AI, and Konnect guide](MCP_AI_KONNECT.md) and [Milestone 8 verification](QA_MILESTONE_8.md) |

Compatibility bounds remain explicit: HTTP MCP OAuth discovery/redirect handling, long-lived streaming sessions, cancellation, interactive elicitation, reviewed sampling, notification response UI, persistent STDIO processes, and a guided resource-template argument editor remain. Custom/local AI means an OpenAI-compatible loopback endpoint; Brunomnia does not yet load `.gguf` files itself. AI response-to-mock/URL fetching is not automatic, and MCP sampling is never silently forwarded. Konnect has a pull-only mapper and no live credential fixture in the repository; SNI/TCP/UDP routes are recorded as unsupported rather than misrepresented.

## Milestone 9 — GraphQL productivity and desktop preferences (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| GraphQL introspection | Complete baseline | Explicit and automatic URL/request-selection introspection through the existing native transport, with redirects/cookie storage disabled and bounded normalized schema caches |
| GraphQL authoring | Complete baseline | Query/variables composition, operation name, structural checks, cached root-field validation, root-field search/insertion, deprecation display, and type documentation browsing |
| GraphQL template boundary | Complete | Query template syntax remains literal to match Insomnia; variables retain local/vault/external template support |
| Request scheduling | Complete baseline | Initial delay, sequential repeat interval, stop-future-runs control, and a 1,000-send local safety bound |
| Desktop preferences | Complete baseline | System/dark/light appearance, comfortable/compact density, editor font size, new-request timeout, apply-to-existing timeout, GraphQL auto-fetch, and delete confirmation |
| Keyboard shortcuts | Complete baseline | Ten device-local editable bindings, platform `Mod` abstraction, collision warnings, clearing/reset, URL focus, request create/duplicate/delete, history, sidebar, environment, send, Preferences, and palette actions |
| Workspace migration | Complete | Versions 1–8 migrate to v9 bounded GraphQL schema cache fields and normalized device-local preferences; imports receive safe defaults and project/encrypted-sync reads preserve local preferences |
| Documentation and evidence | Complete | [GraphQL and preferences guide](GRAPHQL_AND_PREFERENCES.md) and [Milestone 9 verification](QA_MILESTONE_9.md) |

Compatibility bounds remain explicit: validation is structural plus cached root-field checking rather than a complete GraphQL language server; persisted queries, subscriptions, full nested selection/argument/type validation, and introspection-disabled manual schema import remain open. Scheduled stop cancels future runs but does not abort a request already in flight. Preferences do not yet cover every upstream action, accessibility has not received a full assistive-technology audit, and release packaging remains macOS debug-app evidence rather than signed cross-platform distribution.

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

Compatibility bounds remain explicit: drag/drop ordering, bulk folder actions, rendered Markdown, environment-tree reordering, richer collected-data UI, and a full template-tag builder remain open. Private values are omitted rather than encrypted by private-environment storage itself; vault references remain the encrypted-secret path. Insomnia compatibility export cannot represent every Brunomnia hierarchy variant or unsupported protocol without the warnings already recorded by the interchange layer.

## Milestone 11 — request authoring and local client code (complete baseline)

| Capability | Status | Notes |
| --- | --- | --- |
| HTTP methods | Complete baseline | Standard-method suggestions plus bounded, token-valid custom methods through desktop, native transport, import/export, history, runner, and CLI models |
| Request parameters | Complete baseline | Explicit `{name}` path rows with encoded substitution, ordered repeated query keys, row enablement, descriptions, and multiline values |
| Body authoring | Complete baseline | Local JSON and conservative XML beautification without network calls or silent modification of unrecognized text |
| Client code generation | Complete baseline | Local previews for cURL, JavaScript Fetch, Python Requests, Go `net/http`, Java `HttpClient`, and C# `HttpClient`, using effective inherited configuration and the active environment |
| Interchange | Complete baseline | OpenAPI path parameter generation plus Insomnia v4/v5 and Postman import/export preservation for custom methods, path rows, descriptions, and multiline values |
| Workspace migration | Complete | Versions 1–10 migrate to v11 bounded method tokens, normalized path/query/header/form/metadata rows, descriptions, and the Generate Code shortcut |
| Documentation and evidence | Complete | [Request authoring and client-code guide](REQUEST_AUTHORING.md) and [Milestone 11 verification](QA_MILESTONE_11.md) |

Compatibility bounds remain explicit: generated snippets do not yet embed multipart or binary bytes, reproduce runtime-specific Digest/OAuth 1/IAM/Hawk/ASAP/NTLM/Netrc signing, validate target-language syntax, or run generated code. Those omissions produce visible warnings. The local XML formatter is intentionally conservative rather than a schema-aware canonicalizer. The scripting expansion is recorded separately in Milestone 12.

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
| Workspace migration | Complete | Versions 1–11 migrate to v12 safe script timeout and disabled network/vault grants; imports reset authority and shared reads preserve device-local preferences |
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
| CLI boundary | Complete | Trusted Node VM requires both `--allow-scripts` and the separate `--allow-script-files` authority flag |
| Limits | Complete | Regular files only, 5 MB per file, 20 file references, and 20 MB aggregate per script result |
| Workspace migration | Complete | Versions 1–13 migrate to v14 with disabled script-file authority; imported/shared data cannot grant it |
| Verification fixture | Complete | The offline CLI fixture proves denial without file authority and exact attachment bytes with explicit consent |
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
| CLI output | Complete | `--reporter`/`-r` select a format and `--output`/`-o` writes it without changing pass/fail exit codes |
| Strict typecheck | Complete | Five scripting regressions exposed by a clean non-incremental TypeScript pass were repaired before accepting the release gate |
| Documentation and evidence | Complete | [Runner reports and CI](RUNNER_REPORTS.md) and [Milestone 20 verification](QA_MILESTONE_20.md) |

Compatibility bounds remain explicit: Brunomnia does not claim byte-identical Mocha reporter cosmetics. Request selection/drag ordering, response bodies in reports, `--bail`, test-name filtering, every Inso command/configuration flag, all protocol semantics, and signed container/install artifacts remain open.

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

## Milestone 22 — remaining parity closure and release hardening

- Re-audit the current Insomnia documentation and release notes against [PARITY.md](PARITY.md)
- Close remaining nested-resource, environment inheritance, protocol, scripting, extension, collaboration, and CLI gaps
- Cross-platform installers, signing/notarization guidance, accessibility audit, load/performance testing, and recovery tests
- Declare parity only after every ledger row has reproducible evidence

## Architectural boundaries

- Protocol implementations live in Rust crates and expose serializable commands/events.
- The React renderer owns presentation and transient editor state, never unrestricted network access.
- Workspace migrations are explicit, versioned, and reversible through export.
- Cloud or hosted integrations are adapters; local project access cannot depend on them.
- No milestone introduces commercial entitlement checks. See [FREE_FEATURE_POLICY.md](FREE_FEATURE_POLICY.md).
- The source-backed feature comparison lives in [PARITY.md](PARITY.md); roadmap completion alone is not evidence of parity.
