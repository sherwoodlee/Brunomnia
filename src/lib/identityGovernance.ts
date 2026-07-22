import type {
  GovernanceConfig,
  GovernanceMember,
  GovernanceResourceGrant,
  GovernanceRole,
  OrganizationInvitation,
  OrganizationPermission,
  Workspace,
} from '../types';

export const organizationPermissions: OrganizationPermission[] = [
  'own:organization',
  'read:organization',
  'delete:organization',
  'update:organization',
  'read:membership',
  'delete:membership',
  'update:membership',
  'read:invitation',
  'create:invitation',
  'delete:invitation',
  'create:enterprise_connection',
  'read:enterprise_connection',
  'delete:enterprise_connection',
  'update:enterprise_connection',
  'leave:organization',
];

const permissionsByRole: Record<GovernanceRole, OrganizationPermission[]> = {
  owner: organizationPermissions.filter((permission) => permission !== 'leave:organization'),
  admin: organizationPermissions.filter((permission) => permission !== 'own:organization' && permission !== 'delete:organization'),
  editor: ['read:organization', 'read:membership', 'read:invitation', 'read:enterprise_connection', 'leave:organization'],
  viewer: ['read:organization', 'read:membership', 'read:invitation', 'read:enterprise_connection', 'leave:organization'],
};

