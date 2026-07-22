import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const luminance = (hex: string) => {
  const channels = hex.slice(1).match(/../g)?.map(value => Number.parseInt(value, 16) / 255) ?? [];
  const [red, green, blue] = channels.map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
};
const contrast = (foreground: string, background: string) => {
  const high = Math.max(luminance(foreground), luminance(background));
  const low = Math.min(luminance(foreground), luminance(background));
  return (high + 0.05) / (low + 0.05);
};

describe('application accessibility contracts', () => {
  it('provides a skip link and one workspace main landmark outside the application shell header', async () => {
    const source = await readFile('src/App.tsx', 'utf8');
    expect(source).toContain('className="skip-link" href="#workspace-content"');
    expect(source).toContain('<main className={`app-body${sidebarHidden ? \' sidebar-hidden\' : \'\'}`} id="workspace-content" tabIndex={-1}>');
    expect(source).toContain('<div className="app-shell"');
    expect(source).toContain('<DesktopUpdateProvider preferences={workspace.preferences}>');
  });

  it('preserves contrast, reduced-motion, high-contrast, and visible-focus evidence', async () => {
    const css = await readFile('src/styles.css', 'utf8');
    expect(contrast('#74848c', '#0b1014')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#1b0d08', '#ff6534')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#667277', '#f7f7f4')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#586369', '#f7f7f4')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', '#c44217')).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (prefers-contrast: more)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('outline: 2px solid');
    expect(css).not.toMatch(/background: var\(--accent\)[^\n]*color: white/);
  });
});
