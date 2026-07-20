# Milestone 243 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: close Headless CLI and CI parity by reconciling its already-implemented command, option, execution, trust, and release evidence against the pinned Inso production surface and removing false desktop-only plugin/vault requirements.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia-inso/src/cli.ts` exposes the `run test`, `run collection`, `lint spec`, `export spec`, and `script` command leaves. Its `generate-docs` action writes maintainer reference files and deliberately exits nonzero; it is not an end-user execution capability.
- The pinned root plus leaf inventory declares 38 Commander options. Milestones 210–220 and 222 cover working-directory/config diagnostics, prompts/CI selection, environments/globals, item/regex selection, timeout/proxy/TLS/data-folder authority, iterations/data/delay/bail, reporters, retained test source, collection output/full-data risk consent, lint/export, help, version, and config scripts. M225 adds Brunomnia's stored-template extension, M226 covers executable config under a stronger boundary, and M242 closes the Spectral gap.
- A production-source scan of `packages/insomnia-inso/src` finds no `pluginPath`, plugin loader/store, request/response hooks, template-tag host, actions, or plugin RPC. The package depends directly on the official external-vault integration, but does not expose Insomnia desktop's arbitrary user plugin host through Inso.
- The same source has no desktop local-vault API. Inso's data-folder, external-vault, script, request, and configuration capabilities are command-specific paths; importing desktop plugin-host or local-vault requirements into the CLI row was a cross-surface category error.
- Commander/Enquirer styling, exact Mocha prose, and internal process architecture are not stable command behavior. Brunomnia preserves compatible inputs, outputs, exit success/failure, selection, reports, and trust boundaries while adding deterministic noninteractive fallbacks, stricter explicit grants, retries, JSON/JUnit, local-reference lint, and stronger worker/process isolation for free.

## Reproducible evidence

Set `INSOMNIA_PIN` to a clean checkout of the pinned commit, then run:

```sh
git -C "$INSOMNIA_PIN" rev-parse HEAD
rg -n "\\.command\\('(run|test|collection|lint|spec|export|script|generate-docs)" "$INSOMNIA_PIN/packages/insomnia-inso/src/cli.ts"
rg -n "\\.option\\(|\\.addOption\\(" "$INSOMNIA_PIN/packages/insomnia-inso/src/cli.ts"
rg -n "pluginPath|loadPlugin|requestHooks|responseHooks|templateTags|pluginStore|localVault|local vault" "$INSOMNIA_PIN/packages/insomnia-inso/src" --glob '!**/fixtures/**' --glob '!**/*.test.ts'
rg -n "@kong/insomnia-plugin-external-vault" "$INSOMNIA_PIN/packages/insomnia-inso/package.json"
npm run test:cli-runner-smoke
npm run test:cli-template-smoke
npm run test:cli-container
```

Expected evidence is the exact pinned hash; five public command leaves plus the maintainer generator; 38 root/leaf options; no production plugin-host or desktop local-vault match; one direct official external-vault dependency; and three passing Brunomnia CLI trust smokes.

## Validation

| Gate | Result |
| --- | --- |
| Pinned checkout identity | Passed: exact commit `5143b4103030f45293c67b96f4a780398c511d75` |
| Public command/option inventory | Passed: 5 command leaves and 38 root/leaf options reconciled to M210–M220, M222, M225–M226, and M242 evidence |
| False-gap production scan | Passed: no arbitrary plugin directory/host RPC or desktop local-vault API in Inso |
| CLI runner and template smokes | Passed with selection, reports, scripts, files, vault adapters, config, stored tags, TLS/proxy, and Spectral behavior |
| Non-root/no-network CLI container | Passed with self-contained Spectral lint, local refs, suite execution, config, and stored tags on a read-only mount |
| Artifact freshness | Passed: every smoke rebuilt the unchanged M242 bundle; SHA-256 remains `1229646f86e35d1b1ddf276ee6269fbbfd3b13396bc16e824e062cd80a082f9e` |
| Parity-row count | Passed: exactly 16 rows remain incomplete |
| Changed-path whitespace check | Passed |

No frontend/native test or app-build gate was repeated because M243 changes documentation only. M242's 83-file/611-test frontend pass, complete 133-local-test native coverage, strict compiler/audit/build gates, macOS app bundle, and signed multi-architecture CLI publication remain the latest executable evidence.

## Acceptance boundary

M243 closes Headless CLI and CI as `Complete`; it does not upgrade the separate desktop Plugins, Secrets, Runner, Import/export, or Packaging rows. Brunomnia's extra CLI authorities remain explicit opt-ins and no commercial entitlement check is introduced. Exactly 16 parity rows remain incomplete, so Brunomnia is not feature-complete.
