# Local mock servers

Brunomnia serves editable mock routes from the native desktop process on `127.0.0.1`. Starting a server snapshots its enabled routes; stop and restart it after editing routes. Route matching uses the configured HTTP method and path, including `{parameter}` segments. Responses can set status, headers, delay, and a text body.

## Request-aware response bodies

Mock bodies support a safe Liquid-style output subset. Values are inserted as plain response text; no JavaScript or shell code is evaluated.

| Input | Example |
| --- | --- |
| Case-insensitive header | `{{ req.headers['X-Client'] }}` or `{{ req.headers.x-client }}` |
| Query parameter | `{{ req.queryParams.orderId }}` or `{{ req.queryParams['orderId'] }}` |
| Zero-based path segment | `{{ req.pathSegments[0] }}` |
| Raw UTF-8 body | `{{ req.body }}` |
| Parsed JSON/form field | `{{ req.body.customer.name }}` or `{{ req.body.items.0.id }}` |
| Missing-value fallback | `{{ req.body.name | default: "Guest" }}` |
| Route `{id}` parameter | `{{ request.path.id }}` |
| Timestamp / UUID | `{{$timestamp}}` and `{{$randomUUID}}` |

JSON is parsed for `application/json` and `+json` media types. URL-encoded fields are parsed for `application/x-www-form-urlencoded`. Duplicate query/form names currently use the last value. Multipart field parsing is not yet implemented.

## Bounds and compatibility

- Request bodies are inspected only after a method/path route match and only up to 1,000,000 bytes.
- A non-UTF-8 or oversized request body exposes an empty `req.body`; headers, query, path, static body text, and default values still work.
- Missing known variables render as an empty string unless `default` is present.
- Unsupported output variables and Liquid tag syntax remain literal. Brunomnia does not evaluate arbitrary filters or code.
- `assign`, `if`, `unless`, `raw`, multipart fields, and Faker variables remain tracked parity work.
- Native mock CORS remains permissive for local front-end development. Do not place secrets in mock response bodies.

The implemented contract is reconciled against Kong's current [dynamic mocking documentation](https://developer.konghq.com/insomnia/dynamic-mocking/). Brunomnia's mock server is local and account-free; it does not depend on Insomnia Mockbin or a hosted service.
