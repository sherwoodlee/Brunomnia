import { describe, expect, it } from 'vitest';
import { applyEditorCompletion, applyEditorTab } from './editorText';

describe('editor tab behavior', () => {
  it('inserts at the caret and indents a single-line selection without replacing content', () => {
    expect(applyEditorTab('ab', 1, 1, true, 2)).toEqual({ value: 'a\tb', selectionStart: 2, selectionEnd: 2 });
    expect(applyEditorTab('ab', 1, 2, false, 4)).toEqual({ value: '    ab', selectionStart: 5, selectionEnd: 6 });
    expect(applyEditorTab('', 0, 0, false, 99).value).toBe(' '.repeat(16));
  });

  it('indents and outdents every selected line while preserving content and selection', () => {
    const indented = applyEditorTab('one\ntwo\nthree', 0, 7, false, 2);
    expect(indented).toEqual({ value: '  one\n  two\nthree', selectionStart: 2, selectionEnd: 11 });
    expect(applyEditorTab(indented.value, indented.selectionStart, indented.selectionEnd, false, 2, true)).toEqual({
      value: 'one\ntwo\nthree',
      selectionStart: 0,
      selectionEnd: 7,
    });
  });

  it('outdents the current line without consuming non-indentation text', () => {
    expect(applyEditorTab('\tvalue', 4, 4, true, 2, true)).toEqual({ value: 'value', selectionStart: 3, selectionEnd: 3 });
    expect(applyEditorTab(' value', 1, 1, false, 4, true)).toEqual({ value: 'value', selectionStart: 0, selectionEnd: 0 });
  });
});

describe('editor completion behavior', () => {
  it('replaces the active GraphQL token and preserves following text', () => {
    expect(applyEditorCompletion('query { viewer { na } }', 19, 19, 'name')).toEqual({ value: 'query { viewer { name } }', selectionStart: 21, selectionEnd: 21 });
    expect(applyEditorCompletion('query { viewer {  } }', 17, 17, 'name')).toEqual({ value: 'query { viewer { name } }', selectionStart: 21, selectionEnd: 21 });
  });

  it('bounds malformed selections before insertion', () => {
    expect(applyEditorCompletion('id', -10, 99, 'name')).toEqual({ value: 'name', selectionStart: 4, selectionEnd: 4 });
  });
});
