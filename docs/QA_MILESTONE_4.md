# Milestone 4 verification record

Verified on **2026-07-16** on macOS arm64 with Node 26.5.0, npm 11.17.0, and Rust/Cargo 1.97.0.

## Automated checks

| Check | Result |
| --- | --- |
| `npm test` | Passed: 8 files, 33 tests; 20 interoperability checks cover every import family, workspace migration, scoped exports, and Insomnia/HAR round trips |
| `npm run build` | Passed: TypeScript, 129-module production UI bundle, lazy-loaded 47.33 kB interoperability chunk, and bundled CLI |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | Passed |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Passed with no warnings |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Passed: 7 tests, including the real loopback mock-server integration test |
| `npm run tauri build -- --debug --bundles app` | Passed; produced `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| `git diff --check` | Passed |

The loopback Rust test required local bind permission outside the workspace sandbox. The first nested Tauri build attempt stalled during an anomalously slow file read; the retried build completed successfully without source changes.

## Compatibility fixture coverage

Project-owned inputs in [`examples/imports/`](../examples/imports/) cover:

- Insomnia JSON v4 and multi-document-compatible YAML v5
- Postman Collection 2.0 and 2.1
- HAR 1.2
- OpenAPI 3.1 and Swagger 2
- WSDL/SOAP request generation
- cURL command parsing and URL-encoded query data

Additional focused tests cover Postman environments, nested folders, variables, supported authentication and bodies, best-effort scripts, Insomnia real-time downgrade metadata, collision-safe repeated imports, export scopes, and conversion warnings.

## Interactive browser checks

The production bundle was served locally at `http://127.0.0.1:4173/` and exercised in the in-app browser at 1280×720 and 390×844:

1. Verified the page URL/title, meaningful workbench content, no framework overlay, and empty error/warning console.
2. Opened **Import API artifacts**, selected **Clipboard**, analyzed a cURL command, and observed `1 collection · 1 requests`, `0 warnings`, and no content execution.
3. Applied the cURL import and verified a new **clipboard cURL** collection plus the encoded URL `https://api.example.com/search?q=two%20words` in the active request.
4. Analyzed a Postman 2.1 collection using Digest auth and a test script. The preview displayed the expected `unsupported-auth` and `script-translated` warnings before import.
5. Opened **Export API artifacts**, selected HAR for all workspace data, and verified three explicit omission warnings for WebSocket, SSE, and gRPC requests.
6. Switched to the imported cURL collection and verified a collection-scoped HAR preview with zero warnings; switched to OpenAPI and verified automatic design scope plus `orders-api.yaml`.
7. Found and fixed a desktop warning-dialog footer that extended outside the modal. The retest measured the modal and footer fully inside the 720 px viewport with the action at y=630.5–665.
8. Opened import and export through the mobile command palette at 390×844. The page remained 390/390 px, the modal and form remained 370/370 px, previews had no internal horizontal overflow, and both primary actions were fully visible.
9. Rechecked both desktop and mobile browser logs after the fixes and found no warnings or errors.

The in-app browser did not expose its advertised file-chooser helper in this session, so the OS file-picker interaction was not automated. File contents and every accepted extension family are exercised through the same converter entry point by the fixture tests; pasted-text and URL validation share that entry point. Native OS picker behavior remains a small manual-release risk.

## Scope conclusion

This evidence accepts the **Milestone 4 interoperability baseline**, not full Insomnia parity. Folder flattening, translated script breadth, local-file reselection, WSDL placeholders, and binary-export omissions remain named compatibility limits in [MIGRATION.md](MIGRATION.md) and [PARITY.md](PARITY.md); Milestones 98 and 233 later close the original Socket.IO and MCP downgrade behavior.
