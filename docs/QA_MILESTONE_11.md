# Milestone 11 verification

Verified on 2026-07-16 on macOS against the Phase 11 request-authoring and local client-code baseline.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript non-incremental project check | Pass |
| Vitest suite | Pass — 21 files, 90 tests |
| Vite production bundle | Pass — 149 modules transformed; 386.14 KB main chunk plus route-level lazy chunks; no chunk-size warning |
| Bundled CLI build and local smoke run | Pass — 300.4 KB CommonJS executable; 1 request and 2 assertions passed |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --all-features` | Pass |
| `cargo clippy --all-targets --all-features -- -D warnings` | Pass |
| `cargo test --all-features` | Pass — 20 native tests |
| Tauri debug app bundle | Pass — `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| `git diff --check` | Pass |

The final TypeScript and Vite invocations used the bundled Node.js 24.14 runtime. Vitest ran from the disposable Phase 9 `/tmp` source mirror updated with the complete Phase 11 `src` tree and the fresh Phase 10 `npm ci` dependency tree. This avoids the synced Documents filesystem startup bottleneck while testing the same source and lockfile. The production Vite bundle was also rebuilt successfully from the actual workspace.

The native suite ran with loopback permission because the existing mock-server integration binds only a local port. The Tauri command disabled only its already-independently-verified `beforeBuildCommand` and consumed the verified workspace `dist` output. It produced the explicit app-only macOS debug bundle; signed/notarized distribution is not claimed.

## Focused evidence

- Request tests prove valid custom-method normalization, invalid-token fallback, percent-encoded `{path}` substitution, repeated query-key preservation, and JSON/XML formatting behavior.
- Code-generation tests exercise all six targets from a materialized custom-method request and prove explicit warnings for unresolved path values, omitted multipart data, and runtime-specific IAM signing.
- OpenAPI tests prove `{path}` syntax generates explicit path rows with descriptions and example values.
- Postman and Insomnia tests prove custom methods, path rows, row descriptions, and multiline header values survive import; Insomnia v4/v5 export round trips preserve the same model.
- Migration tests prove old workspaces receive v11 path rows, normalized request configuration, and the default Generate Code shortcut.
- The full frontend, CLI, native, and app-bundle gates demonstrate no regression in earlier protocol, hierarchy, automation, project, plugin, security, MCP, AI, Konnect, GraphQL, or preferences work.

## Rendered QA boundary

The existing task direction prohibited another in-app Browser pass in this logical turn, so no fresh screenshot, DOM, console, clipboard, or interactive rendered claim is made. Verification is limited to static React/CSS review, the compiled production UI, focused behavior tests, and the successful desktop app bundle. A future rendered pass should exercise custom-method editing, multiline row resizing, narrow path/query tables, Beautify, every code target, warnings, copy feedback, Escape dismissal, and the `Mod+Shift+G` binding at desktop and narrow widths.

## Deliberate bounds

- Generated snippets omit multipart and binary bytes and identify that omission before copy.
- Static snippets do not reproduce Digest, OAuth 1, NTLM, AWS IAM, Hawk, ASAP, or Netrc runtime signing; supported bearer/basic/API-key/existing-OAuth-token materialization remains local.
- Brunomnia does not install target dependencies, validate every target compiler/runtime, or execute the generated code.
- Duplicate request headers are collapsed for targets represented by a header object and produce a warning; repeated URL query keys remain intact.
- XML formatting is conservative indentation, not schema-aware canonicalization.
- The full upstream script API, accessibility audit, signed/notarized installers, Windows/Linux packaging, and remaining parity-ledger gaps are later phases. Milestone 11 does not declare full Insomnia parity.