const audit = (governance: GovernanceConfig, actorId: string, action: string, detail: string, now = new Date()): GovernanceConfig => {
  const retention = Math.min(10_000, Math.max(1, governance.policy.auditRetention || 500));
  return {
    ...governance,
    audit: [{ id: `audit-${crypto.randomUUID()}`, timestamp: now.toISOString(), actorId, action, detail }, ...governance.audit].slice(0, retention),
  };
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const emailDomain = (email: string) => normalizeEmail(email).split('@')[1] ?? '';

export const currentGovernanceMember = (governance: GovernanceConfig) => governance.members.find((member) => member.id === governance.currentMemberId && member.active);

export const permissionsForMember = (governance: GovernanceConfig, memberId = governance.currentMemberId): Record<OrganizationPermission, boolean> => {
  const member = governance.members.find((candidate) => candidate.id === memberId && candidate.active);
  const permissions = new Set(member ? permissionsByRole[member.role] : []);
  return Object.fromEntries(organizationPermissions.map((permission) => [permission, permissions.has(permission)])) as Record<OrganizationPermission, boolean>;
};

export const hasOrganizationPermission = (governance: GovernanceConfig, permission: OrganizationPermission, memberId = governance.currentMemberId) => permissionsForMember(governance, memberId)[permission];

export const verifiedDomains = (governance: GovernanceConfig) => governance.organization.domains.filter((domain) => Boolean(domain.verifiedAt));

export const identityEmailIsAllowed = (governance: GovernanceConfig, email: string) => {
  const domain = emailDomain(email);
  return Boolean(domain && verifiedDomains(governance).some((candidate) => candidate.domain === domain));
};

export const ssoConfigurationReady = (governance: GovernanceConfig) => {
  if (!verifiedDomains(governance).length) return false;
  if (governance.sso.protocol === 'oidc') return Boolean(governance.sso.oidc.issuer.trim() && governance.sso.oidc.clientId.trim());
  return Boolean(governance.sso.saml.idpEntityId.trim() && governance.sso.saml.signInUrl.trim() && governance.sso.saml.certificatePem.includes('BEGIN CERTIFICATE'));
};

export const scimTokenStatus = (governance: GovernanceConfig, now = new Date()) => {
  if (!governance.scim.tokenId || !governance.scim.issuedAt) return 'missing' as const;
  if (!governance.scim.expiresAt) return 'valid' as const;
  const expiresAt = Date.parse(governance.scim.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return 'expired' as const;
  return expiresAt - now.getTime() <= 20 * 24 * 60 * 60 * 1_000 ? 'expiring' as const : 'valid' as const;
};

export const createOrganizationInvitation = (
  governance: GovernanceConfig,
  email: string,
  role: GovernanceRole = 'editor',
  now = new Date(),
) => {
  if (!hasOrganizationPermission(governance, 'create:invitation')) throw new Error('The current member cannot create organization invitations.');
  const normalizedEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Enter a valid invitation email address.');
  if (governance.members.some((member) => normalizeEmail(member.email) === normalizedEmail && member.active)) throw new Error('That email already belongs to an active organization member.');
  const existing = governance.organization.invitations.find((invitation) => invitation.email === normalizedEmail && invitation.status === 'pending');
  if (existing) throw new Error('That email already has a pending invitation.');
  const invitation: OrganizationInvitation = {
    id: `invitation-${crypto.randomUUID()}`,
    email: normalizedEmail,
    role,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
    lastSentAt: now.toISOString(),
  };
  const next = { ...governance, organization: { ...governance.organization, invitations: [...governance.organization.invitations, invitation] } };
  return { governance: audit(next, governance.currentMemberId, 'organization.invitation.create', `Invited ${normalizedEmail} as ${role}.`, now), invitation };
};

export const reinviteOrganizationMember = (governance: GovernanceConfig, invitationId: string, now = new Date()) => {
  if (!hasOrganizationPermission(governance, 'create:invitation')) throw new Error('The current member cannot resend organization invitations.');
  const invitation = governance.organization.invitations.find((candidate) => candidate.id === invitationId);
  if (!invitation || invitation.status === 'accepted' || invitation.status === 'revoked') throw new Error('Only pending or expired invitations can be resent.');
  const invitations = governance.organization.invitations.map((candidate) => candidate.id === invitationId ? { ...candidate, status: 'pending' as const, expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000).toISOString(), lastSentAt: now.toISOString() } : candidate);
  return audit({ ...governance, organization: { ...governance.organization, invitations } }, governance.currentMemberId, 'organization.invitation.reinvite', `Resent ${invitation.email}.`, now);
};

export const revokeOrganizationInvitation = (governance: GovernanceConfig, invitationId: string, now = new Date()) => {
  if (!hasOrganizationPermission(governance, 'delete:invitation')) throw new Error('The current member cannot revoke organization invitations.');
  const invitation = governance.organization.invitations.find((candidate) => candidate.id === invitationId);
  if (!invitation || invitation.status !== 'pending') throw new Error('Only pending invitations can be revoked.');
  const invitations = governance.organization.invitations.map((candidate) => candidate.id === invitationId ? { ...candidate, status: 'revoked' as const } : candidate);
  return audit({ ...governance, organization: { ...governance.organization, invitations } }, governance.currentMemberId, 'organization.invitation.revoke', `Revoked ${invitation.email}.`, now);
};

export const transferOrganizationOwnership = (governance: GovernanceConfig, memberId: string, now = new Date()) => {
  const current = currentGovernanceMember(governance);
  if (!current || current.id !== governance.organization.ownerId || current.role !== 'owner') throw new Error('Only the organization owner can transfer ownership.');
  if (governance.sso.enabled) throw new Error('Disable SSO before transferring the organization.');
  if (governance.organization.invitations.some((invitation) => invitation.status === 'pending')) throw new Error('Revoke all pending invitations before transferring the organization.');
  const target = governance.members.find((member) => member.id === memberId && member.active);
  if (!target) throw new Error('The new owner must already be an active organization member.');
  if (target.id === current.id) return governance;
  const members = governance.members.map((member) => member.id === target.id ? { ...member, role: 'owner' as const } : member.id === current.id ? { ...member, role: 'admin' as const } : member);
  const next = { ...governance, members, organization: { ...governance.organization, ownerId: target.id } };
  return audit(next, current.id, 'organization.ownership.transfer', `Transferred ownership to ${target.email || target.name}.`, now);
};

const grantsForResource = (governance: GovernanceConfig, resourceType: GovernanceResourceGrant['resourceType'], resourceId: string) => governance.resourceGrants.filter((grant) => grant.resourceType === resourceType && grant.resourceId === resourceId);

export const resourceAccess = (
  governance: GovernanceConfig,
  resourceType: GovernanceResourceGrant['resourceType'],
  resourceId: string,
  memberId = governance.currentMemberId,
): 'none' | 'viewer' | 'editor' => {
  const member = governance.members.find((candidate) => candidate.id === memberId && candidate.active);
  if (!member) return 'none';
  if (member.role === 'owner' || member.role === 'admin') return 'editor';
  const grants = grantsForResource(governance, resourceType, resourceId);
  if (!grants.length) return member.role === 'editor' ? 'editor' : 'viewer';
  const matching = grants.filter((grant) => grant.subjectType === 'member' ? grant.subjectId === member.id : member.teamIds.includes(grant.subjectId));
  if (matching.some((grant) => grant.access === 'editor')) return member.role === 'editor' ? 'editor' : 'viewer';
  return matching.some((grant) => grant.access === 'viewer') ? 'viewer' : 'none';
};

export const canAccessResource = (governance: GovernanceConfig, resourceType: GovernanceResourceGrant['resourceType'], resourceId: string, memberId = governance.currentMemberId) => resourceAccess(governance, resourceType, resourceId, memberId) !== 'none';

export const workspaceForCurrentMember = (workspace: Workspace): Workspace => {
  const collections = workspace.collections.filter((collection) => canAccessResource(workspace.governance, 'collection', collection.id));
  const apiDesigns = workspace.apiDesigns.filter((design) => canAccessResource(workspace.governance, 'api-design', design.id));
  const requestIds = new Set(collections.flatMap((collection) => collection.requests.map((request) => request.id)));
  return {
    ...workspace,
    collections,
    apiDesigns,
    activeRequestId: requestIds.has(workspace.activeRequestId) ? workspace.activeRequestId : collections[0]?.requests[0]?.id ?? '',
  };
};

const authenticationOnlyGovernanceUpdate = (current: GovernanceConfig, proposed: GovernanceConfig) => {
  if (!current.sso.enabled) return false;
  if (JSON.stringify(current.organization) !== JSON.stringify(proposed.organization)
    || JSON.stringify(current.sso) !== JSON.stringify(proposed.sso)
    || JSON.stringify(current.scim) !== JSON.stringify(proposed.scim)
    || JSON.stringify(current.policy) !== JSON.stringify(proposed.policy)
    || JSON.stringify(current.teams) !== JSON.stringify(proposed.teams)
    || JSON.stringify(current.resourceGrants) !== JSON.stringify(proposed.resourceGrants)) return false;
  const proposedCurrent = proposed.members.find((member) => member.id === proposed.currentMemberId && member.active);
  if (!proposedCurrent || current.members.length !== proposed.members.length) return false;
  const identityFieldsOnly = proposed.members.every((member) => {
    const previous = current.members.find((candidate) => candidate.id === member.id);
    return previous
      && previous.email === member.email
      && previous.role === member.role
      && previous.active === member.active
      && previous.source === member.source;
  });
  if (!identityFieldsOnly || proposed.audit.length < current.audit.length) return false;
  return proposed.audit.slice(0, proposed.audit.length - current.audit.length).every((event) => event.action === 'sso.login')
    && JSON.stringify(proposed.audit.slice(proposed.audit.length - current.audit.length)) === JSON.stringify(current.audit);
};

export const enforceWorkspaceMutationAuthority = (current: Workspace, proposed: Workspace): Workspace => {
  const member = currentGovernanceMember(current.governance);
  if (!member || member.role === 'owner' || member.role === 'admin') return proposed;
  const proposedCollections = new Map(proposed.collections.map((collection) => [collection.id, collection]));
  const collections = current.collections.flatMap((collection) => {
    const candidate = proposedCollections.get(collection.id);
    proposedCollections.delete(collection.id);
    return [resourceAccess(current.governance, 'collection', collection.id, member.id) === 'editor' && candidate ? candidate : collection];
  });
  if (member.role === 'editor') collections.push(...proposedCollections.values());
  const proposedDesigns = new Map(proposed.apiDesigns.map((design) => [design.id, design]));
  const apiDesigns = current.apiDesigns.flatMap((design) => {
    const candidate = proposedDesigns.get(design.id);
    proposedDesigns.delete(design.id);
    return [resourceAccess(current.governance, 'api-design', design.id, member.id) === 'editor' && candidate ? candidate : design];
  });
  if (member.role === 'editor') apiDesigns.push(...proposedDesigns.values());
  const governance = authenticationOnlyGovernanceUpdate(current.governance, proposed.governance) ? proposed.governance : current.governance;
  if (member.role === 'editor') return { ...proposed, collections, apiDesigns, governance };
  return {
    ...proposed,
    name: current.name,
    collections,
    environments: current.environments,
    apiDesigns,
    mockServers: current.mockServers,
    testSuites: current.testSuites,
    imports: current.imports,
    project: current.project,
    plugins: current.plugins,
    pluginData: current.pluginData,
    collaboration: current.collaboration,
    governance,
    mcpClients: current.mcpClients,
    ai: current.ai,
    konnect: current.konnect,
  };
};

export type AuthenticatedIdentity = {
  subject: string;
  email: string;
  name: string;
  groups: string[];
  protocol: 'oidc' | 'saml';
};

export const applyAuthenticatedIdentity = (governance: GovernanceConfig, identity: AuthenticatedIdentity, now = new Date()) => {
  const email = normalizeEmail(identity.email);
  if (!identityEmailIsAllowed(governance, email)) throw new Error('The authenticated email does not use a verified organization domain.');
  const member = governance.members.find((candidate) => normalizeEmail(candidate.email) === email && candidate.active);
  if (!member) throw new Error('The authenticated identity is not an active organization member. Invite or provision the user first.');
  const matchingTeamIds = governance.teams.filter((team) => identity.groups.some((group) => group.toLowerCase() === team.name.toLowerCase() || group === team.externalId)).map((team) => team.id);
  const members: GovernanceMember[] = governance.members.map((candidate) => candidate.id === member.id ? {
    ...candidate,
    name: identity.name.trim() || candidate.name,
    externalId: candidate.externalId || identity.subject,
    teamIds: [...new Set([...candidate.teamIds, ...matchingTeamIds])],
    lastAuthenticatedAt: now.toISOString(),
  } : candidate);
  return audit({ ...governance, currentMemberId: member.id, members }, member.id, 'sso.login', `${identity.protocol.toUpperCase()} login for ${email}.`, now);
};

export const upsertResourceGrant = (governance: GovernanceConfig, grant: Omit<GovernanceResourceGrant, 'id'>, now = new Date()) => {
  if (!hasOrganizationPermission(governance, 'update:membership')) throw new Error('The current member cannot update resource access.');
  const existing = governance.resourceGrants.find((candidate) => candidate.resourceType === grant.resourceType && candidate.resourceId === grant.resourceId && candidate.subjectType === grant.subjectType && candidate.subjectId === grant.subjectId);
  const resourceGrants = existing
    ? governance.resourceGrants.map((candidate) => candidate.id === existing.id ? { ...candidate, access: grant.access } : candidate)
    : [...governance.resourceGrants, { ...grant, id: `grant-${crypto.randomUUID()}` }];
  return audit({ ...governance, resourceGrants }, governance.currentMemberId, 'governance.resource-grant.update', `${grant.subjectType}:${grant.subjectId} can ${grant.access} ${grant.resourceType}:${grant.resourceId}.`, now);
};

export const removeResourceGrant = (governance: GovernanceConfig, grantId: string, now = new Date()) => {
  if (!hasOrganizationPermission(governance, 'update:membership')) throw new Error('The current member cannot update resource access.');
  const grant = governance.resourceGrants.find((candidate) => candidate.id === grantId);
  if (!grant) return governance;
  return audit({ ...governance, resourceGrants: governance.resourceGrants.filter((candidate) => candidate.id !== grantId) }, governance.currentMemberId, 'governance.resource-grant.delete', `Removed ${grant.subjectType}:${grant.subjectId} access to ${grant.resourceType}:${grant.resourceId}.`, now);
};
