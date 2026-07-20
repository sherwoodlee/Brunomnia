import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { collectCliApiDesignSources, fetchPublicSpecificationSourceNode, isPrivateOrLoopbackHost } from './apiSpecSources';

describe('CLI API specification sources', () => {
  it('collects nested local specification and ruleset references under their selected roots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunomnia-spec-'));
    await mkdir(join(root, 'schemas'));
    await writeFile(join(root, 'openapi.yml'), 'openapi: 3.0.3\ninfo: { title: API, version: 1.0.0 }\npaths: {}\ncomponents:\n  schemas:\n    Pet: { $ref: ./schemas/pet.yaml#/Pet }\n');
    await writeFile(join(root, 'schemas', 'pet.yaml'), 'Pet: { $ref: ./common.json#/Pet }\n');
    await writeFile(join(root, 'schemas', 'common.json'), '{"Pet":{"type":"object"}}');
    await writeFile(join(root, '.spectral.yml'), 'extends: ./rules.yaml\n');
    await writeFile(join(root, 'rules.yaml'), 'extends: spectral:oas\n');

    const specification = await collectCliApiDesignSources(join(root, 'openapi.yml'), 'specification');
    expect(specification.files.map((file) => file.path).sort()).toEqual(['openapi.yaml', 'openapi.yml', 'schemas/common.json', 'schemas/pet.yaml']);
    const ruleset = await collectCliApiDesignSources(join(root, '.spectral.yml'), 'ruleset');
    expect(ruleset.files.map((file) => file.path).sort()).toEqual(['.spectral.yaml', '.spectral.yml', 'rules.yaml']);
  });

  it('rejects source symlinks that escape the selected root', async () => {
    if (process.platform === 'win32') return;
    const root = await mkdtemp(join(tmpdir(), 'brunomnia-spec-root-'));
    const outside = await mkdtemp(join(tmpdir(), 'brunomnia-spec-outside-'));
    await writeFile(join(outside, 'secret.yaml'), 'Secret: { type: string }\n');
    await symlink(join(outside, 'secret.yaml'), join(root, 'secret.yaml'));
    await writeFile(join(root, 'openapi.yaml'), 'openapi: 3.0.3\ninfo: { title: API, version: 1.0.0 }\npaths: {}\ncomponents: { schemas: { Secret: { $ref: ./secret.yaml#/Secret } } }\n');
    await expect(collectCliApiDesignSources(join(root, 'openapi.yaml'), 'specification')).rejects.toThrow(/through a symlink/);
  });

  it('blocks literal and DNS-resolved private hosts before remote fetch', async () => {
    for (const host of ['localhost', '127.0.0.1', '10.0.0.1', '192.168.1.1', '::', '::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'fd00::1', 'fe80::1']) expect(isPrivateOrLoopbackHost(host)).toBe(true);
    expect(isPrivateOrLoopbackHost('::ffff:8.8.8.8')).toBe(false);
    const fetchRemote = vi.fn(async () => new Response('openapi: 3.0.3'));
    await expect(fetchPublicSpecificationSourceNode('https://127.0.0.1/openapi.yaml', { fetchRemote })).rejects.toThrow(/private or loopback/);
    await expect(fetchPublicSpecificationSourceNode('https://public.example/openapi.yaml', {
      lookupHost: async () => [{ address: '127.0.0.1' }],
      fetchRemote,
    })).rejects.toThrow(/resolves to a private or loopback/);
    expect(fetchRemote).not.toHaveBeenCalled();
  });

  it('returns bounded UTF-8 from public HTTPS sources', async () => {
    await expect(fetchPublicSpecificationSourceNode('https://public.example/openapi.yaml', {
      lookupHost: async () => [{ address: '203.0.113.10' }],
      fetchRemote: async () => new Response('openapi: 3.0.3'),
    })).resolves.toBe('openapi: 3.0.3');
    await expect(fetchPublicSpecificationSourceNode('https://public.example/large.yaml', {
      lookupHost: async () => [{ address: '203.0.113.10' }],
      fetchRemote: async () => new Response('x'.repeat(1_000_001)),
    })).rejects.toThrow(/1 MB/);
  });
});
