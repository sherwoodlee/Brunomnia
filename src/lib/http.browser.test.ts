import { afterEach, describe, expect, it, vi } from 'vitest';
import { cloneSeedWorkspace, createBlankRequest } from '../data/seed';
import { sendRequest } from './http';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  isTauri: () => false,
}));

afterEach(() => vi.unstubAllGlobals());

describe('browser HTTP response bytes', () => {
  it('does not inject the desktop User-Agent into browser Fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const request = createBlankRequest('browser-user-agent');
    request.url = 'https://example.test/status';
    request.headers = [];

    await sendRequest(request, undefined, { requestTimeoutMs: 0 });

    expect(fetchMock).toHaveBeenCalledWith(request.url, expect.objectContaining({ headers: {} }));
  });

  it('honors the request body rendering switch in browser development', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const request = createBlankRequest('browser-body-rendering');
    request.method = 'POST';
    request.url = 'https://example.test/body';
    request.bodyMode = 'text';
    request.body = '{{ value }}';
    const environment = cloneSeedWorkspace().environments[0];
    environment.variables = [{ id: 'value', name: 'value', value: 'resolved', enabled: true }];

    request.renderBodyTemplates = false;
    await sendRequest(request, environment, { requestTimeoutMs: 0 });
    expect(fetchMock).toHaveBeenLastCalledWith(request.url, expect.objectContaining({ body: '{{ value }}' }));

    request.renderBodyTemplates = true;
    await sendRequest(request, environment, { requestTimeoutMs: 0 });
    expect(fetchMock).toHaveBeenLastCalledWith(request.url, expect.objectContaining({ body: 'resolved' }));
  });

  it('preserves enabled empty-name form values and skips only blank multipart rows', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const request = createBlankRequest('browser-structured-bodies');
    request.method = 'POST';
    request.url = 'https://example.test/body';
    request.bodyMode = 'form-urlencoded';
    request.formBody = [
      { id: 'empty-name', name: '', value: 'nameless', enabled: true },
      { id: 'blank', name: '', value: '', enabled: true },
      { id: 'disabled', name: 'omit', value: 'no', enabled: false },
    ];

    await sendRequest(request, undefined, { requestTimeoutMs: 0 });
    const encoded = fetchMock.mock.calls.at(-1)?.[1].body as URLSearchParams;
    expect(encoded.toString()).toBe('=nameless&=');

    request.bodyMode = 'multipart';
    request.multipartBody = [
      { id: 'empty-name', name: '', value: 'nameless', enabled: true, kind: 'text', multiline: false, contentType: '', fileName: '' },
      { id: 'blank', name: '', value: '', enabled: true, kind: 'text', multiline: false, contentType: 'application/x-omit', fileName: '' },
      { id: 'disabled', name: 'omit', value: 'no', enabled: false, kind: 'text', multiline: false, contentType: '', fileName: '' },
    ];

    await sendRequest(request, undefined, { requestTimeoutMs: 0 });
    const multipart = fetchMock.mock.calls.at(-1)?.[1].body as FormData;
    expect([...multipart.entries()]).toEqual([['', 'nameless']]);
  });

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

  it('decodes a declared legacy charset and retains exact raw bytes', async () => {
    const bytes = Uint8Array.from([0x63, 0x61, 0x66, 0xe9]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes.buffer as ArrayBuffer, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=windows-1252' },
    })));
    const request = createBlankRequest('browser-charset-response');
    request.url = 'https://example.test/legacy-text';

    const response = await sendRequest(request, undefined, { requestTimeoutMs: 0 });

    expect(response).toMatchObject({ body: 'café', bodyBase64: 'Y2Fm6Q==', sizeBytes: 4 });
  });
});
