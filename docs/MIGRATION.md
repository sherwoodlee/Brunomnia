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

Compatibility bounds remain explicit: OAuth 2 authorization uses a copied authorization URL and manual returned code/token rather than an embedded callback listener; Netrc contents are project data until the secrets milestone; MD5, file/external-vault template tags, full Faker/JSONPath breadth, arbitrary Spectral JavaScript/functions/remote `extends`, and script-originated network/module access remain deferred. Browser-only HTTP still obeys browser CORS and forbidden-header behavior. WebSocket custom proxy/client identity and headless CLI streaming/auth parity remain later closure work.

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

Compatibility bounds remain explicit: shared-file encryption uses one team passphrase rather than per-user public-key wrapping; synchronization is pull/push rather than real-time presence; server-mediated comments, per-resource Cloud Sync branches/history, offline merge UI, and automatic device discovery remain. Local roles are policy metadata and action checks, not strong identity authentication. Self-hosted SAML/OIDC login, SCIM provisioning, tamper-evident remote audit storage, provider SDK login flows, private-environment hierarchy, script vault access, and headless external-vault parity remain later closure work.

## Milestone 8 — MCP, AI, and service integrations

- MCP clients over HTTP and STDIO with cached tools, prompts, resources, and project serialization
- User-selected hosted, custom URL, and local model providers; no required Brunomnia-hosted model
- Optional local AI mock generation and Git commit grouping
- Free adapters for Konnect/Gateway workflows and other documented product integrations

## Milestone 9 — parity closure and release hardening

- Re-audit the current Insomnia documentation and release notes against [PARITY.md](PARITY.md)
- Close remaining settings, shortcut, UX, packaging, migration, and compatibility gaps
- Cross-platform installers, signing/notarization guidance, accessibility audit, load/performance testing, and recovery tests
- Declare parity only after every ledger row has reproducible evidence

## Architectural boundaries

- Protocol implementations live in Rust crates and expose serializable commands/events.
- The React renderer owns presentation and transient editor state, never unrestricted network access.
- Workspace migrations are explicit, versioned, and reversible through export.
- Cloud or hosted integrations are adapters; local project access cannot depend on them.
- No milestone introduces commercial entitlement checks. See [FREE_FEATURE_POLICY.md](FREE_FEATURE_POLICY.md).
- The source-backed feature comparison lives in [PARITY.md](PARITY.md); roadmap completion alone is not evidence of parity.
