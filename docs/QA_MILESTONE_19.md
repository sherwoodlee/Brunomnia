# Milestone 19 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: the current official `insomnia.sendRequest()` binary-file and multipart-file body contract, inert path transfer from the disposable Worker, one shared desktop/CLI host preparer, independent network/file grants, and one aggregate attachment budget across secondary and primary requests.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript project build | Pass |
| Vitest | Pass — 23 files, 116 tests |
| Vite production build | Pass — 152 modules; 466.71 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 465,242-byte CommonJS executable |
| CLI script safe-default smoke | Pass — the scripted fixture was refused without `--allow-scripts` |
| CLI file safe-default smoke | Pass — trusted scripts were refused without `--allow-script-files` |
| CLI trusted primary-file smoke | Pass — 1 request, HTTP 200, 4 tests with exact attached bytes |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 20 tests passed; the loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Batched changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build/execution, and native packaging used the established disposable `/tmp` source mirror and dependency tree. The Tauri bundle consumed that independently verified `dist` output with only the duplicate `beforeBuildCommand` disabled.

The native source did not change in this milestone. As in Milestones 16–18, the sandbox result is 20/21: only the unchanged integration that opens a loopback listener was denied. No 21/21 claim is made.

## Focused coverage

- The ordinary normalizer still rejects file-backed inputs without host authority. The trusted normalizer emits only inert binary/multipart/certificate path records and request metadata.
- Template path resolution rejects empty or greater-than-10,000-character paths before host reads.
- One shared preparer is invoked by both the desktop Worker message handler and trusted CLI before their existing mediated transports. Tests prove exact binary bytes and UTF-8 PEM identity after preparation.
- Multipart file rows preserve the field name plus filename and content-type overrides while retaining ordinary text rows.
- Hydration requires a reader, enforces 5 MB per regular file, and shares one mutable 20-file/20 MB budget across every secondary request and the final primary request in a script execution.
- Scripts still need separate network authority before a secondary request is attempted and separate file authority before any path can be read.

## Contract reconciliation

The scope was reconciled on 2026-07-17 against the official Kong [scripts reference](https://developer.konghq.com/insomnia/scripts/). Its `insomnia.sendRequest()` examples explicitly document `mode: 'file'` with a path and `mode: 'formdata'` with `type: 'file'` rows. Brunomnia preserves those public shapes while moving reads outside the Worker and behind explicit local authority.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. This phase changes no visible UI. The existing preference already describes local paths being exposed through a request; visual, keyboard, and assistive-technology validation are not claimed.

## Acceptance boundary

This evidence accepts the bounded secondary file-body contract, not full Insomnia parity. No live external-network fixture was used; the shared preparation path is exercised before transport with exact bytes and metadata, while the existing mediated transport remains covered separately. PFX/PKCS#12, encrypted-key passphrases, external-vault scripts, stronger portable CLI isolation, exact package internals, and the non-scripting gaps named in [PARITY.md](PARITY.md) remain open.
