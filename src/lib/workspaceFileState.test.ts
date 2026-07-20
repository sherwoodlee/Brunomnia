import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import type { CookieRecord } from '../types';
import {
  getWorkspaceFileState,
  setWorkspaceFileCookies,
  updateWorkspaceFileState,
  workspaceFileIdForCollection,
  workspaceFileIdForEnvironment,
  workspaceFileIdForRequest,
} from './workspaceFileState';

describe('workspace-owned local state', () => {
  it('maps generated requests to their API design and environment children to their root file', () => {
    const workspace = cloneSeedWorkspace();
    const generated = workspace.collections[0];
    workspace.apiDesigns[0].generatedCollectionId = generated.id;

    expect(workspaceFileIdForCollection(workspace, generated.id)).toBe(workspace.apiDesigns[0].id);
    expect(workspaceFileIdForRequest(workspace, generated.requests[0].id)).toBe(workspace.apiDesigns[0].id);
    expect(workspaceFileIdForEnvironment(workspace, 'development')).toBe('base-environment');
  });

  it('updates one file without leaking cookies or certificates into another file', () => {
    const workspace = cloneSeedWorkspace();
    const firstId = workspace.collections[0].id;
    const secondId = workspace.collections[1].id;
    const cookie: CookieRecord = { id: 'cookie', name: 'sid', value: 'one', domain: 'api.example', path: '/', secure: true, httpOnly: true, sameSite: 'lax', hostOnly: true, createdAt: '2026-07-20T00:00:00.000Z' };
    const withCookies = setWorkspaceFileCookies(workspace, firstId, [cookie]);
    const withCertificate = updateWorkspaceFileState(withCookies, secondId, (state) => ({ ...state, certificates: { ca: { enabled: true, pem: 'second-ca' }, clients: [] } }));

    expect(getWorkspaceFileState(withCertificate, firstId)).toMatchObject({ cookies: [cookie], certificates: { ca: { enabled: false, pem: '' } } });
    expect(getWorkspaceFileState(withCertificate, secondId)).toMatchObject({ cookies: [], certificates: { ca: { enabled: true, pem: 'second-ca' } } });
    expect(workspace.fileState).toEqual({});
  });
});
