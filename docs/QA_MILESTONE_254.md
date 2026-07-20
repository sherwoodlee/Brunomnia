# Milestone 254 verification record

Date: 2026-07-20 (America/Los_Angeles)

Scope: complete the account-free Git Sync onboarding surface with reusable provider credentials, provider identity and repository discovery, credential validation, remote-branch selection, bounded repository scanning, and credential-aware continuity across every existing network operation.

## Source audit

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room behavior reference.
- Pinned `packages/insomnia/src/sync/git/providers/github.ts` validates `GET /user`, lists paginated `GET /user/repos?per_page=100&page=N&sort=updated`, retains repositories with pull permission, discovers `GET /user/emails`, and maps provider credentials into Git authentication.
- Pinned `packages/insomnia/src/sync/git/providers/gitlab.ts` validates `GET /user`, lists membership projects through paginated `/projects`, and maps OAuth-token Git authentication. `custom.ts` supplies username/token HTTP(S) credentials, while `native.ts` delegates to the installed `git credential fill` chain without storing a token in Insomnia.
- Pinned credential routes and `packages/insomnia/src/ui/components/git-credentials/credential-setup.tsx` expose reusable credential selection, validation state, author-email selection, provider repository or manual-URL selection, remote branches, clone location, repository-tree scanning, and clone completion.
- `packages/insomnia/src/routes/git-provider.repositories.tsx`, `git-provider.emails.tsx`, and `git.repository-tree.tsx` confirm that provider discovery and scan evidence are user-facing standard Git capabilities rather than account-only collaboration features.

## Implementation

- A device-global store retains up to 100 reusable GitHub, GitLab, or custom HTTP(S) credentials across Brunomnia projects. Projects persist only the selected credential ID; project YAML, Brunomnia exports, encrypted collaboration payloads, imports, and duplicates contain no Git token.
- Credential name, provider, username, and token are authenticated together inside the existing bounded AES-256-GCM runtime envelope. Its random master key stays in macOS Keychain, and local metadata tampering cannot redirect the restored token to a different provider or username.
- Provider clients use fixed GitHub/GitLab HTTPS APIs, no redirects, 30-second deadlines, 2 MB response bounds, 20-page/2,000-repository limits, exact pinned authorization styles, GitHub pull-permission filtering, GitLab membership ordering, and bounded author-email discovery.
- GitHub tokens are scoped to `https://github.com`, GitLab tokens to `https://gitlab.com`, and custom credentials to the exact parsed HTTP(S) origin. Credentials reach Git only through a host-scoped environment-backed helper; neither tokens nor usernames enter command arguments, repository configuration, remote URLs, or error text. The installed Git credential helper and SSH agent remain the native fallback.
- The four-step onboarding surface adds/selects/edits/removes reusable credentials, validates provider identity or direct repository access, automatically lists provider repositories, accepts manual URLs, discovers and selects remote branches, offers discovered author emails, scans the selected branch, and clones only that branch into the requested destination.
- Repository probes parse `ls-remote --symref`, then scan a temporary depth-one filtered no-checkout clone. The bounded tree summary reports up to 50,000 total files plus Brunomnia, Insomnia, and common OpenAPI/Swagger/AsyncAPI file counts before the temporary directory is removed.
- Existing fetch, remote-branch checkout, pull, push, remote-access preflight, direct commit-and-push, and grouped commit-and-push paths all use the selected global credential. A provider/remote-host mismatch fails before Git receives the credential.
- Workspace v45 normalizes the device-local selected credential ID while portable/imported authority resets it. No Brunomnia account, hosted OAuth broker, entitlement, subscription, or paid gate is introduced.

## Automated gates

