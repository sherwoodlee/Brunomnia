# Milestone 225 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: execute reviewed stored-plugin template tags in portable CLI HTTP/GraphQL collection and suite sends only after an explicit process-level grant, without inheriting the desktop plugin host's broader authority.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned Inso initializes Insomnia's shared Node runtime. Shared template rendering merges local tags with active plugin tags; the plugin loader reads user plugin directories plus bundled plugins, and the Inso package optionally includes the first-party external-vault plugin.
- Brunomnia already stores reviewed dependency-free plugin source, enabled state, permissions, and plugin-local data in its workspace model. M225 adapts that existing model rather than granting the CLI arbitrary filesystem package discovery.

## Implementation

- `--allow-plugins` is a new outer trust grant for `run collection` and `run test`. It does not enable a plugin or add `template`; both reviewed desktop states must already be present.
- Only template-tag execution is connected. Primary requests, dependent response refreshes, and saved suite sends share one per-run store state; request/response hooks, actions, themes, external plugin directories, and host callbacks remain unavailable.
- Each tag operation runs in a fresh ESM Node worker using the desktop validated CommonJS wrapper. Node `process` and `global` are hidden, dynamic imports and function-constructor paths remain blocked, and the only module shim is the existing safe `buffer` subset.
- Every host network/prompt/clipboard RPC is rejected even if the stored plugin has that desktop grant. File and external-vault readers are not passed into the plugin worker.
- A two-second deadline and worker limits of 16 MB old generation, 4 MB young generation, and 2 MB stack apply. Output and each plugin store are capped at 1 MB, stores at 256 entries, notifications at 100 bounded records, and active tag plugins at 50. Store changes remain memory-only for the invocation.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused plugin/CLI tests | Passed: 2 files, 15 tests |
| Full Vitest suite | Passed: 78 files, 570 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 433.88 kB main, 6,478,986-byte CLI |
| Packaged CLI runner smoke | Passed: denied-by-default tag before transport and explicit-grant stored value on localhost |
| Node 22 CLI container smoke | Passed: non-root, read-only workspace, `--network none`, suite execution, and explicit-grant plugin tag |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

No Rust/native behavior changed. Milestone 220 remains the latest full native and macOS app-bundle gate.

## Acceptance boundary

M225 closes stored, reviewed plugin template tags for Brunomnia's portable CLI model. It does not discover arbitrary external plugin directories/packages, execute CLI request/response hooks or actions, expose host network/prompt/clipboard/file/vault adapters, persist CLI store changes, or claim full plugin ecosystem compatibility. Executable JS/TS config, desktop-vault state, remaining Inso edge semantics, full Spectral identity, and broader process-level script isolation also remain. Headless CLI and Plugins stay `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
