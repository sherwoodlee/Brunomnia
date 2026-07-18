# Brunomnia

Brunomnia is a local-first API workbench built with Tauri 2, Rust, React, and TypeScript. It is an original clean-room foundation for moving a desktop API client away from Electron while keeping product capabilities available without an account, subscription, telemetry requirement, or premium feature gate.

> This is the forty-ninth runnable migration milestone, not full Insomnia ecosystem parity yet. See the [parity ledger](docs/PARITY.md) and [migration map](docs/MIGRATION.md) for the honest coverage list.

## What works now

- Native Rust transports for HTTP, GraphQL, WebSocket, SSE, and dynamic gRPC calls
- GraphQL operation/variables editor, bounded schema introspection cache, root-field validation, documentation explorer, and safe field insertion
- WebSocket text/binary-frame sessions with an ordered bidirectional event log
- Long-running Server-Sent Events sessions with incremental parsing, bounded or unlimited automatic reconnects, server retry hints, and `Last-Event-ID` resume
- gRPC reflection, pasted `.proto` compilation, dynamic JSON messages, and unary/client/server/bidirectional streaming calls
- JSON, text, URL-encoded, multipart file/part-metadata, and binary request bodies
- Standard or custom HTTP methods, explicit encoded path parameters, repeated query keys, regular or device-persistent bulk query/header editing, row descriptions, multiline values, and local JSON/XML body beautification
- Local client-code generation for cURL, JavaScript Fetch, Python Requests, Go `net/http`, Java `HttpClient`, and C# `HttpClient`
- Device-local redirect, request-timeout, API/authentication certificate-validation, and system/manual proxy defaults; per-request inheritance/overrides; `0`-disabled deadlines; a finite or unlimited native redirect ceiling; no-proxy lists; and domain-scoped client-certificate controls
- Device-local Default, HTTP 1.0, HTTP 1.1, HTTP/2, and HTTP/2 Prior Knowledge preferences with the negotiated native version in response evidence
- Transparent native gzip, Brotli, deflate, and zstd response decoding with one decode-error-only raw fallback
- Local collections with persistent mixed folder/request drag ordering, cross-collection moves, nested request folders, request/collection/folder documentation, and inherited folder headers, authentication, variables, and scripts
- Distinct global-base/selected-global and collection-base/selected-collection environments, device-local private global sub-environments, folder/iteration/request-local variables, dynamic aliases, and template tags for UUIDs, time, Faker values, encoding, hashing, JSONPath, cookies, prompts, requests, and chained responses
- Basic, Digest, OAuth 1.0/2.0, NTLM, AWS IAM v4, Bearer, API key, Hawk, Atlassian ASAP, and Netrc authentication
- Persistent editable cookie jar with per-request send/store controls
- A searchable 100-send activity log plus chronologically grouped per-request response history with finite/unlimited retention, active-environment filtering, rich URL/method/status/time/size evidence, delete/clear actions, historical request-version restoration, persistent Visual/Source/Raw preview modes with safe HTML and bounded CSV tables, JSONPath/XPath body filters, 5/100 MiB preview safety gates, raw/prettified body downloads, selected-response HTTP debug/HAR exports, body/header inspection, and persisted size-bounded outgoing/response timeline evidence
- Delayed one-shot sends and sequential repeating sends with explicit cancellation and a 1,000-run safety bound
- Permission-bounded pre-request scripts and async after-response tests with documented seven-level environment lookup, exact base/selected scope aliases, folder/query/auth helpers, shared Chai `assert` and chainable `expect` surfaces, bounded adapters for every documented bundled module name, path-scoped opt-in primary/secondary local body and PEM attachment, and mediated HTTP/vault capabilities
- Selectable drag/keyboard-ordered collection runs with JSON/CSV iteration data, retries, bail/cancellation, cookie/response chaining, bounded WebSocket/SSE samples, redacted request metadata, size-limited response inspection, saved reports, and downloadable JSON/JUnit evidence
- OpenAPI 3.x YAML/JSON editing, structural and safe Spectral-style custom linting, operation preview, formatting, and request generation
- Native loopback mock servers with route parameters, delays, headers, CORS, and dynamic response tokens
- A headless CLI for OpenAPI lint/generation/export and collection/test execution with regex test-name filtering, the documented Inso reporter names, and JSON/JUnit artifacts
- File, pasted-text, and HTTP(S) URL imports with format detection and a warning preview
- Insomnia JSON v4/v5, Postman Collection 2.0/2.1 and environments, HAR, OpenAPI 3.x, Swagger 2, WSDL, and cURL imports
- Scoped Brunomnia JSON, Insomnia v4/v5, HAR, and raw OpenAPI exports
- Versioned workspace migrations with collision-safe import history, distinct environment-store interoperability, advanced-auth/cookie-jar mapping, and preserved source metadata
- Reviewable split-YAML filesystem projects with ordinary Git init/clone/status/diff/stage/commit/branch/pull/push/merge workflows
- Three-way text conflict editing, binary ours/theirs resolution, and explicit merge abort without silently discarding local changes
- Local dependency-free CommonJS plugins with disabled-by-default installation, explicit capability grants, request/response hooks, template tags, actions, themes, and plugin-local storage
- A time-limited Worker boundary for plugin code, mediated network/prompt/clipboard access, and automatic grant removal when source changes or a workspace is imported
- A passphrase-derived AES-256-GCM local vault whose decrypted values exist only in memory and resolve through `{{ vault.name }}`
- AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, and HashiCorp Vault template adapters through user-authenticated official CLIs, an in-memory cache, and an explicit per-reference-tuple allowlist
- End-to-end encrypted shared-file revisions with optimistic conflict checks, explicit force, device-local data filtering, and self-hosted filesystem/WebDAV compatibility
- Local owner/admin/editor/viewer metadata, storage and plaintext-secret policies, bounded audit records, and governance migration hardening
- Project-scoped MCP clients over Streamable HTTP/JSON-RPC and native STDIO, with cached tools, prompts, resources, resource templates, roots, invocation, and an event console
- Optional OpenAI, Anthropic, Gemini, and custom/local OpenAI-compatible providers with vault-only credential execution, AI mock generation, and reviewable Git commit grouping suggestions
- Pull-only Konnect control-plane discovery and Gateway Service/HTTP Route mapping that preserves local request work and isolates unsupported routes
- Workspace v22 migrations, device-local bulk/editor/layout/typography/password-visibility and script-data-folder preferences, legacy-safe timeout/certificate/proxy overrides, bounded resource hierarchy and request-row normalization, collection sub-environment repair, private-global publication filtering, split-YAML serialization, import-time authority stripping, and device-local integration/script permissions
- Atomic persistence in the OS application-data directory
- System/dark/light appearance, comfortable/compact density, horizontal/responsive or forced-vertical request layout, separate interface/editor font families and 8–24 px sizes, configurable editor wrapping/indentation/ligatures, masked authentication and integration credentials with device-wide or per-field reveal, request defaults, and customizable keyboard shortcuts
- Responsive desktop UI with no login, upgrade, or cloud dependency

