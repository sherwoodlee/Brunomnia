import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useMemo, useState } from 'react';
import type { GovernanceConfig, GovernanceMember, GovernanceRole, Workspace } from '../types';
import {
  clearScimToken,
  getScimServerStatus,
  issueScimToken,
  loginWithOidc,
  loginWithSaml,
  oidcClientSecretStatus,
  saveOidcClientSecret,
  scimTokenStatus as nativeScimTokenStatus,
  startScimServer,
  stopScimServer,
  verifyOrganizationDomain,
  type ScimServerStatus,
} from '../lib/identityControlPlane';
import {
  applyAuthenticatedIdentity,
  createOrganizationInvitation,
  hasOrganizationPermission,
  permissionsForMember,
  reinviteOrganizationMember,
  removeResourceGrant,
  revokeOrganizationInvitation,
  scimTokenStatus,
  ssoConfigurationReady,
  transferOrganizationOwnership,
  upsertResourceGrant,
} from '../lib/identityGovernance';
import { appendAudit } from '../lib/security';
import { Icon } from './Icon';

type IdentityGovernancePanelProps = {
  workspaceId: string;
  workspace: Workspace;
  onChangeWorkspace: (updater: (workspace: Workspace) => Workspace) => void;
};

type Section = 'organization' | 'members' | 'access' | 'sso' | 'scim' | 'audit';

const roles: GovernanceRole[] = ['owner', 'admin', 'editor', 'viewer'];
const blankServerStatus: ScimServerStatus = { running: false, baseUrl: '', workspaceId: '' };
const domainId = () => `domain-${crypto.randomUUID()}`;
const memberId = () => `member-${crypto.randomUUID()}`;
const teamId = () => `team-${crypto.randomUUID()}`;

const emailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export function IdentityGovernancePanel({ workspaceId, workspace, onChangeWorkspace }: IdentityGovernancePanelProps) {
  const [section, setSection] = useState<Section>('organization');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationRole, setInvitationRole] = useState<GovernanceRole>('editor');
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [teamName, setTeamName] = useState('');
  const [domainName, setDomainName] = useState('');
  const [oidcSecret, setOidcSecret] = useState('');
  const [oidcSecretStored, setOidcSecretStored] = useState(false);
  const [scimTokenStored, setScimTokenStored] = useState(false);
  const [scimTokenOnce, setScimTokenOnce] = useState('');
  const [scimExpiry, setScimExpiry] = useState('90');
  const [scimRefreshMode, setScimRefreshMode] = useState<'manual' | 'oauth2'>('manual');
  const [serverStatus, setServerStatus] = useState<ScimServerStatus>(blankServerStatus);
  const [grantResource, setGrantResource] = useState('');
  const [grantSubject, setGrantSubject] = useState('');
  const [grantAccess, setGrantAccess] = useState<'viewer' | 'editor'>('viewer');
  const native = isTauri();
  const governance = workspace.governance;
  const currentMember = governance.members.find((member) => member.id === governance.currentMemberId && member.active);
  const canGovern = hasOrganizationPermission(governance, 'update:membership');
  const canConfigureSso = currentMember?.role === 'owner';
  const permissions = permissionsForMember(governance);
  const ssoReady = ssoConfigurationReady(governance);
  const tokenStatus = scimTokenStatus(governance);
  const pendingInvitations = governance.organization.invitations.filter((invitation) => invitation.status === 'pending');
  const resources = useMemo(() => [
    ...workspace.collections.map((collection) => ({ key: `collection:${collection.id}`, type: 'collection' as const, id: collection.id, name: collection.name })),
    ...workspace.apiDesigns.map((design) => ({ key: `api-design:${design.id}`, type: 'api-design' as const, id: design.id, name: design.name })),
  ], [workspace.apiDesigns, workspace.collections]);
  const subjects = useMemo(() => [
    ...governance.members.map((member) => ({ key: `member:${member.id}`, type: 'member' as const, id: member.id, name: member.name })),
    ...governance.teams.map((team) => ({ key: `team:${team.id}`, type: 'team' as const, id: team.id, name: team.name })),
  ], [governance.members, governance.teams]);

  const changeGovernance = (updater: (governance: GovernanceConfig) => GovernanceConfig) => onChangeWorkspace((current) => ({ ...current, governance: updater(current.governance) }));
  const auditedChange = (updater: (governance: GovernanceConfig) => GovernanceConfig, action: string, detail: string) => onChangeWorkspace((current) => appendAudit({ ...current, governance: updater(current.governance) }, action, detail));
  const run = async (label: string, operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(label); setError(''); setMessage('');
    try { await operation(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(''); }
  };

  useEffect(() => {
    let cancelled = false;
    if (!native) return;
    void Promise.all([oidcClientSecretStatus(workspaceId), nativeScimTokenStatus(workspaceId), getScimServerStatus()]).then(([oidc, scim, server]) => {
      if (cancelled) return;
      setOidcSecretStored(oidc.stored);
      setScimTokenStored(scim.stored);
      setServerStatus(server.workspaceId === workspaceId ? server : blankServerStatus);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [native, workspaceId]);

  const updateMember = (id: string, patch: Partial<GovernanceMember>) => {
    if (!canGovern) return;
    const nextMembers = governance.members.map((member) => member.id === id ? { ...member, ...patch } : member);
    if (!nextMembers.some((member) => member.active && member.role === 'owner')) { setError('At least one active owner is required.'); return; }
    auditedChange((current) => ({ ...current, members: nextMembers }), 'governance.member.update', `Updated organization member ${id}.`);
  };

  const addManualMember = () => {
    if (!canGovern || !memberName.trim() || !emailValid(memberEmail)) { setError('Enter a member name and valid email address.'); return; }
    const email = memberEmail.trim().toLowerCase();
    if (governance.members.some((member) => member.email === email)) { setError('That email is already an organization member.'); return; }
    const member: GovernanceMember = { id: memberId(), name: memberName.trim(), email, role: 'editor', active: true, source: 'manual', externalId: '', teamIds: [], lastAuthenticatedAt: '' };
    auditedChange((current) => ({ ...current, members: [...current.members, member] }), 'governance.member.add', `Added ${email} as a manual editor.`);
    setMemberName(''); setMemberEmail(''); setError('');
  };

  const addTeam = () => {
    const name = teamName.trim();
    if (!canGovern || !name) return;
    auditedChange((current) => ({ ...current, teams: [...current.teams, { id: teamId(), name, externalId: '', source: 'manual', memberIds: [] }] }), 'governance.team.add', `Added team ${name}.`);
    setTeamName('');
  };

  const toggleTeamMember = (teamIdValue: string, memberIdValue: string, enabled: boolean) => auditedChange((current) => {
    const teams = current.teams.map((team) => team.id === teamIdValue ? { ...team, memberIds: enabled ? [...new Set([...team.memberIds, memberIdValue])] : team.memberIds.filter((id) => id !== memberIdValue) } : team);
    const members = current.members.map((member) => member.id === memberIdValue ? { ...member, teamIds: enabled ? [...new Set([...member.teamIds, teamIdValue])] : member.teamIds.filter((id) => id !== teamIdValue) } : member);
    return { ...current, teams, members };
  }, 'governance.team.membership', `${enabled ? 'Added' : 'Removed'} ${memberIdValue} ${enabled ? 'to' : 'from'} ${teamIdValue}.`);

  const invite = () => {
    try {
      const result = createOrganizationInvitation(governance, invitationEmail, invitationRole);
      changeGovernance(() => result.governance);
      setInvitationEmail('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  const acceptInvitationLocally = (invitationId: string) => {
    const invitation = governance.organization.invitations.find((candidate) => candidate.id === invitationId && candidate.status === 'pending');
    if (!invitation) return;
    const existing = governance.members.find((member) => member.email === invitation.email);
    const member: GovernanceMember = existing ? { ...existing, active: true, role: invitation.role } : { id: memberId(), name: invitation.email.split('@')[0], email: invitation.email, role: invitation.role, active: true, source: 'manual', externalId: '', teamIds: [], lastAuthenticatedAt: '' };
    auditedChange((current) => ({
      ...current,
      members: existing ? current.members.map((candidate) => candidate.id === existing.id ? member : candidate) : [...current.members, member],
      organization: { ...current.organization, invitations: current.organization.invitations.map((candidate) => candidate.id === invitationId ? { ...candidate, status: 'accepted' as const } : candidate) },
    }), 'organization.invitation.accept', `Accepted ${invitation.email} on this self-hosted organization.`);
  };

  const addDomain = () => {
    const domain = domainName.trim().toLowerCase().replace(/\.$/, '');
    if (!canConfigureSso || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)) { setError('Enter a valid DNS domain.'); return; }
    if (governance.organization.domains.some((candidate) => candidate.domain === domain)) { setError('That domain is already configured.'); return; }
    const challenge = crypto.randomUUID().replaceAll('-', '');
    auditedChange((current) => ({ ...current, organization: { ...current.organization, domains: [...current.organization.domains, { id: domainId(), domain, challenge, verifiedAt: '' }] } }), 'organization.domain.add', `Added ${domain} for verification.`);
    setDomainName('');
  };

  const verifyDomain = (id: string) => run('Verifying domain', async () => {
    const domain = governance.organization.domains.find((candidate) => candidate.id === id);
    if (!domain) return;
    const verifiedAt = await verifyOrganizationDomain(domain.domain, domain.challenge);
    auditedChange((current) => ({ ...current, organization: { ...current.organization, domains: current.organization.domains.map((candidate) => candidate.id === id ? { ...candidate, verifiedAt } : candidate) } }), 'organization.domain.verify', `Verified ${domain.domain}.`);
    setMessage(`${domain.domain} verified over HTTPS.`);
  });

  const updateSso = (patch: Partial<GovernanceConfig['sso']>) => auditedChange((current) => ({ ...current, sso: { ...current.sso, ...patch } }), 'sso.configuration.update', 'Updated the self-hosted SSO connection.');
  const updateOidc = (patch: Partial<GovernanceConfig['sso']['oidc']>) => updateSso({ oidc: { ...governance.sso.oidc, ...patch } });
  const updateSaml = (patch: Partial<GovernanceConfig['sso']['saml']>) => updateSso({ saml: { ...governance.sso.saml, ...patch } });
  const updateScim = (patch: Partial<GovernanceConfig['scim']>) => auditedChange((current) => ({ ...current, scim: { ...current.scim, ...patch } }), 'scim.configuration.update', 'Updated the self-hosted SCIM connector.');

  const saveOidcSecret = () => run('Saving OIDC client secret', async () => {
    await saveOidcClientSecret(workspaceId, oidcSecret);
    setOidcSecretStored(Boolean(oidcSecret));
    setOidcSecret('');
    setMessage('OIDC client secret saved in the operating-system credential store.');
  });

  const login = () => run('Authenticating with SSO', async () => {
    if (!governance.sso.enabled) throw new Error('Enable SSO before logging in.');
    const identity = governance.sso.protocol === 'oidc' ? await loginWithOidc(workspaceId, governance) : await loginWithSaml(workspaceId, governance);
    changeGovernance((current) => applyAuthenticatedIdentity(current, identity));
    setMessage(`Authenticated ${identity.email} with ${identity.protocol.toUpperCase()}.`);
  });

  const issueToken = () => run('Generating SCIM token', async () => {
    const issued = await issueScimToken(workspaceId, scimExpiry === 'none' ? null : Number(scimExpiry), scimRefreshMode);
    setScimTokenOnce(issued.token);
    setScimTokenStored(true);
    auditedChange((current) => ({ ...current, scim: { ...current.scim, tokenId: issued.tokenId, issuedAt: issued.issuedAt, expiresAt: issued.expiresAt, refreshMode: issued.refreshMode } }), 'scim.token.issue', `Issued a ${issued.refreshMode} SCIM token${issued.expiresAt ? ` expiring ${issued.expiresAt}` : ' without expiry'}.`);
  });

  const clearToken = () => run('Clearing SCIM token', async () => {
    if (serverStatus.running) setServerStatus(await stopScimServer());
    await clearScimToken(workspaceId);
    setScimTokenStored(false); setScimTokenOnce('');
    updateScim({ tokenId: '', issuedAt: '', expiresAt: '' });
  });

  const toggleServer = () => run(serverStatus.running ? 'Stopping SCIM connector' : 'Starting SCIM connector', async () => {
    const next = serverStatus.running ? await stopScimServer() : await startScimServer();
    setServerStatus(next);
    setMessage(next.running ? `SCIM connector listening at ${next.baseUrl}.` : 'SCIM connector stopped.');
  });

  const applyGrant = () => {
    const resource = resources.find((candidate) => candidate.key === grantResource);
    const subject = subjects.find((candidate) => candidate.key === grantSubject);
    if (!resource || !subject) { setError('Choose a resource and member or team.'); return; }
    try { changeGovernance((current) => upsertResourceGrant(current, { resourceType: resource.type, resourceId: resource.id, subjectType: subject.type, subjectId: subject.id, access: grantAccess })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };

  const updateStorageRule = (key: 'enableCloudSync' | 'enableLocalVault' | 'enableGitSync', enabled: boolean) => {
    const preview = new Set(governance.policy.allowedStorage);
    if (key === 'enableCloudSync') enabled ? preview.add('encrypted-file') : preview.delete('encrypted-file');
    if (key === 'enableGitSync') enabled ? preview.add('git') : preview.delete('git');
    if (key === 'enableLocalVault') {
      if (enabled) { preview.add('local'); preview.add('folder'); }
      else { preview.delete('local'); preview.delete('folder'); }
    }
    if (!preview.size) { setError('At least one organization storage mode must remain enabled.'); return; }
    auditedChange((current) => {
    const modes = new Set(current.policy.allowedStorage);
    if (key === 'enableCloudSync') enabled ? modes.add('encrypted-file') : modes.delete('encrypted-file');
    if (key === 'enableGitSync') enabled ? modes.add('git') : modes.delete('git');
    if (key === 'enableLocalVault') {
      if (enabled) { modes.add('local'); modes.add('folder'); }
      else { modes.delete('local'); modes.delete('folder'); }
    }
    return { ...current, policy: { ...current.policy, allowedStorage: [...modes], storageRules: { ...current.policy.storageRules, [key]: enabled, isOverridden: true } } };
    }, 'organization.storage.update', `${enabled ? 'Enabled' : 'Disabled'} ${key}.`);
  };

  return <div className="identity-governance">
    <nav className="identity-nav" aria-label="Identity governance sections">{(['organization', 'members', 'access', 'sso', 'scim', 'audit'] as Section[]).map((item) => <button className={section === item ? 'active' : ''} key={item} onClick={() => setSection(item)} type="button">{item === 'sso' || item === 'scim' ? item.toUpperCase() : `${item[0].toUpperCase()}${item.slice(1)}`}</button>)}</nav>

    {section === 'organization' ? <div className="security-grid governance-grid">
      <section className="security-card"><header><div><small>Free organization control</small><h2>{governance.organization.name}</h2></div><span>{currentMember?.role ?? 'no session'}</span></header><label>Organization name<input disabled={!permissions['update:organization']} onChange={(event) => changeGovernance((current) => ({ ...current, organization: { ...current.organization, name: event.target.value } }))} value={governance.organization.name} /></label><label>Authenticated actor<select aria-label="Current organization actor" disabled={governance.sso.enabled} onChange={(event) => changeGovernance((current) => ({ ...current, currentMemberId: event.target.value }))} value={governance.currentMemberId}>{governance.members.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</select></label>{governance.sso.enabled ? <p>SSO is enabled, so local actor switching is disabled. Use the SSO Login action to change identity.</p> : <p>No hosted account is required. Enabling SSO replaces this local development switch with a validated IdP login.</p>}<div className="identity-permissions">{Object.entries(permissions).map(([permission, enabled]) => <span className={enabled ? 'allowed' : ''} key={permission}>{enabled ? '✓' : '—'} {permission}</span>)}</div></section>
      <section className="security-card"><header><div><small>Exact organization rules</small><h2>Storage controls</h2></div></header>{(['enableCloudSync', 'enableLocalVault', 'enableGitSync'] as const).map((key) => <label className="force-toggle" key={key}><input checked={governance.policy.storageRules[key]} disabled={!permissions['update:organization']} onChange={(event) => { try { updateStorageRule(key, event.target.checked); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } }} type="checkbox" /> {key === 'enableCloudSync' ? 'Cloud Sync (self-hosted encrypted revisions)' : key === 'enableLocalVault' ? 'Local Vault' : 'Git Sync'}</label>)}<label className="force-toggle"><input checked={governance.policy.requireEncryptedSync} disabled={!canGovern} onChange={(event) => auditedChange((current) => ({ ...current, policy: { ...current.policy, requireEncryptedSync: event.target.checked } }), 'governance.policy.update', 'Changed encrypted-sync requirement.')} type="checkbox" /> Require encrypted collaboration</label><label className="force-toggle"><input checked={governance.policy.requireVaultForSecrets} disabled={!canGovern} onChange={(event) => auditedChange((current) => ({ ...current, policy: { ...current.policy, requireVaultForSecrets: event.target.checked } }), 'governance.policy.update', 'Changed secret-vault requirement.')} type="checkbox" /> Require vault references for secrets</label></section>
      <section className="security-card"><header><div><small>Owner handoff</small><h2>Transfer organization</h2></div></header><p>The target must already be active. SSO must be disabled and all pending invitations revoked.</p><select disabled={currentMember?.id !== governance.organization.ownerId} onChange={(event) => { if (!event.target.value || !window.confirm('Transfer organization ownership?')) return; try { changeGovernance((current) => transferOrganizationOwnership(current, event.target.value)); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } }} value=""><option value="">Choose new owner…</option>{governance.members.filter((member) => member.active && member.id !== governance.organization.ownerId).map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}</select><small>{pendingInvitations.length} pending invitation{pendingInvitations.length === 1 ? '' : 's'} · SSO {governance.sso.enabled ? 'enabled' : 'disabled'}</small></section>
    </div> : null}

    {section === 'members' ? <div className="security-grid governance-grid">
      <section className="security-card identity-members"><header><div><small>Manual and SCIM sources</small><h2>Members and roles</h2></div><span>{governance.members.filter((member) => member.active).length} active</span></header><div className="member-list">{governance.members.map((member) => <article key={member.id}><span><strong>{member.name}</strong><small>{member.email || 'No email'} · {member.source.toUpperCase()} · {member.active ? 'active' : 'inactive'}</small></span><select disabled={!canGovern || member.id === governance.organization.ownerId} onChange={(event) => updateMember(member.id, { role: event.target.value as GovernanceRole })} value={member.role}>{roles.map((role) => <option key={role}>{role}</option>)}</select><label><input checked={member.active} disabled={!canGovern || member.id === governance.organization.ownerId || member.source === 'scim'} onChange={(event) => updateMember(member.id, { active: event.target.checked })} type="checkbox" /> Active</label></article>)}</div><div className="member-new"><input placeholder="Member name" value={memberName} onChange={(event) => setMemberName(event.target.value)} /><input placeholder="Email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} /><button disabled={!canGovern} onClick={addManualMember} type="button">Add editor</button></div></section>
      <section className="security-card"><header><div><small>30 day validity</small><h2>Invitations</h2></div><span>{pendingInvitations.length} pending</span></header><div className="identity-inline"><input placeholder="person@example.com" value={invitationEmail} onChange={(event) => setInvitationEmail(event.target.value)} /><select value={invitationRole} onChange={(event) => setInvitationRole(event.target.value as GovernanceRole)}>{roles.filter((role) => role !== 'owner').map((role) => <option key={role}>{role}</option>)}</select><button disabled={!permissions['create:invitation']} onClick={invite} type="button">Invite</button></div><div className="identity-list">{governance.organization.invitations.map((invitation) => <article key={invitation.id}><span><strong>{invitation.email}</strong><small>{invitation.role} · {invitation.status} · expires {invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString() : 'never'}</small></span>{invitation.status === 'pending' ? <><button onClick={() => acceptInvitationLocally(invitation.id)} type="button">Accept locally</button><button onClick={() => changeGovernance((current) => reinviteOrganizationMember(current, invitation.id))} type="button">Reinvite</button><button onClick={() => changeGovernance((current) => revokeOrganizationInvitation(current, invitation.id))} type="button">Revoke</button></> : null}</article>)}</div></section>
      <section className="security-card"><header><div><small>One-way SCIM ownership</small><h2>Teams</h2></div><span>{governance.teams.length}</span></header><div className="identity-inline"><input placeholder="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} /><button disabled={!canGovern} onClick={addTeam} type="button">Add team</button></div><div className="identity-team-list">{governance.teams.map((team) => <article key={team.id}><header><strong>{team.name}</strong><small>{team.source.toUpperCase()}</small></header>{governance.members.map((member) => <label key={member.id}><input checked={team.memberIds.includes(member.id)} disabled={!canGovern || team.source === 'scim'} onChange={(event) => toggleTeamMember(team.id, member.id, event.target.checked)} type="checkbox" /> {member.name}</label>)}</article>)}</div></section>
    </div> : null}

    {section === 'access' ? <div className="security-grid governance-grid">
      <section className="security-card"><header><div><small>Collections and design documents</small><h2>Resource grants</h2></div><span>{governance.resourceGrants.length}</span></header><label>Resource<select value={grantResource} onChange={(event) => setGrantResource(event.target.value)}><option value="">Choose resource…</option>{resources.map((resource) => <option key={resource.key} value={resource.key}>{resource.type} · {resource.name}</option>)}</select></label><label>Member or team<select value={grantSubject} onChange={(event) => setGrantSubject(event.target.value)}><option value="">Choose subject…</option>{subjects.map((subject) => <option key={subject.key} value={subject.key}>{subject.type} · {subject.name}</option>)}</select></label><label>Access<select value={grantAccess} onChange={(event) => setGrantAccess(event.target.value as 'viewer' | 'editor')}><option value="viewer">Viewer</option><option value="editor">Editor</option></select></label><button disabled={!canGovern} onClick={applyGrant} type="button">Grant access</button><p>Owners and admins always retain access. When a resource has grants, other members see it only through a direct or team grant.</p></section>
      <section className="security-card identity-grants"><header><div><small>Effective scope</small><h2>Configured grants</h2></div></header>{governance.resourceGrants.map((grant) => { const resource = resources.find((candidate) => candidate.id === grant.resourceId && candidate.type === grant.resourceType); const subject = subjects.find((candidate) => candidate.id === grant.subjectId && candidate.type === grant.subjectType); return <article key={grant.id}><span><strong>{resource?.name ?? grant.resourceId}</strong><small>{subject?.name ?? grant.subjectId} · {grant.access}</small></span><button disabled={!canGovern} onClick={() => changeGovernance((current) => removeResourceGrant(current, grant.id))} type="button"><Icon name="trash" size={13} /></button></article>; })}{!governance.resourceGrants.length ? <p>No scoped grants. All active organization members can see every collection and API design according to their organization role.</p> : null}</section>
    </div> : null}

    {section === 'sso' ? <div className="security-grid governance-grid">
      <section className="security-card"><header><div><small>SAML 2.0 and OpenID Connect</small><h2>Single Sign-On</h2></div><label className="force-toggle"><input checked={governance.sso.enabled} disabled={!canConfigureSso || (!governance.sso.enabled && !ssoReady)} onChange={(event) => updateSso({ enabled: event.target.checked })} type="checkbox" /> Enabled</label></header><label>Protocol<select disabled={!canConfigureSso || governance.sso.enabled} onChange={(event) => updateSso({ protocol: event.target.value as 'oidc' | 'saml' })} value={governance.sso.protocol}><option value="oidc">OpenID Connect</option><option value="saml">SAML 2.0</option></select></label><button disabled={!native || !governance.sso.enabled || !ssoReady || Boolean(busy)} onClick={login} type="button">Login with {governance.sso.protocol.toUpperCase()}</button><p>Once enabled, local actor switching is disabled and the validated IdP identity must match an active member on a verified domain.</p></section>
      <section className="security-card"><header><div><small>HTTPS well-known challenge</small><h2>Verified domains</h2></div><span>{governance.organization.domains.filter((domain) => domain.verifiedAt).length}</span></header><div className="identity-inline"><input placeholder="example.com" value={domainName} onChange={(event) => setDomainName(event.target.value)} /><button disabled={!canConfigureSso} onClick={addDomain} type="button">Add domain</button></div><div className="identity-domain-list">{governance.organization.domains.map((domain) => <article key={domain.id}><span><strong>{domain.domain}</strong><small>{domain.verifiedAt ? `Verified ${new Date(domain.verifiedAt).toLocaleString()}` : `Publish brunomnia-domain-verification=${domain.challenge} at /.well-known/brunomnia-domain-verification.txt`}</small></span>{!domain.verifiedAt ? <button disabled={!native || !canConfigureSso || Boolean(busy)} onClick={() => verifyDomain(domain.id)} type="button">Verify</button> : null}<button disabled={!canConfigureSso || governance.sso.enabled} onClick={() => auditedChange((current) => ({ ...current, organization: { ...current.organization, domains: current.organization.domains.filter((candidate) => candidate.id !== domain.id) } }), 'organization.domain.delete', `Removed ${domain.domain}.`)} type="button"><Icon name="trash" size={13} /></button></article>)}</div></section>
      {governance.sso.protocol === 'oidc' ? <section className="security-card"><header><div><small>Discovery · authorization code · PKCE · nonce</small><h2>OIDC connection</h2></div><span>{oidcSecretStored ? 'Secret protected' : 'Public client'}</span></header><label>Issuer URL<input disabled={!canConfigureSso || governance.sso.enabled} onChange={(event) => updateOidc({ issuer: event.target.value })} placeholder="https://identity.example.com" value={governance.sso.oidc.issuer} /></label><label>Client ID<input disabled={!canConfigureSso || governance.sso.enabled} onChange={(event) => updateOidc({ clientId: event.target.value })} value={governance.sso.oidc.clientId} /></label><label>Scopes<input disabled={!canConfigureSso || governance.sso.enabled} onChange={(event) => updateOidc({ scopes: event.target.value })} value={governance.sso.oidc.scopes} /></label><label>Callback port<input disabled={!canConfigureSso || governance.sso.enabled} min="1024" max="65535" onChange={(event) => updateOidc({ callbackPort: Number(event.target.value) })} type="number" value={governance.sso.oidc.callbackPort} /></label><code>{`http://127.0.0.1:${governance.sso.oidc.callbackPort}/sso/oidc/callback`}</code><label>Client secret<input autoComplete="off" disabled={!native || !canConfigureSso} onChange={(event) => setOidcSecret(event.target.value)} placeholder={oidcSecretStored ? 'Stored in OS credential store' : 'Optional for public clients'} type="password" value={oidcSecret} /></label><button disabled={!native || !canConfigureSso || Boolean(busy)} onClick={saveOidcSecret} type="button">{oidcSecret ? 'Save protected secret' : 'Clear protected secret'}</button></section> : <section className="security-card"><header><div><small>Signed assertions or responses</small><h2>SAML 2.0 connection</h2></div></header><label>IdP entity ID<input disabled={!canConfigureSso || governance.sso.enabled} onChange={(event) => updateSaml({ idpEntityId: event.target.value })} value={governance.sso.saml.idpEntityId} /></label><label>Sign-in URL<input disabled={!canConfigureSso || governance.sso.enabled} onChange={(event) => updateSaml({ signInUrl: event.target.value })} placeholder="https://identity.example.com/sso/saml" value={governance.sso.saml.signInUrl} /></label><label>Expected signature<select disabled={!canConfigureSso || governance.sso.enabled} onChange={(event) => updateSaml({ signatureMode: event.target.value as GovernanceConfig['sso']['saml']['signatureMode'] })} value={governance.sso.saml.signatureMode}><option value="assertion">Signed assertion</option><option value="response">Signed response</option><option value="both">Both signed</option></select></label><label>Callback port<input disabled={!canConfigureSso || governance.sso.enabled} min="1024" max="65535" onChange={(event) => updateSaml({ callbackPort: Number(event.target.value) })} type="number" value={governance.sso.saml.callbackPort} /></label><code>{`http://127.0.0.1:${governance.sso.saml.callbackPort}/sso/saml/acs`}</code><label>IdP signing certificate<textarea disabled={!canConfigureSso || governance.sso.enabled} onChange={(event) => updateSaml({ certificatePem: event.target.value })} placeholder="-----BEGIN CERTIFICATE-----" rows={8} value={governance.sso.saml.certificatePem} /></label></section>}
    </div> : null}

    {section === 'scim' ? <div className="security-grid governance-grid">
      <section className="security-card"><header><div><small>SCIM 2.0 · Okta and Azure</small><h2>Provisioning connector</h2></div><label className="force-toggle"><input checked={governance.scim.enabled} disabled={!canGovern || (!governance.scim.enabled && !governance.sso.enabled)} onChange={(event) => updateScim({ enabled: event.target.checked })} type="checkbox" /> Enabled</label></header><label>Bind host<select disabled={!canGovern || serverStatus.running} onChange={(event) => updateScim({ bindHost: event.target.value as GovernanceConfig['scim']['bindHost'] })} value={governance.scim.bindHost}><option value="127.0.0.1">127.0.0.1 · reverse proxy</option><option value="0.0.0.0">0.0.0.0 · all IPv4 interfaces</option><option value="::1">::1 · IPv6 loopback</option><option value="::">:: · all IPv6 interfaces</option></select></label><label>Port<input disabled={!canGovern || serverStatus.running} min="1024" max="65535" onChange={(event) => updateScim({ port: Number(event.target.value) })} type="number" value={governance.scim.port} /></label><label>Public HTTPS base URL<input disabled={!canGovern} onChange={(event) => updateScim({ publicBaseUrl: event.target.value })} placeholder="https://identity.example.com/scim/v2" value={governance.scim.publicBaseUrl} /></label><div className="identity-server-status"><strong>{serverStatus.running ? 'Running' : 'Stopped'}</strong><code>{governance.scim.publicBaseUrl || serverStatus.baseUrl || `http://${governance.scim.bindHost}:${governance.scim.port}/scim/v2`}</code></div><button disabled={!native || !governance.scim.enabled || !scimTokenStored || Boolean(busy)} onClick={toggleServer} type="button">{serverStatus.running ? 'Stop connector' : 'Start connector'}</button><p>For Okta or Azure, terminate HTTPS in your self-hosted reverse proxy and forward to this connector. Manual users remain unchanged until the IdP explicitly provisions a matching email.</p></section>
      <section className="security-card"><header><div><small>Displayed exactly once</small><h2>Bearer connector token</h2></div><span className={tokenStatus === 'expired' ? 'bad' : ''}>{tokenStatus}</span></header><label>Expiry<select value={scimExpiry} onChange={(event) => setScimExpiry(event.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option><option value="365">1 year</option><option value="730">2 years</option><option value="none">No expiration</option></select></label><label>Refresh<select value={scimRefreshMode} onChange={(event) => setScimRefreshMode(event.target.value as 'manual' | 'oauth2')}><option value="manual">Manual refresh</option><option value="oauth2">Automatic OAuth 2 refresh</option></select></label><button disabled={!native || !canGovern || !governance.scim.enabled || Boolean(busy)} onClick={issueToken} type="button">{scimTokenStored ? 'Refresh token' : 'Generate token'}</button>{scimTokenOnce ? <label>Copy now<textarea aria-label="One-time SCIM token" readOnly rows={4} value={scimTokenOnce} /></label> : <p>The raw token is never stored. Only its SHA-256 verifier is protected by the operating-system credential store.</p>}<button disabled={!scimTokenStored || !canGovern || Boolean(busy)} onClick={clearToken} type="button">Revoke token</button>{governance.scim.expiresAt ? <small>Expires {new Date(governance.scim.expiresAt).toLocaleString()}</small> : null}</section>
      <section className="security-card scim-log-card"><header><div><small>Request diagnostics</small><h2>SCIM logs</h2></div><span>{governance.scim.logs.length}</span></header><div>{governance.scim.logs.map((log) => <article key={log.id}><time>{new Date(log.timestamp).toLocaleString()}</time><strong>{log.method} {log.path}</strong><span className={log.status >= 400 ? 'bad' : ''}>{log.status}</span><small>{log.detail}</small></article>)}{!governance.scim.logs.length ? <p>No SCIM requests recorded.</p> : null}</div></section>
    </div> : null}

    {section === 'audit' ? <div className="security-grid governance-grid"><section className="security-card audit-card"><header><div><small>Append-only in the application</small><h2>Governance audit trail</h2></div><span>{governance.audit.length}</span></header><label>Retention<input disabled={!canGovern} min="1" max="10000" onChange={(event) => changeGovernance((current) => ({ ...current, policy: { ...current.policy, auditRetention: Math.min(10_000, Math.max(1, Number(event.target.value))) } }))} type="number" value={governance.policy.auditRetention} /></label><div>{governance.audit.map((event) => <article key={event.id}><time>{new Date(event.timestamp).toLocaleString()}</time><strong>{event.action}</strong><span>{event.detail}</span><small>{governance.members.find((member) => member.id === event.actorId)?.name ?? event.actorId}</small></article>)}{!governance.audit.length ? <p>No governance events recorded.</p> : null}</div></section></div> : null}

    {busy ? <div className="automation-message">{busy}…</div> : null}
    {error ? <div className="automation-message error" role="alert">{error}</div> : null}
    {message ? <div className="automation-message" role="status">{message}</div> : null}
  </div>;
}
