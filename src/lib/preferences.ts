import type { AppPreferences, ShortcutAction } from '../types';

export const shortcutLabels: Record<ShortcutAction, string> = {
  palette: 'Quick search',
  preferences: 'Open preferences',
  send: 'Send request',
  environment: 'Edit environment',
  history: 'Show request history',
  'toggle-sidebar': 'Toggle request sidebar',
  'new-request': 'Create request',
  'duplicate-request': 'Duplicate request',
  'delete-request': 'Delete request',
  'focus-url': 'Focus request URL',
  'generate-code': 'Generate client code',
};

export const defaultShortcuts: AppPreferences['shortcuts'] = {
  palette: 'Mod+K',
  preferences: 'Mod+,',
  send: 'Mod+Enter',
  environment: 'Mod+E',
  history: 'Mod+Shift+H',
  'toggle-sidebar': 'Mod+\\',
  'new-request': 'Mod+N',
  'duplicate-request': 'Mod+D',
  'delete-request': 'Mod+Shift+Backspace',
  'focus-url': 'Mod+L',
  'generate-code': 'Mod+Shift+G',
};

export const defaultPreferences: AppPreferences = {
  theme: 'system',
  density: 'comfortable',
  fontSize: 13,
  preferredHttpVersion: 'default',
  maxRedirects: 10,
  followRedirects: true,
  maxTimelineDataSizeKB: 10,
  maxHistoryResponses: 20,
  filterResponsesByEnv: false,
  requestTimeoutMs: 30_000,
  validateCertificates: true,
  validateAuthCertificates: true,
  scriptTimeoutMs: 10_000,
  allowScriptRequests: false,
  allowScriptFileAccess: false,
  enableVaultInScripts: false,
  autoFetchGraphqlSchema: true,
  confirmDestructive: true,
  shortcuts: { ...defaultShortcuts },
};

const canonicalPart = (value: string) => {
  const lower = value.toLowerCase();
  if (lower === 'mod') return 'Mod';
  if (lower === 'meta' || lower === 'command' || lower === 'cmd') return 'Meta';
  if (lower === 'control' || lower === 'ctrl') return 'Control';
  if (lower === 'alt' || lower === 'option') return 'Alt';
  if (lower === 'shift') return 'Shift';
  return value;
};
const modifier = (value: string) => value === 'Meta' || value === 'Control' || value === 'Alt' || value === 'Shift';

export const normalizeShortcut = (value: string): string => {
  const pieces = value.split('+').map((piece) => canonicalPart(piece.trim())).filter(Boolean);
  const mods = [...new Set(pieces.filter((piece) => modifier(piece) || piece === 'Mod'))];
  const key = pieces.find((piece) => !modifier(piece) && piece !== 'Mod') ?? '';
  return key ? [...mods, key.length === 1 ? key.toUpperCase() : key].join('+') : '';
};

export const shortcutFromEvent = (event: KeyboardEvent): string => {
  const mods = [event.metaKey || event.ctrlKey ? 'Mod' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : ''].filter(Boolean);
  const key = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return modifier(event.key) ? '' : normalizeShortcut([...mods, key].join('+'));
};

export const shortcutMatches = (event: KeyboardEvent, shortcut: string): boolean => {
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) return false;
  const parts = new Set(normalized.split('+'));
  const requiresMod = parts.has('Mod');
  const requiresMeta = parts.has('Meta');
  const requiresControl = parts.has('Control');
  if (requiresMod) {
    if (!(event.metaKey || event.ctrlKey)) return false;
  } else if (requiresMeta !== event.metaKey || requiresControl !== event.ctrlKey) return false;
  if (parts.has('Alt') !== event.altKey || parts.has('Shift') !== event.shiftKey) return false;
  const key = [...parts].find((part) => !['Mod', 'Meta', 'Control', 'Alt', 'Shift'].includes(part));
  return Boolean(key && key.toLowerCase() === event.key.toLowerCase());
};

export const duplicateShortcuts = (shortcuts: AppPreferences['shortcuts']): string[] => {
  const seen = new Map<string, ShortcutAction[]>();
  (Object.entries(shortcuts) as Array<[ShortcutAction, string]>).forEach(([action, value]) => {
    const normalized = normalizeShortcut(value);
    if (normalized) seen.set(normalized, [...(seen.get(normalized) ?? []), action]);
  });
  return [...seen.entries()].filter(([, actions]) => actions.length > 1).map(([shortcut]) => shortcut);
};
