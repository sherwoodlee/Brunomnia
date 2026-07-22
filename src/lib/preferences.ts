import type { AppPreferences, ShortcutAction } from '../types';

export const shortcutLabels: Record<ShortcutAction, string> = {
  'workspace-settings': 'Show collection settings',
  'request-settings': 'Show request settings',
  'keyboard-shortcuts': 'Show keyboard shortcuts',
  preferences: 'Open preferences',
  palette: 'Quick search',
  'reload-plugins': 'Reload plugins',
  autocomplete: 'Show autocomplete',
  send: 'Send request',
  'send-options': 'Send request with options',
  environment: 'Edit environment',
  'switch-environment': 'Switch environments',
  'focus-method': 'Change HTTP method',
  history: 'Show request history',
  'focus-url': 'Focus request URL',
  'generate-code': 'Generate client code',
  'focus-sidebar-filter': 'Filter sidebar',
  'create-menu': 'Open create menu',
  'toggle-sidebar': 'Toggle request sidebar',
  'focus-response': 'Focus response',
  cookies: 'Edit cookies',
  'new-request': 'Create HTTP request',
  'delete-request': 'Delete request',
  'create-folder': 'Create folder',
  'duplicate-request': 'Duplicate request',
  'toggle-pin': 'Pin or unpin request',
  'variable-source': 'Show variable source and value',
  'beautify-body': 'Beautify request body',
  'focus-graphql-filter': 'Focus GraphQL explorer filter',
  'close-tab': 'Close active tab',
  'next-tab': 'Next tab',
  'previous-tab': 'Previous tab',
  'reopen-closed-tab': 'Reopen closed tab',
  'open-request-new-tab': 'Keep request in a new tab',
};

export const defaultShortcuts: AppPreferences['shortcuts'] = {
  'workspace-settings': ['Mod+Shift+,'],
  'request-settings': ['Mod+Alt+Shift+,'],
  'keyboard-shortcuts': ['Meta+Control+Shift+/', 'Control+Shift+/'],
  preferences: ['Mod+,'],
  palette: ['Mod+P'],
  'reload-plugins': ['Mod+Shift+R'],
  autocomplete: ['Control+Space'],
  send: ['Mod+Enter', 'Mod+R', 'F5'],
  'send-options': ['Mod+Shift+Enter'],
  environment: ['Mod+E'],
  'switch-environment': ['Mod+Shift+E'],
  'focus-method': ['Mod+Shift+L'],
  history: ['Mod+Shift+H'],
  'focus-url': ['Mod+L'],
  'generate-code': ['Mod+Shift+G'],
  'focus-sidebar-filter': ['Mod+Shift+F'],
  'create-menu': ['Mod+N'],
  'toggle-sidebar': ['Mod+\\'],
  'focus-response': ["Mod+'"],
  cookies: ['Mod+K'],
  'new-request': ['Mod+Alt+N'],
  'delete-request': ['Mod+Shift+Backspace'],
  'create-folder': ['Mod+Shift+N'],
  'duplicate-request': ['Mod+D'],
  'toggle-pin': ['Mod+Shift+P'],
  'variable-source': ['Alt+Shift+U'],
  'beautify-body': ['Mod+Shift+F'],
  'focus-graphql-filter': ['Mod+Shift+I'],
  'close-tab': ['Mod+W'],
  'next-tab': ['Mod+Alt+ArrowRight', 'Mod+Tab'],
  'previous-tab': ['Mod+Alt+ArrowLeft', 'Mod+Shift+Tab'],
  'reopen-closed-tab': ['Mod+Shift+T'],
  'open-request-new-tab': ['Mod+Shift+O'],
};

export const cloneShortcuts = (shortcuts: AppPreferences['shortcuts']): AppPreferences['shortcuts'] => Object.fromEntries(
  (Object.entries(shortcuts) as Array<[ShortcutAction, string[]]>).map(([action, bindings]) => [action, [...bindings]]),
) as AppPreferences['shortcuts'];

