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

## Body formatting

For JSON or text bodies, choose **Beautify** in the body toolbar. Valid JSON receives two-space indentation. XML-looking text, or text with an XML content type, receives conservative structural indentation. Invalid JSON and unrecognized plain text are left unchanged; the formatter does not send content anywhere.

## Response compression

The native desktop transport automatically advertises and decodes gzip, Brotli, deflate, and zstd responses. If a request already supplies `Accept-Encoding` or `Range`, the native client does not add its own compression negotiation. Response body size and saved content describe the decoded body shown in Brunomnia, not compressed wire bytes.

If an ordinary response body fails specifically during content decoding, Brunomnia repeats that request once with automatic decoding disabled so the raw response remains inspectable. It does not retry unrelated read or transport errors. Because the fallback repeats the request after a response was received, avoid invalid `Content-Encoding` responses for non-idempotent operations. Event Stream transport keeps its existing reconnect policy instead of this one-shot raw fallback.

## Redirect policy

Each request keeps a **Follow HTTP redirects** switch in its Transport tab. Preferences adds a device-local **Maximum redirects** ceiling shared by native HTTP, GraphQL, Event Stream, collection-run, script/plugin, artifact-import, OAuth, AI, MCP, Konnect, and Git-AI traffic. `0` rejects the first redirect, positive integers allow that many hops, and `-1` follows without a hop ceiling. Turning the per-request switch off always disables redirects.

Finite and unlimited chains remain subject to an ordinary request's deadline. Event Streams use the request timeout while waiting for response headers—including redirects—then remove the total deadline from the active stream. Browser development mode uses Fetch's own redirect behavior because Fetch does not expose a maximum-hop control.

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
