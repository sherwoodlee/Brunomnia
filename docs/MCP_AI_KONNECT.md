# MCP, AI, and Konnect integrations

Milestone 8 adds optional integrations without adding an account, subscription, entitlement check, or Brunomnia-hosted intermediary. Every integration is configured locally and remains inactive until a workspace editor explicitly enables it.

## Credential boundary

Credential fields execute only when the entire value is one of these protected references:

```text
{{ vault.integration_token }}
```

```text
{% external 'provider', 'reference', 'scope', 'field', 'version' %}
```

The first form resolves from the passphrase-protected local vault. The second uses an external-vault tuple approved in **Security & Sync**. Raw MCP bearer tokens/passwords/OAuth client secrets/sensitive headers, AI keys, and Konnect tokens are detected as plaintext and rejected at execution. A custom HTTP authorization header can reference a vault entry containing its complete value, such as `Bearer …`.

Credential fields are masked by default. Each MCP bearer token, Basic password, OAuth client secret, AI-provider key, and Konnect token has a temporary Show/Hide control; the device-local **Reveal saved passwords and tokens** preference reveals them together with request authentication fields. This affects presentation only, and switching MCP clients clears temporary disclosure.

Brunomnia imports workspace integrations in a non-authoritative state: MCP clients are disabled; bearer, Basic, OAuth client-secret, and OAuth runtime-token fields are cleared; AI and Konnect are disabled; and their credential fields are cleared. Changing an MCP URL, transport, command, argument list, process environment, authentication family, or OAuth configuration also disables the client and clears its discovery cache.

Insomnia v4 `mcp_request` resources and v5 `mcpClient.insomnia/5.0` documents import as first-class project clients instead of HTTP placeholders. HTTP/STDIO transport, safely tokenized quoted arguments, enabled/disabled process variables, headers, public auth configuration, roots, and per-client environments are retained; imported clients remain disabled, plaintext sensitive header/environment values and credential fields are cleared, and unsupported shell operators are never interpreted. Full-project v4/v5 exports emit one native MCP workspace/document per client, duplicate the public project environment into each self-contained Insomnia MCP workspace, preserve protected references, and omit device-local OAuth/runtime registration credentials. Collection/design-only exports omit project clients with an explicit warning.

## MCP clients

MCP clients are project-scoped resources. Standard folder/Git projects serialize each client as YAML under `mcp-clients/`; cached operations travel with the project so collaborators can review them before reconnecting. Credentials should be references, not secret values.

### HTTP

The HTTP client:

- initializes MCP protocol version `2025-06-18` and sends `notifications/initialized`;
- supports finite JSON plus incremental JSON-bearing Server-Sent Event responses without waiting for a POST stream to close;
- opens the protocol's optional long-lived GET event stream after initialization, treating `405` as an expected non-streaming server response;
- retains one project/client-scoped logical connection in device memory, carrying `Mcp-Session-Id` and `Mcp-Protocol-Version` across discovery and invocation;
- discovers paginated tools, prompts, resources, and resource templates;
- invokes tools, prompts, and resource reads;
- negotiates `resources.subscribe`, sends session-aware subscribe/unsubscribe calls for ordinary resources, and retains bounded connection-local state until disconnect;
- advertises roots/list-change, elicitation, and sampling support and emits their server requests live from POST or GET SSE;
- cancels active discovery or invocation requests and sends session-aware `notifications/cancelled` messages;
- accepts Basic, bearer/PAT, manually configured OAuth 2, and custom headers;
- disables redirects and cookies;
- permits remote HTTPS endpoints and loopback-only plain HTTP; and
- records client/server messages in persistent device-local connection history.

Discovery is bounded to 100 pages and 5,000 cached items per operation family. Response headers and finite JSON bodies have a 30-second deadline; a valid SSE body remains open until its matching JSON-RPC response, cancellation, or bounded reconnect exhaustion. A successful initialization remains active for later resyncs and invocations, including servers that omit a session ID; up to 100 project/client-scoped connections stay only in process memory. Server identities are rejected above 4,096 bytes or when they contain control newlines. Every post-initialize request carries protocol version `2025-06-18`. A `404` for a stateful operation discards that session, initializes one replacement, and retries the operation once.

