import type { ResponsePreviewMode, StreamMessage } from '../types';
import type { ResponseArtifact } from './responseDownload';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const binaryKind = (kind: string) => kind === 'binary' || kind === 'binary echo';

const decodeBase64 = (value: string) => {
  try { return Uint8Array.from(atob(value.trim()), (character) => character.charCodeAt(0)); }
  catch { return undefined; }
};

const safeName = (value: string) => value.trim()
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9._-]/gi, '_')
  .replace(/_+/g, '_')
  .slice(0, 120) || 'event';

const parsedJson = (value: string): { parsed: true; value: unknown } | { parsed: false } => {
  try { return { parsed: true, value: JSON.parse(value) as unknown }; }
  catch { return { parsed: false }; }
};

export const streamMessageBytes = (message: StreamMessage) => binaryKind(message.kind)
  ? decodeBase64(message.text) ?? encoder.encode(message.text)
  : encoder.encode(message.text);

export const streamMessageRawText = (message: StreamMessage) => binaryKind(message.kind)
  ? decoder.decode(streamMessageBytes(message))
  : message.text;

export const streamMessageArguments = (message: StreamMessage) => {
  const parsed = parsedJson(message.text);
  return parsed.parsed && Array.isArray(parsed.value) ? parsed.value.slice(0, 100) : [];
};

export const streamMessagePreview = (message: StreamMessage, mode: ResponsePreviewMode, argumentIndex?: number) => {
  const raw = streamMessageRawText(message);
  if (mode !== 'friendly') return raw;
  const parsed = parsedJson(raw);
  if (!parsed.parsed) return raw;
  const value = argumentIndex !== undefined && Array.isArray(parsed.value) ? parsed.value[argumentIndex] : parsed.value;
  return JSON.stringify(value, null, 2) ?? raw;
};

export const streamMessageSummary = (message: StreamMessage) => {
  if (binaryKind(message.kind)) return `Binary data · ${streamMessageBytes(message).byteLength.toLocaleString()} bytes`;
  const compact = message.text.replace(/\s+/g, ' ').trim();
  if (!compact) return '(empty message)';
  return compact.length > 240 ? `${compact.slice(0, 239)}…` : compact;
};

export const createStreamMessageArtifact = (
  requestName: string,
  message: StreamMessage,
  timestamp = Date.now(),
): ResponseArtifact<string | Uint8Array> => {
  const binary = binaryKind(message.kind);
  const contents = binary ? streamMessageBytes(message) : message.text;
  const json = !binary && parsedJson(message.text).parsed;
  return {
    contents,
    fileName: `${safeName(requestName)}-${safeName(message.kind)}-${timestamp}.${binary ? 'bin' : json ? 'json' : 'txt'}`,
    mimeType: binary ? 'application/octet-stream' : json ? 'application/json' : 'text/plain',
  };
};

export const downloadStreamMessage = (requestName: string, message: StreamMessage) => {
  const artifact = createStreamMessageArtifact(requestName, message);
  const contents = typeof artifact.contents === 'string' ? artifact.contents : new Uint8Array(artifact.contents).buffer;
  const url = URL.createObjectURL(new Blob([contents], { type: artifact.mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};
