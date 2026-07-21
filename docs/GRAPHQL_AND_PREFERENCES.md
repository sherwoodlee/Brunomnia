# GraphQL productivity and desktop preferences

Milestone 9 introduced local GraphQL schema tooling, request scheduling, and device-local desktop preferences. Milestone 135 completes the pinned GraphQL authoring workflow with GraphQL 16.10 parsing/coercion, language-service diagnostics/autocomplete/hover, operation-aware editing, local schema import, richer schema documentation, and complete normalized introspection metadata. None of these capabilities introduces an account, hosted dependency, telemetry requirement, or paid entitlement.

## GraphQL schemas

Open a GraphQL request and choose **Body**. Brunomnia can fetch the endpoint's introspection schema explicitly, refresh a previously fetched remote schema, or import a standard introspection JSON file whose top level contains `data`. When **Automatically introspect GraphQL schemas** is enabled in Preferences, remote schemas refresh after a request is selected, its URL changes, or the deprecated-input option changes. A locally imported schema remains selected until **Fetch remote** is chosen.

Introspection uses the request's URL, headers, authentication, environment, local-vault values, approved external-vault values, TLS/proxy settings, and timeout. It forces POST, disables redirects and cookie storage, removes request scripts/tests, caps the deadline to 1–120 seconds, rejects non-success responses, and accepts at most 20 MB of parsed response text. The shared transport buffers the response before that parsed-text check, so a pre-allocation network limit is not claimed.

Enable **Deprecated inputs** before fetching when the server should return deprecated field arguments and input-object fields through `includeDeprecated: true`. The selected choice and whether the current remote cache includes that metadata are persisted separately, so automatic refresh does not present a stale cache as complete.

Normalized caches retain query/mutation/subscription roots, descriptions, complete type references, directives, scalar specification URLs, one-of input markers, implemented interfaces, union/interface possible types, field arguments, input fields, enum values, defaults, and deprecation metadata. They are bounded to 5,000 types, 1,000 fields per type, 500 input values per type, 100 arguments per field or directive, 5,000 enum values per type, 1,000 interfaces/possible types per type, 500 directives, and twelve nested type-reference levels. Remote responses and local imports accept at most 20 MB of parsed UTF-8 JSON. Workspace v34 applies the same normalization to loaded data and marks older partial remote caches stale so they refresh rather than silently omitting the added metadata.

The operation editor parses the GraphQL document rather than searching its text. Its dropdown lists named operations, keeps the selected name valid as the document changes, selects a named operation when the caret enters it, and requires an explicit choice when more than one executable operation exists. **Beautify** uses the GraphQL AST printer and reports invalid input without replacing the document.

With a schema loaded, the Body editor provides:

- GraphQL 16.10 syntax and executable-document diagnostics with line and column positions;
- nested field, fragment, argument, directive, operation, and type validation through `graphql-language-service` 5.5;
- JSON-object validation plus selected-operation variable coercion against non-null, input-object, enum, list, and scalar types;
- schema-aware completions, keyboard navigation, token replacement, hover signatures/descriptions, and direct documentation navigation;
- schema-wide type/field/description search plus query/mutation/subscription root-field insertion with up to three safe child selections; and
- browsable object/interface/union/input/enum/directive documentation with signatures, arguments, defaults, deprecations, implementations, possible types, and securely opened HTTP(S) scalar specification links.

Diagnostics and completion lists are capped at 200 entries per pass and schema search returns at most 500 matches. These are local presentation/resource bounds, not server-side feature gates. Schema fetch/import failures stay in the GraphQL editor instead of replacing the request's response pane. Milestone 108 adds operation-aware native `graphql-transport-ws` subscriptions; see [request authoring](REQUEST_AUTHORING.md#graphql-subscriptions) for the lifecycle and compatibility boundary.

GraphQL query text intentionally does not resolve template tags, matching Insomnia's documented boundary. Put template tags in the variables JSON instead.

## Send scheduling

For HTTP and GraphQL query/mutation requests, open the arrow beside **Send** to configure an initial delay and repeat interval. GraphQL subscriptions use Connect/Disconnect instead. Repeats are sequential: Brunomnia waits for each request to finish, then waits for the interval. The main button becomes a stop control while a schedule is active.

Stopping cancels the timer and all future runs. A request already in flight completes normally. One schedule is active at a time and repeat mode stops after 1,000 sends as a local safety bound.

## Preferences

Open **Preferences** from the activity rail, command palette, or its editable shortcut. Settings include:

- system, dark, or light appearance;
- comfortable or compact density;
- an off-by-default device-wide reveal choice for saved request/folder authentication and integration credentials;
- separate 8–24 px interface and editor sizes plus optional interface/monospace font-family lists;
- responsive or forced-vertical request/response layout;
- text wrapping, tab/space indentation, a 1–16 indent width, and font ligatures;
- a preferred native protocol of Default negotiation, HTTP 1.0, HTTP 1.1, HTTP/2, or HTTP/2 Prior Knowledge;
- a device-local follow-redirect default that inherited requests can override with Always or Never;
- a native maximum redirect count, where `0` follows none and `-1` allows redirects until the request or Event Stream handshake deadline;
- a maximum outgoing timeline chunk size in KiB, defaulting to 10;
- a per-request response history limit, where `0` keeps only the live result and `-1` retains all saved responses;
- optional response-history filtering by active environment;
- an upstream-compatible, off-by-default choice to disable clickable HTTP(S) links in JSON and Source Code response viewers;
- an off-by-default remote-resource authority for HTML response previews;
- an off-by-default inline-JavaScript mode for isolated HTML response previews;
- a request timeout applied at execution time, defaulting to 30 seconds, with `0` disabling deadlines;
- separate certificate-validation defaults for API requests and authentication flows;
- system or manual HTTP/HTTPS proxy selection with a no-proxy list;
- regular or bulk request-header and query-parameter editors;
- a 1–60 second script deadline plus separate off-by-default secondary-request, local-file, and local-vault script authorities, with an explicit desktop data-folder allowlist for script attachments;
- automatic GraphQL introspection;
- request-deletion confirmation; and
- sixteen editable keyboard actions with up to eight bindings each, including close/next/previous/reopen and keep-request-tab lifecycle actions.