POST SSE is consumed incrementally and returns as soon as the matching JSON-RPC result or error arrives, even when the server deliberately keeps that response open. If the stream ends first, Brunomnia resumes only after a valid SSE event ID has primed the request, using a GET with `Last-Event-ID`; it never replays the POST. The optional GET stream always reconnects after EOF or transport failure. Both paths start at one second, back off by `1.5` to at most 30 seconds, honor bounded server `retry` values, preserve the latest event ID, and stop after two reconnect attempts. A matching POST response stops reconnection immediately. GET notifications and reconnect status flow live into the active connection record, and each later operation refreshes that stream's renderer channel.

Native Streamable HTTP limits each SSE event to 4 MiB, one POST exchange to 1,000 JSON messages and 8 MiB of cumulative message/body data, event IDs to 8,192 bytes, session keys to 8,192 bytes, and active GET streams to 100. Explicit disconnect, configuration replacement, bounded registry eviction, and app cancellation drop the corresponding native response or GET task. Redirect, proxy, certificate, client-identity, HTTP-version, rendered-header, and authentication preparation remain shared with ordinary requests; OAuth token acquisition deliberately stays on the finite ordinary transport rather than entering the MCP stream bridge.

**Disconnect** clears the local connection first and sends the server a five-second `DELETE` with the current session and protocol headers. `404` means the session was already gone, while the protocol-defined `405` leaves the local disconnect successful. Disabling/deleting a client or changing its endpoint, transport, headers, or authentication configuration performs the same best-effort termination. Disconnect requests disable redirects and cookies, bypass plugins and new OAuth acquisition, and never keep stale local state when remote termination fails.

While discovery or invocation is active, **Cancel MCP operation** aborts the exact native POST/finite-response reader and dispatches a detached cancellation notification carrying the exact JSON-RPC request ID and current `Mcp-Session-Id`. That notification has its own five-second deadline, disables redirects and cookies, bypasses plugins and OAuth acquisition, and cannot conceal the local cancellation if delivery fails. Closing the workbench also aborts its active MCP operation; a manual cancellation retains a local event-console record. Canceling one operation does not silently terminate the reusable initialized session or its optional GET stream; **Disconnect** owns that lifecycle.

Discovered resource templates retain `uriTemplate` separately from ordinary resource URIs. Selecting one derives its unique variables in template order, creates required string inputs, and shows the exact expanded URI before `resources/read`. Expansion covers RFC 6570 simple, reserved, fragment, label, path, path-parameter, query, and query-continuation operators; comma variables; explode and scalar-prefix modifiers; and scalar/list/object values. Templates are limited to 8,192 characters, 100 expressions/variables, a 10,000-character prefix modifier, and a 32,768-character expanded URI. Malformed templates remain visible for diagnosis but cannot be invoked. Ordinary resources remain read-only URI selections.

Prompt selections create one string input per advertised argument, retain descriptions and required markers, and stay synchronized with an editable JSON parameter overview. Tool selections use a dependency-free recursive JSON-Schema builder for typed scalars, enums/consts, nested objects and arrays, optional recursive children, local JSON-Pointer `$ref`, `allOf`, selectable `oneOf`/`anyOf`, `if`/`then`/`else`, `dependentSchemas`, `dependentRequired`, legacy schema dependencies, and explicitly declared additional properties. Defaults are composed again after conditional triggers, typed values remain synchronized with JSON, and advisory path-specific required/type/choice issues never block debug invocation, matching the pinned send boundary. The guided traversal is capped at 20 levels, 200 properties, array items, and validation issues per node, 50 composition branches, and 500 enum choices; truncated, specialized-format, remote-reference, or uncommon draft-keyword values remain fully editable in the authoritative JSON overview. Parameter JSON and up to 1,000 branch choices are retained independently by MCP client, primitive family, and primitive name in bounded in-memory draft caches; switching clients clears the active editor without attaching one primitive's values to another.

