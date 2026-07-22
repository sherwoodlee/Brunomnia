import { Channel, invoke, isTauri } from '@tauri-apps/api/core';

export const UPDATE_CHECK_INTERVAL_MS = 3 * 60 * 60 * 1_000;
export const DESKTOP_RELEASES_URL = 'https://github.com/sherwoodlee/brunomnia/releases';

export type DesktopUpdateChannel = 'stable' | 'beta';
export type DesktopUpdateStatus = 'idle' | 'checking' | 'downloading' | 'readyToRestart';

export type DesktopUpdateSupport = {
  enabled: boolean;
  canInstall: boolean;
  noticeOnly: boolean;
  platform: string;
  currentVersion: string;
  disabledReason?: string;
};

export type DesktopUpdateMetadata = {
  currentVersion: string;
  version: string;
  date?: string;
  notes?: string;
  canInstall: boolean;
};

export type DesktopUpdateProgress = {
  phase: 'started' | 'progress' | 'finished';
  downloadedBytes: number;
  totalBytes?: number;
};

export const desktopUpdateButtonLabel = (status: DesktopUpdateStatus) => ({
  idle: 'Check for updates',
  checking: 'Checking…',
  downloading: 'Downloading…',
  readyToRestart: 'Restart and update',
}[status]);

export const desktopUpdateProgressPercent = ({ downloadedBytes, totalBytes }: DesktopUpdateProgress) => totalBytes && totalBytes > 0
  ? Math.min(100, Math.max(0, Math.round((downloadedBytes / totalBytes) * 100)))
  : undefined;

export const getDesktopUpdateSupport = async (): Promise<DesktopUpdateSupport> => {
  if (!isTauri()) return {
    enabled: false,
    canInstall: false,
    noticeOnly: false,
    platform: 'browser',
    currentVersion: 'development',
    disabledReason: 'Updates are available in packaged desktop builds.',
  };
  return invoke<DesktopUpdateSupport>('desktop_update_support');
};

export const checkForDesktopUpdate = async (channel: DesktopUpdateChannel) => {
  if (!isTauri()) throw new Error('Updates are available in packaged desktop builds.');
  return invoke<DesktopUpdateMetadata | null>('desktop_update_check', { channel });
};

export const downloadDesktopUpdate = async (
  channel: DesktopUpdateChannel,
  version: string,
  onProgress: (progress: DesktopUpdateProgress) => void,
) => {
  if (!isTauri()) throw new Error('Updates are available in packaged desktop builds.');
  const onEvent = new Channel<DesktopUpdateProgress>();
  onEvent.onmessage = onProgress;
  await invoke<void>('desktop_update_download', { channel, version, onEvent });
};

export const installDesktopUpdateAndRestart = async (version: string) => {
  if (!isTauri()) throw new Error('Updates are available in packaged desktop builds.');
  await invoke<void>('desktop_update_install_and_restart', { version });
};
