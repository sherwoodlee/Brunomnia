import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { sendRequest } from './http';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  isTauri: () => false,
}));

afterEach(() => vi.unstubAllGlobals());

describe('browser HTTP response bytes', () => {
  it('preserves exact bytes when UTF-8 display decoding is lossy', async () => {
    const bytes = Uint8Array.from([0x66, 0x80, 0x6f, 0x00]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes.buffer as ArrayBuffer, {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    })));
    const request = createBlankRequest('browser-binary-response');
    request.url = 'https://example.test/file.bin';

    const response = await sendRequest(request, undefined, { requestTimeoutMs: 0 });

    expect(response).toMatchObject({ body: 'f�o\0', bodyBase64: 'ZoBvAA==', sizeBytes: 4 });
  });

  it('does not duplicate a lossless UTF-8 body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('héllo', { status: 200 })));
    const request = createBlankRequest('browser-text-response');
    request.url = 'https://example.test/hello';

    const response = await sendRequest(request, undefined, { requestTimeoutMs: 0 });

    expect(response.body).toBe('héllo');
    expect(response.sizeBytes).toBe(6);
    expect(response).not.toHaveProperty('bodyBase64');
  });
});
