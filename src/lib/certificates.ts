import type { TransportConfig, WorkspaceCertificates, WorkspaceClientCertificate } from '../types';

export const MAX_WORKSPACE_CLIENT_CERTIFICATES = 100;
export const MAX_CERTIFICATE_TEXT_BYTES = 1_048_576;
export const MAX_CA_CERTIFICATE_TEXT_BYTES = 5_242_880;
export const MAX_CERTIFICATE_PFX_BYTES = 5_242_880;
export const MAX_CERTIFICATE_PASSPHRASE_BYTES = 4_096;
export const MAX_CERTIFICATE_HOST_LENGTH = 512;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const byteLength = (value: string) => encoder.encode(value).byteLength;
const truncateBytes = (value: string, limit: number) => {
  const bytes = encoder.encode(value);
  if (bytes.byteLength <= limit) return value;
  let end = limit;
  let truncated = decoder.decode(bytes.slice(0, end));
  while (byteLength(truncated) > limit && end > 0) truncated = decoder.decode(bytes.slice(0, --end));
  return truncated;
};

const record = (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
const stringValue = (value: unknown) => typeof value === 'string' ? value : '';
export const base64ByteLength = (value: string) => {
  const base64 = value.trim();
  if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) return -1;
  return Math.floor(base64.length * 3 / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
};

export const readPfxFile = async (file: File | undefined) => {
  if (!file) return '';
  if (file.size > MAX_CERTIFICATE_PFX_BYTES) throw new Error('PFX/PKCS#12 files cannot exceed 5 MiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32_768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  return btoa(binary);
};

export const normalizeCertificatePfxBase64 = (value: unknown) => {
  const pfxBase64 = stringValue(value).trim();
  const bytes = base64ByteLength(pfxBase64);
  return bytes >= 0 && bytes <= MAX_CERTIFICATE_PFX_BYTES ? pfxBase64 : '';
};

export const normalizeCertificatePassphrase = (value: unknown) => truncateBytes(stringValue(value), MAX_CERTIFICATE_PASSPHRASE_BYTES);

const hasClientIdentity = (client: Pick<WorkspaceClientCertificate, 'certificatePem' | 'keyPem' | 'pfxBase64'>) => Boolean(client.pfxBase64 || (client.certificatePem.trim() && client.keyPem.trim()));

export const normalizeWorkspaceCertificates = (value: unknown): WorkspaceCertificates => {
  const source = record(value);
  const ca = record(source?.ca);
  const caPem = truncateBytes(stringValue(ca?.pem), MAX_CA_CERTIFICATE_TEXT_BYTES);
  const ids = new Set<string>();
  const clients = (Array.isArray(source?.clients) ? source.clients : []).flatMap((value, index): WorkspaceClientCertificate[] => {
    const client = record(value);
    const host = stringValue(client?.host).trim().slice(0, MAX_CERTIFICATE_HOST_LENGTH);
    if (!client || !host) return [];
    const requestedId = stringValue(client.id).trim().slice(0, 256) || `workspace-certificate-${index}`;
    let id = requestedId;
    let suffix = 1;
    while (ids.has(id)) id = `workspace-certificate-${index}-${suffix++}`;
    ids.add(id);
    const pfxBase64 = normalizeCertificatePfxBase64(client.pfxBase64);
    return [{
      id,
      host,
      enabled: client.enabled !== false,
      certificatePem: pfxBase64 ? '' : truncateBytes(stringValue(client.certificatePem), MAX_CERTIFICATE_TEXT_BYTES),
      keyPem: pfxBase64 ? '' : truncateBytes(stringValue(client.keyPem), MAX_CERTIFICATE_TEXT_BYTES),
      pfxBase64,
      passphrase: normalizeCertificatePassphrase(client.passphrase),
    }];
  }).slice(0, MAX_WORKSPACE_CLIENT_CERTIFICATES);
  return {
    ca: {
      enabled: ca?.enabled === true && Boolean(caPem.trim()),
      pem: caPem,
    },
    clients,
  };
};

const wildcardPattern = (value: string) => new RegExp(`^${value.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i');

export const certificateHostMatches = (certificateHost: string, requestUrl: string, checkPort = true) => {
  let request: URL;
  let certificate: URL;
  try {
    request = new URL(requestUrl);
    certificate = new URL(certificateHost.includes('://') ? certificateHost : `https://${certificateHost}`);
  } catch {
    return false;
  }
  const certificateHostname = decodeURIComponent(certificate.hostname);
  const certificatePort = decodeURIComponent(certificate.port);
  const requestPort = request.port;
  if (checkPort) {
    if (certificatePort.includes('*')) {
      if (!wildcardPattern(certificatePort).test(requestPort)) return false;
    } else if ((Number(certificatePort) || 443) !== (Number(requestPort) || 443)) return false;
  }
  return wildcardPattern(certificateHostname).test(request.hostname);
};

export const selectWorkspaceClientCertificate = (certificates: WorkspaceCertificates, requestUrl: string) => {
  const enabled = certificates.clients.filter((certificate) => certificate.enabled && hasClientIdentity(certificate));
  return enabled.find((certificate) => certificateHostMatches(certificate.host, requestUrl, true))
    ?? enabled.find((certificate) => certificateHostMatches(certificate.host, requestUrl, false));
};

export const applyWorkspaceCertificates = <Transport extends Pick<TransportConfig, 'clientCertificatePem' | 'clientKeyPem' | 'clientCertificatePfxBase64' | 'clientCertificatePassphrase' | 'clientCertificateDomains' | 'caCertificatePem'>>(
  transport: Transport,
  requestUrl: string,
  certificates?: WorkspaceCertificates,
): Transport => {
  if (!certificates) return transport;
  const selected = transport.clientCertificatePem.trim() || transport.clientKeyPem.trim() || transport.clientCertificatePfxBase64.trim()
    ? undefined
    : selectWorkspaceClientCertificate(certificates, requestUrl);
  const caCertificatePem = transport.caCertificatePem.trim()
    ? transport.caCertificatePem
    : certificates.ca.enabled ? certificates.ca.pem : '';
  return {
    ...transport,
    caCertificatePem,
    ...(selected ? {
      clientCertificatePem: selected.certificatePem,
      clientKeyPem: selected.keyPem,
      clientCertificatePfxBase64: selected.pfxBase64,
      clientCertificatePassphrase: selected.passphrase,
      clientCertificateDomains: '',
    } : {}),
  } as Transport;
};

export const emptyWorkspaceCertificates = (): WorkspaceCertificates => ({ ca: { enabled: false, pem: '' }, clients: [] });
