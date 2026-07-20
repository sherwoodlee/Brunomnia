import { invoke, isTauri } from '@tauri-apps/api/core';

export type GgufModel = {
  name: string;
  size: number;
};

export type GgufModelCatalog = {
  directory: string;
  models: GgufModel[];
};

export type GgufGenerationInput = {
  model: string;
  prompt: string;
  temperature: number;
  topP: number;
  topK: number;
  seed: boolean;
  repeatPenalty: number;
};

const requireDesktop = () => {
  if (!isTauri()) throw new Error('Direct GGUF models require the Tauri desktop app.');
};

export const listGgufModels = async () => {
  requireDesktop();
  return invoke<GgufModelCatalog>('gguf_list_models');
};

export const openGgufModelsFolder = async () => {
  requireDesktop();
  return invoke<string>('gguf_open_models_folder');
};

export const generateGgufText = async (input: GgufGenerationInput) => {
  requireDesktop();
  return invoke<string>('gguf_generate_text', { input });
};
