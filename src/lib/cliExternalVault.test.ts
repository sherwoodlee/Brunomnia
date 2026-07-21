import { describe, expect, it, vi } from 'vitest';
import { cliExternalVaultInvocation, createCliExternalSecretResolver, externalSecretReferenceKey } from '../../cli/externalVault';

describe('CLI external vault adapter', () => {
  it('builds the same bounded official CLI arguments as the desktop adapter', () => {
    expect(cliExternalVaultInvocation({ provider: 'aws', reference: 'orders', scope: 'us-west-2', version: 'AWSCURRENT' })).toMatchObject({ program: 'aws', args: ['secretsmanager', 'get-secret-value', '--secret-id', 'orders', '--output', 'json', '--region', 'us-west-2', '--version-stage', 'AWSCURRENT'] });
    expect(cliExternalVaultInvocation({ provider: 'gcp', reference: 'orders', scope: 'project', version: '' })).toMatchObject({ program: 'gcloud', args: ['secrets', 'versions', 'access', 'latest', '--secret=orders', '--project=project'] });
    expect(cliExternalVaultInvocation({ provider: 'azure', reference: 'orders', scope: 'vault', version: 'v1' })).toMatchObject({ program: 'az', args: ['keyvault', 'secret', 'show', '--vault-name', 'vault', '--name', 'orders', '--version', 'v1', '--query', 'value', '--output', 'tsv'] });
    expect(cliExternalVaultInvocation({ provider: 'hashicorp', reference: 'secret/orders' })).toMatchObject({ program: 'vault', args: ['kv', 'get', '-format=json', 'secret/orders'] });
    expect(() => cliExternalVaultInvocation({ provider: 'aws', reference: '--profile' })).toThrow('invalid');
    expect(() => cliExternalVaultInvocation({ provider: 'aws', reference: 'orders', credentialId: 'device-profile' })).toThrow('unavailable in the portable CLI');
  });

  it('enforces workspace approval, parses provider output, and caches values', async () => {
    const input = { provider: 'aws' as const, reference: 'orders', scope: 'us-west-2', field: '', version: '' };
    const execute = vi.fn(async () => '{"SecretString":"token"}');
    const resolve = createCliExternalSecretResolver([externalSecretReferenceKey(input)], execute);
    await expect(resolve(input)).resolves.toBe('token');
    await expect(resolve(input)).resolves.toBe('token');
    expect(execute).toHaveBeenCalledTimes(1);
    await expect(createCliExternalSecretResolver([], execute)(input)).rejects.toThrow('not approved');
    await expect(createCliExternalSecretResolver([], execute)({ ...input, credentialId: 'device-profile' })).rejects.toThrow('unavailable in the portable CLI');
  });

  it('decodes AWS binary and HashiCorp KV response shapes', () => {
    expect(cliExternalVaultInvocation({ provider: 'aws', reference: 'orders' }).parse('{"SecretBinary":"dG9rZW4="}')).toBe('token');
    expect(() => cliExternalVaultInvocation({ provider: 'aws', reference: 'orders' }).parse('{"SecretBinary":"/w=="}')).toThrow('not valid UTF-8');
    expect(cliExternalVaultInvocation({ provider: 'gcp', reference: 'orders' }).parse('gcp-token\n')).toBe('gcp-token');
    expect(cliExternalVaultInvocation({ provider: 'azure', reference: 'orders', scope: 'vault' }).parse('azure-token\n')).toBe('azure-token');
    expect(() => cliExternalVaultInvocation({ provider: 'gcp', reference: 'orders' }).parse('\n')).toThrow('empty secret');
    expect(cliExternalVaultInvocation({ provider: 'hashicorp', reference: 'secret/orders', field: 'token' }).parse('{"data":{"data":{"token":"secret"}}}')).toBe('secret');
  });

  it('evicts oldest values before the aggregate cache exceeds 20 MB', async () => {
    const inputs = ['one', 'two', 'three'].map((reference) => ({ provider: 'gcp' as const, reference }));
    const execute = vi.fn(async (_program: string, args: string[]) => `${args.find((arg) => arg.startsWith('--secret='))?.slice(9)}-${'x'.repeat(7_000_000)}`);
    const resolve = createCliExternalSecretResolver(inputs.map(externalSecretReferenceKey), execute);
    for (const input of inputs) await resolve(input);
    await resolve(inputs[0]);
    expect(execute).toHaveBeenCalledTimes(4);
  });
});
