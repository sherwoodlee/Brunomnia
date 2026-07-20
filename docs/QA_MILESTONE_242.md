# Milestone 242 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: replace the headless CLI's seven-function structural API lint subset with the pinned Spectral runtime, bounded local/public source resolution, and a self-contained release bundle.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia-inso/src/commands/lint-specification.ts` constructs Spectral with the OAS ruleset, loads a custom ruleset when selected or discovered, reports Spectral diagnostics, and fails only when an error-severity result exists.
- Its safe reference resolver permits public HTTPS only, repeats DNS private/loopback checks, rejects redirects, and applies a ten-second deadline. It does not register a file resolver for specification `$ref`; Brunomnia's bounded local-file support is an account-free automation extension.
- Pinned Inso reuses the desktop ruleset bundler, which root-confines local YAML `extends`, resolves safe remote chains, and rejects custom JavaScript functions and unsafe ruleset shapes. Brunomnia preserves those boundaries.

## Implementation

- `lint spec` now lazily loads the shared `analyzeOpenApiDesign` path used by the desktop design workbench. Default lint runs Spectral 1.22's OAS ruleset; custom YAML receives all safe functions exported by the pinned runtime instead of the former seven-function structural approximation.
- File lint recursively collects local JSON/YAML `$ref` files and YAML ruleset `extends` from separate roots. Canonical paths must remain under the selected root even through symlinks; each source stays below 1 MB, the normalized design limits remain enforced, malformed URI escapes do not gain filesystem authority, and missing references remain Spectral diagnostics.
- Stored designs reuse their persisted source tree. Explicit rulesets receive an independent virtual ruleset tree so a ruleset beside a project can resolve local extends without being confused with specification paths.
- The Node resolver accepts HTTPS without credentials, checks literal plus DNS-resolved IPv4, IPv6, mapped IPv4, unspecified, private, loopback, and link-local targets, rejects redirects, applies a ten-second deadline, and streams at most 1 MB of valid UTF-8.
- The generated CommonJS bundle aliases `jsonc-parser` to its static ESM entry so all implementation modules are embedded. A pinned userland `punycode` alias removes Node's deprecated builtin warning, while the Spectral module remains lazy so version/help/run commands do not initialize it.
- The non-root release-container smoke now runs Spectral with a nested local schema reference on a read-only mount and `--network none`, proving that no host `node_modules` or network access masks bundle defects.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused CLI source/Spectral/OpenAPI matrix | Passed: 3 files and 13 tests covering nested local sources, root/symlink rejection, literal/DNS private-host blocking, bounded UTF-8 fetches, pinned runtime functions, rulesets, refs, and generation |
| Full Vitest suite | Passed: 83 files and 611 tests; 1 public-matrix file and 3 tests skipped by default |
| Full native suite | Covered all 133 local tests across the full run plus exact isolated rerun; 3 public fixtures remained ignored |
| Packaged CLI template and runner smokes | Passed, including stored/file/CI Spectral lint, explicit and nested discovered rulesets, resolved local refs, scripts, plugins, proxy/TLS, reports, and deterministic selection |
| Non-root/no-network CLI container smoke | Passed with self-contained Spectral lint, a read-only local `$ref`, standalone suite execution, and explicit-grant TypeScript config/plugin tags |
| Rust formatting, clippy, and check | Passed with warnings denied |
| Production dependency audit | Passed: 0 vulnerabilities |
| Clean TypeScript/Vite/CLI production build | Passed: 1,514 modules; 181.19 kB CSS, 105.48 kB shared OpenAPI, 3,274.00 kB lazy desktop Spectral chunk, 440.01 kB main, 23,388,403-byte CLI |
| Tauri debug macOS app bundle | Passed: 88,275,528-byte native binary in an 86,212 KiB `Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 17 incomplete rows; no whitespace errors outside the generated CLI artifact |

The first full frontend run encountered one unchanged five-second Postman 2.0 fixture timeout after 33 seconds; that exact fixture passed in 4 ms and the complete rerun passed cleanly. The native full run passed 132 local tests and observed the known login-shell timing fallback; its exact isolated rerun passed, covering the remaining local test. The generated CLI has SHA-256 `1229646f86e35d1b1ddf276ee6269fbbfd3b13396bc16e824e062cd80a082f9e`.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. M242 changes the headless CLI and generated release artifact; focused runtime tests, localhost smokes, the no-network container, strict builds, and the packaged-app gate cover the change without credentials or user data.

## Remote gate

Pending implementation workflow and signed publication evidence.

## Acceptance boundary

M242 closes the audited CLI Spectral gap but does not upgrade Headless CLI and CI beyond `Baseline`. Exact Inso parser/error edge semantics, arbitrary external plugin-directory discovery and host RPC, the desktop local vault, uncommon export/report/proxy/TLS edges, and broader process-level JavaScript isolation remain. Exactly 17 parity rows remain incomplete, so Brunomnia is not feature-complete.