OAuth uses the authorization-code grant, mandatory PKCE S256, an RFC 8707 resource parameter, generated state when no override is supplied, and the shared native system-browser/loopback callback. Authorization URL, token URL, client ID, optional protected client-secret reference, scope, and state can be entered manually; leaving endpoints or client ID blank lets the first `401` drive discovery and dynamic registration. Public clients place `client_id` in the token body; confidential clients use the registered method or HTTP Basic after resolving a configured complete client-secret reference. Access, refresh, identity, expiry, and token-type metadata update across initialization, discovery pages, and invocation. Expired credentials refresh before protected dispatch, rejected refresh grants return to browser authorization, `403 insufficient_scope` requests one bounded reauthorization, and **Clear tokens** removes only local token state.

For automatic setup, Brunomnia parses a Bearer `WWW-Authenticate` challenge, tries the advertised `resource_metadata` URL, then path-aware and root RFC 9728 fallbacks. It validates that protected-resource metadata covers the MCP URL, selects its first authorization server, tries path-aware RFC 8414 and OIDC metadata locations, requires authorization-code and PKCE S256 compatibility when advertised, and chooses explicit scope before challenge, protected-resource, or authorization-server scope. If no client ID exists, it registers a loopback authorization-code/refresh client at the advertised endpoint or legacy `/register` fallback. Metadata GETs follow up to twenty explicit relative or absolute redirects, matching the pinned Fetch ceiling; every hop is revalidated as credential-free, fragment-free HTTPS or loopback HTTP, recorded in the event console, and rejected on a missing `Location`, loop, or overflow. Native automatic redirects remain off, and dynamic-registration POSTs never follow redirects. All discovery/registration requests contain no stored MCP credentials or cookies, have 30-second deadlines, and reject post-buffer JSON over 1 MiB.

MCP OAuth tokens and dynamically registered client ID/secret/expiry/auth-method metadata are stripped from ordinary catalog fields, folder/Git, and encrypted-sync payloads. In the packaged macOS app they are authenticated inside a bounded AES-256-GCM catalog envelope whose random master key is stored in macOS Keychain; request and folder OAuth runtime fields share the same device boundary. Active, backup, legacy, and deleted-project workspace copies migrate before use, the workspace ID is authenticated with the ciphertext, and Keychain or authentication failures stop the read/write rather than falling back to plaintext. The renderer receives restored fields only for a matching OAuth owner. Registration state is persisted immediately, even when later browser authorization is canceled. Browser development retains browser-local storage and makes no OS-protection claim. Configured endpoints, manual client ID, scope/state, and protected manual client-secret reference remain project data. The exact SDK supports optional URL-based client IDs, but pinned Insomnia's provider never supplies `clientMetadataUrl`, so client-ID metadata documents are not an observable Insomnia capability or parity requirement. The locked SDK selects `authorization_servers[0]`; it parses DPoP metadata but has no proof-generation/application path, and Insomnia's provider implements no DPoP hook. Multiple-server failover and DPoP are therefore not observable Insomnia requirements.

### STDIO

The desktop app starts the configured executable directly with an argument array; it never constructs a shell command. One project/client-scoped child is initialized and retained in process memory across the same four discovery families and three invocation families as HTTP. Requests are serialized per child and use monotonically increasing JSON-RPC IDs. **Disconnect**, disabling/deleting the client, or changing its transport, executable, or arguments terminates and joins that child; changing executable or arguments also replaces a stale native session defensively.

The disconnected client editor accepts up to 100 enabled/disabled text environment rows. Names and values render through the selected project environment plus the existing prompt, file, local-vault, and external-vault template boundary immediately before process start. Blank rendered names are omitted and the last enabled duplicate name wins. Sensitive names such as tokens, passwords, secrets, API keys, and private keys require a complete local-vault or approved external-vault reference before rendering.

