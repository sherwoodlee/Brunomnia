# Milestone 110 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: apply inherited/manual and request-custom proxy policy to native WebSocket, GraphQL subscription, and Socket.IO WebSocket-upgrade handshakes without dropping WSS validation or client identity.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned WebSocket execution enables its configured proxy only for WebSocket requests whose proxy setting is active, selects the HTTP or HTTPS proxy agent from the target protocol, and composes that agent with certificate validation and filtered client identities.
- Pinned Socket.IO execution uses the same protocol-specific proxy-agent selection while retaining polling-first Engine.IO negotiation, WebSocket upgrade, certificate validation, and filtered identity inputs.
- Pinned GraphQL subscriptions use the WebSocket path after HTTP(S)-to-WS(S) conversion, so proxy behavior is inherited from that transport.
- Brunomnia already resolves device-manual, request-custom, Direct, protocol-specific URL, and no-proxy values before invoking native streaming. This milestone consumes that effective model rather than adding another settings surface.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 53 files, 347 tests |
| Focused native proxy loopbacks | Pass — 5 tests |
| Native test suite | Pass — 83 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 191 modules; main JavaScript 499.99 kB with no warning |
| Bundled CLI build/startup | Pass |
| macOS Tauri debug `.app` bundle | Pass — app-only packaging plus executable and `Info.plist` checks |
| Changed-path whitespace checks | Pass |

## Focused coverage

- One boxed async transport supports direct TCP, a plain HTTP proxy, a TLS-protected HTTPS proxy, and nested target WSS without changing the WebSocket session/event implementation.
- HTTP CONNECT requests use the target hostname and effective port, accept only an HTTP/1.0 or HTTP/1.1 200 response, and stop response headers at 64 KiB. Unsupported proxy schemes, malformed URLs, refused tunnels, invalid status lines, and timeouts fail explicitly.
- Proxy URLs without a scheme default to `http://`. Percent-encoded Basic username/password values are decoded in memory, while invalid UTF-8, malformed escapes, and encoded CR/LF are rejected before header construction.
- No-proxy matching covers `*`, exact hosts, leading-dot or `*.` suffixes, optional ports, and IPv4/IPv6 CIDR values. A bypass connects directly and does not contact the configured proxy.
- HTTPS proxy TLS uses request-local certificate policy. Target WSS independently applies native roots or request-local Never validation plus domain-scoped PEM identity, including when nested through a proxy.
- WebSocket and converted GraphQL subscription requests call the shared connector. Socket.IO now applies it during `2probe`/`3probe`/`5` upgrade instead of forcing proxy, identity, or Never-validation sessions to remain on polling; ordinary failed upgrades still fall back to polling.
- Real loopbacks prove authenticated routing to an otherwise unresolvable hostname, CIDR bypass around a dead proxy, WSS-over-proxy mTLS, an untrusted HTTPS proxy accepted only under effective Never validation, and polling-to-proxied-WebSocket Socket.IO upgrade.
- No account, organization, telemetry, hosted runtime, subscription, or entitlement check is introduced.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. No screenshot, DOM, console, or visual-interaction claim is made. Verification is limited to pinned source inspection, strict offline Rust gates, real native proxy/TLS loopbacks, full frontend/native suites, production/CLI builds, and desktop app packaging.

## Acceptance boundary

Brunomnia's packaged Tauri path now carries inherited/manual and request-custom HTTP/HTTPS proxy policy through WebSocket, GraphQL subscription, and Socket.IO upgrade execution while preserving no-proxy, validation, and client-identity authority. PAC-authenticated system proxy discovery, exact upstream forward-proxy behavior for plain WS servers that reject CONNECT, upstream filesystem-backed event/timeline streams, streaming plugin hooks, and broad third-party proxy matrices remain open. The affected parity rows therefore remain `Baseline`, and Brunomnia is not yet declared feature-complete.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
