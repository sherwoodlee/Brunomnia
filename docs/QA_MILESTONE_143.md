# Milestone 143 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: implement the pinned bounded Konnect expression-router field extractor so representable routes become managed requests and unsupported expressions remain explicit without claiming a complete Kong DSL evaluator.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/konnect/expression-parser.ts` recognizes uppercase method equality, exact/prefix path predicates, host equality, and word-named header equality with underscore-to-hyphen normalization.
- Repeated methods, paths, and hosts deduplicate. Multiple values for one header retain source order; downstream route mapping uses the first managed value.
- Unsupported predicates such as inequality, regex, `in`, `any()`, and `net.*` are ignored when another supported field exists. Fully unextractable expressions are skipped.
- Independent method/path extraction intentionally over-approximates correlated OR branches into a cross-product. This limitation is documented in pinned source and retained for parity.
- Any `tls.sni` expression is skipped because request URLs cannot override TLS SNI.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused expression/Konnect/storage/resource regressions | Pass — 4 files, 54 tests |
| Full Vitest suite | Pass — 63 files, 449 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 507 renderer modules; 7.64 kB lazy StreamConsole chunk; 345.21 kB main renderer; 5,281,322-byte CLI bundle |
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

- One pure matrix extracts and deduplicates GET/POST, exact/prefix paths, host, and normalized `x-tenant-id` header fields from flat AND/OR syntax.
- Unsupported inequality and regex predicates produce no fields. A supported method combined with an unsupported network predicate remains syncable with that method only.
- SNI, fully unextractable, and oversized expressions return separate inspectable reasons.
- A mapping matrix converts one expression into HTTP and HTTPS GET requests at `/expression`, with extracted Host and tenant constraints, managed route/protocol folders, stable source keys, and protocol proxy variables.
- Path-only expressions receive the established five-method default; method-only expressions receive the route display name and empty path. Independent arrays use the same bounded combination generator and duplicate-key defense as traditional routes.
- Existing template stripping runs before expression parsing, so remote template syntax cannot become a local executable tag through expression fields.
- Existing skipped-route behavior remains for malformed IDs, missing services, unextractable/SNI expressions, traditional SNI, and L4 protocols.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. This milestone adds a pure bounded parser, mapping integration, existing integration copy, tests, and documentation; it makes no screenshot, DOM, console, keyboard-interaction, or visual-layout claim beyond strict compilation, focused data-model evidence, full regression suites, and packaged-app verification.

## Acceptance boundary

Milestone 143 accepts pinned expression-router extraction parity, including its documented partial and cross-product approximation. Automatic all-control-plane project/workspace reconciliation and credentialed live-tenant evidence remain. Service integrations stays `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 144.
