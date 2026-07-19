import { describe, expect, it } from 'vitest';
import type { MultipartPart } from '../types';
import { moveBodyRow, multipartEditorMode, withMultipartEditorMode } from './MultipartEditor';

const textPart = (): MultipartPart => ({ id: 'part', name: 'payload', value: 'hello', enabled: true, description: 'Body', kind: 'text', multiline: false, contentType: 'text/plain' });

describe('multipart editor modes', () => {
  it('distinguishes text, multiline text, and files', () => {
    expect(multipartEditorMode(textPart())).toBe('text');
    expect(multipartEditorMode({ ...textPart(), multiline: true })).toBe('multiline');
    expect(multipartEditorMode({ ...textPart(), kind: 'file' })).toBe('file');
  });

  it('preserves text metadata while toggling multiline editing', () => {
    const multiline = withMultipartEditorMode(textPart(), 'multiline');
    expect(multiline).toMatchObject({ kind: 'text', multiline: true, value: 'hello', contentType: 'text/plain', description: 'Body' });
    expect(withMultipartEditorMode(multiline, 'text')).toMatchObject({ kind: 'text', multiline: false, value: 'hello', contentType: 'text/plain' });
  });

  it('clears incompatible file state when changing value families', () => {
    const file = { ...textPart(), kind: 'file' as const, fileName: 'renamed.txt', file: { fileName: 'source.txt', mimeType: 'text/plain', dataBase64: 'aGVsbG8=' } };
    expect(withMultipartEditorMode(file, 'multiline')).toMatchObject({ kind: 'text', multiline: true, fileName: '', contentType: '' });
    expect(withMultipartEditorMode(file, 'multiline').file).toBeUndefined();
    expect(withMultipartEditorMode(textPart(), 'file')).toMatchObject({ kind: 'file', multiline: false, fileName: '', contentType: '' });
  });

  it('moves ordered body rows only within their bounds', () => {
    const rows = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
    expect(moveBodyRow(rows, 'two', -1).map((row) => row.id)).toEqual(['two', 'one', 'three']);
    expect(moveBodyRow(rows, 'two', 1).map((row) => row.id)).toEqual(['one', 'three', 'two']);
    expect(moveBodyRow(rows, 'one', -1)).toBe(rows);
  });
});
