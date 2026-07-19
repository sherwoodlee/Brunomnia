# Milestone 114 verification record

Date: 2026-07-18 (America/Los_Angeles)

Scope: import, persist, edit, migrate, and natively compile bounded multi-file gRPC proto trees without granting arbitrary filesystem access.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Insomnia's proto-file modal imports one or more files, stores relative file paths, and maintains a selected main file for schema loading.
- Pinned native schema loading recreates the stored relative tree below a temporary directory before invoking its proto loader, rather than compiling every source as one concatenated document.
- Brunomnia previously persisted and compiled only one `protoText` value as `schema.proto`, so valid imported schemas with relative cross-file imports could not load.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 55 files, 353 tests |
| Focused native proto-tree compiler coverage | Pass — 3 tests |
| Native test suite | Pass — 87 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 194 modules; main JavaScript 499.59 kB with no warning |
| Bundled CLI build/startup | Pass — 520.8 kB CommonJS executable |
| macOS Tauri debug `.app` bundle | Pass — executable and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- File and folder import accepts only relative `.proto` paths, removes one common selected directory root, rejects case-insensitive duplicates/traversal/absolute paths, and enforces 500-file, 1 MiB/file, 10 MiB/tree, and 512-character/path limits.
- The editor persists every source file, the active editor file, and an explicit compile entry; entry edits remain synchronized to legacy `protoText` for compatibility.
- Workspace v29 migrates single-source requests to `schema.proto`, repairs malformed persisted trees, and preserves bounded export/import behavior.
- The Tauri command revalidates every boundary, writes only beneath a fresh temporary directory, and compiles the selected entry with imports and source information included.
- A real native test compiles `services/greeter.proto` importing `types/messages.proto`; focused frontend tests cover normalization, directory-root stripping, entry selection, migration, and exact native command serialization.
- The gRPC editor is loaded as a dedicated production chunk so the new tree workflow does not push the main renderer over its warning-free bundle boundary.
- No account, organization, telemetry, hosted runtime, subscription, or entitlement check is introduced.

## Manual/rendered QA

- Rendered interaction QA was not run because this task's standing direction prohibits the in-app Browser. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

- Rendered interaction QA remains omitted by standing direction. Custom gRPC proxy transport, custom CA/PFX identity, and richer schema workflows remain open, so parity is not declared.

Validated desktop artifact:

`/Users/sherwoodlee/Documents/My Projects/Brunomnia/src-tauri/target/debug/bundle/macos/Brunomnia.app`