Focus **Press shortcut** and press a combination to add it. `Mod` maps to Command on macOS and Control elsewhere. Remove combinations individually, reset one action, or use **Reset all**. New duplicates are refused; legacy collisions remain visible and only the first registry owner runs across the request workbench and Runner. Removing every combination leaves that action explicitly unassigned after reload.

Preferences stay on this device. Split-YAML folder/Git projects omit them, encrypted-sync pulls preserve the current device's values, and imported workspace files start with safe defaults. Plugin themes take precedence while active.

Authentication and integration secret inputs are masked by default. Use the adjacent Show/Hide control for a single field, or enable **Reveal saved passwords and tokens** to reveal request/folder authentication plus MCP bearer/Basic, AI-provider, and Konnect credential fields together on this device. The preference does not expose values outside the existing editor, change stored bytes, or reveal local-vault and encrypted-sync passphrases; those keep their own controls. Switching requests or MCP clients discards temporary field-level disclosure.

Desktop script file attachments require both the off-by-default file authority and at least one allowed data folder. Enter one absolute root per line; the value is normalized when the field loses focus. The native host canonicalizes roots and requested files before reading and rejects traversal or symlink resolution outside every root. The grant covers read-only script body, multipart, and PEM attachment hydration, not ordinary user-selected payloads or file writes. The CLI keeps its separate explicit `--allow-script-files` trust flag, requires invocation-only `-f`/`--dataFolders` roots, and does not inherit this device list.

Header and query-parameter tabs can switch between regular rows and the device-persistent bulk editor directly. Bulk mode uses one `name: value` pair per line, splits only at the first colon, and preserves duplicate order. Matching current Insomnia, disabled/blank rows are omitted from the bulk text and the first bulk edit replaces row descriptions; path parameters and gRPC metadata remain in their structured editors.

The request/response split remains horizontal until the responsive breakpoint unless **Stack request and response vertically** is enabled. Code surfaces honor the line-wrap and ligature choices immediately. Tab inserts either a literal tab or the configured 1–16 spaces; Shift-Tab removes one matching indentation level from the current or selected lines. These controls stay device-local and reset to current-compatible defaults on workspace import.

Interface typography defaults to 13 px and the system sans-serif stack; editor typography defaults to 11 px and the system monospace stack. Optional comma-separated CSS font-family lists override each independently, and clearing a field restores the built-in stack. Existing Brunomnia editor-size values survive v20 migration, while new/imported workspaces use the current-compatible split defaults and both sizes clamp to 8–24 px.

The HTTP version, redirect, timeout, and API certificate-validation preferences reach ordinary HTTP/GraphQL, Event Streams, gRPC, collection runs, secondary script/plugin requests, artifact URL imports, and integrations. Native HTTP/GraphQL and Event Streams also resolve the proxy preference. OAuth token requests resolve the same proxy plus the separate authentication validation preference. Requests can inherit or override timeout, redirect, validation, and native HTTP proxy choices. Workspace v14 and earlier timeouts, v15 and earlier validation booleans, and v16 and earlier nonempty request proxies migrate to explicit modes so upgrades preserve behavior.

Standard HTTP/2 negotiates and can fall back; Prior Knowledge requires an HTTP/2-capable peer. Native responses show the negotiated protocol. With manual proxy disabled, reqwest retains its system/environment proxy discovery; manual mode selects HTTP or HTTPS proxy by resolved request URL and applies the no-proxy list. Browser development mode honors redirect/timeouts but owns TLS, proxy routing, protocol, and redirect limits. Portable CLI HTTP/GraphQL uses request-scoped Undici dispatchers for pinned proxy/no-proxy flags and target TLS validation overrides without changing process-global Node behavior.

Saved responses remain device-local and are selectable from the response summary. The default keeps 20 per request. When environment filtering is enabled, the selector and response template tags see only results from the active global environment, and the retention limit applies independently to each request/environment pair. Changing a limit does not erase data immediately; the relevant scope is pruned the next time that request stores a response.

The timeline stores prepared request and aggregate response evidence with each saved result. Configured/calculated outgoing header rows retain duplicate order; native final response headers retain every duplicate value; followed redirect status/source/target hops, effective URL, final status line, and negotiated protocol remain inspectable. Native failures before a response retain their classified timeout/connect/redirect/decode/request/status/transport/canceled kind, elapsed time, available redirect trace, configured request evidence, and error text as an ordinary status-zero response and history entry. Runner Console reuses that timeline under its existing bounds and secret redaction. Text, JSON, GraphQL, and URL-encoded outgoing data below the configured threshold remain visible; data at or above it becomes a size-only hidden marker. Matching current Insomnia behavior, a configured zero uses a 1 KiB fallback. Binary content is always represented by filename and size, and multipart content uses a configured-part summary because the native and browser transports do not expose their final wire boundary. Response bodies remain in Preview; the timeline records only their decoded aggregate size rather than duplicating content. Reqwest does not expose libcurl's byte-exact header casing/global wire order, transport-added request framing, DNS/connect/TLS debug callbacks, compressed wire-byte accounting, challenge-round headers, or a complete pre-response debug stream, so those details are not claimed.