Native spawn clears the application environment. On Unix it asks the OS-account login shell for `PATH`, falling back to `$SHELL` and the pinned platform default when account lookup is unavailable. Discovery uses the pinned `-ilc` lifecycle and then tries `/bin/zsh` and `/bin/bash` when the default shell fails, all within one five-second deadline and 1 MB output cap; final failure or empty output falls back silently to the app's current `PATH`. Windows uses the app `PATH`, matching the pinned dependency. The temporary discovery shell receives the pinned Oh My Zsh/tmux suppression variables, but the MCP executable itself is still started directly and never through a shell. Reviewed rendered rows apply last, so a reviewed `PATH` can override the discovered default. The child never inherits unrelated ambient variables. Resolved environment values participate in the persistent-session fingerprint, so changing a row or selected environment replaces the child before the next operation. Workspace v39 JSON and split-YAML projects preserve row order, disabled state, and protected references.

One dedicated dispatcher continuously owns persistent STDIO output, routes matching responses to bounded waiters, and emits notifications and reviewed server requests even while no operation is active. Canceling removes the exact waiter, sends `notifications/cancelled`, and stops waiting within 50 ms without killing the persistent child. A bounded registry handles cancellation racing ahead of native call registration. A normal server JSON-RPC error also leaves the initialized child reusable. Process exit, malformed protocol output, timeout, stream-limit exhaustion, or another fatal transport error fails every waiter and marks the session unusable. The renderer immediately clears matching connection and subscription state when the dispatcher reports an unexpected idle failure; a later operation terminates and replaces the stale native entry before starting a clean process. The failed operation is never retried silently. Renderer connection state is recorded only after initialization and a reusable operation result, so spawn failures cannot appear connected.

The native boundary limits:

- arguments to 100 entries and 8,192 bytes each;
- environment names to 512 bytes, values to 32,768 bytes, and all 100 rows to 1 MB combined;
- operation parameters to 1 MB;
- individual protocol messages and stderr to 10 MB;
- cumulative session stdout to 20 MB and stderr to 10 MB;
- pre-response events to 1,000;
- roots and pending reviewed server requests to 100 each, roots and response payloads to 1 MB, and individual root URIs to 8,192 bytes;
- active resource subscriptions to 5,000 per connection and subscription URIs to 32,768 characters;
- cancellation and session identities to 512 bytes, with at most 1,024 pending cancellations and 100 active sessions; and
- the operation deadline to 1–120 seconds (the UI uses 30 seconds).

HTTP and persistent STDIO clients advertise `roots` with `listChanged`, `elicitation`, and `sampling`. `roots/list` is answered automatically from the current reviewed URI list; editing roots on a connected client sends `notifications/roots/list_changed`. STDIO uses a concurrency-safe writer so a review response can unblock the serialized operation that caused the request. Server cancellation removes the matching pending review. Unknown STDIO server-request methods receive a JSON-RPC method-not-found response rather than hanging the child.

`elicitation/create` opens the same bounded recursive JSON-Schema form used by MCP tools. The user can submit an accepting structured result only when the form satisfies the requested schema, or explicitly decline/cancel. `sampling/createMessage` shows the bounded request context and editable text content, role, model, and stop reason; **Approve** returns that reviewed result, while **Reject** returns a JSON-RPC error. If the optional AI provider is enabled, **Generate AI draft** sends only the displayed bounded sampling request to that configured provider and fills the form. Generated output is never returned automatically and still requires a separate explicit approval. HTTP replies use the existing authenticated/session-bound rendered POST path; STDIO replies require the original pending request identity. The renderer keeps at most 100 deduplicated reviews and caps every response at 1 MB.

When initialization advertises `capabilities.resources.subscribe`, selecting an ordinary resource exposes **Subscribe**. Successful `resources/subscribe` switches it to **Unsubscribe**; the inverse call clears it. HTTP carries the current session/protocol/authentication boundary, while STDIO uses the retained child and dispatcher. `notifications/resources/updated` stays live in Notifications history for both long-lived HTTP GET and idle STDIO. Subscription state is capped at 5,000 URIs, remains only in bounded device memory, and is cleared on disconnect, connection replacement, an observed fatal transport failure, or eviction. Resource templates are never offered subscription controls, matching pinned Insomnia.

### Connection response history

