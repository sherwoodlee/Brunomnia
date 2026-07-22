# Free feature policy

Brunomnia's product capabilities are source-available under Apache-2.0 and must not be restricted by account state, subscription state, organization size, collaboration-seat count, local project count, request count, collection count, environment count, or protocol type.

## Rules

1. Local use never requires an account or network sign-in.
2. No UI may advertise an upgrade, trial, premium plan, or locked capability.
3. Native capabilities must be callable without a remote entitlement check.
4. Imports, exports, Git synchronization, plugins, runners, design tools, mocks, and collaboration implementations belong in the community build when implemented.
5. Optional hosted infrastructure may have real operating costs, but the corresponding self-hosted implementation and local/offline workflow remain available.
6. Telemetry is absent by default. Any future diagnostics must be explicit, optional, documented, and removable.
7. Pull requests that add feature gating must be rejected unless the gate protects an unsafe or unsupported platform condition rather than a commercial entitlement.
8. SSO, SCIM, organizations, resource RBAC, and governance audit are community features. Operators may supply their own IdP, reverse proxy, and synchronization infrastructure without a Brunomnia license or entitlement service.
9. Desktop updates, release channels, accessibility behavior, and platform packaging/signing configuration are community features. Real Apple, Microsoft-compatible, registry, or hosting credentials may be required by those external platforms, but Brunomnia adds no license gate.

Milestone 280 completes every row in the pinned behavior ledger. Future upstream capabilities or regressions must still be added to [PARITY.md](PARITY.md) and staged in [MIGRATION.md](MIGRATION.md) before a later release repeats that claim.
