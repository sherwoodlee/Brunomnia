import { describe, expect, it } from 'vitest';
import { cloneShortcuts, defaultShortcuts, duplicateShortcuts, normalizeShortcut, normalizeShortcutBindings, shortcutBindingOwner, shortcutEventOwner, shortcutLabels, shortcutMatches } from './preferences';

describe('desktop preferences', () => {
  const keyEvent = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers }) as KeyboardEvent;

  it('normalizes shortcut text and detects collisions', () => {
    expect(normalizeShortcut(' Mod + shift + h ')).toBe('Mod+Shift+H');
    expect(normalizeShortcut(' shift + mod + h ')).toBe('Mod+Shift+H');
    expect(normalizeShortcut('Mod+H+J')).toBe('');
    expect(duplicateShortcuts(defaultShortcuts)).toEqual(['Mod+Shift+F']);
    expect(duplicateShortcuts({ ...cloneShortcuts(defaultShortcuts), send: [...defaultShortcuts.palette] })).toEqual(['Mod+P', 'Mod+Shift+F']);
  });

  it('matches any binding while preserving exact secondary modifiers', () => {
    expect(shortcutMatches(keyEvent('k', { metaKey: true }), ['Mod+K', 'F5'])).toBe(true);
    expect(shortcutMatches(keyEvent('F5'), ['Mod+K', 'F5'])).toBe(true);
    expect(shortcutMatches(keyEvent('k', { ctrlKey: true, shiftKey: true }), ['Mod+K'])).toBe(false);
    expect(shortcutMatches(keyEvent('k', { metaKey: true, ctrlKey: true }), ['Mod+K'])).toBe(false);
  });

  it('migrates legacy strings, preserves cleared lists, and identifies binding owners', () => {
    expect(normalizeShortcutBindings(' mod + enter ', ['F5'])).toEqual(['Mod+Enter']);
    expect(normalizeShortcutBindings(['Mod+Enter', ' mod + enter ', 'F5'], [])).toEqual(['Mod+Enter', 'F5']);
    expect(normalizeShortcutBindings([], ['Mod+Enter'])).toEqual([]);
    expect(normalizeShortcutBindings(undefined, ['Mod+Enter'])).toEqual(['Mod+Enter']);
    expect(shortcutBindingOwner(defaultShortcuts, 'mod + shift + t')).toBe('reopen-closed-tab');
    const duplicates = cloneShortcuts(defaultShortcuts);
    duplicates.send = [...duplicates.palette];
    expect(shortcutEventOwner(duplicates, keyEvent('p', { metaKey: true }))).toBe('palette');
  });

  it('clones binding lists without sharing mutable action arrays', () => {
    const cloned = cloneShortcuts(defaultShortcuts);
    cloned.send.push('Alt+F5');
    expect(defaultShortcuts.send).toEqual(['Mod+Enter', 'Mod+R', 'F5']);
    expect(cloned.send).toEqual(['Mod+Enter', 'Mod+R', 'F5', 'Alt+F5']);
  });

  it('exposes the complete pinned action inventory and create split', () => {
    expect(Object.keys(shortcutLabels)).toHaveLength(33);
    expect(Object.keys(defaultShortcuts)).toEqual(Object.keys(shortcutLabels));
    expect(defaultShortcuts['create-menu']).toEqual(['Mod+N']);
    expect(defaultShortcuts['new-request']).toEqual(['Mod+Alt+N']);
  });
});