Each logical MCP connection owns one response record keyed to its retained HTTP or STDIO runtime identity. Outgoing methods, matching result payloads, server messages, stderr, transport errors, idle notifications, and reviewed responses append live to that record. **Events** excludes incoming notifications and supports Message/Open/Close/Error selection, method/payload search, non-destructive clear-view, newest-first selection, and payload detail. **Notifications** has its own count, payload search, and detail view. **Console** retains bounded elapsed transport/event evidence.

Response records use the shared 20/default, finite, zero, or unlimited response-history preference and active-environment filter. Selecting or deleting an older response closes the live connection first, and **Clear** removes only the selected client's active-environment records. A selected-environment change closes the old connection before another environment can append to it. Each connection keeps at most 5,000 events, one million characters per payload, five million method/payload characters in aggregate, and 5,000 console entries; global normalization keeps at most 5,000 MCP connection records. Records are saved only in the local catalog/backup, reset stale connected states after restart, and are stripped from folder/Git projects, ordinary imports, and encrypted collaboration payloads.

## AI providers and workflows

AI is optional and off by default. The provider adapter supports:

| Provider choice | Protocol |
| --- | --- |
| OpenAI | OpenAI chat completions |
| Claude / Anthropic | Anthropic messages |
| Gemini | Gemini `generateContent` |
| Custom or local | OpenAI-compatible chat completions |

Remote endpoints require HTTPS. Plain HTTP is allowed only for `localhost`, `127.0.0.1`, or `::1`. Hosted providers require a vault-backed key. A custom/local endpoint may omit a key, or use a protected reference when authentication is needed. Changing the provider or base URL deactivates the configuration for review.

### AI mock generation

The mock workbench accepts a pasted prompt, OpenAPI text, or example response. It can instead attach the configured active request, that request's latest saved response, or a fetched specification URL, with optional additional instructions. A non-manual source must be explicitly selected, and the exact prepared context is reviewable before generation. When response-history environment filtering is enabled, latest-response selection stays inside the active environment.

Prepared context uses configured request values rather than resolving environment or vault references. Authentication values, credential-named headers/query/body fields, URL user information, cookies, and file bytes are redacted or omitted; arbitrary domain data in request/response bodies is still model input, so the preview remains the final disclosure check. The composed workbench input is capped at 190,000 characters and the provider adapter retains its 200,000-character hard cap. Output is parsed as data, never evaluated as code. Generated mocks are bound to `127.0.0.1`; methods, paths, status codes, string headers, delays, route count, and port range are validated before the mock is saved.

Specification URLs are fetched only after **Fetch for review**. They must be HTTP(S), at most 8,192 characters, and cannot contain URL user information. Fetch uses the entered URL—including its query—but adds no stored authentication, cookies, scripts, environment, vault, or external-secret values. It follows the configured redirect, timeout, certificate, HTTP-version, and proxy policy. A 2xx text/JSON/YAML/XML response is required; the post-buffer response limit is 5 MB. Credential-shaped query values are redacted from the model context, and fetched content is truncated inside the shared 94,000-character context bound. The displayed context is the final disclosure check because arbitrary specification examples remain intact.

Output remains capped at 10 MB after transport buffering, routes at 500, headers per route at 100, and delay at 60 seconds. Separately, the mock workbench can create a route or replace the selected route's status/headers/body directly from the active request's latest text response without an AI provider; those local actions are not model input.

### Git suggestions

The project workbench can send a bounded staged/working diff plus the exact changed-path allowlist to the selected provider. The model returns up to eight proposed groups with conventional-style messages and short comments. Brunomnia drops unknown paths. Applying a suggestion only selects files and fills the commit message; the user still reviews, stages, and commits through the ordinary Git workflow.

Diff input is capped at 200 KB, messages at 200 characters, comments at 1,000 characters, and output at 10 MB after transport buffering. MCP sampling reaches the AI provider only when the user presses **Generate AI draft**; the request parameters are capped at 200,000 characters, generated text at 1 MB, and explicit approval remains mandatory.

Brunomnia does not bundle a model or load `.gguf` files directly. A local model is currently used through a user-run OpenAI-compatible loopback server.

