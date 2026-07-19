# Request authoring and local client code

Milestone 11 closes a focused set of request-authoring gaps from the current Insomnia [request editor](https://developer.konghq.com/insomnia/requests/) and [keyboard shortcut](https://developer.konghq.com/insomnia/keyboard-shortcuts/) documentation. Everything in this phase remains local and free: no login, hosted conversion service, telemetry call, or entitlement check is involved.

## Methods and parameters

The method field suggests the standard HTTP methods and also accepts a custom method such as `PROPFIND`, `PURGE`, or `REPORT`. Methods are normalized to uppercase and must be a valid HTTP token of at most 32 characters. Invalid imported or stored values fall back to `GET` with an import warning where applicable.

The **Params** tab has separate path and query sections:

- An enabled path row named `id` replaces every literal `{id}` segment. The value is percent-encoded as one path component, so `one/two` becomes `one%2Ftwo`.
- Enabled query rows are appended in their visible order. Repeated names remain repeated instead of silently overwriting an earlier value.
- Path, query, and header rows support an optional description and multiline value. Disabled rows stay in the workspace but do not participate in execution.
- Environment and template values resolve before path substitution and query construction.

OpenAPI 3 generation now retains `{path}` syntax and creates explicit path rows using parameter examples/defaults and descriptions. Postman path variables and Insomnia v4/v5 `pathParameters` map to the same model. Insomnia compatibility exports preserve these rows, custom methods, descriptions, and multiline values.

## Bulk header and query editing

Use **Bulk Edit** in the Headers tab or beside Query parameters to switch the device preference from structured rows to plain text. Each nonblank line is one `name: value` pair. Only the first colon separates the name, so values such as `https://example.test:8443/path` remain intact, and duplicate names keep their visible order.

The toggle is device-local and applies when another request opens. **Regular Edit** restores the structured controls. Matching current Insomnia's bulk editors, only enabled nonblank rows are serialized; editing the bulk text replaces the list with enabled name/value rows, so disabled rows and descriptions that are not represented in the text are removed. Path parameters and gRPC metadata stay structured. Workspace v17 and earlier data safely defaults both bulk modes off during v18 migration, while workspace imports reset the device choices.

## Editor and request layout preferences

Preferences can force the request and response panels into a vertical stack; otherwise Brunomnia retains the horizontal split until its responsive breakpoint. Text editors can wrap long lines or keep horizontal scrolling, enable/disable font ligatures, and use a 1–16 indentation width.

Press Tab in a code surface to insert a literal tab when **Indent with tabs** is enabled or the configured number of spaces when it is disabled. A multiline selection indents every selected line; Shift-Tab removes one tab or up to one configured space indentation level. Workspace v18 and earlier data migrates to the current-compatible defaults of responsive layout, wrapping on, tabs on, two-column indentation, and ligatures off.

Interface and editor typography are independent. Each accepts an optional comma-separated CSS font-family list and an 8–24 px size; blank family fields restore Brunomnia's built-in sans-serif or monospace stack. New/imported data defaults to 13 px interface and 11 px editor text. Existing editor-size values remain editor sizes during workspace v20 migration.

## Password and credential visibility

Authentication tokens, passwords, API-key values, client secrets, authorization codes, refresh/access tokens, AWS secret/session values, and Hawk keys are masked by default in request and folder editors. MCP bearer tokens and Basic passwords, AI-provider keys/references, and Konnect token references follow the same rule in the integration workbench. Each secret has a Show/Hide control for temporary inspection. The device-local **Reveal saved passwords and tokens** preference reveals all of these fields together and defaults off, matching current Insomnia's `showPasswords` setting.

The preference changes presentation only. It does not alter stored values, logs, exports, request/integration execution, or clipboard behavior, and it does not reveal local-vault or encrypted-sync passphrases. Managed projects and encrypted-sync pulls preserve the current device choice; workspace imports reset it off. A temporary reveal resets when the request or MCP client changes.

## OAuth 2 browser authorization

Authorization-code and implicit grants expose **Authorize** in the Tauri app. Brunomnia generates a missing state value and, when PKCE is enabled, a missing verifier; it opens the system browser, waits on the configured loopback path, rejects mismatched state, and can be canceled from the editor. A redirect without a port receives an ephemeral one, while an explicit port is preserved. Register the redirect with the provider according to its native-app loopback policy.

Automatic capture accepts plain HTTP redirects only on `localhost`, `127.0.0.1`, or `::1`. Authorization-code callbacks are exchanged through the existing token transport and retain access, refresh, and identity tokens. Implicit grants support access token, ID token, or combined responses; browser fragments are bridged locally without being sent to a remote service. The listener expires after five minutes and request switching cancels the active flow.

Sending a protected request in Tauri reuses a current token, exchanges a pasted authorization code, obtains password/client-credential tokens, refreshes an expired token, or starts browser authorization before the API request is dispatched. The waiting dialog shows the exact authorization and callback URLs and can cancel the flow. Tokens inherited from a folder are written back to that folder. Collection runs, runner scripts, direct-request scripts, plugin network calls, and user-triggered project/integration HTTP operations use the same resolver; a run pauses its current sequential attempt until authorization finishes, and **Cancel run** also cancels the login flow.

OAuth token responses retain access, refresh, identity, token type, and expiry metadata. ID-only implicit responses use the ID token as the effective request token, matching current Insomnia behavior. ID-token response types receive a generated nonce. Set **Origin header** when the initial token endpoint requires CORS-style origin handling, and set the token prefix to `NO_PREFIX` to send the raw token. **Refresh token** uses the saved refresh credential; **Clear tokens** removes access, refresh, identity, and expiry state.

If a refresh endpoint returns HTTP 401 or OAuth `invalid_grant`, authorization-code/implicit requests restart the shared browser flow while password/client-credential requests clear stale state and obtain a fresh token directly. One-time codes, generated PKCE verifiers, and ephemeral listener ports are not retained after successful automatic exchange; the configured redirect and state remain unchanged.

Runtime OAuth codes, PKCE verifiers, access/identity/refresh tokens, and expiry stay in the device-local catalog project. They are removed from split-YAML folder/Git writes and encrypted-sync revisions, then restored only from matching local request/folder owners after a project reload or sync pull. Incoming project/sync token fields are discarded. Explicit user-controlled workspace/interchange exports retain their existing behavior.

**Copy authorization URL** remains available for browser development, non-loopback provider requirements, and manual troubleshooting. Complete the provider flow and paste the returned code, access token, or identity token into the editor. Brunomnia does not provide an embedded login browser, device-code flow, or custom-scheme callback in this baseline.

## Body formatting

For JSON or text bodies, choose **Beautify** in the body toolbar. Valid JSON receives two-space indentation. XML-looking text, or text with an XML content type, receives conservative structural indentation. Invalid JSON and unrecognized plain text are left unchanged; the formatter does not send content anywhere.

## Socket.IO sessions

Choose **Socket.IO** as the request protocol, enter the server URL, and use the Engine.IO path field when the server does not use `/socket.io`. A URL path becomes the Socket.IO namespace, while query rows remain handshake query parameters. Enabled headers are templated in order; the cookie jar contributes a `Cookie` header when request cookie sending is enabled. Active Bearer authentication is sent as the Socket.IO namespace-connect `auth.token` value rather than duplicated as an HTTP authorization header.

Each emit has an event name and up to 100 ordered arguments. **JSON** arguments parse after template resolution and fall back to their resolved string when invalid; **Text** arguments always remain strings. Enable **Request acknowledgement** to assign an acknowledgement ID and show the matching server arguments as an incoming `<event> · ack` record.

Add up to 500 named listeners before connecting. Enabled listeners receive matching server events, and their switches can add or remove subscriptions during a live session. The stream console keeps ordered incoming, outgoing, and system evidence for the current connection. Collection-run sampling uses the same connection, emit, acknowledgement, and listener path within its configured bounded stream window.

Insomnia v4/v5 imports and exports preserve Socket.IO requests, custom paths, inline or separate payload records, ordered argument modes, acknowledgement state, and named listener state. Workspace v22 and earlier data migrates to the v23 Socket.IO defaults without changing existing protocols.

The native baseline starts with Engine.IO v4 HTTP polling, adds a per-request cache buster, joins the authored namespace, and upgrades through the standard WebSocket probe when the server advertises it. A polling-only server remains connected with the same emit, acknowledgement, listener, heartbeat, and disconnect behavior. If an upgrade attempt fails before completion, Brunomnia continues polling. Custom proxy, PEM client identity, or disabled certificate-validation policy deliberately keeps the session on the existing HTTP transport so those settings remain effective.

Incoming Socket.IO binary events and binary acknowledgements are reconstructed across raw WebSocket frames or Engine.IO polling `b<base64>` packets. Nested placeholders become Node-compatible JSON such as `{ "type": "Buffer", "data": [0, 1, 255] }` before the listener or acknowledgement is written to the console. Up to 100 attachments and 1 MiB of attachment data are accepted per packet; malformed counts, missing indexes, interleaved packets, or oversized data close the invalid stream with visible error evidence. Current upstream authoring exposes JSON and Text arguments only, so Brunomnia does not invent a separate binary-send editor mode.

WebSocket, Socket.IO, and SSE connections create a device-local saved session as soon as connection starts, then persist incoming, outgoing, system, reconnect, error, and close records incrementally. Each new session captures an independent version of the editable request. The response-history selector groups sessions as Just Now, Less Than Two Hours Ago, Today, This Week, or Older Than This Week. Selecting an earlier session disconnects a different live connection before replacing the console and restores that request version while preserving the request's current ID and folder position. Delete removes the selected session and restores the newest remaining version when available; Clear removes the active request/environment sessions without changing the request or touching other requests and environments. Legacy v24 sessions without a valid matching snapshot remain event-log-only.

The event toolbar follows the pinned realtime pane: WebSocket and Socket.IO logs can show All, Message, Open, Close, or Error entries; Event Stream keeps the type selector disabled because upstream treats it as the cURL-backed stream path. Search is case-insensitive and matches message data plus error and close text while excluding open and informational records. **Clear view** hides every event through the latest currently displayed timestamp without deleting the saved session; later live events still appear. Event type, search, and the clear cutoff reset whenever another saved session is selected. The count shows visible versus total events. Pinned Insomnia does not expose a dedicated event-log export action, so Brunomnia does not claim one as a parity requirement.

The existing **Max history responses** preference also controls stream sessions per request: positive values keep that many, `0` leaves the current console live without saving it, and `-1` retains all. **Filter response history by active environment** applies the same environment scope to stream selection and future pruning. Each saved session keeps at most 5,000 newest events and approximately 5 million text characters while always preserving the latest record. Workspace v23 and earlier data migrates through v24's empty validated session store; v25 adds optional request snapshots without fabricating versions for legacy entries. Saved stream history stays in the local project catalog, survives local project switching and reload, and is excluded from split-YAML projects and encrypted-sync payloads.

WebSocket upgrade while custom proxy/client identity or disabled-validation policy is active, per-session handshake/header/timeline inspection, streaming plugin hooks, and live third-party compatibility fixtures remain open. Browser development uses deterministic local demo events; real transport runs in the Tauri app.

## Response compression

The native desktop transport automatically advertises and decodes gzip, Brotli, deflate, and zstd responses. If a request already supplies `Accept-Encoding` or `Range`, the native client does not add its own compression negotiation. Response body size and saved content describe the decoded body shown in Brunomnia, not compressed wire bytes.

If an ordinary response body fails specifically during content decoding, Brunomnia repeats that request once with automatic decoding disabled so the raw response remains inspectable. It does not retry unrelated read or transport errors. Because the fallback repeats the request after a response was received, avoid invalid `Content-Encoding` responses for non-idempotent operations. Event Stream transport keeps its existing reconnect policy instead of this one-shot raw fallback.

## Redirect policy

Preferences keeps a device-local **Follow redirects by default** choice. Each request selects **Use Preferences**, **Always**, or **Never** in its Transport tab, so a request can inherit that default or override it in either direction. Existing requests that disabled redirects migrate to Never; other existing requests migrate to Use Preferences. Insomnia v4/v5 imports and exports preserve the same `global`/`on`/`off` states.

Preferences also provides a device-local **Maximum redirects** ceiling shared by native HTTP, GraphQL, Event Stream, collection-run, script/plugin, artifact-import, OAuth, AI, MCP, Konnect, and Git-AI traffic. `0` rejects the first redirect, positive integers allow that many hops, and `-1` follows without a hop ceiling. Never always disables redirects regardless of the ceiling; security-sensitive internal adapter requests deliberately select Never.

Finite and unlimited chains remain subject to an ordinary request's deadline. Event Streams use the request timeout while waiting for response headers—including redirects—then remove the total deadline from the active stream. Browser development mode honors the effective follow/no-follow choice through Fetch, but Fetch does not expose a maximum-hop control.

## Timeout policy

Preferences keeps a device-local **Request timeout (ms)** value that defaults to `30000` and is resolved when a request executes. Enter `0` to disable the deadline. New HTTP, GraphQL, Event Stream, and gRPC requests use the preference; the Transport tab can retain a custom value for a request that must not follow device changes.

Workspace v14 and earlier requests migrate their saved timeout to **Custom** so an upgrade never changes a working deadline. Choosing **Make every request inherit timeout** opts all requests into the live preference. The effective value reaches primary requests, collection runs, the CLI, scripts/plugins, URL imports, OAuth, and integrations. Internal GraphQL introspection, AI, MCP, Konnect, and bounded script requests deliberately retain custom safety deadlines.

## Certificate-validation policy

Preferences has separate on-by-default choices for **Validate certificates for API requests** and **Validate certificates during authentication**. HTTP, GraphQL, Event Stream, gRPC, collection-run, script/plugin, URL-import, and integration traffic resolve the API setting at execution time. OAuth token acquisition resolves the authentication setting instead, matching current Insomnia's separation.

Each request selects **Use Preferences**, **Always**, or **Never** in Transport. Workspace v15 and earlier requests migrate their saved boolean to Always/Never so upgrades preserve behavior; **Make every request inherit certificate validation** opts them into the device default. Never affects only native desktop transport. Browser Fetch owns certificate verification, and the CLI safely refuses a request whose effective mode is Never rather than weakening Node globally.

## Proxy policy

With **Use manual proxy configuration** off, native HTTP/GraphQL and Event Stream requests leave proxy discovery to reqwest's system/environment support. With it on, resolved `http:` URLs use the HTTP proxy, `https:` URLs use the HTTPS proxy, and both apply the no-proxy list. Proxy URLs can include credentials and remain device-local with other Preferences.

Each request chooses **Use Preferences**, **Custom**, or **Direct connection**. Workspace v16 and earlier requests with a saved URL/exclusion list migrate to Custom; empty legacy settings migrate to inheritance. cURL `--proxy` and script proxy updates select Custom. Browser Fetch owns routing, gRPC/WebSocket proxying remains open, and the CLI rejects manual proxy requirements rather than silently sending direct.

## Response history

After a request completes, use the history selector in the response summary to reopen an earlier saved result. New saved entries retain an independent snapshot of the editable request version; choosing one restores its name, URL, method, protocol configuration, parameters, headers, body, authentication, scripts, documentation, and transport controls while preserving the request's current ID and folder position. Legacy entries without a valid matching snapshot remain response-only. Delete removes the selected saved result and restores the newest remaining version when available; Clear removes every saved result for the active request and environment without changing the current request. Other requests and environments remain intact, and the response panel falls back to the newest remaining visible result or an empty state. Saved entries also retain the response body, headers, status, timing, negotiated protocol, request URL, request identity, active environment identity, and receipt time. Selecting another request restores its newest eligible response instead of leaving the previous request's result on screen.

Preferences defaults to 20 saved responses per request. Positive numbers keep that many, `0` keeps the just-completed result live without saving it, and `-1` retains all. **Filter response history by active environment** restricts both the selector and response template tags to the active global environment; future pruning then applies per request/environment pair. Existing entries are pruned only when that request next stores a response. Response history is omitted from project sharing and encrypted-sync payloads.

Use **Export raw** in the response footer to download the decoded HTTP entity body without modification. Native and browser transports retain exact decoded bytes when UTF-8 display text would be lossy; valid UTF-8 bodies remain reconstructable without a duplicate Base64 copy. JSON responses also expose **Export pretty**, which uses two-space formatting when the displayed body parses and otherwise preserves the exact raw bytes. Filenames combine a filesystem-safe request name, timestamp, and content-type extension. This is byte-exact after browser/reqwest content decoding, not the original compressed wire representation.

HTTP and GraphQL responses also expose **Export debug** and **Export HAR**. Debug export writes a status line, the displayed response headers in deterministic order, a blank line, and the charset-decoded inspection body. HAR export writes one HAR 1.2 entry for the selected response, including its receipt time, duration, negotiated protocol, actual request URL and query keys, editable request headers/body metadata, response headers/body, redirect location, and size. A selected saved response uses its matching request-version snapshot when one exists. Exact binary entity bytes are retained for raw download, but these text diagnostic formats intentionally keep the inspectable decoded body. The persistence contract still does not retain raw wire headers, duplicate response-header fields, TLS/redirect traces, transport-added request headers, request cookies, or compressed bytes; these exports do not reconstruct evidence that was never stored.

JSON and XML previews expose a response-body filter below the viewer. Enter a JSONPath such as `$.store.books[*].author` or an XPath such as `/store/books/author`, then press Enter. The filtered preview reports its match count; Clear restores the complete body. Brunomnia persists the current filter and ten unique newest-first filters per request, and the Recent filters menu reapplies one without adding a duplicate. JSONPath currently covers root, dot/bracket properties, array indexes, wildcards, and recursive property descent; predicates, unions, slices, and script expressions remain open. XPath uses the desktop WebView's standards-based XML parser and evaluator. Filtering changes the preview only—the stored response and raw, pretty, debug, and HAR artifacts remain unchanged.

Saved response choices are grouped as Just Now, Less Than Two Hours Ago, Today, This Week, or Older Than This Week. Each entry includes its receipt time, status, restored method when a request snapshot exists, actual URL, duration, and stored body size. The current pinned Insomnia response-history surface has selection, chronological grouping, request-version restoration, delete-current, and clear-history actions; it does not expose a separate response-comparison action, so comparison is not treated as a current parity requirement.

Response previews larger than 5 MiB are hidden before Brunomnia prettifies, filters, splits, or renders their lines. Choose **Show anyway** for the current response, **Always show this session** for subsequent 5–100 MiB responses until the app reloads, or **Save response to file** to use the byte-exact decoded-body download. Responses larger than 100 MiB remain hidden and expose download only. These thresholds match the pinned Insomnia source and compare strictly greater sizes, so exactly 5 MiB remains normal and exactly 100 MiB remains in the showable large band. Brunomnia still buffers response bodies in memory and persists them in the device-local workspace; the gate protects renderer work but does not claim upstream filesystem-backed, deferred body reads or a pre-allocation network limit.

The Preview toolbar stores one mode per request. Before friendly routing, **Visual Preview** follows the pinned Insomnia order: it tries to parse the exact entity bytes as UTF-8 JSON regardless of the declared type, then recognizes an HTML doctype within the first 100 bytes, then falls back to the original Content-Type. This lets JSON or common HTML error pages override misleading `text/plain`, image, or binary headers without changing stored headers or bytes. Detection runs after the 5/100 MiB response gate and also applies to selected multipart sections. Empty, malformed, or unmatched bodies retain their declared type, including case-sensitive MIME boundary parameters; no broader signature sniffing is claimed.

Visual Preview renders detected or declared JSON through the filtered/prettified source path and detected or declared `text/html` in an opaque-origin sandboxed iframe. For a valid HTTP(S) response URL, Brunomnia injects a normalized, attribute-escaped first `<base>` before response-controlled markup, matching Insomnia's response-URL-relative link behavior even when the body omits `<head>`. A no-referrer policy prevents that URL from becoming navigation referrer data. Relative links replace the iframe in place, and **Reset preview** restores the stored response document; live, saved-history, content-detected, and recursively selected multipart HTML all use the actual top-level response URL. Non-HTTP(S) or malformed values receive no base.

By default the injected content-security policy blocks scripts, forms, automatic external subresources, and parent/top navigation privileges while allowing inline styles plus embedded data/blob images and fonts. **Preferences → Allow remote resources in HTML response previews** permits HTTP(S) styles, images, fonts, media, and nested frames. On its own it still blocks every script, fetch/XHR/WebSocket/EventSource connection, and worker. **Allow inline JavaScript in HTML response previews** permits inline scripts and DOM interaction. Only when both device-local grants are active may the response load HTTP(S) external scripts, make HTTP(S)/WebSocket connections, or start blob/HTTP(S) workers. Top-level, content-detected, saved-history, and selected multipart HTML all use the same grants and show an active warning.

Every combination retains the opaque sandbox and blocks forms, popups, modals, downloads, same-origin access, parent/top navigation, objects, and `eval`. Normal WebView CORS and mixed-content policy still apply. A followed page remains in that sandbox but uses its own CSP; if the JavaScript grant is active, that destination can run scripts and network requests within the sandbox. Treat both grants as authority for trusted responses only. Imports reset them off and folder/Git/encrypted revisions cannot turn them on.

Visual Preview renders CSV media types as scrollable tables. It also routes declared `image/*`, `application/pdf`, and `audio/*` bodies into responsive image, embedded PDF, and native audio-control viewers backed by the exact decoded entity bytes. Media uses local revocable Blob URLs rather than data URLs or remote requests; switching responses or modes releases the URL. Empty bodies and WebView decode failures receive visible states, and raw downloads use useful binary/media extensions.

The CSV parser auto-detects comma, tab, semicolon, or pipe delimiters outside quotes; preserves escaped quotes, embedded delimiters, empty cells, CRLF, and quoted multiline fields; skips empty lines; and reports malformed quotes. Preview work is capped at 10,000 rows, 200 columns per row, and 250,000 cells with an explicit truncation notice.

Visual Preview also parses `multipart/*` bodies against the exact decoded entity buffer using quoted or unquoted case-sensitive MIME boundaries and CRLF/LF framing. Choose among up to 100 parts by their disposition name/filename, inspect up to 100 unfolded headers, and save the complete selected part bytes. Displayed sizes are original part bytes rather than re-encoded inspection text. A selected part recursively uses the same JSON/text, safe HTML, bounded CSV, image, PDF, audio, or multipart friendly viewer according to its declared Content-Type; binary media receives the original byte slice. Each nested multipart level retains its own selector, headers, and Save part action. Only the selected path is expanded, recursion stops after five levels, and a nested multipart section over 5 MiB stays collapsed with an exact-save instruction. Plain decoded text is capped at 1,000,000 characters with a notice; Save part always retains the complete original bytes. Missing/incomplete boundaries and malformed header separators produce visible errors.

Declared response charsets are resolved before timelines, plugins, scripts, filters, previews, and text diagnostics receive the body. Parameter matching is case-insensitive, accepts quoted values, and supports Insomnia's `utf8`, `utf16le`, `ucs2`, `latin1`, `binary`, and `win1250` through `win1258` aliases plus encoding labels supported by the WebView `TextDecoder`. Missing or unsupported labels fall back to UTF-8. A non-UTF-8 body, malformed UTF-8, or leading UTF-8 BOM retains an exact Base64 sidecar whenever the inspection string cannot reconstruct the original entity bytes.

**Source Code** shows the filtered/prettified textual representation with line numbers. Matching current Insomnia, HTTP(S) URLs in Source Code and friendly JSON are clickable by default, while **Preferences → Disable links in response viewer** turns them back into plain selectable text. Link detection preserves surrounding punctuation, decodes the four upstream XML entities only for XML navigation, accepts at most 100 links per line and 8 KiB per URL, and delegates only normalized HTTP(S) targets to the default browser without a command shell. Native validation or opener-start failures appear below the viewer. **Raw Data** remains non-interactive and shows the charset-decoded inspection string without prettification, filters, or line numbers.

Switching modes never changes the saved response; **Copy** follows the pinned upstream action and copies that inspection string regardless of the displayed mode. Exact entity bytes remain available to raw download and media viewers even when the inspection string differs. Available image/audio codecs and embedded PDF controls depend on the operating-system WebView. Filesystem-backed bodies, content sniffing beyond valid UTF-8 JSON and a leading HTML doctype, recursion outside the documented multipart safety bounds, and upstream's default-on unrestricted response-WebView authority remain open.

## Timeline evidence

The Timeline tab persists prepared request and aggregate response evidence with each saved response. It records the resolved method and URL, eligible outgoing data, status and decoded response size, negotiated native protocol when available, and completion timing.

**Max timeline chunk size (KiB)** defaults to 10. Outgoing data whose UTF-8 or decoded payload size is below the threshold is shown; data exactly at or above it is replaced by a size-only hidden marker. A zero value follows current Insomnia's 1 KiB fallback. Text, JSON, GraphQL, and repeated URL-encoded fields retain inspectable content. Binary data remains filename/size-only. Multipart entries list configured part names, values, filenames, and logical size but explicitly exclude generated wire framing.

Brunomnia's Rust and Fetch transports do not expose libcurl-style debug callback boundaries, so response transfer evidence is one decoded aggregate-size record rather than a row per raw network chunk. Full response content stays in Preview and saved response history. Raw transport-added headers, TLS diagnostics, redirect hops, exact multipart framing, and raw compressed-byte accounting remain parity gaps.

## Generate client code

Choose **Code** beside the request URL or use `Mod+Shift+G`. The preview uses the effective request after collection/folder inheritance plus the resolved active environment. Available targets are:

- cURL;
- JavaScript Fetch;
- Python Requests;
- Go `net/http`;
- Java `HttpClient`; and
- C# `HttpClient`.

Bearer, Basic, header/query API keys, and an existing OAuth 2 access token are materialized. JSON, text, GraphQL, and URL-encoded bodies are included. Copying is the only side effect: opening the dialog does not execute the request or generated program.

Warnings are part of the result, not hidden conversion failures. The dialog identifies unresolved template/path values, collapsed duplicate headers in object-oriented targets, omitted multipart/binary payload bytes, and runtime-specific signing schemes that cannot be safely reproduced as static text. Target-language package availability and syntax/runtime validation remain the user's responsibility.

## Compatibility boundary

This milestone does not claim a universal code-generation engine. Multipart/binary embedding, advanced dynamic signing, target dependency installation, syntax validation, and execution are still open work. The unrestricted upstream scripting API is also deliberately separate because expanding script network, module, and storage authority requires its own security review. Those gaps remain in the [feature-parity ledger](PARITY.md).
