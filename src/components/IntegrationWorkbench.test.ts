import { describe, expect, it } from 'vitest';
import { integrationSecretInputType, mcpOperationDraftKey, withMcpParameterDraft } from './IntegrationWorkbench';

describe('integration credential visibility', () => {
  it('masks credentials by default', () => {
    expect(integrationSecretInputType(false, false)).toBe('password');
  });

  it('reveals every credential through the device preference', () => {
    expect(integrationSecretInputType(true, false)).toBe('text');
  });

  it('allows one credential to be revealed without changing the preference', () => {
    expect(integrationSecretInputType(false, true)).toBe('text');
  });

  it('isolates MCP parameter drafts by client, primitive family, and name', () => {
    expect(mcpOperationDraftKey('client-a', 'tool', 'search')).not.toBe(mcpOperationDraftKey('client-b', 'tool', 'search'));
    expect(mcpOperationDraftKey('client-a', 'tool', 'search')).not.toBe(mcpOperationDraftKey('client-a', 'prompt', 'search'));
    let drafts: Record<string, string> = {};
    for (let index = 0; index < 1002; index += 1) drafts = withMcpParameterDraft(drafts, `draft-${index}`, String(index));
    expect(Object.keys(drafts)).toHaveLength(1000);
    expect(drafts['draft-0']).toBeUndefined();
    expect(drafts['draft-1001']).toBe('1001');
  });
});
