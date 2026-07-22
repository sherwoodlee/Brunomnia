import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { GovernanceConfig } from '../types';
import type { AuthenticatedIdentity } from './identityGovernance';

export type ScimTokenIssue = {
  token: string;
  tokenId: string;
  issuedAt: string;
  expiresAt: string;
  refreshMode: 'manual' | 'oauth2';
};

export type ScimServerStatus = {
  running: boolean;
  baseUrl: string;
  workspaceId: string;
};

export type CredentialStatus = { stored: boolean };

export type GovernanceUpdateEvent = {
  workspaceId: string;
  governance: GovernanceConfig;
};

const requireNative = () => {
  if (!isTauri()) throw new Error('The self-hosted identity control plane requires the Tauri desktop app.');
};

export const syncIdentityControlPlane = async (workspaceId: string, governance: GovernanceConfig) => {
  if (!isTauri()) return;
  await invoke('identity_control_plane_sync', { input: { workspaceId, governance } });
};

export const listenForGovernanceUpdates = async (listener: (event: GovernanceUpdateEvent) => void): Promise<UnlistenFn> => {
  if (!isTauri()) return () => undefined;
  return listen<GovernanceUpdateEvent>('identity-governance-updated', (event) => listener(event.payload));
};

export const issueScimToken = async (workspaceId: string, expiresDays: number | null, refreshMode: 'manual' | 'oauth2') => {
  requireNative();
  return invoke<ScimTokenIssue>('identity_scim_issue_token', { input: { workspaceId, expiresDays, refreshMode } });
};

export const scimTokenStatus = async (workspaceId: string) => {
  if (!isTauri()) return { stored: false };
  return invoke<CredentialStatus>('identity_scim_token_status', { workspaceId });
};

export const clearScimToken = async (workspaceId: string) => {
  requireNative();
  await invoke('identity_scim_clear_token', { workspaceId });
};

export const startScimServer = async () => {
  requireNative();
  return invoke<ScimServerStatus>('identity_scim_start');
};

export const stopScimServer = async () => {
  requireNative();
  return invoke<ScimServerStatus>('identity_scim_stop');
};

export const getScimServerStatus = async () => {
  if (!isTauri()) return { running: false, baseUrl: '', workspaceId: '' };
  return invoke<ScimServerStatus>('identity_scim_status');
};

export const saveOidcClientSecret = async (workspaceId: string, secret: string) => {
  requireNative();
  await invoke('identity_oidc_save_client_secret', { workspaceId, secret });
};

export const oidcClientSecretStatus = async (workspaceId: string) => {
  if (!isTauri()) return { stored: false };
  return invoke<CredentialStatus>('identity_oidc_client_secret_status', { workspaceId });
};

export const loginWithOidc = async (workspaceId: string, governance: GovernanceConfig) => {
  requireNative();
  return invoke<AuthenticatedIdentity>('identity_oidc_login', {
    input: {
      workspaceId,
      issuer: governance.sso.oidc.issuer,
      clientId: governance.sso.oidc.clientId,
      scopes: governance.sso.oidc.scopes,
      callbackPort: governance.sso.oidc.callbackPort,
    },
  });
};

export const loginWithSaml = async (workspaceId: string, governance: GovernanceConfig) => {
  requireNative();
  return invoke<AuthenticatedIdentity>('identity_saml_login', {
    input: {
      workspaceId,
      idpEntityId: governance.sso.saml.idpEntityId,
      signInUrl: governance.sso.saml.signInUrl,
      certificatePem: governance.sso.saml.certificatePem,
      signatureMode: governance.sso.saml.signatureMode,
      callbackPort: governance.sso.saml.callbackPort,
    },
  });
};

export const verifyOrganizationDomain = async (domain: string, challenge: string) => {
  requireNative();
  return invoke<string>('identity_verify_domain', { input: { domain, challenge } });
};
