# Milestone 49 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: add a safe, bounded CSV table to Visual Preview for textual response bodies without adding a dependency or claiming byte-backed media parity.

The scope was reconciled against current Insomnia at commit `8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62`. The pinned [response viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-viewer.tsx) routes friendly `text/csv` responses to the [CSV response viewer](https://github.com/Kong/insomnia/blob/8a1dc1ef62ffb6375cb006518c7a8bbd3006bd62/packages/insomnia/src/ui/components/viewers/response-csv-viewer.tsx), which decodes the response buffer, parses with Papa Parse while skipping empty lines, renders every record as table cells, and supports ordinary table selection.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 35 files, 215 tests |
| Vite production build | Pass — 164 modules; 496.36 KB / 496,364-byte main JavaScript chunk; 8,393-byte response-preview chunk; no chunk-size warning |
| Bundled CLI build/startup | Pass — 521,368-byte CommonJS executable |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked` | Pass |
| `cargo clippy --all-targets --locked -- -D warnings` | Pass |
| Sandboxed `cargo test --locked` | Environment-limited — 26 policy/parser/unit tests pass; the unchanged loopback-only mock integration alone cannot bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Changed-path whitespace checks | Pass |

Frontend verification uses the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumes the independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled and reuses the generated Cargo target directory.

The sandbox result remains one test short of the full 27-test native suite: only the existing mock-server integration that opens a loopback listener is denied. No native behavior changed in this phase. No rendered-browser claim is made.

## Focused coverage

- Visual Preview recognizes CSV media types and mounts the table parser only after the existing large-response guard passes; Source and Raw do not parse CSV.
- Delimiter detection counts comma, tab, semicolon, and pipe candidates only outside quoted fields on the first record and chooses comma deterministically on ties/no evidence.
- Parsing preserves quoted delimiters, doubled quote escapes, quoted line endings, embedded CRLF/newlines, empty cells, final records without a newline, and UTF-8 strings.
- Ordinary blank records are skipped in line with the pinned upstream option; populated rows containing empty cells remain intact.
- Unterminated quotes discard partial table data and produce a visible parse error.
- The parser caps rows at 10,000, columns at 200, and total cells at 250,000. It stops accepting records at the limit and reports truncation.
- Table cells render as React text content with stable row/column keys; CSV markup cannot become executable HTML.
- The table scrolls in both axes, preserves cell whitespace, stripes rows, and bounds individual cell width.
- CSV parser and viewer code remain in the lazy response-preview chunk; the main bundle size is unchanged from Phase 48.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. Native table selection, scrolling, focus behavior, and visual density are compile- and source-verified only in this phase.

## Acceptance boundary

Brunomnia uses a dependency-free four-delimiter parser, not Papa Parse's full dialect inference. It does not infer headers/types/formulas/encoding, virtualize rows, or reproduce the upstream global Meta+A table-selection handler. Response input remains decoded UTF-8 text rather than original bytes.
