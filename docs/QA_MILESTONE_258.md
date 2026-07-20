# Milestone 258 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: complete the pinned pre-request and after-response scripting capability by isolating portable CLI execution, matching the read-only vault surface, supporting password-protected PEM identities, and removing requirements that are not exposed by pinned Insomnia.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- Pinned `packages/insomnia/src/scripting/run-script.ts` imports the global Lodash-compatible `_` from `es-toolkit/compat`; an exact historical Lodash package implementation is not a separate scripting operation.
- Pinned `packages/insomnia-scripting-environment/src/objects/insomnia.ts` exposes request, response, variable, execution, test, vault, and secondary-request objects but no script filesystem-write object. Attachment and certificate source paths are read by the host transport.
- Pinned `Vault` extends the reserved private global-environment object. It allows `get`, `has`, `replaceIn`, and `toObject`, explicitly rejects `set`, `unset`, and `clear`, and has no AWS, GCP, Azure, or HashiCorp provider method.
- Pinned `packages/insomnia/src/network/network.ts` fills that object only from the decrypted reserved private global-environment branch when the device preference allows script access. External-vault providers remain a separate template/plugin facility.
- Pinned `packages/insomnia/src/main/network/libcurl-promise.ts` applies `KEYPASSWD` after configuring either PEM certificate/key paths or PFX/PKCS#12, so encrypted PEM-key passphrases were a real transport gap.
- Portable CLI client identities were completed in M210. The remaining CLI issue was that trusted scripts still ran in the CLI process's own Node `vm` context while desktop scripts already used disposable Workers.

## Implementation