export const defaultPreferences: AppPreferences = {
  theme: 'system',
  updateAutomatically: true,
  updateChannel: 'stable',
  density: 'comfortable',
  fontSize: 11,
  interfaceFontSize: 13,
  fontInterface: '',
  fontMonospace: '',
  showPasswords: false,
  allowHtmlPreviewRemoteResources: true,
  allowHtmlPreviewScripts: true,
  disableResponsePreviewLinks: false,
  preferredHttpVersion: 'default',
  maxRedirects: 10,
  followRedirects: true,
  maxTimelineDataSizeKB: 10,
  maxHistoryResponses: 20,
  filterResponsesByEnv: false,
  requestTimeoutMs: 30_000,
  validateCertificates: true,
  validateAuthCertificates: true,
  clearOAuth2SessionOnRestart: false,
  proxyEnabled: false,
  httpProxy: '',
  httpsProxy: '',
  noProxy: '',
  pluginRegistryUrl: 'https://registry.npmjs.org/',
  useBulkHeaderEditor: false,
  useBulkParametersEditor: false,
  forceVerticalLayout: false,
  editorIndentWithTabs: true,
  editorIndentSize: 2,
  editorLineWrapping: true,
  fontVariantLigatures: false,
  showVariableSourceAndValue: false,
  scriptTimeoutMs: 10_000,
  allowScriptRequests: false,
  allowScriptFileAccess: false,
  dataFolders: [],
  enableVaultInScripts: false,
  autoFetchGraphqlSchema: true,
  confirmDestructive: true,
  shortcuts: cloneShortcuts(defaultShortcuts),
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
const canonicalKeys: Record<string, string> = {
  enter: 'Enter', tab: 'Tab', space: 'Space', backspace: 'Backspace', delete: 'Delete', escape: 'Escape',
  arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
  home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
};
const canonicalKey = (value: string) => canonicalKeys[value.toLowerCase()] ?? (/^f\d{1,2}$/i.test(value) ? value.toUpperCase() : value.length === 1 ? value.toUpperCase() : value);

export const normalizeShortcut = (value: string): string => {
  const pieces = value.split('+').map((piece) => canonicalPart(piece.trim())).filter(Boolean);
  const presentModifiers = new Set<string>(pieces.filter((piece) => modifier(piece) || piece === 'Mod'));
  if (presentModifiers.has('Mod') && (presentModifiers.has('Meta') || presentModifiers.has('Control'))) return '';
  const keys = pieces.filter((piece) => !modifier(piece) && piece !== 'Mod');
  if (keys.length !== 1) return '';
  const mods = ['Mod', 'Meta', 'Control', 'Alt', 'Shift'].filter((piece) => presentModifiers.has(piece));
  return [...mods, canonicalKey(keys[0])].join('+');
};

export const shortcutFromEvent = (event: KeyboardEvent): string => {
  if (event.metaKey && event.ctrlKey) return '';
  const mods = [event.metaKey || event.ctrlKey ? 'Mod' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : ''].filter(Boolean);
  const key = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return modifier(event.key) ? '' : normalizeShortcut([...mods, key].join('+'));
};

const shortcutBindingMatches = (event: KeyboardEvent, shortcut: string): boolean => {
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) return false;
  const parts = new Set(normalized.split('+'));
  const requiresMod = parts.has('Mod');
  const requiresMeta = parts.has('Meta');
  const requiresControl = parts.has('Control');
  if (requiresMod) {
    if (event.metaKey === event.ctrlKey) return false;
  } else if (requiresMeta !== event.metaKey || requiresControl !== event.ctrlKey) return false;
  if (parts.has('Alt') !== event.altKey || parts.has('Shift') !== event.shiftKey) return false;
  const key = [...parts].find((part) => !['Mod', 'Meta', 'Control', 'Alt', 'Shift'].includes(part));
  return Boolean(key && key.toLowerCase() === event.key.toLowerCase());
};

export const shortcutMatches = (event: KeyboardEvent, shortcuts: string | readonly string[]): boolean => (Array.isArray(shortcuts) ? shortcuts : [shortcuts]).some((shortcut) => shortcutBindingMatches(event, shortcut));

export const normalizeShortcutBindings = (value: unknown, fallback: readonly string[]): string[] => {
  if (value === undefined) return [...fallback];
  const candidates = typeof value === 'string' ? [value] : Array.isArray(value) ? value : undefined;
  if (!candidates) return [...fallback];
  return [...new Set(candidates
    .filter((candidate): candidate is string => typeof candidate === 'string')
    .map((candidate) => normalizeShortcut(candidate.slice(0, 64)))
    .filter(Boolean))].slice(0, 8);
};

export const shortcutDisplayLabel = (shortcuts: readonly string[]) => shortcuts[0]?.replace('Mod', '⌘/Ctrl') ?? 'Unassigned';

export const shortcutBindingOwner = (shortcuts: AppPreferences['shortcuts'], value: string): ShortcutAction | undefined => {
  const normalized = normalizeShortcut(value);
  if (!normalized) return undefined;
  return (Object.entries(shortcuts) as Array<[ShortcutAction, string[]]>).find(([, bindings]) => bindings.some((binding) => normalizeShortcut(binding) === normalized))?.[0];
};

export const shortcutEventOwner = (shortcuts: AppPreferences['shortcuts'], event: KeyboardEvent): ShortcutAction | undefined => (Object.entries(shortcuts) as Array<[ShortcutAction, string[]]>).find(([, bindings]) => shortcutMatches(event, bindings))?.[0];

export const duplicateShortcuts = (shortcuts: AppPreferences['shortcuts']): string[] => {
  const seen = new Map<string, ShortcutAction[]>();
  (Object.entries(shortcuts) as Array<[ShortcutAction, string[]]>).forEach(([action, bindings]) => {
    bindings.forEach((value) => {
      const normalized = normalizeShortcut(value);
      if (normalized) seen.set(normalized, [...(seen.get(normalized) ?? []), action]);
    });
  });
  return [...seen.entries()].filter(([, actions]) => actions.length > 1).map(([shortcut]) => shortcut);
};
