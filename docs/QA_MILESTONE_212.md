# Milestone 212 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: align ordinary pinned Inso collection `--output` with a metadata-safe JSON result report, preflight existing destinations before transport, and keep the selected reporter on stdout independently of the result file.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/commands/run-collection/result-report.ts` defaults to safe data when `--includeFullData` is absent: full collection metadata; environment identity without data; proxy settings; request identity/description; response status/code/time; tests; iteration; timing; statistics; and error.
- Pinned `packages/insomnia-inso/src/cli.ts` resolves output from the effective working directory, rejects an existing non-file or non-writable destination before loading/running requests, creates missing parent directories when saving, and continues logging the selected test reporter separately from the result file.
- Brunomnia maps that boundary to its local models through a versioned `brunomnia-inso-safe-report`. It additionally strips credentials from proxy URLs and omits URL, auth, headers, bodies, cookies, effective variables, and certificate material instead of serializing then redacting them. Reporter output stays on stdout; the destination notice uses stderr so machine reporters remain parseable.

## Automated gates

| Gate | Result |
| --- | --- |
| Full Vitest suite | Passed: 77 files, 565 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 6,445,878-byte CLI |
| Bundled CLI startup/help | Passed: output, full-data, risk, and working-directory contracts present |
| Bundled Runner safe-report smoke | Passed: pre-transport directory rejection, nested safe-file creation, metadata projection, secret non-leakage, JUnit stdout, full-data continuity, and HTTP 200 mTLS evidence |
| Bundled localhost CLI file-boundary smoke | Passed |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Passed |

## Focused coverage

- An existing output directory fails before the required-client-certificate request reaches the local mTLS server. Existing files receive an explicit writability check; missing parent directories remain creatable after execution.
- Ordinary collection output retains collection/request identity and documentation, selected-environment identity, response status/text/time, assertions, one-based iteration/retry attempt, timing, statistics, and flow error only.
- The safe-file fixture contains none of the selected/effective environment secret, Basic username/password, sensitive header, authenticated proxy URL, custom CA, encrypted PFX bytes, or identity passphrase.
- Explicit `--reporter junit` still emits valid JUnit XML on stdout while `--output` receives safe JSON, preserving the pinned separation between console reporting and result-file evidence.
- M211 redact/plaintext modes continue to replace the safe file only after explicit risk acceptance, preserve reporter stdout, and retain their field-level disclosure/redaction contract.
- Relative destinations resolve under the explicit working directory and nested parents are created; absolute destinations remain an intentional caller-selected path.

## Security boundary

Metadata-safe is not secret-proof. Collection/request documentation plus assertion names and errors remain because the pinned safe report retains them, and those author-controlled strings can contain credentials or personal data. Review before publication. The safe file omits transport and payload evidence by construction, while full-data modes retain M211's stronger warning and explicit acceptance boundary.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 212 closes the named pinned default collection result-report and destination-preflight gap without weakening full-data consent. Interactive prompts, executable JS/TS configs, plugin tags, desktop local-vault access, remaining Inso commands/flags, uncommon report/proxy/TLS edge semantics, process-level JavaScript isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 213.
