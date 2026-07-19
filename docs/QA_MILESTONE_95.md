# Milestone 95 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: add synchronized guided MCP prompt arguments and top-level scalar tool JSON-Schema controls with bounded per-primitive draft retention.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` converts prompt arguments into required string JSON Schema, passes tool `inputSchema` to RJSF, mirrors form changes into the JSON parameter overview, and keys `mcpParams` by primitive type/name.
- Its form validates before send but intentionally does not block debug invocation on validation errors; complex tool schemas remain representable through the complete RJSF form and JSON overview.
- Brunomnia matches prompt/scalar-tool behavior with dependency-free controls and keeps unsupported complex structures authoritative in the JSON overview.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 51 files, 319 tests |
| Focused parameter/template/integration/MCP suites | Pass — 4 files, 15 tests |
| Vite production build | Pass — 184 modules; Integration workbench 53.62 kB; main JavaScript 499.20 kB with no warning |
| Bundled CLI build/startup | Pass — isolated 510.6 kB CommonJS artifact and help startup |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Native test suite | Pass — 66 tests, unchanged native tree after Milestone 93 validation |
| macOS Tauri debug `.app` bundle | Pass |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Prompt fields retain server order, descriptions, and required markers and serialize as string-valued argument objects.
- Tool normalization covers scalar/nullable types, title/description, required sets, defaults, enums, const values, and deterministic property ordering while bounding properties/options.
- Enum and boolean selections preserve their original JSON scalar type; integer/number controls coerce finite values while retaining incomplete text for correction.
- Nested/array/reference/composed/additional fields trigger an explicit complex-schema notice and remain untouched in the JSON overview when scalar fields change.
- Guided and direct JSON edits share one source string; malformed JSON remains visible but fails before MCP dispatch.
- Draft identity includes client, primitive family, and name; updates move to the newest retention position and evict beyond 1,000 entries.
- Switching clients resets selected operation/result/parameter presentation without deleting other clients' bounded drafts.

## Manual/rendered QA

Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. Schema normalization, typed coercion, draft isolation, TypeScript safety, full test execution, warning-free production bundling, and desktop packaging provide the acceptance evidence.

## Acceptance boundary

Guided MCP prompt and scalar tool parameters are a complete baseline. Recursive JSON-Schema controls, references/compositions/conditionals, specialized format widgets, persisted draft history, byte-for-byte RJSF validation messages, and live third-party schemas remain open; the complete JSON overview remains the functional path for every valid argument object.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
