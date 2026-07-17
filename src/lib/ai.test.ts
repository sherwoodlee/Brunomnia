import { describe, expect, it } from 'vitest';
import { generateAiText, parseAiJson } from './ai';

describe('AI structured output parsing', () => {
  it('accepts plain and fenced JSON without evaluating code', () => {
    expect(parseAiJson('{"ok":true}')).toEqual({ ok: true });
    expect(parseAiJson('```json\n{"routes":[]}\n```')).toEqual({ routes: [] });
  });

  it('extracts the first structured payload from explanatory text', () => {
    expect(parseAiJson('Here is the result: {"groups":[{"message":"feat: add route"}]} done.')).toEqual({ groups: [{ message: 'feat: add route' }] });
  });

  it('rejects hosted plaintext API keys before any provider request', async () => {
    await expect(generateAiText({ enabled: true, provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-test', apiKey: 'plaintext', mockGeneration: false, commitSuggestions: false }, 'test', undefined, {})).rejects.toThrow('complete local-vault');
  });
});
