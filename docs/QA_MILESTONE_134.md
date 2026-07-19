# Milestone 134 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: close portable HTTP/GraphQL CLI template-rendering gaps with explicit trusted File/external-vault grants, Node OS values, dependent-response execution, cookie continuity, and rendered transport-policy checks without broadening the full-parity claim.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia-inso/src/cli.ts` builds run-test and run-collection request callbacks from an in-memory database and passes invocation-time data-folder, timeout, proxy, and certificate-validation settings.
- `packages/insomnia/src/network/send-request.node.ts` runs the pre-request script, interpolates the mutated request with send purpose, deliberately skips request plugins, executes transport, transforms the response, and then runs the after-response script.
- `packages/insomnia/src/common/templating/local-template-tags.ts` performs File reads only through the supplied template utility. Brunomnia preserves that mediated-callback shape while making portable File authority an off-by-default process flag.
- Brunomnia's account-free CLI external adapters use installed official provider clients and existing workspace reference approvals rather than persisting provider credentials or adding a hosted entitlement dependency.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript/Vite/CLI production build | Pass — 351 renderer modules transformed; 5,284,036-byte CLI bundle |
| Focused CLI vault/template/runner regressions | Pass — 3 files, 29 tests |
| Full Vitest suite | Pass — 61 files, 426 tests |
| Bundled localhost CLI template smoke | Pass — denied File access, explicit grant, Node OS/hash/custom time, zero-history dependent response, and cookie continuity |
| Bundled CLI startup/help | Pass — new trusted template flags are present |
| Native test suite | Pass — 99 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- CLI HTTP/GraphQL requests now pass through `renderApiRequest`, including names, URL/path/query/header rows, bodies, authentication, GraphQL variables, gRPC-shaped fields retained in the model, and templated transport fields before URL construction.
- Node supplies source-shaped architecture, CPU, free-memory, hostname, platform, release, and user-information values without a native Tauri bridge.
- `--allow-template-files` grants bounded 5 MB UTF-8 reads; `--allow-script-files` implies that authority for trusted script-backed workspaces. The denial path remains the default and imported workspace data cannot set either process flag.
- `--allow-external-vaults` still requires the exact encoded provider/reference/scope/field/version tuple in the workspace governance allowlist. AWS, GCP, Azure, and HashiCorp adapters use direct argument arrays with no shell, 30-second/10 MB process limits, strict provider parsing, fatal AWS binary UTF-8 decoding, and a 20 MB/256-entry aggregate memory cache.
- CLI execution sends eligible cookies, captures Set-Cookie values, stores response metadata, and shares mutable cookie/response state with dependent response tags. The resolver returns the newly created response directly, so `maxHistoryResponses: 0` does not break an `always` trigger.
- Workspace certificate selection plus custom proxy, custom TLS material, and disabled-validation refusal run against the fully rendered URL rather than unresolved template text.
- The checked-in smoke uses only `127.0.0.1`; external provider parsing is dependency-injected and unit-mocked, with no provider credentials or external service calls.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. This milestone changes the headless CLI, shared render-context typing, fixtures, and documentation; no screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

Milestone 134 accepts portable CLI template parity for headless-appropriate built-in HTTP/GraphQL tags. Interactive prompts, desktop-local `vault.*` state, plugin tags, streaming CLI protocols, custom TLS material, per-request insecure TLS, standalone unit-test-suite identity, remaining Inso commands/configuration flags, signed containers, and stronger portable script isolation remain open. The Headless CLI and Secrets rows remain `Baseline`; 24 parity rows are still incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 135.
