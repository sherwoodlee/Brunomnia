import { beforeEach, describe, expect, it, vi } from 'vitest';

const tauri = vi.hoisted(() => ({ channels: [] as Array<{ onmessage?: (message: unknown) => void }>, invoke: vi.fn(), isTauri: vi.fn(() => true) }));
vi.mock('@tauri-apps/api/core', () => ({
  Channel: class {
    onmessage?: (message: unknown) => void;

    constructor() {
      tauri.channels.push(this);
    }
  },
  invoke: tauri.invoke,
  isTauri: tauri.isTauri,
}));

import { authenticateAzureExternalCredential, loadExternalCredentials, saveExternalCredentials, type ExternalCredentialRecord } from './security';

describe('protected external credential bridge', () => {
  beforeEach(() => {
    tauri.channels.length = 0;
    tauri.invoke.mockReset();
  });

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

  it('uses the dedicated native Azure browser and device-code authentication bridge', async () => {
    const credential = { type: 'azureOauth' as const, expiresOn: '2027-01-01T00:00:00Z', uniqueId: 'subscription', username: 'user@example.com', accessToken: 'token' };
    tauri.invoke.mockResolvedValue(credential);
    const statuses: string[] = [];
    const browser = authenticateAzureExternalCredential(false, (message) => statuses.push(message));
    tauri.channels[0].onmessage?.({ kind: 'status', message: 'Open the Azure browser.' });
    await expect(browser).resolves.toEqual(credential);
    await expect(authenticateAzureExternalCredential(true)).resolves.toEqual(credential);
    expect(statuses).toEqual(['Open the Azure browser.']);
    expect(tauri.invoke.mock.calls).toEqual([
      ['external_credential_azure_authenticate', { useDeviceCode: false, onEvent: tauri.channels[0] }],
      ['external_credential_azure_authenticate', { useDeviceCode: true, onEvent: tauri.channels[1] }],
    ]);
  });
});
