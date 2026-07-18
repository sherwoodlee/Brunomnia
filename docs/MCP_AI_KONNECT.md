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

The first form resolves from the passphrase-protected local vault. The second uses an external-vault tuple approved in **Security & Sync**. Raw MCP bearer tokens/passwords/sensitive headers, AI keys, and Konnect tokens are detected as plaintext and rejected at execution. A custom HTTP authorization header can reference a vault entry containing its complete value, such as `Bearer …`.

Credential fields are masked by default. Each MCP bearer token/Basic password, AI-provider key, and Konnect token has a temporary Show/Hide control; the device-local **Reveal saved passwords and tokens** preference reveals them together with request authentication fields. This affects presentation only, and switching MCP clients clears temporary disclosure.

Brunomnia imports workspace integrations in a non-authoritative state: MCP clients are disabled, bearer/Basic credential fields are cleared, AI and Konnect are disabled, and their credential fields are cleared. Changing an MCP URL, transport, command, or argument list also disables the client and clears its discovery cache.

## MCP clients

MCP clients are project-scoped resources. Standard folder/Git projects serialize each client as YAML under `mcp-clients/`; cached operations travel with the project so collaborators can review them before reconnecting. Credentials should be references, not secret values.

### HTTP

The HTTP client:

- initializes MCP protocol version `2025-06-18` and sends `notifications/initialized`;
- supports JSON and JSON-bearing Server-Sent Event responses;
- carries `Mcp-Session-Id` across initialization, discovery, and invocation;
- discovers paginated tools, prompts, resources, and resource templates;
- invokes tools, prompts, and resource reads;
- accepts Basic, bearer/PAT, and custom headers;
- disables redirects and cookies;
- permits remote HTTPS endpoints and loopback-only plain HTTP; and
- records client/server messages in the integration event console.

Discovery is bounded to 100 pages and 5,000 cached items per operation family. Each request has a 30-second deadline. The shared HTTP transport buffers a response before the parser applies its format checks, so this milestone does not claim a pre-allocation Streamable HTTP body limit.

An HTTP `401` produces a focused authentication error. PAT/Basic credentials work, but automatic MCP OAuth authorization-server discovery, browser redirects, and callback capture remain open. Long-lived response streams, cancellation, server-request response UI, and live notification-driven cache refresh also remain open.

### STDIO

The desktop app starts the configured executable directly with an argument array; it never constructs a shell command. Each discovery or invocation creates a fresh process, initializes it, performs one operation, and terminates it. STDIO supports the same four discovery families and three invocation families as HTTP.

The native boundary limits:

- arguments to 100 entries and 8,192 bytes each;
- operation parameters to 1 MB;
- individual protocol messages and stderr to 10 MB;
- total stdout read to 20 MB;
- pre-response events to 1,000; and
- the operation deadline to 1–120 seconds (the UI uses 30 seconds).

Servers may call `roots/list`; Brunomnia returns the reviewed project roots. Other server requests, including sampling and elicitation, receive an explicit JSON-RPC “method not found” response explaining that interactive approval UI is required. Persistent process sessions, cancellation, sampling review, and elicitation forms remain parity work.

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

The mock workbench accepts a pasted prompt, OpenAPI text, or example response. It can instead attach the configured active request or that request's latest saved response, with optional additional instructions. A non-manual source must be explicitly selected, and the exact prepared context is reviewable before generation. When response-history environment filtering is enabled, latest-response selection stays inside the active environment.

Prepared context uses configured request values rather than resolving environment or vault references. Authentication values, credential-named headers/query/body fields, URL user information, cookies, and file bytes are redacted or omitted; arbitrary domain data in request/response bodies is still model input, so the preview remains the final disclosure check. The composed workbench input is capped at 190,000 characters and the provider adapter retains its 200,000-character hard cap. Output is parsed as data, never evaluated as code. Generated mocks are bound to `127.0.0.1`; methods, paths, status codes, string headers, delays, route count, and port range are validated before the mock is saved.

Output remains capped at 10 MB after transport buffering, routes at 500, headers per route at 100, and delay at 60 seconds. Brunomnia does not automatically fetch a specification URL. Separately, the mock workbench can create an editable route directly from the active request's latest text response without an AI provider; that local action is not model input.

### Git suggestions

The project workbench can send a bounded staged/working diff plus the exact changed-path allowlist to the selected provider. The model returns up to eight proposed groups with conventional-style messages and short comments. Brunomnia drops unknown paths. Applying a suggestion only selects files and fills the commit message; the user still reviews, stages, and commits through the ordinary Git workflow.

Diff input is capped at 200 KB, messages at 200 characters, comments at 1,000 characters, and output at 10 MB after transport buffering. MCP sampling is not automatically forwarded to the AI provider.

Brunomnia does not bundle a model or load `.gguf` files directly. A local model is currently used through a user-run OpenAI-compatible loopback server.

## Konnect pull

The Konnect adapter accepts only HTTPS hosts equal to `api.konghq.com` or ending in `.api.konghq.com`. It uses the configured protected PAT/system-token reference to:

1. list `/v2/control-planes`;
2. fetch Gateway Services for the selected control plane; and
3. fetch Gateway Routes for the selected control plane.

Pagination is confined to the configured origin, redirects and cookies are disabled, requests have a 60-second deadline, pagination is capped at 100 pages, resource accumulation at 10,000 records, and each parsed response at 20 MB after transport buffering.

Gateway Services become `Konnect · …` collections. HTTP/HTTPS routes become requests using a generated `konnect_<service>_proxy_host` variable in the active environment. Later pulls replace remote-managed route names, methods, paths, Host constraints, and route header constraints while retaining local query parameters, auth, body modes/content, custom non-conflicting headers, transport settings, pre-request scripts, and after-response tests. Routes without a service or with unsupported protocols such as SNI/TCP/UDP are retained in **Konnect · Skipped Routes** with source metadata.

The integration is intentionally pull-only: Brunomnia never writes Gateway configuration. No live PAT is checked into the repository, so automated evidence covers mapping and confinement logic rather than a live Konnect tenant.

## Device-local and shareable data

- MCP configuration and cached operation metadata are project-scoped and participate in split-YAML projects.
- AI and Konnect configuration are device-local when opening or pulling a project and are excluded from encrypted shared-file payloads.
- Local response/history/cookie data remains device-local as in earlier milestones.
- All integration actions respect the current local viewer/editor governance check.

Reference behavior was reconciled against Kong's current [MCP client documentation](https://developer.konghq.com/insomnia/mcp-clients-in-insomnia/), [AI documentation](https://developer.konghq.com/insomnia/ai-in-insomnia/), [Konnect integration guide](https://developer.konghq.com/insomnia/konnect-integration/), and [Konnect API overview](https://developer.konghq.com/konnect-api/) on 2026-07-16.
