# Milestone 234 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: replace the scalar-only MCP tool builder with bounded recursive and conditional JSON-Schema controls while retaining authoritative synchronized JSON and nonblocking debug invocation.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `mcp-request-pane.tsx` passes each discovered tool's complete `inputSchema` directly to `InsomniaRjsfForm`, mirrors form changes into the JSON overview, and keeps data keyed by primitive type/name.
- Pinned `InsomniaRjsfForm` wraps `@rjsf/core`, `@rjsf/utils`, and `@rjsf/validator-ajv8` `6.0.0-beta.15`, composes default state on schema changes, validates before send, and intentionally does not block debug invocation when validation fails.
- Brunomnia therefore needs guided nested/reference/composition/conditional behavior and synchronized advisory validation, not RJSF package identity or byte-identical AJV wording.

## Implementation

- One dependency-free schema engine resolves bounded local JSON-Pointer `$ref` chains, composes `allOf`, exposes selectable `oneOf`/`anyOf`, applies `if`/`then`/`else`, `dependentSchemas`, `dependentRequired`, and legacy schema dependencies, and recomposes defaults after condition triggers.
- Recursive guided controls cover objects, arrays, typed scalar/enum/const values, optional recursive children, declared additional properties, add/remove/rename operations, and read-only fields. Direct JSON remains authoritative and every guided edit uses immutable path updates.
- The selected branch is retained by client/tool/path in a 1,000-entry in-memory choice cache alongside the existing 1,000-entry primitive JSON draft cache. Switching tools or clients cannot leak values or choices into another primitive.
- Advisory path issues cover required values, composed types, declared choices, nested objects, and array items. They remain visible but do not disable Invoke, matching pinned debug behavior; malformed or non-object JSON still fails before transport.
- Guided work is capped at 20 levels, 200 properties, array items, and issues per node, 50 composition branches, and 500 enum choices. Cyclic local references stop at optional add controls instead of expanding forever; truncated and unsupported shapes retain the complete JSON editor, and server-provided regular expressions are never executed in the renderer.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused schema/workbench suites | Passed: 2 files, 10 tests |
| Full Vitest suite | Passed: 80 files, 592 tests |
| Full native suite | Passed: 118 tests; 1 public-fixture test ignored |
| Packaged CLI template and runner smokes | Passed |
| Rust formatting, clippy, and check | Passed |
| Clean TypeScript/Vite/CLI production build | Passed: 529 modules; 176.45 kB CSS, 85.51 kB Integration workbench, 434.07 kB main, 16,449,664-byte CLI |
| Tauri debug macOS app bundle | Passed: `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

The full frontend/native suites and packaged CLI smokes ran with loopback access because their disposable MCP, HTTP, and protocol fixtures bind local sockets. The generated CLI remains byte-identical at SHA-256 `2ec54c299ee0b366e88d061454cd6745df3e425bfe787bb4b8938d002d671fe9` because this milestone changes only the lazy renderer integration surface.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. Deterministic schema-model fixtures prove recursive-reference termination, nested defaults, arrays, local references, branch inference/selection, compositions, conditionals, modern dependencies, typed controls, immutable object/array edits, bounded fallback, and advisory validation; strict React/TypeScript compilation and the rebuilt packaged app verify the rendered component boundary.

## Remote gate

Pending the first push of the M234 implementation commit to `main`.

## Acceptance boundary

M234 closes the named recursive/conditional MCP tool-form gap. Specialized `format` widgets, remote `$ref`, `patternProperties`, `propertyNames`, tuple/prefix-item controls, uncommon newer-draft keywords, byte-identical RJSF/AJV diagnostics, persisted parameter drafts, and live third-party schema fixtures remain JSON-overview or release-hardening work. Long-lived GET/POST SSE resumption/reconnect, elicitation and reviewed sampling UI, notification/server-request response UI, multiple authorization-server failover, DPoP, live third-party servers, and OS-keychain-wrapped runtime credentials also remain. MCP clients stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
