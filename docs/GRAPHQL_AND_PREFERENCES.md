# GraphQL productivity and desktop preferences

Milestone 9 adds local GraphQL schema tooling, request scheduling, and device-local desktop preferences without introducing an account, hosted dependency, telemetry requirement, or paid entitlement.

## GraphQL schemas

Open a GraphQL request and choose **Body**. Brunomnia can fetch the endpoint's introspection schema explicitly, or automatically after a request is selected or its URL changes when **Automatically introspect GraphQL schemas** is enabled in Preferences.

Introspection uses the request's URL, headers, authentication, environment, local-vault values, approved external-vault values, TLS/proxy settings, and timeout. It forces POST, disables redirects and cookie storage, removes request scripts/tests, caps the deadline to 1–120 seconds, rejects non-success responses, and accepts at most 20 MB of parsed response text. The shared transport buffers the response before that parsed-text check, so a pre-allocation network limit is not claimed.

Normalized caches are bounded to 5,000 types, 1,000 fields per type, 100 arguments per field, and finite type-reference depth. Workspace migration applies the same bounds to imported caches.

With a schema loaded, the Body editor provides:

- structural delimiter and variables-object checks;
- cached query/mutation/subscription root-field validation;
- root-field filtering and safe insertion;
- deprecation indicators and type signatures; and
- browsable type and field documentation.

Safe insertion selects up to three child fields that do not require arguments. It does not pretend to be a full GraphQL language server: nested selection/type validation, argument completion, persisted queries, subscriptions, manual schema import, and introspection-disabled workflows remain in the parity ledger.

GraphQL query text intentionally does not resolve template tags, matching Insomnia's documented boundary. Put template tags in the variables JSON instead.

## Send scheduling

For HTTP and GraphQL requests, open the arrow beside **Send** to configure an initial delay and repeat interval. Repeats are sequential: Brunomnia waits for each request to finish, then waits for the interval. The main button becomes a stop control while a schedule is active.

Stopping cancels the timer and all future runs. A request already in flight completes normally. One schedule is active at a time and repeat mode stops after 1,000 sends as a local safety bound.

## Preferences

Open **Preferences** from the activity rail, command palette, or its editable shortcut. Settings include:

- system, dark, or light appearance;
- comfortable or compact density;
- 11–20 px editor font size;
- a preferred native protocol of Default negotiation, HTTP 1.0, HTTP 1.1, HTTP/2, or HTTP/2 Prior Knowledge;
- a device-local follow-redirect default that inherited requests can override with Always or Never;
- a native maximum redirect count, where `0` follows none and `-1` allows redirects until the request or Event Stream handshake deadline;
- a maximum outgoing timeline chunk size in KiB, defaulting to 10;
- a per-request response history limit, where `0` keeps only the live result and `-1` retains all saved responses;
- optional response-history filtering by active environment;
- a request timeout applied at execution time, defaulting to 30 seconds, with `0` disabling deadlines;
- separate certificate-validation defaults for API requests and authentication flows;
- a 1–60 second script deadline plus separate off-by-default secondary-request, local-file, and local-vault script authorities;
- automatic GraphQL introspection;
- request-deletion confirmation; and
- eleven editable keyboard bindings.

Click a shortcut field and press a combination. `Mod` maps to Command on macOS and Control elsewhere. Duplicate bindings are shown and only the first matching action runs. Press Backspace to clear a binding or use **Reset defaults**.

Preferences stay on this device. Split-YAML folder/Git projects omit them, encrypted-sync pulls preserve the current device's values, and imported workspace files start with safe defaults. Plugin themes take precedence while active.

The HTTP version, follow-redirect default, maximum redirects, request timeout, and API certificate-validation preference reach ordinary HTTP and GraphQL sends, Event Streams, gRPC, collection runs, secondary script/plugin requests, artifact URL imports, and HTTP-backed integrations. OAuth token requests resolve the separate authentication validation preference. Each request can inherit or explicitly override its timeout, redirect choice, and API certificate validation. New requests inherit the device defaults. Workspace v14 and earlier requests keep their saved timeouts as custom overrides; workspace v15 and earlier requests keep their saved validation booleans as Always/Never until explicitly switched to inheritance. Security-sensitive internal requests retain bounded custom deadlines and Never redirect policies.

Standard HTTP/2 negotiates and can fall back; Prior Knowledge requires an HTTP/2-capable peer. Native responses show the protocol actually used in the response summary and timeline. Browser development mode honors effective redirect and timeout choices through Fetch, including no AbortSignal when timeouts are disabled, but the browser owns TLS verification, protocol selection, and its redirect-count ceiling. The CLI refuses requests that require disabled validation because Node Fetch does not expose that authority.

Saved responses remain device-local and are selectable from the response summary. The default keeps 20 per request. When environment filtering is enabled, the selector and response template tags see only results from the active global environment, and the retention limit applies independently to each request/environment pair. Changing a limit does not erase data immediately; the relevant scope is pruned the next time that request stores a response.

The timeline stores prepared request and aggregate response evidence with each saved result. Text, JSON, GraphQL, and URL-encoded outgoing data below the configured threshold remain inspectable; data at or above it becomes a size-only hidden marker. Matching current Insomnia behavior, a configured zero uses a 1 KiB fallback. Binary content is always represented by filename and size, and multipart content uses a configured-part summary because the native and browser transports do not expose their final wire boundary. Response bodies remain in Preview; the timeline records only their decoded aggregate size rather than duplicating content.