- Trusted CLI scripts now execute in a fresh `worker_threads` Worker per invocation. The Worker has bounded old/young heaps and stack, and timeout settlement always terminates it.
- Compatibility code executes inside a null-prototype restricted `vm` context with string and Wasm code generation disabled. It receives no `process`, host `Buffer`, parent port, filesystem, or ambient network global.
- Only typed script state, bounded assertions/logs, and mediated subrequest messages cross the Worker boundary. The parent alone normalizes and hydrates approved file references, executes permitted secondary requests, enforces response limits, and returns bounded responses.
- The shared desktop/CLI scripting object now supplies pinned read-only `insomnia.vault.get`, `has`, `replaceIn`, and `toObject` behavior while preserving explicit mutation failures and the existing off-by-default device grant.
- The shared native identity path decrypts PBES2/AES encrypted PKCS#8 and legacy OpenSSL AES-128/192/256-CBC, DES-CBC, and 3DES-CBC PEM keys. Wrong/missing passphrases, malformed metadata/base64/padding, and unsupported ciphers fail before transport.
- Decrypted keys remain in process memory and are normalized back to unencrypted PKCS#8, PKCS#1, or SEC1 PEM only for the existing HTTP, realtime, gRPC, and embedded OAuth identity consumers. Stored request/workspace material remains encrypted.
- Request-local Transport and workspace certificate controls now accept passphrases for PEM as well as PFX/PKCS#12 identities. Normalization, device-local persistence boundaries, script certificate mutation, and security scanning reuse the existing passphrase field.
- `Pre-request and after-response scripts` is `Complete` in `PARITY.md`. Exactly eight rows remain incomplete: seven `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused script/identity regressions | Pass — 3 files, 25 tests covering shared sandbox behavior, disposable Node Worker isolation/RPC, certificate selection, and passphrase propagation |
| Full Vitest suite with loopback authority | Pass — 93 files and 660 tests; 2 opt-in public fixture files and 4 tests skipped |
| TypeScript build check | Pass — `tsc -b`; the first cold filesystem reads were unusually slow, and the successful warmed run completed without diagnostics |
| Production renderer | Pass — 1,520 modules; 187.71 kB stylesheet; 460.44 kB main renderer; 3,274.00 kB lazy Spectral chunk |
| Bundled CLI build | Pass — 23,390,759 bytes; SHA-256 `0f17fa9c9701e29a449dfbe8b59e4afb6744ca1073ae194c03fd9af9e60999b4` |
| Bundled CLI template/physical-store/runner smokes | Pass — default-denied files/scripts, canonical roots, script attachments, response/cookie chaining, physical records, configuration/plugins, reports, proxy/TLS/CA, and client identities |
| Native encrypted-identity regressions | Pass — modern PBES2/AES PKCS#8 and legacy OpenSSL PEM decrypt, wrong-passphrase rejection, parse validation, and live mTLS alongside modern PFX/PKCS#12 |
| Native full suite | Effective pass — 164 tests passed and 4 opt-in fixtures ignored; the unchanged login-shell aggregate flake passed its exact isolated rerun, and the new live mTLS fixture passed exactly and in aggregate |
| `cargo fmt --check --all` | Pass |
| `cargo check --all-targets --locked --offline` | Pass |
| `cargo clippy --all-targets --locked --offline -- -D warnings` | Pass |
| Production dependency audit | Pass — 0 vulnerabilities |
| Tauri debug macOS app bundle | Pass — 97,354,584-byte native binary in a 95,080 KiB `Brunomnia.app` filesystem allocation |
| Parity and changed-path checks | Pass — exactly 8 incomplete rows (7 `Baseline`, 1 `Early baseline`) and no whitespace errors |

## Focused coverage

- Node host globals are absent, string constructors cannot generate code, runaway loops are terminated, and documented state mutation/assertions still round-trip.
- A Worker integration regression proves secondary file hydration, parent-mediated HTTP, primary file hydration, bounded response return, vault reads/replacement/object export, and pinned vault mutation denial.
- Desktop shared-sandbox regressions retain module denial, capability-default denial, primary/secondary file budgets, PEM/PFX mutation, variable ancestry, assertions, execution flow, and host hydration.
- Modern encrypted PKCS#8 and legacy encrypted RSA/EC PEM fixtures decrypt with the correct passphrase and reject a wrong one. Parsed output is accepted by Rustls, and live Reqwest mTLS authenticates both encrypted EC formats plus PFX against a client-verifying server.
- Workspace-selected and request-local PEM passphrases flow through the same normalized transport field without overriding explicit request identity material.
- CLI template denial was rerun outside the listener-restricted sandbox and produced the expected `Template file access is disabled` result before transport; the earlier `fetch failed` observation did not reproduce.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M258 therefore makes no screenshot, observed-click, DOM, focus, screen-reader, or visual-layout claim beyond pinned-source behavior, strict compilation, focused and full regressions, live mTLS, CLI smokes, and packaged-app verification.

## Remote gate

Implementation commit `26047432b6c355a2a3f9ba754a3f9c03df4fe777` completed verify and publish in [Actions run 29765659119](https://github.com/sherwoodlee/Brunomnia/actions/runs/29765659119). Both jobs passed. The verify job reproduced the committed CLI, passed freshness, built the verification image, and passed ordinary plus extended non-root/no-network container smokes. The publish job emitted AMD64/ARM64 provenance and SBOM attestations and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:95f448a73ec2cd53463ca28edee79b1e46048ffe1b62fb68ec952544c8d50f62
```

Independent manifest inspection resolved AMD64 `sha256:b66a177029bc11634e127cdacb4a648620e824a5e3a8f670505f4715196f9ac5`, ARM64 `sha256:d1a2837ffc2230a5092e10e3ea787c59c76b2485d34f947b7fe516cc18cd4239`, and attached attestation manifests `sha256:0bbf3a81472390b9c341b7f425d7227c25dc5ffe414dcf879c0736952f09cfe9` plus `sha256:da29ec3a09d08843a33b27065c043d08721e689d6c9b7f89d12debb71bce5beb`. Independent Cosign verification passed trusted certificate-chain validation, exact issuer `https://token.actions.githubusercontent.com`, exact subject `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, branch, repository, workflow, implementation SHA, digest claims, and offline transparency-log inclusion at Rekor index `2207089009`.

## Acceptance boundary

M258 closes the documented scripting operations rather than claiming identity with undocumented package internals or adding capabilities pinned Insomnia does not expose. Script execution remains explicitly opt-in for imported workspaces; file, network, and vault authority remain separate device grants rather than account, subscription, or entitlement checks. Eight parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
