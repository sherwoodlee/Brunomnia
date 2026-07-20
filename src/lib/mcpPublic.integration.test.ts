import { expect, it, vi } from 'vitest';
import type { McpClient } from '../types';
import { disconnectMcpClient, discoverMcpClient, forgetMcpClientSession, hasMcpClientSession, invokeMcpOperation } from './mcp';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: () => false }));

type PublicMcpFixture = {
  id: string;
  name: string;
  url: string;
  tool: string;
  parameters: Record<string, string>;
  stateful: boolean;
};

const fixtures: PublicMcpFixture[] = [
  {
    id: 'deepwiki',
    name: 'DeepWiki',
    url: 'https://mcp.deepwiki.com/mcp',
    tool: 'read_wiki_structure',
    parameters: { repoName: 'Kong/insomnia' },
    stateful: false,
  },
  {
    id: 'context7',
    name: 'Context7',
    url: 'https://mcp.context7.com/mcp',
    tool: 'resolve-library-id',
    parameters: { libraryName: 'React', query: 'Find the React documentation identifier.' },
    stateful: true,
  },
  {
    id: 'cloudflare-docs',
    name: 'Cloudflare Docs',
    url: 'https://docs.mcp.cloudflare.com/mcp',
    tool: 'search_cloudflare_documentation',
    parameters: { query: 'Workers KV consistency model' },
    stateful: false,
  },
];

const clientFor = (fixture: PublicMcpFixture): McpClient => ({
  id: `public-${fixture.id}`,
  name: fixture.name,
  enabled: true,
  transport: 'http',
  url: fixture.url,
  command: '',
  args: [],
  env: [],
  headers: [],
  authType: 'none',
  token: '',
  username: '',
  password: '',
  oauthAuthorizationUrl: '',
  oauthAccessTokenUrl: '',
  oauthClientId: '',
  oauthClientSecret: '',
  oauthScope: '',
  oauthState: '',
  oauthRefreshToken: '',
  oauthIdentityToken: '',
  oauthExpiresAt: 0,
  oauthTokenPrefix: 'Bearer',
  oauthRegisteredClientId: '',
  oauthRegisteredClientSecret: '',
  oauthRegisteredClientIdIssuedAt: 0,
  oauthRegisteredClientSecretExpiresAt: 0,
  oauthRegisteredTokenEndpointAuthMethod: 'none',
  roots: [],
  tools: [],
  prompts: [],
  resources: [],
  resourceTemplates: [],
});

const liveTest = process.env.BRUNOMNIA_MCP_LIVE === '1' ? it : it.skip;

for (const fixture of fixtures) {
  liveTest(`discovers and invokes the public ${fixture.name} MCP server`, async () => {
    const scope = `public-compatibility-${fixture.id}`;
    let client = clientFor(fixture);
    try {
      const discovered = await discoverMcpClient(client, undefined, { requestTimeoutMs: 30_000, sessionScope: scope });
      client = discovered.client;
      expect(client.tools.map((tool) => tool.name)).toContain(fixture.tool);
      expect(new Set(client.tools.map((tool) => tool.name)).size).toBe(client.tools.length);
      expect(hasMcpClientSession(client, scope)).toBe(true);

      const invoked = await invokeMcpOperation(client, 'tool', fixture.tool, fixture.parameters, undefined, { requestTimeoutMs: 30_000, sessionScope: scope });
      client = invoked.client;
      expect(invoked.result).toEqual(expect.objectContaining({ content: expect.any(Array) }));
      expect((invoked.result as { content: unknown[] }).content.length).toBeGreaterThan(0);
      expect(invoked.events).toContainEqual(expect.objectContaining({ direction: 'server', method: 'tools/call' }));

      const disconnected = await disconnectMcpClient(client, undefined, { requestTimeoutMs: 5_000, sessionScope: scope });
      expect(disconnected.terminated).toBe(fixture.stateful);
      expect(hasMcpClientSession(client, scope)).toBe(false);
    } finally {
      await disconnectMcpClient(client, undefined, { requestTimeoutMs: 5_000, sessionScope: scope }).catch(() => undefined);
      forgetMcpClientSession(client.id, scope);
    }
  }, 120_000);
}
