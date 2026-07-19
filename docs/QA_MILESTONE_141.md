# Milestone 141 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: replace Konnect's always-loopback proxy-variable baseline with pinned-source-backed control-plane `proxy_urls` defaults while preserving safe review fallbacks and user edits without broadening the Service integrations parity claim.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/konnect/api.ts` retains each control plane's nullable `proxy_urls` array with host, port, and protocol fields.
- `packages/insomnia/src/konnect/transform.ts` selects the first HTTP-like entry, exact gRPC and GRPCS entries, omits standard HTTP-like ports, retains nonstandard/gRPC ports, and leaves unavailable families unset.
- `packages/insomnia/src/konnect/sync.ts` creates missing variables, fills existing empty managed values when remote defaults later appear, and does not overwrite non-empty user values.
- Brunomnia uses full per-protocol URL variables instead of pinned host-only variables, so it applies the selected authority to each generated scheme and retains its existing executable loopback fallback when a family is unavailable.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Konnect/storage/workbench regressions | Pass — 3 files, 45 tests |
| Full Vitest suite | Pass — 62 files, 445 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 506 renderer modules; 7.64 kB lazy StreamConsole chunk; 345.08 kB main renderer; 5,281,021-byte CLI bundle |
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

- Control-plane discovery strips remote Liquid/template syntax and accepts only bounded HTTP, HTTPS, WS, WSS, gRPC, or GRPCS entries with a non-empty authority and integral port from 1 through 65,535.
- Workspace migration applies the same constraints to camel-case local data and pinned-style snake-case data, discarding template hosts, path/credential/query fragments, unsupported protocols, and invalid ports.
- The first valid HTTP-like authority seeds full protocol-specific HTTP, HTTPS, WS, and WSS URLs. Standard source ports disappear exactly as pinned; nonstandard ports remain.
- Exact gRPC and GRPCS entries seed only their corresponding variables, retain explicit ports, and safely bracket raw IPv6 hosts.
- Missing protocol families retain protocol-appropriate loopback defaults. New variables receive discovered defaults immediately.
- A later pull replaces empty or untouched managed loopback values, while non-managed rows and edited non-loopback values remain byte-for-byte unchanged.
- Existing Konnect API confinement remains unchanged: HTTPS `*.api.konghq.com`, same-origin pagination, bounded resources/body, no redirects/cookies, and vault/external-vault credential resolution.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. This milestone changes pure discovery normalization, persistence normalization, environment mapping, existing integration copy, tests, and documentation; it makes no screenshot, DOM, console, keyboard-interaction, or visual-layout claim beyond strict compilation, focused data-model evidence, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 141 accepts control-plane proxy-default parity for Brunomnia's protocol-specific full-URL model. Automatic all-control-plane project/workspace reconciliation, generated route-folder hierarchy, reviewed expression-router conversion, and credentialed live-tenant evidence remain. Service integrations stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 142.
