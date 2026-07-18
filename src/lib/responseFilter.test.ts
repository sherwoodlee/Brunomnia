import { describe, expect, it } from 'vitest';
import type { HttpResponse } from '../types';
import { applyResponseBodyFilter, queryJsonPath, rememberResponseFilter, responseFilterLanguage } from './responseFilter';

const response = (body: string, contentType = 'application/json'): HttpResponse => ({
  status: 200,
  statusText: 'OK',
  headers: { 'Content-Type': contentType },
  body,
  durationMs: 1,
  sizeBytes: body.length,
});

describe('response body filters', () => {
  it('filters nested properties and array wildcards with JSONPath', () => {
    const body = JSON.stringify({ store: { books: [{ author: 'Ada' }, { author: 'Grace' }] } });
    expect(queryJsonPath(body, '$.store.books[*].author')).toEqual(['Ada', 'Grace']);
    expect(applyResponseBodyFilter(response(body), '$.store.books[*].author')).toEqual({
      contents: '[\n  "Ada",\n  "Grace"\n]',
      error: '',
      matchCount: 2,
    });
  });

  it('supports bracket properties, numeric indexes, and recursive descent', () => {
    const body = JSON.stringify({ 'team-name': { members: [{ id: 1 }, { id: 2 }] }, nested: { id: 3 } });
    expect(queryJsonPath(body, "$['team-name'].members[1].id")).toEqual([2]);
    expect(queryJsonPath(body, '$..id')).toEqual([1, 2, 3]);
  });

  it('reports invalid JSONPath without mutating the response', () => {
    const original = response('{"items":[1]}');
    expect(applyResponseBodyFilter(original, '$.items[?(@ > 0)]')).toMatchObject({ contents: '[]', matchCount: null });
    expect(original.body).toBe('{"items":[1]}');
  });

  it('detects JSON despite a misleading content type and recognizes XML', () => {
    expect(responseFilterLanguage(response('{"ok":true}', 'text/plain'))).toBe('json');
    expect(responseFilterLanguage(response('<orders><id>1</id></orders>', 'application/xml'))).toBe('xml');
    expect(responseFilterLanguage(response('hello', 'text/plain'))).toBe('');
  });

  it('keeps ten unique recent filters in newest-first order', () => {
    const history = Array.from({ length: 10 }, (_, index) => `$.item${index}`);
    expect(rememberResponseFilter(history, '$.item4')[0]).toBe('$.item4');
    expect(rememberResponseFilter(history, ' $.new ')[0]).toBe('$.new');
    expect(rememberResponseFilter(history, '$.new')).toHaveLength(10);
    expect(rememberResponseFilter(history, '')).toEqual(history);
  });
});
