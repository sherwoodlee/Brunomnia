import { beforeEach, describe, expect, it, vi } from 'vitest';

const tauri = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn(() => true) }));
vi.mock('@tauri-apps/api/core', () => tauri);

import { loadExternalCredentials, saveExternalCredentials, type ExternalCredentialRecord } from './security';

describe('protected external credential bridge', () => {
  beforeEach(() => tauri.invoke.mockReset());

  it('loads and saves exact non-syncable profile records through native commands', async () => {
    const records: ExternalCredentialRecord[] = [{
      id: 'aws-one', name: 'Production AWS', provider: 'aws',
      credentials: { type: 'awsTemporary', accessKeyId: 'key', secretAccessKey: 'secret', sessionToken: 'session', region: 'us-west-2' },
    }];
    tauri.invoke.mockResolvedValue(records);
    await expect(loadExternalCredentials()).resolves.toEqual(records);
    await expect(saveExternalCredentials(records)).resolves.toEqual(records);
    expect(tauri.invoke.mock.calls).toEqual([
      ['external_credential_store_load'],
      ['external_credential_store_save', { credentials: records }],
    ]);
  });
});
