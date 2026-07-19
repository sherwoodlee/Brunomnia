import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { buildTemplateTag, insertTemplateTag, templateTagDestinations } from './templateTagBuilder';

describe('guided template tag builder', () => {
  it('builds pinned local and external tag syntax with escaped arguments', () => {
    expect(buildTemplateTag('environment', { name: 'baseUrl' })).toBe('{{ baseUrl }}');
    expect(buildTemplateTag('faker', { name: 'randomFullName' })).toBe('{{ faker.randomFullName }}');
    expect(buildTemplateTag('base64', { operation: 'encode', encoding: 'url', value: "one's" })).toBe("{% base64 'encode', 'url', 'one\\'s' %}");
    expect(buildTemplateTag('cookie', { url: 'https://api.example.com', name: 'session' })).toBe("{% cookie 'https://api.example.com', 'session' %}");
    expect(buildTemplateTag('external', { provider: 'hashicorp', reference: 'secret/orders', scope: '', field: 'token', version: 'latest' })).toBe("{% external 'hashicorp', 'secret/orders', '', 'token', 'latest' %}");
  });

  it('enumerates editable request destinations and inserts without mutating the source', () => {
    const request = createBlankRequest('tag-builder');
    request.url = 'https://api.example.com/';
    request.headers = [{ id: 'header:with:colon', name: 'X-Token', value: 'Bearer ', enabled: true }];
    request.params = [{ id: 'query', name: 'filter', value: '', enabled: true }];
    request.bodyMode = 'json';
    request.body = '{"id":""}';
    request.auth = { ...request.auth, type: 'bearer', token: 'Bearer ' };
    expect(templateTagDestinations(request).map((item) => item.label)).toEqual(expect.arrayContaining(['Request name', 'Request URL', 'Request body', 'Header value · X-Token', 'Header name · X-Token', 'Query parameter value · filter', 'Authentication · token']));

    const header = insertTemplateTag(request, 'header:header:with:colon', '{{ token }}', 'append');
    expect(header.headers[0].value).toBe('Bearer {{ token }}');
    expect(request.headers[0].value).toBe('Bearer ');
    expect(insertTemplateTag(request, 'query:query', "{% faker 'randomUUID' %}", 'replace').params[0].value).toBe("{% faker 'randomUUID' %}");
    expect(insertTemplateTag(request, 'body', '{{ payload }}', 'append').body).toBe('{"id":""}{{ payload }}');
    expect(insertTemplateTag(request, 'auth:token', '{{ authToken }}', 'append').auth.token).toBe('Bearer {{ authToken }}');
  });

  it('rejects destinations removed while the dialog was open', () => {
    expect(() => insertTemplateTag(createBlankRequest('missing'), 'header:missing', '{{ value }}', 'append')).toThrow("destination 'header:missing' is no longer available");
    expect(() => insertTemplateTag(createBlankRequest('missing'), 'unknown:missing', '{{ value }}', 'append')).toThrow("destination 'unknown:missing' is no longer available");
  });
});
