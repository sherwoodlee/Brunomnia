import { invoke, isTauri } from '@tauri-apps/api/core';
import type { FilePayload } from '../types';

export const readDesktopScriptFile = async (path: string, allowedRoots: string[]): Promise<FilePayload> => {
  if (!isTauri()) throw new Error('Script file access requires the Tauri desktop app.');
  return invoke<FilePayload>('script_read_file', { path, allowedRoots });
};

export const readDesktopTemplateFile = async (path: string, allowedRoots: string[]): Promise<string> => {
  const file = await readDesktopScriptFile(path, allowedRoots);
  const bytes = Uint8Array.from(atob(file.dataBase64), (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};
