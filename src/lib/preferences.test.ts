import { describe, expect, it } from 'vitest';
import { defaultShortcuts, duplicateShortcuts, normalizeShortcut, shortcutMatches } from './preferences';

describe('desktop preferences', () => {
  const keyEvent = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers }) as KeyboardEvent;

  it('normalizes shortcut text and detects collisions', () => {
    expect(normalizeShortcut(' Mod + shift + h ')).toBe('Mod+Shift+H');
    expect(duplicateShortcuts({ ...defaultShortcuts, send: defaultShortcuts.palette })).toEqual(['Mod+K']);
  });

  it('matches Mod to either platform primary modifier with exact secondary modifiers', () => {
    expect(shortcutMatches(keyEvent('k', { metaKey: true }), 'Mod+K')).toBe(true);
    expect(shortcutMatches(keyEvent('k', { ctrlKey: true }), 'Mod+K')).toBe(true);
    expect(shortcutMatches(keyEvent('k', { ctrlKey: true, shiftKey: true }), 'Mod+K')).toBe(false);
  });
});