## Konnect pull

The Konnect adapter accepts only HTTPS hosts equal to `api.konghq.com` or ending in `.api.konghq.com`. It uses the configured protected PAT/system-token reference to:

1. list `/v2/control-planes`;
2. fetch Gateway Services for the selected control plane; and
3. fetch Gateway Routes for the selected control plane.

Pagination is confined to the configured origin, redirects and cookies are disabled, requests have a 60-second deadline, pagination is capped at 100 pages, resource accumulation at 10,000 records, and each parsed response at 20 MB after transport buffering.

Gateway Services become `Konnect · …` collections. Each route receives a source-backed top folder named from the route. HTTP routes add path/protocol subfolders whenever the route has multiple paths or HTTP protocols; WS and gRPC routes add protocol subfolders when they have multiple protocols. Subfolders and requests use the resolved path as their base name, falling back to the raw regex when conversion is intentionally generic. Every supported HTTP/HTTPS method, path, and protocol combination becomes an HTTP request; WS/WSS paths become WebSocket requests; and gRPC/GRPCS paths become gRPC requests with parsed service/method metadata. Regex paths receive safe editable path parameters. Bounded expression-router conversion extracts deduplicated uppercase `http.method ==`, exact `http.path ==`, prefix `http.path ^=`, `http.host ==`, and `http.headers.<name> ==` predicates. Header underscores become lowercase hyphens. Unsupported predicates are ignored when at least one safe field is extractable, matching pinned behavior; independent methods and paths form the same documented cross-product approximation. Expressions containing `tls.sni`, no extractable field, or more than 100,000 characters remain explicit skips. Protocol-specific `konnect_<service>_<protocol>_proxy_url` values are added to the active environment. Their first values come from the selected control plane's bounded `proxy_urls`: the first HTTP/HTTPS/WS/WSS authority seeds each HTTP-like scheme, while exact gRPC and GRPCS entries seed those schemes. Standard HTTP-like ports are omitted, nonstandard and gRPC ports remain explicit, and IPv6 hosts are bracketed. If the API omits a family, a loopback review value remains. A later discovery can replace an empty or untouched managed loopback value, but never a custom row or edited non-loopback value. Later pulls replace remote-managed route names, URLs, hierarchy, path parameters, Host/header constraints, and gRPC metadata while retaining local query parameters, auth, bodies, custom non-conflicting headers/metadata, transport settings, scripts, tests, collection environments, resource order, and documentation. Managed folder IDs and local folder settings survive matching pulls; stale managed folders are removed. User-created folders remain, orphaned local folders return safely to the collection root, and a request manually moved into a local folder stays there. Duplicate normalized route combinations are emitted once. Remote Liquid/template syntax is stripped before request creation. Missing-identifier, missing-service, unextractable/SNI-expression, traditional-SNI, and L4 routes remain visible in **Konnect · Skipped Routes** with the exact reason.

The integration is intentionally pull-only, matching pinned Insomnia: Brunomnia never writes Gateway configuration. Pinned SNI and L4 routes are also explicit skips rather than executable requests. No live PAT is checked into the repository, so automated evidence covers mapping and confinement logic rather than a live Konnect tenant. Automatic all-control-plane project/workspace reconciliation remains open.

## Device-local and shareable data

- MCP configuration and cached operation metadata are project-scoped and participate in split-YAML projects; MCP OAuth tokens and dynamically registered client credentials stay device-local.
- AI and Konnect configuration are device-local when opening or pulling a project and are excluded from encrypted shared-file payloads.
- Local response/history/cookie data remains device-local as in earlier milestones.
- All integration actions respect the current local viewer/editor governance check.

Reference behavior was reconciled against Kong's current [MCP client documentation](https://developer.konghq.com/insomnia/mcp-clients-in-insomnia/), [AI documentation](https://developer.konghq.com/insomnia/ai-in-insomnia/), [Konnect integration guide](https://developer.konghq.com/insomnia/konnect-integration/), and [Konnect API overview](https://developer.konghq.com/konnect-api/) on 2026-07-19.
