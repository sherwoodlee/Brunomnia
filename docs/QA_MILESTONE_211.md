# Milestone 211 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: add pinned Inso collection `--includeFullData <redact|plaintext>` output with explicit noninteractive risk acceptance, final rendered execution evidence, bounded known-field redaction, and working-directory-relative report paths.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia-inso/src/cli.ts` exposes collection-only `--includeFullData` choices `redact` and `plaintext`; when an output file is present it resolves that path from the effective working directory, asks for security confirmation unless `--acceptRisk` is present, and creates missing parent directories.
- Pinned `packages/insomnia-inso/src/commands/run-collection/result-report.ts` includes collection/environment/proxy, request/response/test/iteration executions, timing, statistics, and error evidence. Its redacted mode uses the exact `<Redacted by Insomnia>` marker for environment data, authentication fields outside a small identity whitelist, and known sensitive request/response headers.
- Brunomnia keeps its local model and emits a versioned `brunomnia-inso-full-report` rather than claiming byte-identical upstream JSON. It additionally redacts proxy URL credentials, Set-Cookie values, and request/workspace CA, PEM, PFX, key, and passphrase material. Because the CLI is noninteractive, missing `--acceptRisk` fails before transport instead of opening a prompt.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused CLI parser regressions | Passed: 1 file, 12 tests |
| Full Vitest suite | Passed: 77 files, 565 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 71.63 kB Automation, 71.61 kB Interchange, 433.88 kB main, 6,442,585-byte CLI |
| Bundled CLI startup/help | Passed: full-data mode, risk acceptance, output, and working-directory contracts present |
| Bundled Runner full-report smoke | Passed: pre-transport risk rejection, redacted non-leakage, plaintext preservation, nested working-directory output, proxy credentials, CA, encrypted PFX identity, and HTTP 200 mTLS evidence |
| Bundled localhost CLI file-boundary smoke | Passed |
| Native test suite | Passed: 110 passed, 1 ignored |
| `cargo fmt --check --all` | Passed |
| `cargo check --all-targets --locked --offline` | Passed |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Passed |
| Production dependency audit | Passed: 0 vulnerabilities |
| macOS Tauri debug `.app` bundle | Passed: arm64 Mach-O with `dev.brunomnia.desktop` identifier |
| Changed-path whitespace checks | Passed |

## Focused coverage

- Option-aware positional extraction accepts both separated and pinned inline `--includeFullData=plaintext` syntax without turning the option into a collection identifier.
- Invalid mode, test-command use, missing output, and missing risk acceptance fail before request dispatch. The packaged mTLS fixture records no new arrival after the rejected risk invocation.
- Collection primary sends capture the final template-rendered request after workspace certificate selection, complete response, effective variable map, script assertions, and one-based iteration/retry attempt. Dependent response and explicitly granted script sends retain normal history/cookie behavior without being mislabeled as primary collection executions.
- Redacted output preserves auth identity fields and ordinary headers while replacing selected/effective environment values, auth secrets, known sensitive headers, Set-Cookie values, embedded proxy credentials, CA roots, encrypted PFX bytes, and passphrases with the pinned marker. The smoke rejects every fixture secret in the serialized report text.
- Plaintext output preserves the same environment, Basic credentials, sensitive header, proxy URL, custom CA, encrypted PFX bytes, and passphrase so reviewed CI evidence remains complete.
- Relative output paths resolve under the explicit working directory, nested parent directories are created, and the normal reporter artifact remains unchanged when full-data mode is absent.

## Security boundary

`redact` is a known-field transformation, not a general secret scanner. Request URLs, parameters, bodies, response bodies, collection documentation, assertion/error text, filenames, and arbitrary non-sensitive-named headers can still contain secrets. Both redacted and plaintext reports require explicit invocation-only acceptance and must be stored, reviewed, and shared as sensitive local evidence. No report is uploaded and acceptance is not persisted.

## Manual/rendered QA

This milestone changes the headless CLI and has no rendered desktop interaction. The in-app Browser remains unavailable for local app navigation under the standing `http://127.0.0.1:1420` restriction; no alternate surface or policy workaround was attempted.

## Acceptance boundary

Milestone 211 closes the named pinned collection full-report and risk-acceptance gap while preserving explicit authority boundaries. Interactive prompts, executable JS/TS configs, plugin tags, desktop local-vault access, remaining Inso commands/flags, uncommon report/proxy/TLS edge semantics, process-level JavaScript isolation, and signed containers remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not declared feature-complete. Remaining closure and release hardening move to Milestone 212.
