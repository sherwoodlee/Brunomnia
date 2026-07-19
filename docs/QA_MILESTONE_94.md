# Milestone 94 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: preserve MCP resource-template identity, implement bounded RFC 6570 expansion, expose guided string parameters with an exact URI preview, and invoke the expanded URI through `resources/read`.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` identifies resource templates by `uriTemplate`, uses the MCP SDK `UriTemplate.variableNames` to build required string fields, previews `UriTemplate.expand`, and passes the expansion to `readResource`.
- Ordinary resources remain read-only concrete URIs; tool inputs and prompt arguments use separate schema builders.
- Brunomnia mirrors that selected-template behavior without adding a dependency or entitlement gate and retains broader pure helper support for list/object RFC values.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 50 files, 316 tests |
| Focused MCP/template/storage suites | Pass — 4 files, 36 tests |
| Vite production build | Pass — 183 modules; Integration workbench 49.05 kB; main JavaScript 499.20 kB with no warning |
| Bundled CLI build/startup | Pass — isolated 510.6 kB CommonJS artifact and help startup |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 66 tests, unchanged native tree after Milestone 93 validation |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Discovery and migration retain the source `uriTemplate`, concrete display value, stable unique variables, name, description, and MIME type separately from ordinary resources.
- RFC examples cover simple, reserved, fragment, label/path/query families, comma variables, explode, scalar prefixes, UTF-8 percent encoding, scalar/list/object values, and operator-specific empty values.
- Malformed/unclosed expressions, invalid names, combined invalid modifiers, excessive template/expression/prefix/output sizes, and non-scalar prefix values fail before transport.
- Selecting a template creates required string inputs in template order, clears stale operation parameters, updates a live exact URI preview, and disables malformed-template invocation.
- Resource invocation resolves the selected cached template after HTTP OAuth/session initialization and before the shared HTTP or native STDIO `resources/read` call.
- Legacy cached templates derive variables during migration; operation/client counts include both concrete resources and resource templates.
- The complete RFC helper remains in the lazy Integration path; a compact migration extractor prevents it from crossing into the main bundle.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. Parameter state, preview expansion, invocation resolution, migration, type safety, production bundling, and desktop packaging are verified without rendered interaction.

## Acceptance boundary

Guided MCP resource-template invocation is a complete baseline. Tool JSON-Schema forms, richer prompt argument forms, per-primitive editor history, resource subscriptions, malformed-template diagnostics matching the SDK byte-for-byte, and live third-party fixtures remain open.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
