import { describe, expect, it } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { applyWorkspaceCertificates, certificateHostMatches, normalizeWorkspaceCertificates, selectWorkspaceClientCertificate } from './certificates';

describe('workspace certificates', () => {
  it('matches upstream-style wildcard hosts and prefers exact ports before host fallback', () => {
    expect(certificateHostMatches('*.example.test:8443', 'grpcs://api.example.test:8443')).toBe(true);
    expect(certificateHostMatches('*.example.test:8443', 'grpcs://api.example.test:9443')).toBe(false);
    const certificates = normalizeWorkspaceCertificates({ clients: [
      { id: 'host', host: '*.example.test', certificatePem: 'host-cert', keyPem: 'host-key' },
      { id: 'port', host: 'api.example.test:9443', pfxBase64: 'cGZ4', passphrase: 'secret' },
    ] });
    expect(selectWorkspaceClientCertificate(certificates, 'grpcs://api.example.test:9443')?.id).toBe('port');
    expect(selectWorkspaceClientCertificate(certificates, 'grpcs://other.example.test:7443')?.id).toBe('host');
  });

  it('injects enabled CA and selected identity without overriding explicit request material', () => {
    const request = cloneSeedWorkspace().collections[0].requests[0];
    const certificates = normalizeWorkspaceCertificates({
      ca: { enabled: true, pem: 'ca-pem' },
      clients: [{ id: 'client', host: 'api.example.test', certificatePem: 'workspace-cert', keyPem: 'workspace-key' }],
    });
    expect(applyWorkspaceCertificates(request.transport, 'https://api.example.test', certificates)).toMatchObject({
      caCertificatePem: 'ca-pem', clientCertificatePem: 'workspace-cert', clientKeyPem: 'workspace-key',
    });
    request.transport.clientCertificatePem = 'request-cert';
    request.transport.clientKeyPem = 'request-key';
    expect(applyWorkspaceCertificates(request.transport, 'https://api.example.test', certificates)).toMatchObject({
      caCertificatePem: 'ca-pem', clientCertificatePem: 'request-cert', clientKeyPem: 'request-key',
    });
  });

  it('selects PFX identities and preserves request-local PFX precedence', () => {
    const request = cloneSeedWorkspace().collections[0].requests[0];
    const certificates = normalizeWorkspaceCertificates({ clients: [{ id: 'client', host: 'api.example.test', pfxBase64: 'cGZ4', passphrase: 'workspace-secret' }] });
    expect(applyWorkspaceCertificates(request.transport, 'https://api.example.test', certificates)).toMatchObject({
      clientCertificatePfxBase64: 'cGZ4', clientCertificatePassphrase: 'workspace-secret', clientCertificatePem: '', clientKeyPem: '',
    });
    request.transport.clientCertificatePfxBase64 = 'bG9jYWw=';
    request.transport.clientCertificatePassphrase = 'request-secret';
    expect(applyWorkspaceCertificates(request.transport, 'https://api.example.test', certificates)).toMatchObject({
      clientCertificatePfxBase64: 'bG9jYWw=', clientCertificatePassphrase: 'request-secret',
    });
  });

  it('bounds malformed imported records and disables an incomplete authority by default', () => {
    const normalized = normalizeWorkspaceCertificates({
      ca: { enabled: 'yes', pem: 'ca' },
      clients: [null, { host: '', certificatePem: 'ignored' }, { host: 'valid.test', certificatePem: 'cert', keyPem: 'key' }, { host: 'pfx.test', certificatePem: 'ignored', keyPem: 'ignored', pfxBase64: 'cGZ4' }],
    });
    expect(normalized.ca).toEqual({ enabled: false, pem: 'ca' });
    expect(normalized.clients).toEqual([
      expect.objectContaining({ host: 'valid.test', enabled: true, pfxBase64: '' }),
      expect.objectContaining({ host: 'pfx.test', certificatePem: '', keyPem: '', pfxBase64: 'cGZ4' }),
    ]);
  });
});
