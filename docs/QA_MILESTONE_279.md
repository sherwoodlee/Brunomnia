# Milestone 279 verification record

Date: 2026-07-21 (America/Los_Angeles)

Scope: close the pinned paid identity-governance contract with account-free organizations, exact resource RBAC, validated SAML/OIDC SSO, one-way SCIM provisioning, invitations, ownership transfer, verified domains, storage controls, and bounded operator-visible logs.

## Source reconciliation

- Kong/insomnia `develop` commit `5143b4103030f45293c67b96f4a780398c511d75` remains the pinned clean-room product reference. Kong Developer documentation commit `73995e32ed758882a290c945807225d7442b483e` is the pinned behavior reference for SSO, SCIM, RBAC, organizations, invitations, verified domains, and storage rules.
- The pinned contracts expose SAML 2.0 and OpenID Connect, verified organization domains, SSO-exclusive login, one-way SCIM Users/Groups provisioning, email matching, expiring and renewable connector tokens, SCIM request logs, exact organization permission identifiers, collection/API-design grants, 30-day invitations, and guarded ownership transfer.
- Cloud Sync, Local Vault, and Git Sync remain separate organization storage choices. Brunomnia supplies the Cloud Sync role with self-hosted encrypted revisions rather than a hosted account/session broker.
- Pinned documentation exposes SCIM diagnostics but no separate general remote tamper-evident audit export. That earlier ledger requirement was removed instead of fabricating a broader product contract.

## Implementation

- Workspace v51 stores bounded organizations, domains, invitations, owner/admin/editor/viewer members, manual/SCIM provenance, teams, storage policy, collection/API-design grants, SSO/SCIM configuration, audit events, and SCIM request logs.
- The renderer provides organization, membership, team, invitation, transfer, storage, access, SSO, SCIM, and audit surfaces without account, seat, plan, entitlement, or subscription checks. Restricted resources are removed before sidebar, dashboard, tab, pin, and Runner activation; central mutation enforcement preserves read-only and viewer resources even when a caller bypasses disabled controls.
- Native OIDC uses HTTPS discovery, authorization code with PKCE, random state and nonce, issuer/audience/signature validation, optional `at_hash` validation, loopback correlation, and an OS-protected confidential-client secret.
- Native SAML pins the configured IdP certificate and validates the configured response/assertion signature placement, issuer, status, audience, destination/recipient, bearer confirmation, request correlation, RelayState, time windows, and replay.
- The bearer-authenticated self-hosted SCIM 2.0 service implements discovery, schemas, Users, Groups, filtering, pagination, create/read/replace/patch/deactivate/delete, non-destructive manual records, bidirectional group membership bookkeeping, last-owner refusal, one-time OS-protected token verifiers, expiry, automatic renewal, and bounded request logs. Operators terminate HTTPS in their own reverse proxy.

## Automated gates

