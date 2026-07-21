import { execFile } from 'node:child_process';

export type CliExternalSecretInput = {
  provider: 'aws' | 'gcp' | 'azure' | 'hashicorp';
  reference: string;
  scope?: string;
  field?: string;
  version?: string;
  credentialId?: string;
  appName?: string;
};

export type CliExternalVaultInvocation = {
  program: string;
  args: string[];
  label: string;
  parse: (stdout: string) => string;
};

type ExecuteCli = (program: string, args: string[], label: string) => Promise<string>;

const MAX_OUTPUT_BYTES = 10_000_000;
const MAX_CACHE_BYTES = 20_000_000;
const MAX_CACHE_ENTRIES = 256;
const CACHE_MS = 30 * 60 * 1_000;

const required = (value: string | undefined, label: string) => {
  const normalized = value?.trim() ?? '';
  if (!normalized) throw new Error(`Enter an external vault ${label}.`);
  if (normalized.startsWith('-') || normalized.includes('\0')) throw new Error(`The external vault ${label} is invalid.`);
  return normalized;
};

const optional = (value: string | undefined, label: string) => value?.trim() ? required(value, label) : '';

const nonempty = (value: string, provider: string) => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`The ${provider} CLI returned an empty secret.`);
  return normalized;
};

const awsValue = (source: string) => {
  let value: { SecretString?: unknown; SecretBinary?: unknown };
  try { value = JSON.parse(source) as typeof value; }
  catch (error) { throw new Error(`AWS returned invalid secret JSON: ${error instanceof Error ? error.message : String(error)}`); }
  if (typeof value.SecretString === 'string') return value.SecretString;
  if (typeof value.SecretBinary === 'string') {
    const decoded = Buffer.from(value.SecretBinary, 'base64');
    if (decoded.toString('base64').replace(/=+$/, '') !== value.SecretBinary.replace(/=+$/, '')) throw new Error('AWS returned invalid base64 secret bytes.');
    try { return new TextDecoder('utf-8', { fatal: true }).decode(decoded); }
    catch { throw new Error('AWS returned secret bytes that are not valid UTF-8.'); }
  }
  throw new Error('AWS did not return SecretString or SecretBinary.');
};

const hashicorpValue = (source: string, field: string) => {
  let value: unknown;
  try { value = JSON.parse(source) as unknown; }
  catch (error) { throw new Error(`HashiCorp Vault returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const outer = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : {};
  const data = outer.data && typeof outer.data === 'object' ? outer.data as Record<string, unknown> : outer;
  const key = field || 'value';
  if (!Object.hasOwn(data, key)) throw new Error(`HashiCorp Vault response has no '${key}' field.`);
  return typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
};

export const externalSecretReferenceKey = (input: CliExternalSecretInput) => `v1:${[input.provider, input.reference, input.scope, input.field, input.version]
  .map((value) => encodeURIComponent(value?.trim() ?? ''))
  .join(':')}`;

export const cliExternalVaultInvocation = (input: CliExternalSecretInput): CliExternalVaultInvocation => {
  if (input.credentialId?.trim() || input.appName?.trim()) throw new Error('Device-local external-vault profiles are unavailable in the portable CLI. Use an ambient official CLI credential chain and approve that unprofiled reference separately.');
  const reference = required(input.reference, 'secret reference');
  const scope = optional(input.scope, 'scope');
  const version = optional(input.version, 'version');
  const field = optional(input.field, 'field');
  if (input.provider === 'aws') return {
    program: 'aws', label: 'AWS',
    args: ['secretsmanager', 'get-secret-value', '--secret-id', reference, '--output', 'json', ...(scope ? ['--region', scope] : []), ...(version ? ['--version-stage', version] : [])],
    parse: awsValue,
  };
  if (input.provider === 'gcp') return {
    program: 'gcloud', label: 'GCP',
    args: ['secrets', 'versions', 'access', version || 'latest', `--secret=${reference}`, ...(scope ? [`--project=${scope}`] : [])],
    parse: (source) => nonempty(source, 'GCP'),
  };
  if (input.provider === 'azure') return {
    program: 'az', label: 'Azure',
    args: ['keyvault', 'secret', 'show', '--vault-name', required(scope, 'Azure vault name'), '--name', reference, ...(version ? ['--version', version] : []), '--query', 'value', '--output', 'tsv'],
    parse: (source) => nonempty(source, 'Azure'),
  };
  if (input.provider === 'hashicorp') return {
    program: 'vault', label: 'HashiCorp Vault', args: ['kv', 'get', '-format=json', reference],
    parse: (source) => hashicorpValue(source, field),
  };
  throw new Error('Choose AWS, GCP, Azure, or HashiCorp as the external vault provider.');
};

const executeCli: ExecuteCli = (program, args, label) => new Promise((resolve, reject) => {
  execFile(program, args, { encoding: 'utf8', maxBuffer: MAX_OUTPUT_BYTES, timeout: 30_000, windowsHide: true }, (error, stdout, stderr) => {
    if (error) {
      const detail = String(stderr || stdout || error.message).trim();
      reject(new Error(`The ${label} CLI failed: ${detail}`));
      return;
    }
    resolve(stdout);
  });
});

export const createCliExternalSecretResolver = (allowlist: string[], execute: ExecuteCli = executeCli) => {
  const cache = new Map<string, { bytes: number; storedAt: number; value: string }>();
  return async (input: CliExternalSecretInput) => {
    if (input.credentialId?.trim() || input.appName?.trim()) throw new Error('Device-local external-vault profiles are unavailable in the portable CLI. Use an ambient official CLI credential chain and approve that unprofiled reference separately.');
    const key = externalSecretReferenceKey(input);
    if (!allowlist.includes(key)) throw new Error(`External vault reference '${key}' is not approved by workspace policy.`);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.storedAt < CACHE_MS) return cached.value;
    if (cached) cache.delete(key);
    const invocation = cliExternalVaultInvocation(input);
    const value = invocation.parse(await execute(invocation.program, invocation.args, invocation.label));
    const bytes = Buffer.byteLength(value);
    if (bytes <= MAX_CACHE_BYTES) {
      const cacheBytes = () => [...cache.values()].reduce((total, entry) => total + entry.bytes, 0);
      while (cache.size && (cache.size >= MAX_CACHE_ENTRIES || cacheBytes() + bytes > MAX_CACHE_BYTES)) {
        cache.delete(cache.keys().next().value as string);
      }
      cache.set(key, { bytes, storedAt: Date.now(), value });
    }
    return value;
  };
};
