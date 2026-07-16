# Brunomnia

Brunomnia is a local-first API workbench built with Tauri 2, Rust, React, and TypeScript. It is an original clean-room foundation for moving a desktop API client away from Electron while keeping product capabilities available without an account, subscription, telemetry requirement, or premium feature gate.

> This is the second runnable migration milestone, not full Insomnia ecosystem parity yet. See [the migration map](docs/MIGRATION.md) for the honest coverage list.

## What works now

- Native Rust transports for HTTP, GraphQL, WebSocket, SSE, and dynamic gRPC calls
- GraphQL operation and variables editor
- WebSocket text-frame sessions with an ordered bidirectional event log
- Incremental Server-Sent Events parsing with named-event history
- gRPC reflection, pasted `.proto` compilation, dynamic JSON messages, and unary/client/server/bidirectional streaming calls
- JSON, text, URL-encoded, multipart file, and binary request bodies
- Redirect, timeout, certificate validation, proxy, and client-certificate controls for native HTTP/SSE
- Local collections and editable requests
- Local environments with `{{ variable }}` expansion
- Bearer, Basic, and API-key authentication
- Request history and response body/header/timeline inspection
- Pre-request script and test editing surfaces
- Versioned JSON workspace import/export
- Atomic persistence in the OS application-data directory
- Responsive desktop UI with no login, upgrade, or cloud dependency

## Run it

Requirements: Node.js 20+ and Rust 1.77.2+.

```sh
npm install
npm run tauri dev
```

For browser-only UI development:

```sh
npm run dev
```

The browser development build uses deterministic protocol demos for the `*.acme.dev` examples. Other HTTP URLs use browser `fetch`; the Tauri build routes protocol execution through Rust, so browser CORS rules do not apply.

## Verify it

```sh
npm test
npm run build
cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings
```

## Architecture

- `src/` — React workbench, local state, templating, and browser fallback
- `src-tauri/` — native shell, atomic workspace persistence, and HTTP transport
- `design/` — accepted full-screen concept and verified implementation captures
- `docs/` — migration and feature-access policy

Brunomnia is independent software and is not affiliated with or endorsed by Kong Inc. “Insomnia” is referenced only to describe import/migration goals.

## License

Apache-2.0. See [LICENSE](LICENSE).
