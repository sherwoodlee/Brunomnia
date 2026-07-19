# Milestone 3 verification record

Verified on **2026-07-16** on macOS arm64 with Node 26.5.0, npm 11.17.0, and Rust/Cargo 1.97.0.

## Automated checks

| Check | Result |
| --- | --- |
| `npm test` | Passed: 6 files, 12 tests |
| `npm run build` | Passed: TypeScript, 116-module production UI bundle, and bundled CLI |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | Passed |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Passed with no warnings |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Passed: 7 tests, including a real loopback bind/serve/CORS-preflight/stop mock integration test |
| `npm run tauri build -- --debug --bundles app` | Passed; produced `src-tauri/target/debug/bundle/macos/Brunomnia.app` |
| `git diff --check` | Passed |

The broader debug bundling command also built the native executable and `.app`, then its optional DMG packaging script failed in the local automation environment. DMG packaging is not a Milestone 3 acceptance claim; release installer work remains in the parity ledger.

## Reproducible CLI checks

All of these exited successfully:

```sh
node bin/brunomnia.cjs --help
node bin/brunomnia.cjs lint spec orders-api.yaml -w examples
node bin/brunomnia.cjs generate collection examples/orders-api.yaml --output /tmp/brunomnia-generated.json
node bin/brunomnia.cjs export spec "CLI API" -w examples/cli-workspace.json --output /tmp/brunomnia-exported.yaml
node bin/brunomnia.cjs run collection examples/cli-workspace.json "CLI Health" --iterations 2 --retries 1
node bin/brunomnia.cjs run test examples/cli-workspace.json cli-health
```

Observed results: the OpenAPI fixture produced 2 operations and 0 issues; collection generation and design export wrote their files; the two-iteration run passed 2/2 attempts and 4/4 assertions; the test command passed 1/1 attempt and 2/2 assertions.

## Interactive browser checks

The production UI bundle was served locally and exercised in the in-app browser:

1. Opened **API Design** and verified the Orders API parsed as OpenAPI 3.1.0 with 3 operations, 0 errors, and 0 warnings.
2. Generated requests and verified a new **Orders API** collection with 3 runnable requests appeared and the first request opened.
3. Added a pre-request script that persisted an environment value and inserted a request header.
4. Added after-response status and constructor-isolation assertions plus a console message, sent the request, and verified `2/2 passing`. The live worker reported `({}).constructor.constructor` as unavailable.
5. Ran the five-request Orders collection and verified 5 total attempts, 5 passed, and 0 failed in order.
6. Added and persisted an `X-QA-Phase: milestone-3` mock response header, started the browser mock lifecycle, navigated to Collections and back, and verified that `Running locally` plus the Stop action persisted. The real native server lifecycle is covered separately by the Rust integration test.
7. Re-tested the automation workbenches at 390×844. The document remained 390/390 and the mock workbench, editor, control bar, and response-header editor each measured 344/344; panes stacked vertically with no root or editor horizontal overflow.
8. Inspected captured browser logs and found no warnings or errors.

## Scope conclusion

This evidence accepts the **Milestone 3 baseline**, not full Insomnia parity. Compatibility bounds and all remaining feature families are recorded in [MIGRATION.md](MIGRATION.md) and [PARITY.md](PARITY.md).