## Run it

Requirements: Node.js 20.19+ (or 22.12+) and Rust 1.77.2+.

```sh
npm install
npm run tauri dev
```

For browser-only UI development:

```sh
npm run dev
```

The browser development build uses deterministic protocol demos for the `*.acme.dev` examples. Other HTTP URLs use browser `fetch`; the Tauri build routes protocol execution through Rust, so browser CORS rules do not apply.

## Use the CLI

Build the bundled `brunomnia` executable and inspect its commands:

```sh
npm run build:cli
node bin/brunomnia.cjs --help
```

Examples:

```sh
node bin/brunomnia.cjs lint spec examples/orders-api.yaml
node bin/brunomnia.cjs generate collection examples/orders-api.yaml --output collection.json
node bin/brunomnia.cjs export spec examples/cli-workspace.json "CLI API" --output api.yaml
node bin/brunomnia.cjs run test examples/cli-workspace.json "CLI Health" --allow-scripts --allow-script-files
node bin/brunomnia.cjs run test examples/cli-workspace.json "CLI Health" --allow-scripts --allow-script-files --bail --reporter junit --output report.xml
```

The checked-in [CLI workspace fixture](examples/cli-workspace.json) is self-contained and does not make an internet request. CLI JavaScript is disabled unless `--allow-scripts` is present; the fixture's local attachment also requires `--allow-script-files`. Trusted scripts can make secondary HTTP requests only when `--allow-script-requests` is also present. Reporters are `dot`, `list`, `min`, `progress`, `spec`, `tap`, `json`, and `junit`; use `--output` to write the artifact instead of stdout. See [runner reports and CI](docs/RUNNER_REPORTS.md).

## Verify it

```sh
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run tauri build -- --debug --bundles app
```

## Architecture

- `src/` — React workbench, design/runner/script/interchange engines, local state, templating, and browser fallback
- `src-tauri/` — native shell, atomic workspace/project persistence, Git process boundary, local plugin reader, protocol transports, and loopback mocks
- `cli/` — headless automation entry point sharing the OpenAPI and runner modules
- `design/` — accepted full-screen concept and verified implementation captures
- `docs/` — migration, project/plugin/security guides, verification records, and feature-access policy

Brunomnia is independent software and is not affiliated with or endorsed by Kong Inc. “Insomnia” is referenced only to describe import/migration goals.

## License

Apache-2.0. See [LICENSE](LICENSE).
