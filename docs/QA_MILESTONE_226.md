# Milestone 226 verification record

Date: 2026-07-19 (America/Los_Angeles)

Scope: support the pinned Inso executable configuration formats and search order behind an explicit trusted-workspace grant, without inheriting Cosmiconfig's unrestricted host-process authority.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- `packages/insomnia-inso/src/cli.ts` creates `cosmiconfig('inso')`, loads an explicit `--config` path or searches from the effective working directory/current directory, and filters `workingDir`, `ci`, `verbose`, and `printOptions` plus `scripts` from the result.
- Pinned Cosmiconfig 9 searches `package.json`, `.insorc*`, `.config/insorc*`, and `inso.config.*` in order, including JS, TypeScript, CommonJS, and ESM files. Its ordinary executable loaders run with host Node authority; Brunomnia preserves the data contract and search shape, not that ambient authority.

## Implementation

- JSON/YAML files and a package `inso` property remain data-only. JS/CJS/MJS/TS discovery or explicit loading fails before workspace transport unless the invocation includes `--allow-config-code`; workspace data cannot enable the flag.
- Accepted source is capped at 1 MB. TypeScript is transpiled in memory without file emission, imports and `require()` are refused, and compiled code is capped at 1 MB.
- Every config executes in a fresh worker with 16 MB old-generation, 4 MB young-generation, and 2 MB stack ceilings. A null-prototype VM context applies a 500 ms execution deadline; an outer one-second deadline terminates a stuck worker.
- Node `process`, module loading, filesystem/network adapters, external buffers, string code generation, and WebAssembly code generation are unavailable. Only a strict JSON-compatible object up to 1 MB crosses back to the CLI.
- The shared global-option merge keeps explicit CLI precedence and applies the result uniformly to collection/test runs, lint, export, and config scripts. `--printOptions` reports whether executable config authority was granted without changing machine-readable stdout.
- CLI generation normalizes trailing whitespace only inside esbuild's final bundled-license comment, preserving executable text while keeping committed-bundle freshness and whitespace gates deterministic after TypeScript is bundled.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused config/parser tests | Passed: 2 files, 16 tests |
| Full Vitest suite | Passed: 79 files, 574 tests |
| Clean TypeScript/Vite/CLI production build | Passed: 528 modules; 175.18 kB CSS, 433.88 kB main, 16,449,585-byte CLI |
| Packaged CLI runner smoke | Passed: executable config denied before transport, then explicit-grant TypeScript config plus stored-plugin tag on localhost |
| Node 22 CLI container smoke | Passed: non-root, read-only workspace, `--network none`, discovered TypeScript config, and stored-plugin tag |
| Parity-row and changed-path checks | Passed: exactly 19 incomplete rows; no whitespace errors |

No Rust/native behavior changed. Milestone 220 remains the latest full native and macOS app-bundle gate.

## Remote gate

Main commit `965fce08da6b8e40f016ce079c8b1059ea53adc6` completed both jobs in [Actions run 29707916707](https://github.com/sherwoodlee/Brunomnia/actions/runs/29707916707). The Node 22 verify job rebuilt the bundle without drift and passed the read-only, no-network TypeScript/plugin smoke; the publish job emitted AMD64/ARM64 provenance and SBOM attestations and signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:83ed54414f9ce4fba2f08dbc50a95b7772ee3f0f8cad82635da0e4a961a1738e
```

Independent `cosign verify` passed the exact GitHub Actions issuer and `cli-container.yml@refs/heads/main` identity, validated digest claims and the trusted certificate chain, and found transparency-log entry `2204409460` for the exact M226 commit.

## Acceptance boundary

M226 closes pinned executable Inso configuration formats and search places for JSON-compatible static configuration. It does not grant imports, environment/process access, arbitrary host computation, or Cosmiconfig loader identity. Desktop-vault state, arbitrary external plugin discovery/RPC, remaining Inso error and edge semantics, full Spectral identity, and broader process-level script isolation remain. Headless CLI stays `Baseline`; exactly 19 parity rows remain incomplete, so Brunomnia is not feature-complete.
