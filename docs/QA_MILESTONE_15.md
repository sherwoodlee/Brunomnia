# Milestone 15 verification record

Date: 2026-07-17 (America/Los_Angeles)

Scope: the complete module-name surface in the current Insomnia scripts reference, one self-contained adapter factory shared by the disposable desktop Worker and explicitly trusted CLI VM, common bounded library/Node operations, capability denial for unlisted modules, and exact compatibility documentation.

## Automated gates

| Gate | Result |
| --- | --- |
| TypeScript project build | Pass |
| Vitest | Pass — 22 files, 105 tests |
| Vite production build | Pass — 150 modules; 444.18 KB main JavaScript chunk; no chunk-size warning |
| Bundled CLI build | Pass — 417,657-byte CommonJS executable |
| CLI safe-default smoke | Pass — the scripted fixture was refused without `--allow-scripts` and retained its selected global environment |
| CLI trusted module smoke | Pass — 1 request, HTTP 200, 3 assertions including AJV-style schema, CSV, and SHA-256 adapters |
| `cargo fmt --check` | Pass |
| `cargo check --all-targets` | Pass |
| `cargo clippy --all-targets -- -D warnings` | Pass |
| Sandboxed `cargo test` | Environment-limited — 19 tests passed; the loopback-only mock integration alone could not bind (`Operation not permitted`) |
| macOS Tauri debug `.app` bundle | Pass — independently verified production renderer, executable, and `Brunomnia.app` built |
| Batched changed-path whitespace checks | Pass |

TypeScript, Vitest, Vite, CLI build, and CLI execution used the established disposable `/tmp` source mirror and dependency tree. The verified `dist` output was copied back before the Tauri bundle, with only the independently verified `beforeBuildCommand` disabled.

The native code did not change. The native suite repeated the same sandbox-only result as Milestones 12–14: 19 tests passed and only the integration that opens a loopback listener was denied. A permission escalation was not retried because the platform previously rejected that normal retry for its account/tool usage ceiling. No 20/20 claim is made.

## Focused coverage

- The adapter inventory test checks every one of the 13 external-library and 11 Node-module names listed in the current official Insomnia scripts reference.
- Direct adapter tests cover AJV/TV4-style schema validation, quoted/column CSV, the known SHA-256 `abc` vector, Cheerio-style selectors, XML object parsing, Moment-style UTC formatting, Postman request models, Lodash helpers, repeated query keys, Buffer encodings, EventEmitter, POSIX paths, URL resolution, streams, StringDecoder, util formatting, UUID validation, and the 5 MB module-input bound.
- The executable Node VM harness evaluates the actual generated Worker source, requires every documented name, exercises representative external and Node adapters, and proves unlisted `node:fs` remains outside the capability boundary.
- Desktop and CLI implementations both consume `createScriptModules`; the earlier duplicated module maps were removed.
- The checked-in offline CLI fixture proves the bundled executable exposes the same AJV-style validation, CSV parsing, and SHA-256 behavior only after explicit trusted-script consent.

## Contract reconciliation

The name inventory was reconciled on 2026-07-17 against the current official Kong [scripts reference](https://developer.konghq.com/insomnia/scripts/). It documents these external libraries:

- `ajv`, `atob`, `btoa`, `chai`, `cheerio`, `crypto-js`, `csv-parse`, `lodash`, `moment`, `postman-collection`, `tv4`, `uuid`, and `xml2js`.

It documents these Node modules:

- `assert`, `buffer`, `events`, `path`, `querystring`, `punycode`, `stream`, `string-decoder`, `timers`, `url`, and `util`.

Brunomnia also accepts synchronous CSV compatibility aliases. No adapter loads remote code, reads an installed package, or grants new host authority.

## Manual/rendered QA

Rendered browser QA was not run because this task's standing direction prohibited the in-app Browser. The final renderer compiled and the macOS `.app` bundled successfully, but visual, keyboard, and assistive-technology validation are not claimed. This phase changes script execution and documentation rather than UI layout.

## Acceptance boundary

This evidence accepts Milestone 15's documented module-name baseline, not full Insomnia or npm-package parity. The adapters intentionally cover common finite operations and do not claim complete package versions/options, all JSON Schema drafts or references, full HTML/XML parsing and DOM behavior, every CryptoJS algorithm, Moment locales/time zones, complete Lodash/Chai/Node behavior, or the complete Postman Collection SDK. File-backed script helpers, external-vault script access, deprecated Postman interfaces, stronger portable CLI isolation, and the non-scripting gaps named in [PARITY.md](PARITY.md) remain open.
