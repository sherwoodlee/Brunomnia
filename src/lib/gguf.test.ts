import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateGgufText, listGgufModels, openGgufModelsFolder } from './gguf';

const tauri = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
}));

vi.mock('@tauri-apps/api/core', () => tauri);

describe('native GGUF adapter', () => {
  beforeEach(() => {
    tauri.invoke.mockReset();
    tauri.isTauri.mockReturnValue(true);
  });

  it('lists, opens, and generates through the bounded native commands', async () => {
    tauri.invoke
      .mockResolvedValueOnce({ directory: '/app/llms', models: [{ name: 'model.gguf', size: 42 }] })
      .mockResolvedValueOnce('/app/llms')
      .mockResolvedValueOnce('local output');

    await expect(listGgufModels()).resolves.toEqual({ directory: '/app/llms', models: [{ name: 'model.gguf', size: 42 }] });
    await expect(openGgufModelsFolder()).resolves.toBe('/app/llms');
    await expect(generateGgufText({ model: 'model.gguf', prompt: 'hello', temperature: 0.6, topP: 0.9, topK: 40, seed: true, repeatPenalty: 1.1 })).resolves.toBe('local output');
    expect(tauri.invoke).toHaveBeenNthCalledWith(1, 'gguf_list_models');
    expect(tauri.invoke).toHaveBeenNthCalledWith(2, 'gguf_open_models_folder');
    expect(tauri.invoke).toHaveBeenNthCalledWith(3, 'gguf_generate_text', { input: { model: 'model.gguf', prompt: 'hello', temperature: 0.6, topP: 0.9, topK: 40, seed: true, repeatPenalty: 1.1 } });
  });

  it('refuses direct models outside the desktop runtime', async () => {
    tauri.isTauri.mockReturnValue(false);
    await expect(listGgufModels()).rejects.toThrow('Tauri desktop app');
    await expect(openGgufModelsFolder()).rejects.toThrow('Tauri desktop app');
    await expect(generateGgufText({ model: 'model.gguf', prompt: 'hello', temperature: 0.6, topP: 0.9, topK: 40, seed: true, repeatPenalty: 1.1 })).rejects.toThrow('Tauri desktop app');
    expect(tauri.invoke).not.toHaveBeenCalled();
  });
});
