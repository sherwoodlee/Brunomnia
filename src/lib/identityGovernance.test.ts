import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import type { GovernanceMember } from '../types';
import {
  applyAuthenticatedIdentity,
  canAccessResource,
  createOrganizationInvitation,
  enforceWorkspaceMutationAuthority,
  permissionsForMember,
  reinviteOrganizationMember,
  resourceAccess,
  revokeOrganizationInvitation,
  scimTokenStatus,
  transferOrganizationOwnership,
  upsertResourceGrant,
  workspaceForCurrentMember,
} from './identityGovernance';

const member = (id: string, role: GovernanceMember['role'], email = `${id}@example.com`): GovernanceMember => ({
  id,
  name: id,
  email,
  role,
  active: true,
  source: 'manual',
  externalId: '',
  teamIds: [],
  lastAuthenticatedAt: '',
});

describe('identity governance', () => {
  it('maps exact organization permissions by role', () => {
    const workspace = cloneSeedWorkspace();
    workspace.governance.members.push(member('admin', 'admin'), member('viewer', 'viewer'));
    expect(permissionsForMember(workspace.governance, 'local-owner')['own:organization']).toBe(true);
    expect(permissionsForMember(workspace.governance, 'admin')['create:enterprise_connection']).toBe(true);
    expect(permissionsForMember(workspace.governance, 'admin')['delete:organization']).toBe(false);
    expect(permissionsForMember(workspace.governance, 'viewer')['update:membership']).toBe(false);
  });

  it('creates, renews, and revokes thirty-day invitations', () => {
    const workspace = cloneSeedWorkspace();
    const now = new Date('2026-07-21T12:00:00.000Z');
    const created = createOrganizationInvitation(workspace.governance, 'NEW@example.com', 'viewer', now);
    expect(created.invitation.email).toBe('new@example.com');
    expect(Date.parse(created.invitation.expiresAt) - now.getTime()).toBe(30 * 24 * 60 * 60 * 1_000);
    const resent = reinviteOrganizationMember({ ...created.governance, organization: { ...created.governance.organization, invitations: [{ ...created.invitation, status: 'expired' }] } }, created.invitation.id, new Date('2026-08-25T00:00:00.000Z'));
    expect(resent.organization.invitations[0].status).toBe('pending');
    expect(revokeOrganizationInvitation(resent, created.invitation.id).organization.invitations[0].status).toBe('revoked');
  });

  it('enforces ownership transfer prerequisites', () => {
    const workspace = cloneSeedWorkspace();
    workspace.governance.members.push(member('next-owner', 'editor'));
    workspace.governance.sso.enabled = true;
    expect(() => transferOrganizationOwnership(workspace.governance, 'next-owner')).toThrow('Disable SSO');
    workspace.governance.sso.enabled = false;
    const transferred = transferOrganizationOwnership(workspace.governance, 'next-owner');
    expect(transferred.organization.ownerId).toBe('next-owner');
    expect(transferred.members.find((candidate) => candidate.id === 'next-owner')?.role).toBe('owner');
    expect(transferred.members.find((candidate) => candidate.id === 'local-owner')?.role).toBe('admin');
  });

  it('scopes collections and designs through direct and team grants', () => {
    const workspace = cloneSeedWorkspace();
    const editor = member('editor', 'editor');
    workspace.governance.members.push(editor);
    workspace.governance.currentMemberId = 'local-owner';
    workspace.governance = upsertResourceGrant(workspace.governance, { resourceType: 'collection', resourceId: workspace.collections[0].id, subjectType: 'member', subjectId: editor.id, access: 'viewer' });
    workspace.governance.currentMemberId = editor.id;
    expect(resourceAccess(workspace.governance, 'collection', workspace.collections[0].id)).toBe('viewer');
    expect(canAccessResource(workspace.governance, 'collection', workspace.collections[1].id)).toBe(true);
    workspace.governance.resourceGrants.push({ id: 'other-grant', resourceType: 'collection', resourceId: workspace.collections[1].id, subjectType: 'member', subjectId: 'local-owner', access: 'editor' });
    const visible = workspaceForCurrentMember(workspace);
    expect(visible.collections.map((collection) => collection.id)).toEqual(workspace.collections.filter((collection) => collection.id !== workspace.collections[1].id).map((collection) => collection.id));
  });

  it('accepts only active members on verified SSO domains', () => {
    const workspace = cloneSeedWorkspace();
    workspace.governance.organization.domains.push({ id: 'domain', domain: 'example.com', challenge: 'proof', verifiedAt: '2026-07-21T00:00:00.000Z' });
    const editor = member('editor', 'editor', 'person@example.com');
    workspace.governance.members.push(editor);
    const authenticated = applyAuthenticatedIdentity(workspace.governance, { subject: 'idp-person', email: 'PERSON@example.com', name: 'Person', groups: [], protocol: 'oidc' }, new Date('2026-07-21T12:00:00.000Z'));
    expect(authenticated.currentMemberId).toBe(editor.id);
    expect(authenticated.members.find((candidate) => candidate.id === editor.id)?.externalId).toBe('idp-person');
    expect(() => applyAuthenticatedIdentity(workspace.governance, { subject: 'other', email: 'person@other.test', name: 'Other', groups: [], protocol: 'saml' })).toThrow('verified organization domain');
  });

  it('centrally preserves viewer and read-only-grant resources', () => {
    const workspace = cloneSeedWorkspace();
    const editor = member('editor', 'editor');
    workspace.governance.members.push(editor);
    workspace.governance.currentMemberId = 'local-owner';
    workspace.governance = upsertResourceGrant(workspace.governance, { resourceType: 'collection', resourceId: workspace.collections[0].id, subjectType: 'member', subjectId: editor.id, access: 'viewer' });
    workspace.governance.currentMemberId = editor.id;
    const proposed = structuredClone(workspace);
    proposed.collections[0].name = 'Forbidden rename';
    proposed.collections[1].name = 'Allowed rename';
    const enforced = enforceWorkspaceMutationAuthority(workspace, proposed);
    expect(enforced.collections[0].name).toBe(workspace.collections[0].name);
    expect(enforced.collections[1].name).toBe('Allowed rename');
    workspace.governance.members.find((candidate) => candidate.id === editor.id)!.role = 'viewer';
    proposed.environments[0].name = 'Forbidden environment rename';
    expect(enforceWorkspaceMutationAuthority(workspace, proposed).environments[0].name).toBe(workspace.environments[0].name);
  });

  it('reports missing, expiring, expired, and non-expiring SCIM tokens', () => {
    const governance = cloneSeedWorkspace().governance;
    const now = new Date('2026-07-21T00:00:00.000Z');
    expect(scimTokenStatus(governance, now)).toBe('missing');
    governance.scim.tokenId = 'token'; governance.scim.issuedAt = now.toISOString();
    expect(scimTokenStatus(governance, now)).toBe('valid');
    governance.scim.expiresAt = '2026-07-30T00:00:00.000Z';
    expect(scimTokenStatus(governance, now)).toBe('expiring');
    governance.scim.expiresAt = '2026-07-20T00:00:00.000Z';
    expect(scimTokenStatus(governance, now)).toBe('expired');
  });
});
