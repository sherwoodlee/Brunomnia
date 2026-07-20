import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneSeedWorkspace } from '../data/seed';
import { generateAiText } from './ai';

const tauri = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
}));

vi.mock('@tauri-apps/api/core', () => tauri);

describe('GGUF AI generation', () => {
  beforeEach(() => {
    tauri.invoke.mockReset();
    tauri.isTauri.mockReturnValue(true);
  });

  it('dispatches the selected model and upstream-compatible sampling settings locally', async () => {
    tauri.invoke.mockResolvedValue('model response');
    const settings = {
      ...cloneSeedWorkspace().ai,
      enabled: true,
      provider: 'gguf' as const,
      model: 'local.gguf',
      temperature: 0.7,
      topP: 0.8,
      topK: 25,
      seed: false,
      repeatPenalty: 1.2,
    };

    await expect(generateAiText(settings, 'Return JSON.', undefined, {})).resolves.toBe('model response');
    expect(tauri.invoke).toHaveBeenCalledWith('gguf_generate_text', { input: {
      model: 'local.gguf',
      prompt: 'Return JSON.',
      temperature: 0.7,
      topP: 0.8,
      topK: 25,
      seed: false,
      repeatPenalty: 1.2,
    } });
  });

  it('rejects empty native output consistently with hosted providers', async () => {
    tauri.invoke.mockResolvedValue('   ');
    const settings = { ...cloneSeedWorkspace().ai, enabled: true, provider: 'gguf' as const, model: 'local.gguf' };
    await expect(generateAiText(settings, 'Return JSON.', undefined, {})).rejects.toThrow('did not return text');
  });
});
