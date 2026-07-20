# Milestone 241 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: close desktop API-specification design parity with the pinned safe Spectral runtime, bounded local/public reference resolution, and resolved request generation without enabling ruleset JavaScript.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia/src/main/lint-process.mjs` constructs Spectral 1.22 with the default OAS ruleset and a resolver that permits only HTTPS public hosts, repeats DNS private/loopback checks, rejects redirects, and uses a ten-second fetch deadline.
- Pinned `spectral-ruleset-validator.ts` permits only `rules` and `extends`, rejects custom functions and unsafe fields/prototype paths, and allowlists built-in function names. Its extra `typedEnum` token is absent from `@stoplight/spectral-functions` 1.10.1 and from the pinned 1.7.0 ruleset bundler's built-in module, so it is validator-only rather than executable behavior.
- Pinned `bundle-spectral-ruleset.ts` accepts `.yaml`/`.yml` local extends only under the selected root, rejects tuples/cycles/depth beyond five, validates public HTTPS remote chains, and treats every non-built-in/non-path value as a URL. It therefore does not provide the package-identifier behavior previously listed as a Brunomnia gap.
- Pinned custom JavaScript ruleset functions are explicitly rejected as an RCE vector. Brunomnia preserves that boundary rather than treating arbitrary Spectral JavaScript as a parity target.

## Implementation

- The desktop design workbench lazily loads the pinned Spectral core/functions/parsers/rulesets runtime. Default lint uses `spectral:oas`; custom YAML can extend the pinned OAS, AsyncAPI, or Arazzo built-ins and use all thirteen functions actually exported by the pinned functions package.
- Each design persists up to 100 selected JSON/YAML source files under a normalized relative tree, with 1 MB per-file and 10 MB aggregate limits. File and folder pickers support nested local document `$ref` and local ruleset `extends`; duplicate, absolute, escaping, unsupported, and oversized paths fail before persistence.
- Spectral receives one virtual-file resolver for selected sources and one recursively compiled custom ruleset. Relative local and remote chains preserve parent-over-child rule precedence, stop after five extends levels, detect cycles, reject tuple/package/custom-function forms, and never execute untrusted JavaScript.
- Public document references and remote ruleset extends use one explicit Refresh HTTPS action plus a five-minute bounded cache. The packaged Tauri command permits HTTPS only, rejects URL credentials, resolves every host before use, blocks private/loopback/link-local/unspecified IPv4, IPv6, and mapped addresses, rejects redirects, and enforces ten seconds plus 1 MB per response. Spectral additionally limits each lint to twenty distinct remote sources.
- Diagnostics retain Spectral severity, code, resolved path, source file, line, and character. Resolved operations and schemas feed preview and collection generation, so local or remote request-body references produce the same runnable request bodies as inline schemas.
- Spectral is isolated in a lazy API-design chunk; the shared synchronous OpenAPI module and committed CLI bundle do not absorb its multi-megabyte browser runtime. A narrow Lodash 4.18.1 override removes the current transitive advisories while the exact pinned Spectral versions remain fixed.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused Spectral/OpenAPI matrix | Passed: 9 tests covering resolved generation, all 13 runtime built-ins, nested local/remote extends, local/remote refs, rejection paths, and source bounds |
| Immutable public native fetch fixture | Passed against pinned Kong/insomnia `openapi3.yaml` |
| Full Vitest suite | Passed: 82 files and 607 tests; 1 public-matrix file and 3 tests skipped by default |
| Full native suite | Passed across full plus isolated/live reruns: all 133 local tests covered; immutable public spec fixture passed; public gRPC and MCP fixtures remain opt-in |
| Packaged CLI template and runner smokes | Passed; CLI remains deterministic and freshly generated |
| Rust formatting, clippy, and check | Passed with warnings denied |
| Production dependency audit | Passed: 0 vulnerabilities after the scoped Lodash override |
| Clean TypeScript/Vite/CLI production build | Passed: 1,514 modules; 181.19 kB CSS, 77.96 kB Automation workbench, 105.48 kB shared OpenAPI, 3,273.99 kB lazy Spectral chunk, 440.01 kB main, 16,454,219-byte CLI |
| Tauri debug macOS app bundle | Passed: 88,275,528-byte native binary in an 86,212 KiB `Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 17 incomplete rows; no whitespace errors outside the generated CLI artifact |

The ordinary native full run passed 132 tests and skipped three opt-in public fixtures. Its unchanged five-second login-shell test observed the known timing fallback under full-suite contention on both runs and passed immediately in an exact isolated rerun; the two new deterministic native resolver tests passed in full execution, and the new immutable public resolver fixture passed explicitly. The generated CLI has SHA-256 `9587ffb56943c055ee0620f1951ce23d0c477ff97e69a740d45032b2b37d2416`.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. Focused resolved-document/ruleset matrices, an immutable native public fetch, strict builds, source-aware UI state, and the fresh packaged-app gate cover this closure without credentials or user data.

## Remote gate

Pending implementation workflow and signed publication evidence.

## Acceptance boundary

M241 closes desktop API specification design. The headless CLI keeps its separately documented safe local lint subset under the Headless CLI row rather than inheriting desktop network/file authority. Exactly 17 parity rows remain incomplete, so Brunomnia is not feature-complete.
