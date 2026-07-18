import type { HttpResponse } from '../types';
import { responseBodyBytes } from './responseBytes';

export type ResponseMedia = { kind: 'image' | 'pdf' | 'audio'; mimeType: string };
export type ResponseMediaArtifact = { blob: Blob; bytes: Uint8Array };

const MEDIA_TYPE = /^(?:image|audio)\/[a-z0-9][a-z0-9.+-]*$/;

export const responseMedia = (contentType: string): ResponseMedia | null => {
  const mimeType = contentType.split(';')[0].trim().toLowerCase();
  if (mimeType === 'application/pdf') return { kind: 'pdf', mimeType };
  if (!MEDIA_TYPE.test(mimeType)) return null;
  return { kind: mimeType.startsWith('image/') ? 'image' : 'audio', mimeType };
};

export const createResponseMediaArtifact = (
  source: Pick<HttpResponse, 'body' | 'bodyBase64'> | Uint8Array,
  media: ResponseMedia,
): ResponseMediaArtifact => {
  const bytes = source instanceof Uint8Array ? source : responseBodyBytes(source);
  return { bytes, blob: new Blob([new Uint8Array(bytes).buffer], { type: media.mimeType }) };
};
