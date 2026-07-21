# Milestone 262 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: close the finite pinned plugin request/response context, host-helper, request-group action, theme-style, linked-source reload, and portable CLI hook slice without overstating package or ecosystem compatibility.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room reference.
- The pinned plugin reference exposes request/body/header/parameter/auth/environment/cookie/settings methods; response byte, stream, and duplicate-header access; local store and network calls; app dialog/clipboard/path helpers; data import/export; request, request-group, workspace, and document action models; and style-aware themes.
- Pinned realtime connect routes bypass request/response hooks, so WebSocket, Socket.IO, SSE, and GraphQL-subscription hook injection is not a plugin parity requirement.
- The pinned desktop discovers/installs packages through its Node/npm environment and places actions into contextual menus. Brunomnia's isolated local bundled-source runtime deliberately keeps remote package/dependency installation, external directory discovery/watch, exact context-menu placement, native modules, and broad Node ecosystem compatibility open.
- The pinned Inso CLI has no arbitrary user plugin-directory loader or desktop host-action surface. Brunomnia's stored-plugin CLI execution is an account-free extension, but its hook/tag behavior remains permission gated and host RPC remains denied.

## Implementation

- The plugin request context now covers structured/text bodies, headers, query parameters, environment reads, authentication mutation, cookies, and send/store-cookie, URL-encoding, body-rendering, and redirect settings. `ApiRequest.encodeUrl` defaults safely, affects transport preparation, and round-trips through storage plus Insomnia v4/v5.
- Response contexts preserve exact bytes, wire-size fallback, duplicate header lines, and a bounded in-memory stream with `pipe`, event, and async-iterator adapters.
- `context.app` adds dialog, clipboard clear, desktop-path, and save-path helpers. `context.data` adds host-mediated raw/URI import and Insomnia/HAR export with separate read, write, and private-environment permissions.
- Request-group actions receive the selected group and every descendant request. Workspace/document models remain selected-context scoped. Plugin network requests normalize into complete bounded Brunomnia requests before transport.
- Theme descriptors retain mapped style colors and at most 100 KB of raw CSS; imports, URLs, script schemes, expressions, and behaviors fail closed.
- Local package reads accept nested `insomnia.displayName`/description metadata and retain the canonical package root. Explicit reload reads the linked source again, disables the plugin, and clears grants.
- `--allow-plugins` now runs granted request and response hooks around collection/suite HTTP/GraphQL transport in addition to template tags. Every operation uses a fresh resource-limited worker; host RPC and persistent writes remain denied.
- `Plugins and extension API` remains `Baseline`. Exactly five parity rows remain incomplete: four `Baseline` and one `Early baseline`.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused plugin/request/storage/interchange suites | Pass — 6 files and 95 tests |
| TypeScript project check | Pass — `tsc -b` completed without diagnostics in a clean `/private/tmp` snapshot |
| Full frontend suite | Pass — 95 files and 674 tests; 2 opt-in integration files and 4 tests skipped |
| Production build | Pass — TypeScript, Vite renderer, and bundled CLI completed from the clean snapshot |
| Focused native plugin test | Pass — local package entry, nested metadata, and canonical package-root linkage |
| Native aggregate suite | Pass — 168 tests; 4 opt-in public/live fixture tests skipped |
| Native formatting and lint | Pass — `cargo fmt --check` and all-target strict Clippy completed without diagnostics |

## Focused coverage

- CLI request hooks mutate URL, method, headers, parameters, authentication, cookies, URL encoding, rendering, redirect/cookie settings, and structured bodies before transport.
- CLI response hooks read duplicate headers and body streams, then replace exact response bytes after transport; disabled or ungranted plugins remain inert.
- Request-group actions see the selected folder and recursively nested request set rather than only the directly selected request.
- Permission inference identifies folder action, app-file, data read/write, and private-value authority; dynamic/static imports, ESM exports, and oversized sources remain rejected.
- Request URL encoding defaults and migration behavior execute consistently and survive Insomnia v4/v5 export/import.
- Imported plugin code still loses enablement, data, grants, and active-theme authority.

## Manual/rendered QA

Rendered/manual QA remains omitted under the standing project direction. M262 therefore makes no screenshot, observed-click, DOM, focus, screen-reader, or visual-layout claim beyond source-backed behavior, strict compilation, focused/full regressions, production build, and native verification evidence.

## Remote gate

Implementation commit `932862e9a2a159bff8b54716a62c4bc4d59975da` plus deterministic bundle-freshness commit `f378f10fc2a4dd99da733fd3f83b215f053d41ef` completed both verify and publish jobs in [CLI container run 29798523883](https://github.com/sherwoodlee/Brunomnia/actions/runs/29798523883). The verify job rebuilt the committed CLI without a diff, built the verification image, matched the package version, passed the ordinary no-network/read-only suite smoke, and passed the extended pinned-image/non-root/no-network/config/plugin-tag smoke. The publish job emitted AMD64/ARM64 SBOM and provenance attestations and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:0ffa6a26b650ff1448c12bf09b462e51a621e9e0dc5f99d073b094c01ee7090c
```

Independent manifest inspection resolved AMD64 `sha256:6049de7d99fd50c168abfedeff69432d18717fd92d52f1d1595f21305e2395c5`, ARM64 `sha256:dc670fb6c6c5a90ff241d9c4658b2d144f1550144ff68211ead72ae456dd974d`, and attached attestation manifests `sha256:0fbdf28f0155b587f3fab993ca8d9ddf801c30ce014ed079749459febac4a329` plus `sha256:f1864166ac6218dcae5271711c1002dd8f3c13deb154c2960ed97d25e8f8f348`. Independent Cosign verification passed claims, trusted certificate-chain validation, exact issuer `https://token.actions.githubusercontent.com`, exact subject `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, branch, repository, workflow, release SHA, digest claims, and offline transparency-log inclusion at Rekor index `2210038265`.

## Acceptance boundary

M262 closes the audited finite context/action/CLI/local-reload slice while preserving the isolation and explicit-grant model. It does not claim remote npm installation, dependency loading, automatic external-directory discovery/watch, exact context-menu placement, broad Node/native-module ecosystem compatibility, or CLI host RPC/actions. Five parity rows remain incomplete, so Brunomnia is not yet declared feature-complete.
