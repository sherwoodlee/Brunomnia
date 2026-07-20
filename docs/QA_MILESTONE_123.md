# Milestone 123 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: preserve complete bounded gRPC proto trees through Insomnia v4 resource interchange and make the current v5 database-reference limitation explicit instead of silently substituting an unrelated schema.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `insomnia-data/src/models/proto-file.ts` stores a proto resource's `name` and `protoText`; `proto-directory.ts` stores a named hierarchy node. Both are syncable models.
- `common/import.ts` registers v4 `_type` values `proto_file` and `proto_directory` as those models.
- `network/grpc/write-proto-file.node.ts` finds the referenced file's workspace and root proto-directory ancestors, recursively writes every descendant, omits the synthetic root directory from the entry's relative path, and supplies all generated directories as include roots.
- Current v5 collection YAML includes `protoFileId` on a gRPC request but has no proto-resource collection or embedded text field. Upstream v5 import/export therefore preserves only a database ID that is meaningful inside the originating database.

## Automated gates

| Gate | Result |
| --- | --- |
| Clean TypeScript project rebuild | Pass |
| Vitest | Pass — 56 files, 375 tests |
| Focused interchange regressions | Pass — 2 files, 27 tests |
| Native test suite | Pass — 97 tests with localhost bind access |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Vite production build | Pass — 197 modules; 308.40 kB main, 192.35 kB React vendor, and 66.75 kB interchange JavaScript with no warning |
| Bundled CLI build/startup | Pass — 531.0 kB CommonJS executable |
| macOS Tauri debug `.app` bundle | Pass — app-only bundle, arm64 executable, and `dev.brunomnia.desktop` identifier verified |
| Changed-path whitespace checks | Pass |

## Focused coverage

- V4 import resolves the request's `protoFileId`, follows only `proto_directory` ancestors, rejects cycles or ancestry outside the request workspace, and identifies the top root used by Insomnia's recursive writer.
- Every candidate file must descend from that root. Directory/file names are reduced to safe leaf segments, files without the conventional suffix receive `.proto`, and paths then pass Brunomnia's traversal, duplicate, path-length, file-count, per-file, and aggregate-byte normalization.
- Missing entry resources, foreign ancestry, empty trees, and partially invalid/over-limit trees emit `external-schema` warnings. A request becomes proto-backed only after a usable referenced entry is reconstructed.
- V4 export gives each proto-backed request an isolated synthetic root under its workspace, emits deterministic nested `proto_directory` resources and exact `proto_file` text, and assigns the gRPC request's `protoFileId` to the normalized compile entry.
- A nested `types/messages.proto` plus `services/greeter.proto` tree round-trips exact path/text pairs and restores `services/greeter.proto` as the compile entry.
- V5 import retains an unavailable `protoFileId` in source metadata, warns that contents are absent, and leaves the request on server reflection. V5 export emits an empty binding and the same explicit warning.

## Manual/rendered QA

Rendered interaction QA is omitted by standing direction. No screenshot, DOM, console, or visual-interaction claim is made.

## Acceptance boundary

This milestone closes complete Insomnia v4 gRPC proto-resource interchange and makes the current v5 limitation explicit. Milestone 233 later closes MCP downgrade metadata. Partial/deprecated scripts, external payload files, WSDL placeholders, and omitted binary bytes remain. Related ledger rows stay `Baseline`; Brunomnia is not declared feature-complete.
