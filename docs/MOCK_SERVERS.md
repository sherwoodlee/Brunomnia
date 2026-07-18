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
| Parsed JSON/form/multipart field | `{{ req.body.customer.name }}` or `{{ req.body.items.0.id }}` |
| Missing-value fallback | `{{ req.body.name | default: "Guest" }}` |
| Route `{id}` parameter | `{{ request.path.id }}` |
| Timestamp / UUID | `{{$timestamp}}` and `{{$randomUUID}}` |

JSON is parsed for `application/json` and `+json` media types. URL-encoded fields are parsed for `application/x-www-form-urlencoded`. Multipart fields are parsed for `multipart/form-data`, `multipart/mixed`, `multipart/related`, and `multipart/alternate` when a valid boundary is present. Repeated multipart names become arrays, so two `tag` fields are available as `{{ req.body.tag.0 }}` and `{{ req.body.tag.1 }}`. UTF-8 file-part content is exposed under its field name like upstream Mockbin; filenames and per-part headers are not template properties. Duplicate query/URL-encoded names currently use the last value.

## Bounded control tags

The same response body can use this deliberately small control-flow subset:

| Control | Example |
| --- | --- |
| Local assignment | `{% assign greeting = "Hello" %}{{ greeting }}` |
| Conditional branch | `{% if req.queryParams.role == "admin" %}allowed{% else %}denied{% endif %}` |
| Inverted branch | `{% unless req.body.disabled %}enabled{% endunless %}` |
| Literal template text | `{% raw %}{{ not_rendered }}{% endraw %}` |

Conditions support truthiness plus `==` and `!=` comparisons against another known value, a quoted string, a number, `true`, `false`, `nil`, or `null`. Assignments accept an ASCII letter/number/underscore name up to 100 characters, values up to 10,000 bytes, and at most 100 distinct locals; they last only for that response render. Empty and `false` values are falsey; other non-empty values are truthy. `raw` copies everything through its matching `endraw` without interpreting outputs or nested tags.

## Faker values

All 118 names in Kong's current [Faker variables list](https://developer.konghq.com/insomnia/faker-variables/) render locally with `{{ faker.<variable-name> }}`. This covers identifiers, booleans, timestamps, colors, text, dates, internet/address/job values, image references, finance/company/database values, files, and products. Examples include:

```liquid
{
  "id": "{{ faker.randomUUID }}",
  "name": "{{ faker.randomFullName }}",
  "email": "{{ faker.randomExampleEmail }}",
  "createdAt": "{{ faker.isoTimestamp }}",
  "enabled": {{ faker.randomBoolean }}
}
```

Every occurrence is generated independently for the response. Image variables return a URL or self-contained SVG data URI as documented; rendering never downloads an image. Unknown Faker names remain literal. Brunomnia uses a compact built-in English test-data corpus, so exact strings, locale breadth, and probability distributions intentionally differ from the upstream FakerJS package.

## Bounds and compatibility

- Request bodies are inspected only after a method/path route match and only up to 1,000,000 bytes.
- A non-UTF-8 or oversized request body exposes an empty `req.body`; headers, query, path, static body text, and default values still work.
- Multipart parsing accepts at most 100 parts, 16,000 header bytes per part, a 200-byte boundary, and 1,000-byte field names. Malformed or over-limit multipart exposes no parsed fields; its bounded valid-UTF-8 raw body remains available.
- Each response evaluates at most 1,000 template-token operations and 20 nested conditional levels. The unprocessed remainder stays literal when either limit is reached.
- Dynamically inserted values contribute at most 5,000,000 response bytes. Static route text does not consume this expansion budget; an output and the following remainder stay literal if it would cross the limit.
- Missing known variables render as an empty string unless `default` is present.
- Unsupported output variables and Liquid tag syntax remain literal. Brunomnia does not evaluate arbitrary filters, loops, includes, or code.
- Repeated query/URL-encoded arrays, multipart metadata, `elsif`, broader operators/filters, full Liquid semantics, and exact FakerJS corpus/distribution identity remain tracked parity work.
- Native mock CORS remains permissive for local front-end development. Do not place secrets in mock response bodies.

The implemented contract is reconciled against Kong's current [dynamic mocking documentation](https://developer.konghq.com/insomnia/dynamic-mocking/). Brunomnia's mock server is local and account-free; it does not depend on Insomnia Mockbin or a hosted service.
