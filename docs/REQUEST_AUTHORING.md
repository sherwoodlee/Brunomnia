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

## Body formatting

For JSON or text bodies, choose **Beautify** in the body toolbar. Valid JSON receives two-space indentation. XML-looking text, or text with an XML content type, receives conservative structural indentation. Invalid JSON and unrecognized plain text are left unchanged; the formatter does not send content anywhere.

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

After a request completes, use the history selector in the response summary to reopen an earlier saved result. Saved entries retain the response body, headers, status, timing, negotiated protocol, request URL, request identity, active environment identity, and receipt time. Selecting another request restores its newest eligible response instead of leaving the previous request's result on screen.

Preferences defaults to 20 saved responses per request. Positive numbers keep that many, `0` keeps the just-completed result live without saving it, and `-1` retains all. **Filter response history by active environment** restricts both the selector and response template tags to the active global environment; future pruning then applies per request/environment pair. Existing entries are pruned only when that request next stores a response. Response history is omitted from project sharing and encrypted-sync payloads.

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
