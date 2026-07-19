# Local mock servers

Brunomnia serves editable mock routes from the native desktop process on `127.0.0.1`. While a server is running, route additions, deletions, enablement, matching fields, delays, headers, status, and response-body edits are applied to the existing listener after a short local debounce. An in-flight request keeps the route snapshot it matched, while the next request uses the latest saved editor state. Route matching uses the configured HTTP method and path, including `{parameter}` segments. Responses can set status, headers, delay, and a text body.

## Create or overwrite from a response

The request response pane includes a **Mock** tab for HTTP and GraphQL results. It can create a new account-free local server and route, add a route to an existing server, or overwrite only the status, headers, and body of an existing route. New routes expose editable method and path fields before creation. Method/path conflicts are rejected so a newly created route cannot be silently shadowed by an earlier route. **Go to mock** opens the exact selected or created route in the local mock workbench.

This workflow has no project-storage, account, organization, enterprise-plan, or subscription check. Binary responses remain refused because the current route model stores text bodies. If the target server is already running, create and overwrite actions update its existing listener immediately.

## Request-aware response bodies

Mock bodies support a safe Liquid-style output subset. Values are inserted as plain response text; no JavaScript or shell code is evaluated.

| Input | Example |
| --- | --- |
| Case-insensitive header | `{{ req.headers['X-Client'] }}` or `{{ req.headers.x-client }}` |
| Query parameter | `{{ req.queryParams.orderId }}` or `{{ req.queryParams['order.id'] }}` |
| Repeated query/form/multipart value | `{{ req.queryParams.tag[0] }}` or `{{ req.body.tag.1 }}` |
| Computed property | `{% assign key = "profile.name" %}{{ req.body[key] }}` or `{{ req.body.lookup[req.queryParams.key] }}` |
| Zero-based decoded path segment | `{{ req.pathSegments[0] }}` |
| Raw UTF-8 body | `{{ req.body }}` |
| Parsed JSON/form/multipart field | `{{ req.body.customer.name }}` or `{{ req.body.items.0.id }}` |
| Missing-value fallback | `{{ req.body.name | default: "Guest" }}` |
| Route `{id}` parameter | `{{ request.path.id }}` |
| Timestamp / UUID | `{{$timestamp}}` and `{{$randomUUID}}` |

JSON is parsed for `application/json` and `+json` media types. URL-encoded fields are parsed for `application/x-www-form-urlencoded`. Multipart fields are parsed for `multipart/form-data`, `multipart/mixed`, `multipart/related`, and `multipart/alternate` when a valid boundary is present. Repeated query, URL-encoded, or multipart names become ordered arrays. Dot segments, numeric brackets, numeric dotted indices, quoted bracket keys, and nested computed bracket expressions can be combined, including `{{ req.body.items[0]['profile.name'] }}` and `{{ req.body.lookup[req.body.keys[0]] }}`. Assigned arrays/objects retain typed property access; arrays and strings expose `size`, `first`, and `last`. UTF-8 file-part content is exposed under its field name like upstream Mockbin; filenames and per-part headers are not template properties.

Query/form percent encoding is decoded as UTF-8 and `+` represents a space. Path segments and `{parameter}` values decode valid UTF-8 `%HH` sequences, while a literal path `+` stays `+`. Invalid UTF-8 path escapes remain unchanged rather than producing replacement text.

## Bounded control tags

The same response body can use this deliberately small control-flow subset:

| Control | Example |
| --- | --- |
| Local assignment | `{% assign greeting = "Hello" %}{{ greeting }}` |
| Conditional branch | `{% if req.queryParams.role == "admin" %}allowed{% else %}denied{% endif %}` |
| Additional branch | `{% if req.body.score > 90 %}high{% elsif req.body.score >= 50 %}medium{% else %}low{% endif %}` |
| Inverted branch | `{% unless req.body.disabled %}enabled{% endunless %}` |
| Literal template text | `{% raw %}{{ not_rendered }}{% endraw %}` |

Conditions support strict typed `==`/`!=`, `>`/`<`/`>=`/`<=`, string or array `contains`, unary `not`, and right-associative `and`/`or` with LiquidJS precedence. Query/form values remain strings, while parsed JSON booleans, numbers, arrays, objects, and null remain typed. Like LiquidJS's Shopify mode, only `false`, nil, and missing values are falsey; empty strings, empty arrays, and zero are truthy. The `empty` and `blank` comparison literals are supported. The `default` filter replaces false, nil, empty strings, and empty arrays, but not zero.

Assignments retain their value type, accept an ASCII letter/number/underscore name up to 100 characters, values up to 10,000 rendered bytes, and at most 100 distinct locals; they last only for that response render. `if` and `unless` accept ordered `elsif` branches before an optional `else`. `raw` copies everything through its matching `endraw` without interpreting outputs or nested tags.

Single- and double-quoted values follow LiquidJS escapes for quotes/backslashes, `\b`, `\f`, `\n`, `\r`, `\t`, `\v`, one-to-four-digit `\u` hexadecimal values, and one-to-three-digit octal values. Quoted `}}`, `%}`, `{%`, operators, pipes, and brackets remain string content rather than ending or splitting the surrounding token. The allowed `default` filter can be chained, and pipes inside its quoted fallback stay literal.

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

Every occurrence is generated independently for the response. Image variables return a URL or self-contained SVG data URI as documented; rendering never downloads an image. Unknown Faker names render as an empty string, matching Mockbin's non-strict variable mode. Brunomnia uses a compact built-in English test-data corpus, so exact strings, locale breadth, and probability distributions intentionally differ from the upstream FakerJS package.

## Bounds and compatibility

- Request bodies are inspected only after a method/path route match and only up to 1,000,000 bytes.
- A non-UTF-8 or oversized request body exposes an empty `req.body`; headers, query, path, static body text, and default values still work.
- Query strings and URL-encoded bodies retain at most the first 1,000 decoded pairs, matching Node's default query-string bound.
- Multipart parsing accepts at most 100 parts, 16,000 header bytes per part, a 200-byte boundary, and 1,000-byte field names. Malformed or over-limit multipart exposes no parsed fields; its bounded valid-UTF-8 raw body remains available.
- A response template can contain at most 1,000,000 Unicode characters, evaluate at most 1,000 template-token operations, and enter at most 20 nested conditional levels.
- Dynamically inserted values contribute at most 5,000,000 response bytes. Static route text does not consume this expansion budget.
- Missing known variables render as an empty string unless `default` is present.
- Unknown variables and Faker names render as an empty string. Unsupported filters or tags, malformed/unclosed outputs, strings, properties, or controls, invalid assignments, and source/token/nesting/local/expansion limit failures stop rendering rather than preserving a literal remainder. Syntax in an inactive conditional branch is still validated.
- A render failure returns HTTP 500 JSON shaped as `{"error":"Error rendering body template","message":"<diagnostic>"}` with CORS and mock-route identity headers. Brunomnia does not evaluate arbitrary filters, loops, includes, or code; those tags and filters are also disabled by the current Mockbin allowlist.
- Exact LiquidJS parser diagnostics, range literals, quoted/range base-value property reads, JavaScript lone-surrogate identity, runtime wall-clock/memory accounting, object/Drop identity, and exact FakerJS corpus/distribution identity remain tracked parity work.
- Native mock CORS remains permissive for local front-end development. Do not place secrets in mock response bodies.

The implemented contract is reconciled against Kong's current [dynamic mocking documentation](https://developer.konghq.com/insomnia/dynamic-mocking/). Brunomnia's mock server is local and account-free; it does not depend on Insomnia Mockbin or a hosted service.
