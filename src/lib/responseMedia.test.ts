import { describe, expect, it } from 'vitest';
import { createResponseMediaArtifact, responseMedia } from './responseMedia';

describe('response media routing', () => {
  it('normalizes image, PDF, and audio content types', () => {
    expect(responseMedia('IMAGE/SVG+XML; charset=utf-8')).toEqual({ kind: 'image', mimeType: 'image/svg+xml' });
    expect(responseMedia(' application/pdf ; version=1.7')).toEqual({ kind: 'pdf', mimeType: 'application/pdf' });
    expect(responseMedia('audio/mpeg')).toEqual({ kind: 'audio', mimeType: 'audio/mpeg' });
  });

  it('rejects incomplete and unrelated content types', () => {
    expect(responseMedia('image/')).toBeNull();
    expect(responseMedia('application/json')).toBeNull();
    expect(responseMedia('')).toBeNull();
  });

  it('creates a correctly typed Blob from exact preserved bytes', async () => {
    const media = responseMedia('image/png')!;
    const artifact = createResponseMediaArtifact({ body: '�PNG', bodyBase64: 'iVBORw==' }, media);

    expect(artifact.bytes).toEqual(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]));
    expect(artifact.blob.type).toBe('image/png');
    expect(new Uint8Array(await artifact.blob.arrayBuffer())).toEqual(artifact.bytes);
  });

  it('creates the same media artifact directly from a multipart byte slice', async () => {
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const artifact = createResponseMediaArtifact(bytes, responseMedia('image/jpeg')!);

    expect(artifact.bytes).toBe(bytes);
    expect(artifact.blob.type).toBe('image/jpeg');
    expect(new Uint8Array(await artifact.blob.arrayBuffer())).toEqual(bytes);
  });
});
