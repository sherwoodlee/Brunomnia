# Milestone 163 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned-compatible, account-free Table/Raw JSON environment editing with typed nested values across global, collection, sub-environment, and folder scopes.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `environment-editor.tsx` requires valid JSON, reports parse/key errors, and edits an object with stable property order.
- Pinned `use-toggle-environment-type.tsx` blocks Raw-to-Table while JSON is invalid and confirms before Table-to-Raw drops disabled rows or earlier duplicate names.
- Pinned `environment-utils.ts` rejects keys beginning with `$`, keys containing `.`, and root `_`, `vault`, or `__insomnia_vault`; object/array values become JSON rows and scalars become strings.
- The same editor behavior applies to workspace/global environments and request-group/folder environments; Brunomnia additionally reuses it for its collection base/sub-environment adaptation.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused environment/storage/interchange/resource/request regressions | Pass — 6 files, 87 tests |
| Full Vitest suite | Pass — 67 files, 483 tests |
| Clean TypeScript/Vite/CLI production build | Pass — 512 renderer modules; 159.51 kB stylesheet; 401.58 kB main renderer; 5,290,073-byte CLI bundle |
| Bundled CLI startup/help | Pass |
| Bundled localhost CLI template smoke | Pass — denial, File grant, OS/hash/time, response chaining, and cookies |
| Native test suite | Pass — 105 tests; 1 opt-in public gRPC fixture ignored |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Pass — arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Pass |

## Focused coverage

- Workspace v36 normalizes String/JSON row types and Table/Raw modes across global, collection base/sub-, and folder environments while retaining legacy Table defaults.
- Raw parsing requires a root object, preserves matching row IDs, converts objects/arrays to JSON rows, converts scalars to strings, and bounds source length, top-level keys, total nested values, and depth.
- Root and nested invalid keys are rejected; invalid drafts remain editable and block Table mode; Table-to-Raw conversion warns before dropping disabled rows or earlier enabled duplicates.
- JSON rows expose compact root values and bounded nested dot paths with correct override/disabled masking in direct rendering plus global, collection, and folder script scopes.
- Special keys such as `__proto__` remain own data properties without changing record prototypes.
- Insomnia v4 round-trips editor mode, typed values, and disabled table rows; v5 round-trips typed object/array data through its supported schema.

## Manual/rendered QA

The in-app Browser rejected local app navigation under the standing restriction for `http://127.0.0.1:1420`. No alternate browser surface or policy workaround was attempted. M163 therefore makes no screenshot, observed-click, DOM, console, focus, screen-reader, or visual-layout claim beyond source-backed roles/labels, strict compilation, focused model evidence, full regressions, and packaged-app verification.

## Acceptance boundary

Milestone 163 accepts raw/table environment editing, typed nested values, persistence, runtime resolution, and supported Insomnia interchange for the packaged Tauri app. Insomnia v5 does not expose a compatible KV-pair/editor-mode field, so v5 imports use Raw mode while preserving typed data. Collections and Import/export remain `Baseline`; 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 164.
