import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { cloneShortcuts, defaultShortcuts } from '../lib/preferences';
import { ShortcutBindingsEditor } from './PreferencesWorkbench';

describe('keyboard shortcut multi-binding editor', () => {
  it('renders every binding with independent add, remove, and reset controls', () => {
    const html = renderToStaticMarkup(<ShortcutBindingsEditor onChange={vi.fn()} onMessage={vi.fn()} shortcuts={cloneShortcuts(defaultShortcuts)} />);
    expect(html).toContain('Next tab');
    expect(html).toContain('⌘/Ctrl+Alt+ArrowRight');
    expect(html).toContain('⌘/Ctrl+Tab');
    expect(html).toContain('aria-label="Add Next tab shortcut"');
    expect(html).toContain('aria-label="Remove Mod+Tab from Next tab"');
    expect(html).toContain('aria-label="Reset Next tab shortcuts"');
  });

  it('surfaces legacy collisions instead of silently replacing an action', () => {
    const shortcuts = cloneShortcuts(defaultShortcuts);
    shortcuts.send = [...shortcuts.palette];
    const html = renderToStaticMarkup(<ShortcutBindingsEditor onChange={vi.fn()} onMessage={vi.fn()} shortcuts={shortcuts} />);
    expect(html).toContain('Duplicate migrated bindings');
    expect(html).toContain('Mod+K');
  });
});
