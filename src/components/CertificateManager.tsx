import { useRef, useState } from 'react';
import type { WorkspaceCertificates } from '../types';
import { MAX_CA_CERTIFICATE_TEXT_BYTES, MAX_CERTIFICATE_TEXT_BYTES, MAX_WORKSPACE_CLIENT_CERTIFICATES } from '../lib/certificates';
import { Icon } from './Icon';

type CertificateManagerProps = {
  certificates: WorkspaceCertificates;
  canEdit: boolean;
  onChange: (certificates: WorkspaceCertificates) => void;
};

const readTextFile = async (file: File | undefined, maxBytes: number) => {
  if (!file) return '';
  if (file.size > maxBytes) throw new Error(`Certificate files cannot exceed ${(maxBytes / 1_048_576).toLocaleString()} MiB.`);
  return file.text();
};

export function CertificateManager({ certificates, canEdit, onChange }: CertificateManagerProps) {
  const caInput = useRef<HTMLInputElement>(null);
  const certificateInput = useRef<HTMLInputElement>(null);
  const keyInput = useRef<HTMLInputElement>(null);
  const [host, setHost] = useState('');
  const [certificatePem, setCertificatePem] = useState('');
  const [keyPem, setKeyPem] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const updateCa = (patch: Partial<WorkspaceCertificates['ca']>) => onChange({ ...certificates, ca: { ...certificates.ca, ...patch } });
  const updateCaPem = (pem: string) => {
    if (new Blob([pem]).size > MAX_CA_CERTIFICATE_TEXT_BYTES) { setError('CA certificate text cannot exceed 5 MiB.'); return; }
    setError(''); updateCa({ pem, enabled: pem.trim() ? certificates.ca.enabled : false });
  };
  const importFile = async (file: File | undefined, maxBytes: number, apply: (text: string) => void) => {
    try {
      const text = await readTextFile(file, maxBytes);
      if (!text) return;
      apply(text); setError(''); setMessage(`Imported ${file?.name ?? 'certificate file'}.`);
    } catch (caught) {
      setMessage(''); setError(caught instanceof Error ? caught.message : String(caught));
    }
  };
  const addClient = () => {
    if (!canEdit) return;
    if (!host.trim() || !certificatePem.trim() || !keyPem.trim()) {
      setError('Enter a host, certificate PEM, and private key PEM.'); return;
    }
    if (new Blob([certificatePem]).size > MAX_CERTIFICATE_TEXT_BYTES || new Blob([keyPem]).size > MAX_CERTIFICATE_TEXT_BYTES) {
      setError('Client certificate and private key text must each be 1 MiB or smaller.'); return;
    }
    if (certificates.clients.length >= MAX_WORKSPACE_CLIENT_CERTIFICATES) {
      setError(`Workspaces cannot exceed ${MAX_WORKSPACE_CLIENT_CERTIFICATES} client certificates.`); return;
    }
    onChange({
      ...certificates,
      clients: [...certificates.clients, { id: `workspace-certificate-${crypto.randomUUID()}`, host: host.trim(), enabled: true, certificatePem, keyPem }],
    });
    setHost(''); setCertificatePem(''); setKeyPem(''); setError(''); setMessage('Client certificate added.');
  };
  return (
    <div className="security-grid certificate-manager-grid">
      <section className="security-card certificate-authority-card">
        <header><div><small>Workspace trust store</small><h2>CA Certificate</h2></div><label className="certificate-enable"><input checked={certificates.ca.enabled} disabled={!canEdit || !certificates.ca.pem.trim()} onChange={(event) => updateCa({ enabled: event.target.checked })} type="checkbox" /> Enabled</label></header>
        <textarea aria-label="Workspace CA certificate PEM" disabled={!canEdit} onChange={(event) => updateCaPem(event.target.value)} placeholder="-----BEGIN CERTIFICATE-----" value={certificates.ca.pem} />
        <div className="certificate-actions"><button disabled={!canEdit} onClick={() => caInput.current?.click()} type="button"><Icon name="import" size={13} />Import PEM</button><button disabled={!canEdit || !certificates.ca.pem} onClick={() => updateCa({ enabled: false, pem: '' })} type="button"><Icon name="trash" size={13} />Clear</button></div>
        <input accept=".pem,.crt,.cer" hidden ref={caInput} type="file" onChange={(event) => { void importFile(event.target.files?.[0], MAX_CA_CERTIFICATE_TEXT_BYTES, (pem) => updateCa({ pem, enabled: true })); event.target.value = ''; }} />
        <p>Enabled CA certificates extend native roots for API, authentication, realtime, and gRPC TLS validation.</p>
      </section>

      <section className="security-card certificate-add-card">
        <header><div><small>PEM identity</small><h2>Add Client Certificate</h2></div><span>{certificates.clients.length}/{MAX_WORKSPACE_CLIENT_CERTIFICATES}</span></header>
        <label>Host<input disabled={!canEdit} maxLength={512} onChange={(event) => setHost(event.target.value)} placeholder="api.example.com:443 or *.example.com" value={host} /></label>
        <label>Certificate PEM<textarea disabled={!canEdit} onChange={(event) => setCertificatePem(event.target.value)} placeholder="-----BEGIN CERTIFICATE-----" value={certificatePem} /></label>
        <label>Private key PEM<textarea disabled={!canEdit} onChange={(event) => setKeyPem(event.target.value)} placeholder="-----BEGIN PRIVATE KEY-----" value={keyPem} /></label>
        <div className="certificate-actions"><button disabled={!canEdit} onClick={() => certificateInput.current?.click()} type="button"><Icon name="import" size={13} />Certificate file</button><button disabled={!canEdit} onClick={() => keyInput.current?.click()} type="button"><Icon name="import" size={13} />Key file</button><button disabled={!canEdit} onClick={addClient} type="button"><Icon name="plus" size={13} />Add identity</button></div>
        <input accept=".pem,.crt,.cer" hidden ref={certificateInput} type="file" onChange={(event) => { void importFile(event.target.files?.[0], MAX_CERTIFICATE_TEXT_BYTES, setCertificatePem); event.target.value = ''; }} />
        <input accept=".pem,.key" hidden ref={keyInput} type="file" onChange={(event) => { void importFile(event.target.files?.[0], MAX_CERTIFICATE_TEXT_BYTES, setKeyPem); event.target.value = ''; }} />
      </section>

      <section className="security-card certificate-list-card">
        <header><div><small>Host and port matched</small><h2>Client Certificates</h2></div><span>{certificates.clients.filter((client) => client.enabled).length} enabled</span></header>
        <div className="certificate-list">{certificates.clients.map((client) => <article key={client.id}><div><strong>{client.host}</strong><small>{client.certificatePem.includes('BEGIN CERTIFICATE') ? 'PEM certificate' : 'Certificate text'} · {client.keyPem.includes('PRIVATE KEY') ? 'PEM private key' : 'Key text'}</small></div><label><input checked={client.enabled} disabled={!canEdit} onChange={(event) => onChange({ ...certificates, clients: certificates.clients.map((candidate) => candidate.id === client.id ? { ...candidate, enabled: event.target.checked } : candidate) })} type="checkbox" />{client.enabled ? 'Enabled' : 'Disabled'}</label><button aria-label={`Delete certificate ${client.host}`} disabled={!canEdit} onClick={() => onChange({ ...certificates, clients: certificates.clients.filter((candidate) => candidate.id !== client.id) })} type="button"><Icon name="trash" size={13} /></button></article>)}{!certificates.clients.length ? <p>No workspace client certificates. Request-local PEM identity fields remain available in Transport.</p> : null}</div>
        <p>Port-specific matches win first; if none match, Brunomnia retries by hostname like Insomnia. PFX/PKCS#12 identities remain a separate compatibility gap.</p>
      </section>
      {error ? <div className="automation-message error">{error}</div> : message ? <div className="automation-message">{message}</div> : null}
    </div>
  );
}
