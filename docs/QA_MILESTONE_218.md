# Milestone 218 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: implement pinned Inso test-only `--keepFile` with ordered generated test source, retained temporary-file reporting, explicit sensitivity guidance, and collection-command rejection.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` exposes `--keepFile` only on `run test`, generates one source file from the selected sorted suites/tests, and passes the option into `runTestsCli`.
- Pinned `packages/insomnia-testing/src/generate/generate.ts` emits `chai.expect`, clears the active request before each test, nests ordered `describe`/`it` blocks, installs each default request ID, and includes user-authored test code.
- Pinned `packages/insomnia-testing/src/run/run.ts` writes a random `*-test.ts` beneath the system temporary root, deletes it after execution by default, and with `--keepFile` instead appends `Test files: ["<path>"].` to stdout after the reporter.
- Brunomnia already executes persistent test models directly rather than compiling a Mocha harness. It therefore retains the generated diagnostic suite source, not an injected executable bridge. It strengthens temporary storage with a unique mode-`0700` directory and mode-`0600` file while preserving the observable path-notice contract.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused generator/parser regressions | Passed: 2 files, 17 tests |
| Full Vitest suite | Passed: 77 files, 567 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 6,455,288-byte CLI |
| Bundled CLI startup/help | Passed: pinned test-only `--keepFile` is visible |
| Bundled localhost CLI test smoke | Passed: retained path notice, mode `0600`, sorted suite/test source, default request ID, user code, explicit cleanup, and all prior template/script boundaries |
| Bundled lint/export/Runner smoke | Passed: collection `--keepFile` refusal before transport and all prior selection/transport/report evidence |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Temporary cleanup, parity-row, and changed-path checks | Passed: smoke-owned retained directory removed, exactly 19 incomplete rows, no whitespace errors |

## Focused coverage

- The pure generator sorts suites and tests by persisted sort keys, JSON-escapes names and request IDs, preserves multiline user code, sets default request IDs, and emits a stable trailing newline.
- Option-aware positional extraction treats `--keepFile` as a boolean instead of an omitted suite identifier. `--keep-file` is a Brunomnia convenience alias.
- Resource selection, test-pattern validation, output preflight, and trusted-file-root validation complete before a private temporary directory and source file are created. The file is retained across successful or failed test results by explicit request and its path is printed after reporter output.
- Packaged localhost execution reads the reported path, verifies file mode, suite name, selected request ID, and representative user assertion, then removes the unique directory so automated validation leaves no retained artifact.
- Collection execution rejects the test-only flag before transport. Existing reporter, output-file, bail, filtering, environment, TLS/proxy, script, template-file, and external-vault behavior remains unchanged.

## Manual/rendered QA

This milestone changes the headless CLI and generated diagnostic artifacts; it has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 218 closes the named `--keepFile` gap. Brunomnia does not misrepresent its retained source as the upstream injected executable Mocha harness, and users remain responsible for deleting explicitly retained files. Internal documentation generation, executable JS/TS configs, plugin tags, the desktop local vault, remaining Inso flags/edge semantics, full Spectral identity, process-level JavaScript isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 219.
