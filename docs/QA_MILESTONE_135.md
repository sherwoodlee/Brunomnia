# Milestone 135 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: complete the pinned GraphQL authoring workflow with exact GraphQL language engines, parsed operation selection, typed variables, remote/local schema acquisition, complete bounded schema metadata, and searchable documentation without broadening the full-parity claim.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia/src/ui/components/editors/body/graph-ql-editor.tsx` uses GraphQL 16.10 through `codemirror-graphql`, parses operation definitions, supplies schema-backed hint/info/jump/lint options, derives variable types, prettifies queries, and exposes remote refresh, automatic fetch, input-value deprecation, and local introspection JSON controls.
- The pinned remote schema path creates a private child request, renders request/environment state, applies request plugins, executes the ordinary transport/TLS/certificate path, rejects non-success or error-bearing responses, and builds a client schema from introspection data.
- `packages/insomnia/src/ui/components/graph-ql-explorer/*` provides root, type, field, enum, interface/union/object relationship, history, and type/field search workflows.
- Brunomnia pins `graphql@16.10.0` and `graphql-language-service@5.5.0`; the normalized cache is deliberately bounded and the renderer isolates those dependencies in `graphql-vendor` rather than adding them to the portable CLI bundle.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused GraphQL/storage/editor regressions | Pass — 3 files, 46 tests |
| Full Vitest suite | Pass — 61 files, 433 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 505 renderer modules; 178.63 kB GraphQL vendor chunk; 5,279,883-byte CLI bundle |
| Bundled CLI startup/help | Pass — commands, reporters, and trusted template flags present |
| Bundled localhost CLI template smoke | Pass — denial, File grant, Node OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 99 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- GraphQL 16.10 parses and prints documents, identifies named and anonymous operations without false matches, selects named operations by caret offset, and retains the literal query-template boundary used by pinned Insomnia.
- `graphql-language-service` reconstructs an executable client schema from the bounded persisted model and supplies nested field/argument/type diagnostics, completion, and hover information. Variables are JSON-object checked and coerced against the selected operation with a fifty-error ceiling.
- Completion UI supports arrows, Enter/Tab, Escape, pointer selection, accessible listbox/option roles, deprecation state, and pure token-replacement logic that preserves following text and bounds malformed selections.
- Remote fetch/refresh and automatic refresh carry the rendered request context while disabling redirects/scripts/cookie storage and capping the deadline. The input-value deprecation toggle changes the standard introspection query and cache freshness key.
- Standard local introspection JSON import and remote parsed responses have a 20 MB limit. Errors remain in the editor, and local schemas remain active across endpoint changes until a user requests remote fetch.
- Workspace v34 persists directives, full type references, interfaces, possible types, input fields, enum values, defaults, deprecations, one-of markers, and scalar specification URLs. Older caches retain usable data but lose their endpoint freshness marker so automatic refresh restores missing metadata.
- The explorer searches types/fields/descriptions, inserts safe root selections, navigates object/interface/union/input/enum relationships, lists directives, displays arguments/deprecations, and opens scalar specification URLs through the validated HTTP(S) external-link boundary.
- Vite isolates the language stack in a 178.63 kB production chunk; the CLI imports the lightweight schema normalizer only and remains 5,279,883 bytes.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. This milestone makes no screenshot, DOM, console, keyboard-interaction, or visual-layout claim beyond the source-backed accessible controls and automated pure insertion tests.

## Acceptance boundary

Milestone 135 accepts GraphQL authoring parity for the pinned source-backed workflows. Documented local schema/diagnostic/search bounds, safe external-link validation, literal query templates, and remote introspection's no-redirect/no-cookie policy remain deliberate safety/resource boundaries rather than paid gates. The GraphQL row is `Complete`; 23 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Broad closure and release hardening move to Milestone 136.
