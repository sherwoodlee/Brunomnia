# Self-hosted identity governance

Brunomnia provides organization controls, SSO, resource-scoped RBAC, and SCIM without a hosted account or commercial entitlement. Organization metadata is part of workspace v51. OIDC client secrets and SCIM token verifiers remain device-local in macOS Keychain, Windows Credential Manager, or Linux Secret Service.

## Organizations and roles

Every workspace has one organization with owner, admin, editor, and viewer members. At least one active owner is required. The permission surface uses the same desktop identifiers as pinned Insomnia: organization own/read/delete/update, membership read/delete/update, invitation read/create/delete, enterprise-connection create/read/delete/update, and leave organization.

Owners and admins can invite, reinvite, revoke, and role-manage members. Invitations expire after 30 days. Ownership transfer requires an existing active member, no pending invitations, and disabled SSO. Because Brunomnia has no subscriptions or seat limits, no plan comparison or available-seat check can block transfer.

The organization storage controls expose Cloud Sync, Local Vault, and Git Sync. Cloud Sync maps to Brunomnia's self-hosted encrypted collaboration repository; Local Vault maps to local and split-folder storage; Git Sync maps to ordinary Git-backed projects.

## Resource RBAC

Admins can scope individual request collections and API design documents to members or teams. Owners and admins always retain access. A resource without grants follows the member's organization role. Once a resource has grants, non-admin members need a matching direct or team grant. Editor grants remain read-only for organization viewers.

The renderer filters inaccessible collections, requests, folders, tabs, pinned items, Runner targets, dashboards, and API designs before they reach an active document surface. The underlying workspace remains complete so changing actors does not delete hidden resources.

## Verified domains

SSO requires at least one verified domain. Add the domain, then publish the displayed line at:

```text
https://example.com/.well-known/brunomnia-domain-verification.txt
```

Verification requires a valid HTTPS certificate, refuses redirects, bounds the response to 4 KiB, and requires an exact `brunomnia-domain-verification=<challenge>` line. IP literals and `localhost` are rejected.

## OpenID Connect

Configure an HTTPS issuer, client ID, scopes, and fixed loopback callback port. Register the displayed callback URL with the IdP. Confidential-client secrets are optional and are stored only through the operating-system credential store.

Login performs OIDC discovery with redirects disabled, authorization code plus PKCE S256, random state and nonce, fixed loopback callback matching, token exchange, issuer/audience/signature/nonce validation, and access-token hash validation when the ID token carries `at_hash`. The authenticated email must match an active member on a verified organization domain.

## SAML 2.0

Configure the IdP entity ID, HTTPS sign-in URL, signing certificate, expected signed assertion/response mode, and fixed loopback ACS port. Register the displayed ACS URL and Brunomnia's `urn:brunomnia:workspace:<workspace-id>` service-provider entity with the IdP.

The native flow sends an HTTP-Redirect AuthnRequest and accepts the IdP's HTTP-POST response. Validation pins the configured certificate and checks the selected XML signature placement, issuer, status, audience, destination, recipient, time window, bearer subject confirmation, `InResponseTo`, RelayState, and an in-memory replay cache. The response must provide an email NameID or recognized email attribute matching an active member on a verified domain.

## SCIM 2.0

SCIM requires configured SSO and an OS-protected connector token. The embedded server implements bearer-authenticated `/ServiceProviderConfig`, `/ResourceTypes`, `/Schemas`, `/Users`, and `/Groups` endpoints with list/filter/pagination, create, read, replace, patch, deactivate/delete, and two-way in-record group membership updates.

The desktop server can bind loopback or an explicitly selected all-interface address. Okta and Azure require a public HTTPS connector, so terminate TLS in a user-controlled reverse proxy and forward to the displayed local endpoint. The public base URL controls SCIM resource locations returned to the IdP.

Provisioning is one-way:

- IdP-assigned users and groups become SCIM-managed.
- A newly provisioned user matches an existing manual member by normalized email before creating a member.
- Manual members and teams remain unchanged unless the IdP explicitly provisions the matching identity.
- Direct SCIM changes to still-manual records are rejected.
- The last active owner cannot be deactivated.

The raw connector token is displayed once. Brunomnia stores only a SHA-256 verifier in the operating-system credential store. Manual mode uses the selected 30/90/180/365/730-day or non-expiring lease. Automatic mode renews the protected verifier lease when an authenticated connector request enters the 20-day warning window. Refresh keeps the connector URL stable; explicit refresh or revocation invalidates the old token immediately.

Every request records method, path, status, timestamp, and a bounded detail without bearer values or request bodies. These SCIM diagnostics and the bounded governance audit trail are the pinned audit surfaces; Insomnia's current documentation does not define a separate general-purpose remote audit export.

## Authentication boundary

Enabling SSO disables the local actor switch. The validated IdP identity selects the active member. Workspace files still carry organization policy metadata, so direct filesystem editors remain inside the local trust boundary; IdP and SCIM proof is provided only by the native browser and connector paths. No capability depends on an Insomnia account, subscription, seat count, or Brunomnia-hosted service.
