import { invoke, isTauri } from '@tauri-apps/api/core';
import type { FilePayload } from '../types';

export const readDesktopScriptFile = async (path: string): Promise<FilePayload> => {
  if (!isTauri()) throw new Error('Script file access requires the Tauri desktop app.');
  return invoke<FilePayload>('script_read_file', { path });
};
