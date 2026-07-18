import { describe, expect, it } from 'vitest';
import { parseCsvPreview } from './csvPreview';

describe('CSV response preview', () => {
  it('parses comma rows, quoted delimiters, escaped quotes, and multiline fields', () => {
    expect(parseCsvPreview('name,note\r\nAda,"hello, world"\r\nGrace,"line 1\nline ""2"""').rows).toEqual([
      ['name', 'note'],
      ['Ada', 'hello, world'],
      ['Grace', 'line 1\nline "2"'],
    ]);
  });

  it('detects tab, semicolon, and pipe delimiters outside quoted fields', () => {
    expect(parseCsvPreview('a\tb\n1\t2').delimiter).toBe('\t');
    expect(parseCsvPreview('a;b\n1;2').delimiter).toBe(';');
    expect(parseCsvPreview('a|b\n1|2').delimiter).toBe('|');
  });

  it('skips empty lines without dropping empty cells in populated rows', () => {
    expect(parseCsvPreview('a,,c\n\n1,,3\n').rows).toEqual([['a', '', 'c'], ['1', '', '3']]);
  });

  it('returns a visible parse error for unterminated quoted input', () => {
    expect(parseCsvPreview('a,b\n1,"open')).toMatchObject({ error: 'CSV contains an unterminated quoted field.', rows: [] });
  });

  it('bounds rows, columns, and cells while reporting truncation', () => {
    expect(parseCsvPreview('a,b,c\n1,2,3\n4,5,6', { maxRows: 2, maxColumns: 2, maxCells: 4 })).toEqual({
      delimiter: ',',
      error: '',
      rows: [['a', 'b'], ['1', '2']],
      truncated: true,
    });
  });
});
