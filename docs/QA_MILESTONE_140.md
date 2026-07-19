# Milestone 140 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: expand the pull-only Konnect baseline from one collapsed HTTP request per route to source-backed HTTP, WebSocket, and gRPC combination mapping with safe remote data, stable managed merges, and corrected parity requirements without declaring Service integrations complete.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/konnect/sync.ts` fetches Konnect into local Insomnia projects/workspaces and never writes Gateway configuration, disproving the previous bidirectional-configuration requirement.
- The pinned mapper expands HTTP/HTTPS methods, paths, and protocols; WS/WSS paths; and gRPC/GRPCS service-method paths into distinct managed requests with stable route-combination keys.
- `packages/insomnia/src/konnect/transform.ts` sanitizes Liquid template syntax, converts regex route paths into editable parameters, merges only managed headers/path rows, and derives HTTP/gRPC proxy environment values.
- Pinned sync explicitly skips L4-only and SNI routes because Insomnia cannot execute or override those matchers. These are visible compatibility outcomes, not missing protocol implementations.
- Pinned expression-router conversion accepts a bounded representable subset and skips unsupported expressions. Brunomnia keeps all expression routes explicit in Skipped Routes until that parser is implemented rather than guessing.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Konnect mapper/workbench regressions | Pass — 2 files, 9 tests |
| Full Vitest suite | Pass — 62 files, 442 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 506 renderer modules; 7.64 kB lazy StreamConsole chunk; 344.42 kB main renderer; 5,279,883-byte CLI bundle |
| Bundled CLI startup/help | Pass |
| Bundled localhost CLI template smoke | Pass — denial, File grant, Node OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 105 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- HTTP/HTTPS routes expand across every safe custom/default method, path, and protocol combination rather than selecting only the first method/path and forcing GET.
- WS/WSS routes create native WebSocket requests. gRPC/GRPCS routes create native gRPC requests, parse service/method from the Konnect path, and attach non-Host route metadata.
- Plain paths remain exact. Named regex captures become lowercase editable path rows, unnamed groups/classes become deterministic `param_N` rows, and irreducibly complex patterns receive one explicit `{path}` fallback.
- Route names, methods, paths, hosts, headers, expressions, protocols, and SNI fields have nested Liquid/template blocks removed before they can enter Brunomnia's renderer.
- Stable source keys include route, family, raw path, protocol, and HTTP method. A legacy route-ID request migrates into the first compatible combination without losing local query/body/auth/transport/script/test/custom-header state.
- Duplicate normalized methods, paths, or protocols cannot create repeated source keys or request IDs. Existing collection folders, valid resource order, base/sub-environments, active sub-environment, and documentation survive later pulls; new requests append once after preserved resources.
- Later pulls replace incoming and formerly managed headers/metadata, preserve unrelated custom rows, retain path values for surviving parameter names, and remove stale managed rows. Focused gRPC evidence proves stale `X-Old` removal and `X-Custom` preservation.
- Each generated protocol receives a reviewable environment URL with a protocol-appropriate loopback default. Existing user-edited values are not overwritten by later pulls.
- Missing-service, expression-router, SNI, and unsupported L4 routes remain in Skipped Routes with their exact reason. A focused matrix proves 12 generated HTTP/WS/gRPC combinations and three skip classes.
- Konnect API confinement remains unchanged: HTTPS `*.api.konghq.com`, same-origin pagination, bounded resources/body, no redirects/cookies, and vault/external-vault credential resolution.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. This milestone changes pure mapping, existing integration copy, tests, and documentation; it makes no screenshot, DOM, console, keyboard-interaction, or visual-layout claim beyond strict compilation, focused data-model evidence, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 140 accepts the pinned protocol-combination, regex-path, managed-merge, sanitization, and explicit-skip subset of Konnect parity. Automatic all-control-plane project/workspace reconciliation, control-plane `proxy_urls`, route-folder hierarchy, reviewed expression conversion, and live-tenant evidence remain. Service integrations stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 141.
