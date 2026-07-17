# Brunomnia

Brunomnia is a local-first API workbench built with Tauri 2, Rust, React, and TypeScript. It is an original clean-room foundation for moving a desktop API client away from Electron while keeping product capabilities available without an account, subscription, telemetry requirement, or premium feature gate.

> This is the fifth runnable migration milestone, not full Insomnia ecosystem parity yet. See the [parity ledger](docs/PARITY.md) and [migration map](docs/MIGRATION.md) for the honest coverage list.

## What works now

- Native Rust transports for HTTP, GraphQL, WebSocket, SSE, and dynamic gRPC calls
- GraphQL operation and variables editor
- WebSocket text/binary-frame sessions with an ordered bidirectional event log
- Incremental Server-Sent Events parsing with named-event history
- gRPC reflection, pasted `.proto` compilation, dynamic JSON messages, and unary/client/server/bidirectional streaming calls
- JSON, text, URL-encoded, multipart file/part-metadata, and binary request bodies
- Redirect, timeout, certificate validation, proxy exclusions, and domain-scoped client-certificate controls for native HTTP/SSE
- Local collections and editable requests
- Local environments, iteration/request-local variables, dynamic aliases, and template tags for UUIDs, time, Faker values, encoding, hashing, JSONPath, cookies, prompts, requests, and chained responses
- Basic, Digest, OAuth 1.0/2.0, NTLM, AWS IAM v4, Bearer, API key, Hawk, Atlassian ASAP, and Netrc authentication
- Persistent editable cookie jar with per-request send/store controls
- Request history and response body/header/timeline inspection
- Permission-bounded pre-request scripts and after-response tests
- Ordered collection runs with JSON/CSV iteration data, retries, cancellation, cookie/response chaining, bounded WebSocket/SSE samples, and saved reports
- OpenAPI 3.x YAML/JSON editing, structural and safe Spectral-style custom linting, operation preview, formatting, and request generation
- Native loopback mock servers with route parameters, delays, headers, CORS, and dynamic response tokens
- A headless CLI for OpenAPI lint/generation/export and collection/test execution
- File, pasted-text, and HTTP(S) URL imports with format detection and a warning preview
- Insomnia JSON v4/v5, Postman Collection 2.0/2.1 and environments, HAR, OpenAPI 3.x, Swagger 2, WSDL, and cURL imports
- Scoped Brunomnia JSON, Insomnia v4/v5, HAR, and raw OpenAPI exports
- Versioned workspace migrations with collision-safe import history, advanced-auth/cookie-jar interoperability, and preserved source metadata
- Atomic persistence in the OS application-data directory
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
node bin/brunomnia.cjs run test examples/cli-workspace.json "CLI Health"
```

The checked-in [CLI workspace fixture](examples/cli-workspace.json) is self-contained and does not make an internet request.

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
- `src-tauri/` — native shell, atomic workspace persistence, protocol transports, and loopback mocks
- `cli/` — headless automation entry point sharing the OpenAPI and runner modules
- `design/` — accepted full-screen concept and verified implementation captures
- `docs/` — migration and feature-access policy

Brunomnia is independent software and is not affiliated with or endorsed by Kong Inc. “Insomnia” is referenced only to describe import/migration goals.

## License

Apache-2.0. See [LICENSE](LICENSE).