| Gate | Result |
| --- | --- |
| Pinned source and documentation audit | Pass — SSO, SCIM, organization, invitation, transfer, permission, resource-grant, storage, token, and log contracts were reconciled against the exact pinned revisions |
| Focused renderer/model/security regressions | Pass — 77 unique governance-panel, RBAC, storage-migration, secret-boundary, and native-bridge tests passed |
| TypeScript | Pass — `tsc -b --pretty false` completed without diagnostics after the governance listener cleanup type was corrected |
| Full frontend suite | Pass — 108 offline files/741 tests passed with two opt-in live-service files excluded; the real loopback MCP lifecycle passed separately as 1 file/1 test; desktop artifact provenance passed separately as 1 file/4 tests |
| Production and CLI build | Pass — Vite transformed 1,553 modules; the generated 23,699,027-byte CLI bundle has SHA-256 `99f77bba8dba85795de60d06b74f1792acd3a8375d6a116b09431b675e60b6bc` |
| Packaged CLI smokes | Pass outside the localhost sandbox — template/file grants, authoritative physical store, complete Runner/config/plugin/transport/report matrix, and the pinned non-root/no-network/read-only container all passed |
| Focused native identity tests | Pass — 5 domain, email-matching, group-membership, last-owner, and automatic-token-renewal tests passed |
| Native aggregate suite | Pass outside the localhost sandbox — 197 tests passed and 4 explicit public/model fixtures were ignored |
| Native formatting, compile, and lint | Pass — `cargo fmt --check`, `CARGO_INCREMENTAL=0 cargo check`, and strict all-target/all-feature Clippy completed without diagnostics on Rust 1.97 |
| Production dependency audit | Pass — `npm audit --omit=dev` reported 0 vulnerabilities. `cargo audit` is not installed in this environment, so no completed Cargo advisory audit is claimed |
| Desktop bundle and manifest | Pass with the documented headless cosmetic fallback — the unsigned `.app` built normally; Finder automation timed out with AppleEvent `-1712`, then Tauri's generated `create-dmg` script completed with its supported `--skip-jenkins` path. The 14,604,892-byte DMG has SHA-256 `4649d2160f2ee43803a71ccfd41dcc9726a65ec819c40edf8cd5a7b94b6f73cd`, passed `hdiutil verify`, mounted read-only, contained the executable app plus `/Applications` link, and matched the generated manifest |
| Parity ledger | Pass — `SSO, RBAC, SCIM, audit, and organization controls` is `Complete`; exactly one capability row remains non-complete |

## Rendered QA

The flow under test was: production preview loads -> `Security & Sync` -> `Governance & audit` -> organization policy renders -> organization name mutation updates visible state.

At `http://127.0.0.1:4173/` in the Codex in-app browser's 1280×720 desktop viewport, the page title was `Brunomnia`, the seeded project rendered instead of a blank shell, no framework overlay appeared, and the browser console contained no warnings or errors. The governance panel exposed all six sections, exact owner permissions, free/self-hosted wording, and enabled Cloud Sync, Local Vault, Git Sync, encrypted-collaboration, and vault-reference controls. Changing the organization name to `Browser QA Organization` updated the rendered textbox and heading state. Native-only IdP callbacks, credential-store persistence, SCIM sockets, and token renewal are covered by focused native tests rather than the browser build.

## Remote gate

Implementation commit `94bb8ef1d159afce029b8471cbaaa0bc36003c60` completed both jobs in [CLI container workflow 29887158868](https://github.com/sherwoodlee/Brunomnia/actions/runs/29887158868) and all three platform jobs in [Desktop bundles workflow 29887158894](https://github.com/sherwoodlee/Brunomnia/actions/runs/29887158894).

The CLI verify job rebuilt the committed bundle without a diff, built the verification image, matched the package version, and passed the pinned-image, non-root, no-network, read-only, local-reference lint, standalone-suite, config, and plugin-tag smoke. Publication emitted AMD64/ARM64 SBOM and provenance attestations, then keylessly signed `ghcr.io/sherwoodlee/brunomnia-cli@sha256:b54ade3ec9c0cf5ab8349195869009ba8277cf2a9ceaf0bd10d3aba4d0795c71`; the Cosign transparency-log entry is Rekor index `2215766918`.

The desktop workflow rebuilt, checksummed, and attested the unsigned macOS ARM64 DMG, Windows x64 NSIS/MSI, and Linux x64 AppImage/DEB/RPM artifacts successfully. Its tag-only release job correctly remained skipped for this `main` push. The successful macOS CI bundle also confirms that the local AppleEvent timeout was specific to the headless Codex Finder session rather than the committed Tauri packaging configuration.

## Acceptance boundary

Milestone 279 closes the pinned SSO, RBAC, SCIM, audit/logging, invitation, transfer, verified-domain, resource-access, and organization-storage contract through a bounded self-hosted implementation. It does not claim that browser-local actor switching is strong authentication, that the application terminates public SCIM TLS, that encrypted SAML assertions are supported, or that a general remote audit-export product exists. Exactly one parity row remains `Baseline`, so Brunomnia is not yet declared feature-complete.
