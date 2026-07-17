# Milestone 16 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: permission-bounded primary-request binary and multipart file paths, PEM certificate/key source paths, post-Worker host hydration, separate desktop/CLI authority, bounded native reads, workspace v14 safe defaults, and removal of deprecated Postman interfaces from the upstream parity requirement.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript project build | Pass |
| Vitest | Pass — 22 files, 107 tests |
| Vite production build | Pass — 151 modules; 448.37 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 426,091-byte CommonJS executable |
| CLI script safe-default smoke | Pass — the scripted fixture was refused without `--allow-scripts` |
| CLI file safe-default smoke | Pass — trusted scripts were refused without `--allow-script-files` |
| CLI trusted file smoke | Pass — 1 request, HTTP 200, 4 assertions including the exact attached filename and bytes |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 20 tests passed; the loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Batched changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build, and CLI execution used the established disposable `/tmp` source mirror and dependency tree. The verified `dist` output was copied back before the Tauri bundle, with only the independently verified `beforeBuildCommand` disabled.

The native suite now contains one additional passing bounded-file test. Its sandbox result is therefore 20/21 rather than the earlier 19/20: only the unchanged integration that opens a loopback listener was denied. A permission escalation was not retried because the platform previously rejected that normal retry for its account/tool usage ceiling. No 21/21 claim is made.

## Focused coverage

- The generated Worker source denies file mode without explicit host authority, template-resolves granted paths, emits inert references for binary/multipart/cert/key targets, exposes no filesystem function, and removes superseded references when body or certificate state changes.
- Host hydration tests prove exact binary attachment, multipart filename/content-type behavior, UTF-8 PEM decoding, the 5 MB per-file check, the 20-reference limit, and the 20 MB aggregate guard.
- The native command canonicalizes a requested path, accepts only regular files, checks size before and after reading, returns bounded base64 plus a conservative MIME type, and rejects a 5,000,001-byte fixture.
- Direct sends and collection runs inject the desktop reader only when the device-local preference is enabled. Browser-only execution cannot grant the capability.
- The trusted CLI has a separate `--allow-script-files` flag and applies the same hydration/aggregate contract. The offline fixture proves that `--allow-scripts` alone is insufficient and explicit file authority preserves exact bytes.
- Storage tests prove versions 1–13 migrate to workspace v14 with file authority disabled, malformed truthy values do not grant it, and imported workspaces reset a previously enabled grant.

## Contract reconciliation

The scope was reconciled on 2026-07-17 against the current official Kong [scripts reference](https://developer.konghq.com/insomnia/scripts/). It documents `mode: 'file'`, multipart rows with `type: 'file'`, and certificate/key objects with `src` paths. The same reference explicitly says deprecated Postman interfaces are not supported by Insomnia; Brunomnia therefore does not count those interfaces as an upstream feature-parity requirement.

Brunomnia mediates the documented path inputs instead of adding filesystem authority to the Worker. This preserves the public script shape while keeping the authority visible, local, revocable, and bounded.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The final renderer compiled and the macOS `.app` bundled successfully, but visual, keyboard, and assistive-technology validation are not claimed. Static UI review covered the new disabled-by-default preference copy and browser-only disabled state.

## Acceptance boundary

This evidence accepts Milestone 16's primary-request file/PEM baseline, not full Insomnia parity. PFX/PKCS#12 sources, encrypted-key passphrases, file-backed secondary requests, external-vault script access, stronger portable CLI isolation, full npm-package behavior, and the non-scripting gaps named in [PARITY.md](PARITY.md) remain open. A granted script can attach any readable path it names to a primary request; that consequential behavior is why the authority is off by default and described as appropriate only for trusted workspaces.
