# Milestone 137 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: close the pinned WebSocket redirect-policy gap, correct the prior realtime proxy audit, and carry the redirect-safe connector into GraphQL subscriptions and Socket.IO WebSocket upgrades without broadening the full-parity claim.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/main/network/websocket.ts` resolves request/global follow policy and passes it with the positive redirect ceiling to pinned `ws@^8.18.1`; the settings UI documents `-1` as unlimited. Brunomnia applies the documented `0`/positive/`-1` contract directly rather than inheriting `ws`'s fallback ceiling for non-positive values.
- The same pinned WebSocket path installs an HTTP/HTTPS proxy agent only when global manual proxying and request proxy use are enabled. It does not call Electron proxy resolution when that condition is false.
- `packages/insomnia/src/main/network/socket-io.ts` supplies an explicit HTTP/HTTPS proxy agent when global manual proxying is enabled and otherwise sets `agent: false`. It likewise has no PAC/system proxy-resolution path.
- Pinned Socket.IO leaves the client library's default transient reconnection behavior enabled. Its initial `connect_error` handler closes the client, while explicit client/namespace disconnects are terminal; Brunomnia retains automatic post-connect Engine.IO recovery as the next named Socket.IO gap.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused WebSocket redirect regressions | Pass — 4 native tests |
| Full Vitest suite | Pass — 62 files, 437 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 506 renderer modules; 7.64 kB lazy StreamConsole chunk; 343.03 kB main renderer; 5,279,883-byte CLI bundle |
| Bundled CLI startup/help | Pass |
| Bundled localhost CLI template smoke | Pass — denial, File grant, Node OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 103 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Follow-disabled mode refuses the first redirect with an explicit reason. A maximum of `0` also refuses the first hop, positive values allow exactly that many hops, and `-1` uses an iterative no-ceiling loop without recursive stack growth.
- Relative and absolute `Location` values resolve against the current WS(S) URL. Missing, malformed, non-UTF-8, HTTP(S), and other non-WS(S) locations fail instead of silently changing transport.
- Every followed hop rebuilds the handshake, regenerating Connection, Upgrade, WebSocket version, and `Sec-WebSocket-Key` values. Loopback evidence proves a relative same-origin redirect receives a different key while preserving ordinary, Authorization, and Cookie headers.
- Scheme, host, or effective-port changes remove authored Host, Authorization, and Cookie values before rebuilding. Loopback evidence proves the target receives its generated authority, retains a non-sensitive header, and receives neither credential header.
- Each hop reselects direct/manual/custom HTTP or HTTPS proxy routing, Basic proxy credentials, exact/suffix/port/IP-CIDR no-proxy exclusions, WSS validation, workspace CA, and domain-scoped PEM or PFX/PKCS#12 identity for its actual target.
- The shared connector is used by ordinary WebSocket sessions, `graphql-transport-ws` subscriptions, and Socket.IO's Engine.IO WebSocket upgrade attempt. Socket.IO polling continues to use the same effective redirect policy through reqwest.
- Redirect failures remain ordinary connection errors and do not create a fabricated successful handshake. Existing event history, timeline, runner sampling, message inspection, copy/export, delete, and clear behavior remains unchanged and account-free.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. This milestone changes native connection behavior and documentation; it makes no screenshot, DOM, console, keyboard-interaction, or visual-layout claim beyond strict compilation, loopback transport evidence, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 137 accepts WebSocket parity for the pinned source-backed request, connection, redirect, proxy, TLS, identity, history, and inspection workflows. The previous PAC/system proxy requirement was a ledger error, not an unimplemented pinned behavior; Milestone 136 retains its historical 22-row count with a retrospective correction. Socket.IO remains `Baseline` because automatic reconnection after transient Engine.IO loss is still open. The WebSocket row is `Complete`; 21 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 138.
