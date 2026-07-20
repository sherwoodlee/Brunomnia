# Milestone 244 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: close the AI-assisted workflow row's only named gap with free direct `.gguf` discovery, configuration, and crash-isolated native inference in the Tauri app.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia/src/ui/components/settings/llms/gguf.tsx` creates/reads app-data `llms`, lists regular case-insensitive `.gguf` files, opens that folder, activates one selected filename, and exposes temperature `0.6` (`0`–`2`), top P `0.9` (`0`–`1`), top K `40` (`0`–`100`), random seed enabled, and repeat penalty `1.1` (`0`–`10`).
- Pinned `packages/insomnia/src/main/llm-config-service.ts` supplies that folder to the optional AI plugin and persists the five parameters. Pinned generation runs in Electron utility processes so a native model/runtime crash does not terminate the main app.
- The optional proprietary `@kong/insomnia-plugin-ai@1.0.11` depends on `node-llama-cpp@3.18.1`. Brunomnia uses the open `llama-cpp-2@0.1.151` binding directly and introduces no account, entitlement, subscription, remote service, or proprietary package dependency.

## Implementation

- The Tauri app creates an `llms` directory under its resolved app-data root. Catalog and selection paths reject a symlinked folder, symlinked file, non-file, nested/path-traversal input, non-GGUF extension, and canonical root escape. Workspaces retain only the selected filename.
- `gguf_list_models`, `gguf_open_models_folder`, and `gguf_generate_text` expose the bounded native surface. Browser builds refuse direct models before invoke; the settings card disables that provider outside Tauri, hides URL/key fields, lists filename and size, refreshes and opens the folder, exposes the pinned advanced controls, and retains explicit activate/test behavior.
- Workspace v40 normalizes provider and sampling fields. Invalid persisted floats use defaults or safe clamping; top K is integer-bounded; legacy workspaces receive the pinned defaults. Imported authority remains disabled through the existing AI import boundary.
- The Tauri executable recognizes only the hidden first argument `--brunomnia-gguf-worker`. The parent sends one at-most-1.1 MB JSON request over stdin, concurrently captures at most 10 MB stdout and 64 KB diagnostics, kills the child after ten minutes, and maps process crashes/nonzero exits into bounded user errors.
- The worker initializes llama.cpp, loads the selected model, uses its embedded chat template when available and the prepared prompt otherwise, decodes the prompt in 512-token batches, and uses an 8,192-token context with at most 4,096 generated tokens. The sampler applies repeat penalty, top K, top P, temperature, and deterministic/random distribution in order; prompt and generated tokens enter sampler state; EOG stops output; non-text control tokens are skipped; one stateful UTF-8 decoder preserves split code points.
- macOS attempts full Metal layer plus operation/KQV offload first and retries a fully CPU-layer/operation/KQV attempt after an accelerated failure. Non-macOS builds use the CPU path under the current feature set. Each attempt drops all model/context state before retry or process exit.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused frontend GGUF/AI/storage matrix | Passed: 4 files and 43 tests covering invoke shape, desktop refusal, local dispatch, empty output, v40 defaults, clamping, and prior structured-output/key safety |
| Focused native GGUF matrix | Passed: 3 local tests covering folder creation, sorted case-insensitive extension discovery, regular-file selection, traversal/extension/parameter refusal, and folder/file symlink rejection; live test remains opt-in by default |
| Live in-process GGUF inference | Passed outside the Metal-restricted sandbox with `stories15M-q4_0.gguf`; model load, 8K context, prompt/generation decode, sampling, non-text control token, EOG/max-token, and UTF-8 paths completed |
| Packaged hidden-worker smoke | Passed through `Brunomnia.app/Contents/MacOS/brunomnia --brunomnia-gguf-worker`; bounded JSON parsed with status `ok` and 12,393 nonempty output bytes |
| Full Vitest coverage | Covered all 85 runnable files and 616 tests; the first sandbox run passed 615 and denied the unchanged loopback MCP listener, whose exact outside-sandbox rerun passed in 41 ms; 1 public-matrix file and 3 tests remained skipped |
| Full native coverage | Covered all 136 local tests across the full run plus exact known login-shell timing rerun; 4 public/live fixtures remained ignored by default, and the GGUF fixture was exercised separately |
| Packaged CLI template and runner smokes | Passed, including file/root trust, retained test source, templates, scripts, plugins, config, selection, environments, Spectral refs/rulesets, reports, proxy/TLS, and assertion evidence |
| Non-root/no-network CLI container | Passed with exact version, read-only workspace, self-contained Spectral local-reference lint, suite execution, and explicit-grant TypeScript config/plugin tags |
| Rust formatting, check, and all-target clippy | Passed with warnings denied |
| Production dependency audit | Passed: 0 npm production vulnerabilities |
| Clean TypeScript/Vite/CLI production build | Passed: 1,515 modules; 181.90 kB CSS, 109.94 kB Integration workbench, 440.45 kB main renderer, 3,274.00 kB lazy Spectral chunk, and 23,389,072-byte CLI bundle |
| Tauri debug macOS app bundle | Passed: 93,893,816-byte native binary in a 91,700 KiB `Brunomnia.app` filesystem allocation |
| Parity-row and changed-path checks | Passed: exactly 15 incomplete rows and no whitespace errors outside the generated CLI artifact |

The public live fixture was downloaded only to `/tmp` from `https://huggingface.co/ggml-org/models/resolve/main/tinyllamas/stories15M-q4_0.gguf`; its SHA-256 is `66967fbece6dbe97886593fdbb73589584927e29119ec31f08090732d1861739` and it is not part of the repository or app. The generated CLI SHA-256 is `8046dbde00f087db89f62dad32b0c6d7664ffaa25434ac2a14d928f655323977`.

The sandbox cannot create the Node loopback listener or a Metal command queue. Those exact gates were rerun outside the sandbox rather than weakened. The first full native run also observed the established login-shell five-second fallback; its exact fixture passed on immediate rerun. No failure involved the changed GGUF paths.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. No screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim is made. Source-backed controls, strict TypeScript/React compilation, focused state/adapter regressions, the production renderer bundle, real Metal inference, direct packaged-worker IPC, and the macOS app bundle cover this milestone without credentials or user data.

## Remote gate

Pending the first M244 push to remote `main`. No workflow, GHCR, signature, provenance, SBOM, or transparency-log result is claimed in this local implementation record yet.

## Acceptance boundary

M244 closes direct local `.gguf` loading and upgrades AI-assisted workflows to `Complete`. Brunomnia does not download, update, or bundle models; supported architectures, quantizations, and embedded templates follow the pinned llama.cpp runtime, and browser/CLI surfaces receive no new filesystem or native-model authority. Exactly 15 parity rows remain incomplete, so Brunomnia is not feature-complete.
