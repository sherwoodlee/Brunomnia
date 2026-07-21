# Milestone 276 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: close the finite pinned plugin and extension contract by implementing the official template-sandbox globals and utility surface, reconciling incidental loader authority and unsupported package formats out of the parity requirements, and preserving Brunomnia's explicit desktop/CLI trust boundary.

## Source reconciliation

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/plugins/index.ts` discovers plugin packages and loads entrypoints through native CommonJS `require`. The public export model remains `module.exports` for hooks, tags, actions, and themes; there is no separate documented ESM plugin contract.
- Pinned installation invokes bundled Yarn with production dependencies and later host-loads packages. Lifecycle scripts, native addons, ambient process/filesystem authority, conflicting dependency graphs, and whatever else that unrestricted loader happens to execute are implementation side effects, not declared extension capabilities. Reproducing that unsafe authority is not a user-feature requirement.
- Pinned `examples/insomnia-plugin-sandbox-demo`, `templating/sandbox/sandbox-globals.ts`, and `in-sandbox-bootstrap.ts` define the missing finite contract: a frozen process metadata stub, empty frozen environment/arguments/version maps, host platform/architecture, microtask `nextTick`, `INSOMNIA_TEMPLATE_SANDBOX`, `Buffer`, URL, Web Crypto, relative CommonJS modules, and baseline `context.util.nodeOS()`.
- Pinned Inso production source still has no arbitrary desktop plugin-directory loader, plugin host RPC, user-invoked desktop action surface, or local-vault API. Brunomnia's opt-in CLI hooks and tags remain an account-free extension rather than a reason to import desktop-only host powers into the CLI row.

## Implementation

- The shared worker source now builds a frozen process stub from cloned host OS metadata, exposes a frozen null-prototype plugin `globalThis`, adds the dedicated template-sandbox marker only for tag execution, and supplies baseline `context.util.nodeOS()` without exposing the host process or environment.
- Desktop workers obtain the existing source-shaped OS contract through `template_os_info`; browser development receives the established inert fallback. The callback remains injectable for deterministic tests and alternate hosts.
- CLI workers collect the same OS fields from Node before hiding the real process. The temporary bootstrap property is replaceable only by the shared worker's final non-configurable safe stub; Node `global`, host environment, files, networking, prompts, clipboard, paths, data RPC, and persistent writes remain unavailable.
- The regression uses the official demo's multi-file relative require, marker, `globalThis`, `process.platform`/`arch`, empty authority fields, `nextTick`, `context.util.nodeOS()`, `Buffer`, and `URL` behavior in one operation, while the separate denial test proves host capabilities remain refused.
- Plugin documentation and the parity ledger now distinguish supported CommonJS extension behavior from incidental unsafe loader implementation details. `Plugins and extension API` is `Complete`; four parity rows remain incomplete.

## Automated gates

| Gate | Result |
| --- | --- |
| Pinned source identity and contract audit | Pass — exact commit, native CommonJS loader, official sandbox-demo globals/utility/multi-file fixture, and absent Inso desktop plugin host were inspected directly |
| Focused plugin regressions | Pass — 2 files/22 tests cover shared worker source plus desktop-static and executable CLI sandbox behavior |
| TypeScript | Pass — `tsc -b` completed without diagnostics |
| Full frontend suite | Pass in required partition — 105 regular files/726 tests passed with 2 opt-in integration files/4 tests skipped; the real MCP loopback file passed separately, so all 727 active frontend tests were observed passing |
| Production and CLI build | Pass — TypeScript, Vite renderer, 1,547 transformed modules, and the generated 23,686,154-byte CLI bundle completed; CLI SHA-256 is `dbe783b62768b497d63b88500750f6b568fdb54a6eebaba29b10f6a6ee3d383e` |
| Packaged CLI smokes | Pass outside the localhost sandbox — template/file grants, authoritative physical store, full Runner/config/plugin/transport/report matrix, and pinned non-root/no-network/read-only container all passed |
| Native aggregate suite | Pass outside the localhost sandbox — 189 tests passed and 4 opt-in public/model fixtures were ignored; two timing-sensitive assertions that failed on earlier aggregate attempts each passed in isolation before the final clean aggregate |
| Native formatting, check, and lint | Pass — `cargo fmt --check`, locked all-target/all-feature Cargo check, and strict Clippy completed without diagnostics with `CARGO_INCREMENTAL=0` |

## Manual/rendered QA

Rendered/manual and assistive-technology QA remain omitted under the standing project direction. M276 makes no visual plugin-workbench or third-party ecosystem claim beyond source reconciliation, deterministic worker regressions, builds, packaged CLI gates, and the complete automated suite.

## Remote gate

Implementation commit `a7d7a57980b69d84423f16b4b40c2934b9ecf0a9` completed both verify/publish jobs in [CLI container workflow 29833934171](https://github.com/sherwoodlee/Brunomnia/actions/runs/29833934171) and all three platform jobs in [Desktop bundles workflow 29833933977](https://github.com/sherwoodlee/Brunomnia/actions/runs/29833933977).

The CLI verify job rebuilt the committed bundle without a diff, built the verification image, matched the package version, and passed the pinned-image, non-root, no-network, read-only, local-reference lint, standalone-suite, config, and plugin-tag smoke. Publication emitted AMD64/ARM64 provenance and SBOM attestations, then keylessly signed `ghcr.io/sherwoodlee/brunomnia-cli@sha256:2b019fa154f171ae660cd771e8fa793ae038a296861738265045e114c744e281`; the Cosign transparency-log entry is Rekor index `2212151221`.

The desktop workflow rebuilt and attested the unsigned macOS ARM64 DMG, Windows x64 NSIS/MSI, and Linux x64 AppImage/DEB/RPM artifacts successfully. Its tag-only release job correctly remained skipped for this `main` push.

## Acceptance boundary

M276 closes the pinned, documented CommonJS plugin export/context/action/theme/package and template-sandbox contract. It does not claim arbitrary compatibility with undocumented packages that depend on unrestricted Electron/Node authority, lifecycle side effects, native addons, ESM-only entrypoints, or conflicting dependency versions. Those are not pinned extension contracts and remain deliberately denied by Brunomnia's reviewable Worker boundary. `Plugins and extension API` is now `Complete`; exactly four parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
