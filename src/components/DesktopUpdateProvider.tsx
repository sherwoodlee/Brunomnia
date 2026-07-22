import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppPreferences } from '../types';
import { checkForDesktopUpdate, downloadDesktopUpdate, getDesktopUpdateSupport, installDesktopUpdateAndRestart, UPDATE_CHECK_INTERVAL_MS, type DesktopUpdateMetadata, type DesktopUpdateProgress, type DesktopUpdateStatus, type DesktopUpdateSupport } from '../lib/desktopUpdates';

type DesktopUpdateContextValue = {
  support?: DesktopUpdateSupport;
  status: DesktopUpdateStatus;
  available?: DesktopUpdateMetadata;
  progress?: DesktopUpdateProgress;
  message: string;
  activate: () => Promise<void>;
};

const DesktopUpdateContext = createContext<DesktopUpdateContextValue>({
  status: 'idle',
  message: 'Loading update support…',
  activate: async () => {},
});

const updateErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export function DesktopUpdateProvider({ children, preferences }: { children: ReactNode; preferences: AppPreferences }) {
  const [support, setSupport] = useState<DesktopUpdateSupport>();
  const [status, setStatus] = useState<DesktopUpdateStatus>('idle');
  const [available, setAvailable] = useState<DesktopUpdateMetadata>();
  const [progress, setProgress] = useState<DesktopUpdateProgress>();
  const [message, setMessage] = useState('Loading update support…');
  const operationRunning = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void getDesktopUpdateSupport().then((next) => {
      if (cancelled) return;
      setSupport(next);
      setMessage(next.disabledReason ?? `Version ${next.currentVersion} · ${next.platform}`);
    }).catch((error) => {
      if (!cancelled) setMessage(updateErrorMessage(error));
    });
    return () => { cancelled = true; };
  }, []);

  const checkNow = useCallback(async (manual: boolean) => {
    if (!support?.enabled || operationRunning.current) return;
    operationRunning.current = true;
    setStatus('checking');
    setAvailable(undefined);
    setProgress(undefined);
    setMessage(manual ? 'Checking for updates…' : 'Running automatic update check…');
    try {
      const update = await checkForDesktopUpdate(preferences.updateChannel);
      if (!update) {
        setStatus('idle');
        setMessage(`Brunomnia ${support.currentVersion} is up to date on the ${preferences.updateChannel} channel.`);
        return;
      }
      setAvailable(update);
      if (!update.canInstall) {
        setStatus('idle');
        setMessage(`Brunomnia ${update.version} is available. Linux updates are installed from the release package.`);
        return;
      }
      setStatus('downloading');
      setMessage(`Downloading and verifying Brunomnia ${update.version}…`);
      await downloadDesktopUpdate(preferences.updateChannel, update.version, setProgress);
      setStatus('readyToRestart');
      setMessage(`Brunomnia ${update.version} is verified and ready. Restart to apply it.`);
    } catch (error) {
      setStatus('idle');
      setMessage(`Update error: ${updateErrorMessage(error)}`);
    } finally {
      operationRunning.current = false;
    }
  }, [preferences.updateChannel, support]);

  useEffect(() => {
    if (!preferences.updateAutomatically || !support?.enabled) return;
    void checkNow(false);
    const interval = window.setInterval(() => void checkNow(false), UPDATE_CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [checkNow, preferences.updateAutomatically, support?.enabled]);

  const activate = useCallback(async () => {
    if (status !== 'readyToRestart' || !available) {
      await checkNow(true);
      return;
    }
    setMessage(`Installing Brunomnia ${available.version} and restarting…`);
    try {
      await installDesktopUpdateAndRestart(available.version);
    } catch (error) {
      setStatus('readyToRestart');
      setMessage(`Update error: ${updateErrorMessage(error)}`);
    }
  }, [available, checkNow, status]);

  const value = useMemo(() => ({ support, status, available, progress, message, activate }), [activate, available, message, progress, status, support]);
  return <DesktopUpdateContext value={value}>{children}</DesktopUpdateContext>;
}

export const useDesktopUpdater = () => useContext(DesktopUpdateContext);
