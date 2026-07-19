import { describe, expect, it } from 'vitest';
import { createBlankRequest } from '../data/seed';
import { buildTemplateTag, insertTemplateTag, templateTagDestinations } from './templateTagBuilder';

describe('guided template tag builder', () => {
  it('builds pinned local and external tag syntax with escaped arguments', () => {
    expect(buildTemplateTag('environment', { name: 'baseUrl' })).toBe('{{ baseUrl }}');
    expect(buildTemplateTag('faker', { name: 'randomFullName' })).toBe('{{ faker.randomFullName }}');
    expect(buildTemplateTag('now', { format: 'custom', formatTemplate: 'yyyy-MM-dd' })).toBe("{% now 'custom', 'yyyy-MM-dd' %}");
    expect(buildTemplateTag('os', { function: 'userInfo', path: '$.username' })).toBe("{% os 'userInfo', '$.username' %}");
    expect(buildTemplateTag('base64', { operation: 'encode', encoding: 'url', value: "one's" })).toBe("{% base64 'encode', 'url', 'one\\'s' %}");
    expect(buildTemplateTag('cookie', { url: 'https://api.example.com', name: 'session' })).toBe("{% cookie 'https://api.example.com', 'session' %}");
    expect(buildTemplateTag('external', { provider: 'hashicorp', reference: 'secret/orders', scope: '', field: 'token', version: 'latest' })).toBe("{% external 'hashicorp', 'secret/orders', '', 'token', 'latest' %}");
    expect(buildTemplateTag('prompt', { title: 'Password', label: 'Value', value: '', storageKey: 'login', maskText: 'true', saveLastValue: 'false' })).toBe("{% prompt 'Password', 'Value', '', 'login', 'true', 'false' %}");
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

  it('targets realtime and Buf registry fields rendered during execution', () => {
    const websocket = createBlankRequest('websocket-tags');
    websocket.protocol = 'websocket';
    expect(templateTagDestinations(websocket)).toContainEqual({ id: 'body', label: 'WebSocket message' });

    const socketIo = createBlankRequest('socketio-tags');
    socketIo.protocol = 'socketio';
    socketIo.socketIo.args = [{ id: 'argument', mode: 'json', value: '{}' }];
    socketIo.socketIo.eventListeners = [{ id: 'listener', eventName: 'orders', description: '', enabled: true }];
    expect(templateTagDestinations(socketIo).map((item) => item.id)).toEqual(expect.arrayContaining(['socketio:path', 'socketio:eventName', 'socketio-arg:argument', 'socketio-listener:listener']));
    expect(insertTemplateTag(socketIo, 'socketio-arg:argument', '{{ payload }}', 'replace').socketIo.args[0].value).toBe('{{ payload }}');
    expect(insertTemplateTag(socketIo, 'socketio-listener:listener', '.updated', 'append').socketIo.eventListeners[0].eventName).toBe('orders.updated');

    const grpc = createBlankRequest('grpc-buf-tags');
    grpc.protocol = 'grpc';
    expect(templateTagDestinations(grpc).map((item) => item.id)).toEqual(expect.arrayContaining(['grpc:reflectionApiUrl', 'grpc:reflectionApiKey', 'grpc:reflectionApiModule']));
    expect(insertTemplateTag(grpc, 'grpc:reflectionApiModule', '{{ module }}', 'replace').grpc.reflectionApiModule).toBe('{{ module }}');
  });
});
