import { describe, expect, it } from 'vitest';
import { responseHtmlPreview } from './responseHtml';

describe('HTML response preview policy', () => {
  it('blocks scripts and all sandbox capabilities by default', () => {
    const preview = responseHtmlPreview('<button>Inspect</button><script>run()</script>', false);

    expect(preview.sandbox).toBe('');
    expect(preview.document).toContain("default-src 'none'");
    expect(preview.document).not.toContain('script-src');
    expect(preview.document.endsWith('<button>Inspect</button><script>run()</script>')).toBe(true);
  });

  it('allows only inline scripts when explicitly enabled', () => {
    const preview = responseHtmlPreview('<script>document.body.dataset.ready = "yes"</script>', true);

    expect(preview.sandbox).toBe('allow-scripts');
    expect(preview.document).toContain("script-src 'unsafe-inline'");
    expect(preview.document).toContain("connect-src 'none'");
    expect(preview.document).toContain("object-src 'none'");
    expect(preview.document).toContain("form-action 'none'");
    expect(preview.document).not.toContain("'unsafe-eval'");
  });
});
