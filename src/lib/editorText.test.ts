import { describe, expect, it } from 'vitest';
import { applyEditorTab } from './editorText';

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
