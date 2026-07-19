import { describe, expect, it } from 'vitest';
import type { StreamMessage } from '../types';
import { createStreamMessageArtifact, streamMessageArguments, streamMessageBytes, streamMessagePreview, streamMessageRawText, streamMessageSummary } from './streamEvent';

const message = (patch: Partial<StreamMessage> = {}): StreamMessage => ({
  id: 'event-1',
  sessionId: 'session-1',
  direction: 'incoming',
  kind: 'message',
  text: '{"name":"Ada","roles":["admin"]}',
  timestamp: '2026-07-19T12:00:00.000Z',
  ...patch,
});

describe('realtime event inspection', () => {
  it('provides friendly JSON while preserving exact source and raw text', () => {
    expect(streamMessagePreview(message(), 'friendly')).toBe('{\n  "name": "Ada",\n  "roles": [\n    "admin"\n  ]\n}');
    expect(streamMessagePreview(message(), 'source')).toBe(message().text);
    expect(streamMessagePreview(message(), 'raw')).toBe(message().text);
    expect(streamMessagePreview(message({ text: 'plain text' }), 'friendly')).toBe('plain text');
  });

  it('exposes bounded Socket.IO arguments for individual friendly inspection', () => {
    const socketMessage = message({ kind: 'order.created', text: '[{"id":42},true,"done"]' });
    expect(streamMessageArguments(socketMessage)).toEqual([{ id: 42 }, true, 'done']);
    expect(streamMessagePreview(socketMessage, 'friendly', 0)).toBe('{\n  "id": 42\n}');
    expect(streamMessageArguments(message({ text: '{"not":"args"}' }))).toEqual([]);
  });

  it('decodes binary frames for inspection and retains exact bytes for export', () => {
    const binary = message({ kind: 'binary', text: 'AP+AQQ==' });
    expect([...streamMessageBytes(binary)]).toEqual([0, 255, 128, 65]);
    expect(streamMessageRawText(binary)).toContain('A');
    expect(streamMessageSummary(binary)).toBe('Binary data · 4 bytes');
    expect(createStreamMessageArtifact('Binary / request', binary, 42)).toEqual({
      contents: new Uint8Array([0, 255, 128, 65]),
      fileName: 'Binary_request-binary-42.bin',
      mimeType: 'application/octet-stream',
    });
  });

  it('creates deterministic JSON/text artifacts and bounded list summaries', () => {
    expect(createStreamMessageArtifact('Orders request', message(), 42)).toMatchObject({ fileName: 'Orders_request-message-42.json', mimeType: 'application/json' });
    expect(createStreamMessageArtifact('Orders request', message({ text: 'ok' }), 42)).toMatchObject({ fileName: 'Orders_request-message-42.txt', mimeType: 'text/plain' });
    expect(streamMessageSummary(message({ text: `  ${'x'.repeat(300)}  ` }))).toHaveLength(240);
  });
});
