import { describe, expect, it } from 'vitest';
import { responseHtmlPreview } from './responseHtml';

describe('HTML response preview policy', () => {
  it('blocks scripts and all sandbox capabilities by default', () => {
    const preview = responseHtmlPreview('<button>Inspect</button><script>run()</script>', false);

    expect(preview.sandbox).toBe('');
    expect(preview.baseUrl).toBe('');
    expect(preview.document).toContain("default-src 'none'");
    expect(preview.document).toContain("base-uri 'none'");
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

  it('injects a normalized HTTP response URL before the response body', () => {
    const preview = responseHtmlPreview('<head><base href="https://attacker.test/"></head><a href="../next">Next</a>', false, 'https://api.example.test/v1/orders/42?view=full');

    expect(preview.baseUrl).toBe('https://api.example.test/v1/orders/42?view=full');
    expect(preview.document).toContain('base-uri http: https:');
    expect(preview.document).toContain('<meta name="referrer" content="no-referrer"><base href="https://api.example.test/v1/orders/42?view=full"><head>');
    expect(preview.document.indexOf('api.example.test')).toBeLessThan(preview.document.indexOf('attacker.test'));
    expect(new URL('../next', preview.baseUrl).href).toBe('https://api.example.test/v1/next');
  });

  it('escapes URL attribute delimiters and rejects non-HTTP base URLs', () => {
    const escaped = responseHtmlPreview('<a href="next">Next</a>', false, 'https://example.test/path?a=1&copy="yes"');
    const rejected = responseHtmlPreview('<a href="next">Next</a>', true, 'javascript:alert(1)');
    const file = responseHtmlPreview('<a href="next">Next</a>', false, 'file:///private/tmp/secret.html');
    const malformed = responseHtmlPreview('<a href="next">Next</a>', false, 'not a URL');

    expect(escaped.document).toContain('<base href="https://example.test/path?a=1&amp;copy=%22yes%22">');
    expect(rejected.baseUrl).toBe('');
    expect(rejected.document).toContain("base-uri 'none'");
    expect(rejected.document).not.toContain('<base href=');
    expect(file.baseUrl).toBe('');
    expect(malformed.baseUrl).toBe('');
  });
});
