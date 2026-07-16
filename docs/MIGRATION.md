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

## Milestone 4 — import and export interoperability

- Import Insomnia JSON v4/v5, Postman Collection 2.0/2.1, HAR, OpenAPI 3.0/3.1, Swagger 2, WSDL, and cURL
- Export stable Brunomnia JSON/YAML plus portable OpenAPI and request snippets
- Preserve folders, environments, auth, scripts, and unsupported-source metadata with actionable conversion warnings
- Add round-trip fixtures and compatibility tests for every adapter

## Milestone 5 — request and authentication fidelity

- Digest, OAuth 1.0/2.0, NTLM, AWS IAM v4, Hawk, Atlassian ASAP, and Netrc authentication
- Persistent cookie jar, cookie inspection/editing, request chaining, dynamic variables, and richer template tags
- Domain-scoped client certificates, proxy exclusions, multipart edge cases, binary WebSocket composition, and stream-aware runner behavior
- Custom lint rulesets and broader script/test compatibility

## Milestone 6 — Git Sync and extensibility

- Standard filesystem project representation with Git init/clone/status/diff/commit/branch/pull/push operations
- Conflict-aware merges and a visual resolver that never discards local changes silently
- Permissioned plugin runtime with request/response hooks, template tags, themes, actions, and an Insomnia compatibility adapter
- Documented extension API, local plugin installation, and migration tooling

## Milestone 7 — collaboration, secrets, and governance

- Self-hostable end-to-end encrypted sync and real-time collaboration
- Project sharing, branches, history, presence, comments, and offline reconciliation
- Local credential storage plus AWS, GCP, Azure, and HashiCorp external-vault adapters
- Free self-hosted SSO, RBAC, SCIM, audit, organization, and policy controls

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