| Gate | Result |
| --- | --- |
| Focused frontend credential/project/storage/security matrix | Passed: 4 files and 63 tests covering Tauri command boundaries, device-local selection migration/import stripping, onboarding helpers, and existing project security boundaries |
| Focused native Git/provider/credential matrix | Passed: provider JSON mapping, host scoping, secret-free command arguments, remote-ref parsing, local bare-repository branch scanning, keychain-envelope round trips, metadata-tamper restoration, malformed/duplicate store rejection, and runtime-envelope compatibility |
| Strict TypeScript project check | Passed with no diagnostics |
| Full Vitest coverage | Passed outside the listener-restricted sandbox: 92 files passed and 2 opt-in/public files skipped; 655 tests passed and 4 remained skipped |
| Full native coverage | Passed outside the listener-restricted sandbox: 156 local tests passed and 4 public/live fixtures remained ignored by default |
| Rust formatting, check, and all-target clippy | Passed with warnings denied |
| Production dependency audit | Passed: 0 npm production vulnerabilities |
| Clean TypeScript/Vite/CLI production build | Passed: 1,520 renderer modules; 187.71 kB CSS, 27.77 kB catalog chunk, 33.42 kB Git workbench, 120.87 kB Integration workbench, 457.58 kB main renderer, and the established 3,274.00 kB lazy Spectral chunk warning |
| Packaged CLI physical-store smoke | Passed: native manifest detection, sibling record assembly, environment hierarchy, scripts, and data-URL execution |
| Existing packaged CLI smokes | Template and Runner smokes passed, including roots, scripts/plugins/config, cookies/chaining, environments, reports, proxy/TLS, workspace CA/client identity, Spectral, suite/collection selection, and assertion evidence |
| Non-root/no-network CLI container | Passed: pinned image, exact version, read-only workspace, self-contained Spectral local-reference lint, standalone suite execution, and explicit-grant TypeScript config/plugin tags |
| Tauri debug macOS app bundle | Passed with `--bundles app`: 96,287,112-byte native binary in a 94,036 KiB `Brunomnia.app` filesystem allocation |
| Parity-row and changed-path checks | Passed: exactly 12 incomplete rows (11 `Baseline`, 1 `Early baseline`) and no whitespace errors |

The generated CLI is 23,404,892 bytes with SHA-256 `b2623bdaa53dcb4bdfb567a771f93baf38ddc0493f1dec6becab7f2b2c500235`. The bundle changes because workspace migration advances to v45 even though the credential store and Git provider operations remain desktop-native.

The sandbox denies localhost/Unix listeners, Docker access, and advisory network requests. The first full frontend/native attempts failed only with expected `EPERM` listener denials, and the first npm audit failed only with restricted DNS; the full suites, CLI listener fixtures, container gate, and audit were rerun with only their required external authority and all passed. No application or fixture policy was weakened.

## Manual/rendered QA

Rendered interaction QA remains omitted by standing direction. The onboarding controls and state transitions are covered by source-backed React wiring, strict compilation, helper regressions, provider/native command tests, production build, and packaged-app creation. No screenshot, observed-click, DOM, console, focus-navigation, screen-reader, or pixel-layout claim is made.

## Remote gate

Main implementation commit `943628a127963d6698af61fc58083c112aec6797` completed verify and publish in [Actions run 29751606905](https://github.com/sherwoodlee/Brunomnia/actions/runs/29751606905). The verify job reproduced the committed CLI under Node 22, passed bundle freshness, built the verification image, and passed ordinary plus extended non-root/no-network container smokes. The publish job emitted AMD64/ARM64 provenance/SBOM attestation manifests and keylessly signed:

```text
ghcr.io/sherwoodlee/brunomnia-cli@sha256:fdf271855edbd384dee5bc2c91faf7f887eda12df084bbf731dc5a1e81fa7c3a
```

Independent manifest inspection resolved AMD64 `sha256:373bf6eff3271321a186aa61323eb92d31372ad056ba69bba1863f334b42823e`, ARM64 `sha256:b34199109479e2dd80c0f5f7a98138546fb564c8bf9aed5713bb8e4ed1c35d68`, and attached attestation manifests `sha256:9d8a258a5e35325a1db55d6a67c5b413dae12f83be80730221271d7048c13a20` plus `sha256:909fd8a23b66bfe5f24b344dd3cd40da2fbf2817a89081edf434f13f15decb73`. Independent Cosign verification passed issuer `https://token.actions.githubusercontent.com`, exact workflow identity `https://github.com/sherwoodlee/Brunomnia/.github/workflows/cli-container.yml@refs/heads/main`, implementation SHA and digest claims, trusted certificate-chain validation, and offline transparency-log inclusion at Rekor index `2206704866`.

Both jobs and every required step completed successfully; no gate was skipped or weakened.

## Acceptance boundary

M254 closes provider-specific authentication, guided repository onboarding, credential validation, and automatic repository discovery for the pinned standard Git surface. Built-in provider sign-in is PAT-based rather than dependent on a Brunomnia-hosted OAuth client; system Git/SSH and custom credentials cover native and enterprise providers. **Git Sync and version control** is now `Complete`. Exactly 12 parity rows remain incomplete, so Brunomnia is not feature-complete.
