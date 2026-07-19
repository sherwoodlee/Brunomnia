# Milestone 111 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: match the pinned plain-WebSocket HTTP proxy request form while retaining Milestone 110's WSS CONNECT, TLS, client-identity, no-proxy, and Socket.IO policy continuity.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned WebSocket and Socket.IO execution selects `HttpProxyAgent` for plain WS/HTTP targets and `HttpsProxyAgent` for WSS/HTTPS targets.
- The pinned package graph resolves `http-proxy-agent` 7.0.2. Its `setRequestProps` implementation derives an absolute `http://host[:port]/path?query` request path, injects percent-decoded URL Basic credentials as `Proxy-Authorization`, and adds `Proxy-Connection` only when absent.
- Pinned WSS behavior remains CONNECT-based through `https-proxy-agent`; Milestone 110 already implemented that tunnel plus nested target TLS and scoped client identity.
- Brunomnia's frontend transport resolver already selects protocol-specific manual proxy URLs and request custom/direct overrides. This milestone changes only the native plain-WS wire form.

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

- `ForwardProxyStream` wraps only a selected plain-WS proxy connection. It requires one complete generated GET header block, replaces the origin-form request line with an absolute `http://` URL, and leaves every generated/authored header plus any tail bytes byte-for-byte unchanged.
- The adapter retains an output cursor across short asynchronous writes and reports the original input length only after every rewritten byte reaches the proxy. Later WebSocket reads, writes, flushes, and shutdown delegate directly to the established stream.
- Absolute URLs preserve normalized IPv4/domain/IPv6 authority, omit default port 80, retain non-default ports, path, and query, exclude fragments, and never resolve the target hostname locally.
- Configured proxy URL credentials use the existing bounded percent decoder and replace an authored proxy authorization value. Password-only URLs are accepted, an authored proxy-connection value remains authoritative, and absent values receive `Keep-Alive`.
- Plain WS forwarding works through both HTTP and TLS-protected HTTPS proxies. WSS continues to issue bounded authenticated CONNECT before nested target TLS, so GraphQL subscriptions and HTTPS Socket.IO targets keep certificate-validation and client-identity behavior.
- Real proxy endpoints complete the forwarded WebSocket handshake themselves for an otherwise unresolvable target and assert the absolute URI and proxy headers. Socket.IO proves polling followed by absolute-form upgrade on the same proxy policy; WSS mTLS and direct no-proxy tests continue passing.
- No account, organization, telemetry, hosted runtime, subscription, or entitlement check is introduced.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. No screenshot, DOM, console, or visual-interaction claim is made. Verification is limited to pinned source/dependency inspection, strict offline Rust gates, real native proxy/TLS loopbacks, full frontend/native suites, production/CLI builds, and desktop app packaging.

## Acceptance boundary

Brunomnia's packaged Tauri path now matches the pinned proxy split: plain WS uses absolute-form forwarding through an HTTP or HTTPS proxy, while WSS uses authenticated CONNECT and nested TLS. PAC-authenticated system proxy discovery, digest/NTLM proxy authentication, upstream filesystem-backed event/timeline streams, streaming plugin hooks, and broad third-party proxy matrices remain open. The affected parity rows therefore remain `Baseline`, and Brunomnia is not yet declared feature-complete.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
