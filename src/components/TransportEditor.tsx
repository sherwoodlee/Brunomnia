import { useRef, useState } from 'react';
import { base64ByteLength, readPfxFile } from '../lib/certificates';
import type { ApiRequest } from '../types';

type ChangeRequest = (patch: Partial<ApiRequest>) => void;

export function TransportEditor({ request, globalTimeoutMs, onChange }: { request: ApiRequest; globalTimeoutMs: number; onChange: ChangeRequest }) {
  const transport = request.transport;
  const pfxInput = useRef<HTMLInputElement>(null);
  const [certificateError, setCertificateError] = useState('');
  const update = (patch: Partial<ApiRequest['transport']>) => onChange({ transport: { ...transport, ...patch } });
  const importPfx = async (file: File | undefined) => {
    try {
      const clientCertificatePfxBase64 = await readPfxFile(file);
      if (!clientCertificatePfxBase64) return;
      setCertificateError('');
      update({ clientCertificatePfxBase64, clientCertificatePem: '', clientKeyPem: '' });
    } catch (caught) {
      setCertificateError(caught instanceof Error ? caught.message : String(caught));
    }
  };
  return (
    <div className="transport-editor">
      <div className="transport-grid">
        <label>Request timeout<select value={transport.timeoutMode} onChange={(event) => update({ timeoutMode: event.target.value as typeof transport.timeoutMode })}><option value="global">Use Preferences ({globalTimeoutMs.toLocaleString()} ms)</option><option value="custom">Custom</option></select></label>
        <label>Custom timeout (ms)<input disabled={transport.timeoutMode !== 'custom'} min="0" step="1" type="number" value={transport.timeoutMs} onChange={(event) => update({ timeoutMs: Math.min(2_147_483_647, Math.max(0, Number(event.target.value) || 0)) })} /><small>0 disables the deadline</small></label>
        <label>Proxy policy<select value={transport.proxyMode} onChange={(event) => update({ proxyMode: event.target.value as typeof transport.proxyMode })}><option value="global">Use Preferences</option><option value="custom">Custom</option><option value="disabled">Direct connection</option></select></label>
        <label>Custom proxy URL<input disabled={transport.proxyMode !== 'custom'} placeholder="http://127.0.0.1:8080" spellCheck={false} value={transport.proxyUrl} onChange={(event) => update({ proxyUrl: event.target.value })} /></label>
        <label>Custom proxy exclusions<input disabled={transport.proxyMode !== 'custom'} placeholder="localhost, .example.com, 10.0.0.0/8" spellCheck={false} value={transport.proxyExclusions} onChange={(event) => update({ proxyExclusions: event.target.value })} /></label>
        <label>Certificate domains<input placeholder="api.example.com, *.internal.example" spellCheck={false} value={transport.clientCertificateDomains} onChange={(event) => update({ clientCertificateDomains: event.target.value })} /></label>
      </div>
      <div className="transport-switches">
        <label><span>Follow HTTP redirects</span><select value={transport.followRedirectsMode} onChange={(event) => { const followRedirectsMode = event.target.value as typeof transport.followRedirectsMode; update({ followRedirectsMode, followRedirects: followRedirectsMode !== 'off' }); }}><option value="global">Use Preferences</option><option value="on">Always</option><option value="off">Never</option></select></label>
        <label><span>Validate server certificates</span><select value={transport.validateCertificatesMode} onChange={(event) => { const validateCertificatesMode = event.target.value as typeof transport.validateCertificatesMode; update({ validateCertificatesMode, validateCertificates: validateCertificatesMode !== 'off' }); }}><option value="global">Use Preferences</option><option value="on">Always</option><option value="off">Never</option></select></label>
        <label><input checked={transport.sendCookies} type="checkbox" onChange={(event) => update({ sendCookies: event.target.checked })} /><span>Send matching workspace cookies</span></label>
        <label><input checked={transport.storeCookies} type="checkbox" onChange={(event) => update({ storeCookies: event.target.checked })} /><span>Store response cookies</span></label>
      </div>
      <div className="certificate-grid">
        <label>Client certificate (PEM)<textarea aria-label="Client certificate PEM" disabled={Boolean(transport.clientCertificatePfxBase64)} placeholder="-----BEGIN CERTIFICATE-----" value={transport.clientCertificatePem} onChange={(event) => update({ clientCertificatePem: event.target.value, clientCertificatePfxBase64: '' })} /></label>
        <label>Client private key (PEM)<textarea aria-label="Client private key PEM" disabled={Boolean(transport.clientCertificatePfxBase64)} placeholder="-----BEGIN PRIVATE KEY-----" value={transport.clientKeyPem} onChange={(event) => update({ clientKeyPem: event.target.value, clientCertificatePfxBase64: '' })} /></label>
      </div>
      <div className="transport-pfx"><div><strong>{transport.clientCertificatePfxBase64 ? 'PFX / PKCS#12 identity loaded' : 'PEM or PFX passphrase'}</strong><small>{transport.clientCertificatePfxBase64 ? `${base64ByteLength(transport.clientCertificatePfxBase64).toLocaleString()} bytes` : 'Supports encrypted PKCS#8 and legacy PEM private keys'}</small></div><label>Passphrase<input autoComplete="off" disabled={!transport.clientCertificatePfxBase64 && !transport.clientKeyPem.trim()} type="password" value={transport.clientCertificatePassphrase} onChange={(event) => update({ clientCertificatePassphrase: event.target.value })} /></label><button onClick={() => pfxInput.current?.click()} type="button">Import PFX</button>{transport.clientCertificatePfxBase64 ? <button onClick={() => update({ clientCertificatePfxBase64: '', clientCertificatePassphrase: '' })} type="button">Clear</button> : null}<input accept=".p12,.pfx,application/x-pkcs12" hidden ref={pfxInput} type="file" onChange={(event) => { void importPfx(event.target.files?.[0]); event.target.value = ''; }} /></div>
      {certificateError ? <p className="transport-note error">{certificateError}</p> : <p className="transport-note">Request-local PEM or PFX overrides the workspace certificate manager. Transport secrets export only when you explicitly export this workspace.</p>}
    </div>
  );
}
