import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { desktopUpdateButtonLabel, desktopUpdateProgressPercent, UPDATE_CHECK_INTERVAL_MS } from './desktopUpdates';

describe('desktop updater contracts', () => {
  it('uses the pinned three-hour automatic check cadence and status labels', () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(10_800_000);
    expect(desktopUpdateButtonLabel('idle')).toBe('Check for updates');
    expect(desktopUpdateButtonLabel('checking')).toBe('Checking…');
    expect(desktopUpdateButtonLabel('downloading')).toBe('Downloading…');
    expect(desktopUpdateButtonLabel('readyToRestart')).toBe('Restart and update');
  });

  it('reports bounded progress only when a total is known', () => {
    expect(desktopUpdateProgressPercent({ phase: 'started', downloadedBytes: 0 })).toBeUndefined();
    expect(desktopUpdateProgressPercent({ phase: 'progress', downloadedBytes: 40, totalBytes: 100 })).toBe(40);
    expect(desktopUpdateProgressPercent({ phase: 'progress', downloadedBytes: 120, totalBytes: 100 })).toBe(100);
  });

  it('runs automatic checks at application scope instead of only while Preferences is open', async () => {
    const provider = await readFile('src/components/DesktopUpdateProvider.tsx', 'utf8');
    expect(provider).toContain('void checkNow(false)');
    expect(provider).toContain('window.setInterval(() => void checkNow(false), UPDATE_CHECK_INTERVAL_MS)');
  });
});
