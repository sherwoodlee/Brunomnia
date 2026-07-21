import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cloneSeedWorkspace } from '../../data/seed';
import { applyArtifactImport, importArtifact } from './index';

describe('artifact import adapters', () => {
  it('warns and removes inherited authority from Brunomnia plugins and integrations', () => {
    const workspace = cloneSeedWorkspace();
    workspace.plugins = [{
      id: 'plugin-one', name: 'Imported', version: '1.0.0', description: '', source: "require('events'); module.exports = {};", sourceFormat: 'insomnia-commonjs', enabled: true,
      requestedModules: ['events'], grantedModules: ['events'],
      requestedPermissions: ['network'], grantedPermissions: ['network'], installedAt: new Date().toISOString(),
    }];
    workspace.mcpClients = [{ id: 'mcp-one', name: 'Imported MCP', enabled: true, transport: 'http', url: 'https://mcp.example', command: '', args: [], env: [], headers: [], authType: 'oauth2', token: 'secret', username: '', password: '', oauthAuthorizationUrl: 'https://identity.example/authorize', oauthAccessTokenUrl: 'https://identity.example/token', oauthClientId: 'client', oauthClientSecret: 'client-secret', oauthScope: 'mcp', oauthState: '', oauthRefreshToken: 'refresh', oauthIdentityToken: 'identity', oauthExpiresAt: 123, oauthTokenPrefix: 'Bearer', oauthRegisteredClientId: 'registered-client', oauthRegisteredClientSecret: 'registered-secret', oauthRegisteredClientIdIssuedAt: 1, oauthRegisteredClientSecretExpiresAt: 2, oauthRegisteredTokenEndpointAuthMethod: 'client_secret_post', roots: [], tools: [], prompts: [], resources: [], resourceTemplates: [] }];
    workspace.ai = { ...workspace.ai, enabled: true, apiKey: 'secret' };
    const result = importArtifact(JSON.stringify(workspace), 'workspace.brunomnia.json');
    expect(result.warnings[0].message).toContain('capability grants were cleared');
    expect(result.warnings.some((warning) => warning.code === 'integrations-disabled')).toBe(true);
    expect(result.replacement?.plugins[0]).toMatchObject({ enabled: false, grantedPermissions: [], requestedModules: ['events'], grantedModules: [] });
    expect(result.replacement?.mcpClients[0]).toMatchObject({ enabled: false, token: '', oauthClientSecret: '', oauthRefreshToken: '', oauthIdentityToken: '', oauthExpiresAt: 0, oauthRegisteredClientId: '', oauthRegisteredClientSecret: '', oauthRegisteredClientIdIssuedAt: 0, oauthRegisteredClientSecretExpiresAt: 0, oauthRegisteredTokenEndpointAuthMethod: 'none' });
    expect(result.replacement?.ai).toMatchObject({ enabled: false, apiKey: '' });
  });

  it.each([
    ['insomnia-v4.json', 'insomnia-v4'],
    ['insomnia-v5.yaml', 'insomnia-v5'],
    ['postman-2.0.json', 'postman-2'],
    ['postman-2.1.json', 'postman-2'],
    ['sample.har', 'har'],
    ['openapi-3.yaml', 'openapi-3'],
    ['swagger-2.json', 'swagger-2'],
    ['calculator.wsdl', 'wsdl'],
    ['requests.sh', 'curl'],
  ])('detects the %s compatibility fixture', (fileName, format) => {
    const contents = readFileSync(new URL(`../../../examples/imports/${fileName}`, import.meta.url), 'utf8');
    expect(importArtifact(contents, fileName).format).toBe(format);
  });

  it('imports nested Postman 2.1 requests, variables, auth, bodies, and scripts', () => {
    const result = importArtifact(JSON.stringify({
      info: { name: 'Postman Shop', _postman_id: 'postman-shop', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      variable: [{ key: 'baseUrl', value: 'https://shop.example.com' }],
      item: [{ name: 'Orders', item: [{
        name: 'Create',
        event: [
          { listen: 'prerequest', script: { exec: ["pm.globals.set('global', 'yes');", "pm.collectionVariables.set('collection', 'yes');", "pm.variables.set('local', pm.iterationData.get('row'));", "pm.execution.skipRequest();", "postman.setNextRequest('next-request');", "pm.sendRequest('https://example.com', () => {});"] } },
          { listen: 'test', script: { exec: ["pm.test('created', () => pm.response.to.have.status(201));"] } },
        ],
        request: {
          method: 'POST', url: { raw: '{{baseUrl}}/orders', query: [{ key: 'preview', value: 'true' }] },
          header: [{ key: 'X-Client', value: 'postman' }],
          auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}' }] },
          body: { mode: 'raw', raw: '{"sku":"one"}', options: { raw: { language: 'json' } } },
        },
      }] }],
    }), 'shop.postman_collection.json');

    expect(result.format).toBe('postman-2');
    expect(result.collections[0].requests[0]).toMatchObject({ name: 'Orders / Create', method: 'POST', bodyMode: 'json' });
    expect(result.collections[0].requests[0].auth).toMatchObject({ type: 'bearer', token: '{{token}}' });
    expect(result.collections[0].requests[0].preRequestScript).toContain("insomnia.globals.set('global'");
    expect(result.collections[0].requests[0].preRequestScript).toContain("insomnia.collectionVariables.set('collection'");
    expect(result.collections[0].requests[0].preRequestScript).toContain("insomnia.variables.set('local', insomnia.iterationData.get('row'))");
    expect(result.collections[0].requests[0].preRequestScript).toContain('insomnia.execution.skipRequest()');
    expect(result.collections[0].requests[0].preRequestScript).toContain("insomnia.execution.setNextRequest('next-request')");
    expect(result.collections[0].requests[0].preRequestScript).toContain("insomnia.sendRequest('https://example.com'");
    expect(result.collections[0].requests[0].tests).toContain("insomnia.test('created'");
    expect(result.collections[0].requests[0].tests).toContain('insomnia.expect(insomnia.response.status).toBe(201)');
    expect(result.collections[0].environment?.[0]).toMatchObject({ name: 'baseUrl', value: 'https://shop.example.com' });
    expect(result.environments).toEqual([]);
  });

  it('imports custom methods, explicit path variables, descriptions, and multiline values', () => {
    const postman = importArtifact(JSON.stringify({
      info: { name: 'WebDAV', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [{ name: 'Inspect', request: {
        method: 'PROPFIND',
        url: { raw: 'https://api.example.com/files/:path', variable: [{ key: 'path', value: 'team docs', description: 'File path' }] },
        header: [{ key: 'X-Notes', value: 'first\nsecond', description: 'Audit notes' }],
      } }],
    }), 'webdav.postman_collection.json');
    expect(postman.warnings.some((warning) => warning.code === 'unsupported-method')).toBe(false);
    expect(postman.collections[0].requests[0]).toMatchObject({ method: 'PROPFIND', url: 'https://api.example.com/files/{path}' });
    expect(postman.collections[0].requests[0].pathParams[0]).toMatchObject({ name: 'path', value: 'team docs', description: 'File path' });
    expect(postman.collections[0].requests[0].headers[0]).toMatchObject({ value: 'first\nsecond', description: 'Audit notes' });

    const insomnia = importArtifact(JSON.stringify({ __export_format: 4, resources: [
      { _id: 'wrk', _type: 'workspace', name: 'WebDAV' },
      { _id: 'req', parentId: 'wrk', _type: 'request', name: 'Inspect', method: 'PROPFIND', url: 'https://api.example.com/files/{path}', pathParameters: [{ name: 'path', value: 'team docs', description: 'File path' }] },
    ] }), 'webdav-insomnia.json');
    expect(insomnia.collections[0].requests[0].method).toBe('PROPFIND');
    expect(insomnia.collections[0].requests[0].pathParams[0]).toMatchObject({ name: 'path', value: 'team docs', description: 'File path' });
  });

  it('maps advanced Postman and Insomnia auth families into executable fields', () => {
    const postman = importArtifact(JSON.stringify({
      info: { name: 'AWS', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [{ name: 'Signed', request: { method: 'GET', url: 'https://execute-api.us-west-2.amazonaws.com', auth: { type: 'awsv4', awsv4: [
        { key: 'accessKey', value: '{{access}}' }, { key: 'secretKey', value: '{{secret}}' }, { key: 'region', value: 'us-west-2' }, { key: 'service', value: 'execute-api' },
      ] } } }],
    }), 'aws.postman_collection.json');
    expect(postman.collections[0].requests[0].auth).toMatchObject({ type: 'iam', awsAccessKeyId: '{{access}}', awsSecretAccessKey: '{{secret}}', awsRegion: 'us-west-2' });

    const insomnia = importArtifact(`type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: Secured
meta: { id: wrk_secured }
collection:
  - name: Hawk request
    method: POST
    url: https://api.example.com/items
    authentication: { type: hawk, id: client, key: secret, algorithm: sha256, validatePayload: true }
cookieJar:
  name: Default
  cookies:
    - { key: session, value: abc, domain: api.example.com, path: /, secure: true, httpOnly: true }
`, 'secured.yaml');
    expect(insomnia.collections[0].requests[0].auth).toMatchObject({ type: 'hawk', hawkId: 'client', hawkKey: 'secret', hawkValidatePayload: true });
    expect(insomnia.cookies[0]).toMatchObject({ name: 'session', domain: 'api.example.com', secure: true, httpOnly: true });
  });

  it('imports HAR requests and detects bearer authentication', () => {
    const result = importArtifact(JSON.stringify({ log: { version: '1.2', creator: { name: 'Browser' }, entries: [{ request: {
      method: 'POST', url: 'https://api.example.com/items', httpVersion: 'HTTP/1.1',
      headers: [{ name: 'Authorization', value: 'Bearer abc' }], queryString: [], cookies: [],
      postData: { mimeType: 'application/x-www-form-urlencoded', params: [{ name: 'q', value: 'one' }] },
    } }] } }), 'capture.har');
    expect(result.format).toBe('har');
    expect(result.collections[0].requests[0]).toMatchObject({ method: 'POST', bodyMode: 'form-urlencoded' });
    expect(result.collections[0].requests[0].auth).toMatchObject({ type: 'bearer', token: 'abc' });
  });

  it('imports multiple cURL commands without executing shell syntax', () => {
    const result = importArtifact(`curl -X POST 'https://api.example.com/items' -H 'Content-Type: application/json' --data '{"ok":true}'
curl --get 'https://api.example.com/search' --data-urlencode 'q=two words'`, 'requests.sh');
    expect(result.format).toBe('curl');
    expect(result.collections[0].requests[0].transport.timeoutMode).toBe('global');
    expect(result.collections[0].requests[0].transport.validateCertificatesMode).toBe('global');
    expect(result.collections[0].requests[0].transport.proxyMode).toBe('global');
    expect(result.collections[0].requests).toHaveLength(2);
    expect(result.collections[0].requests[0]).toMatchObject({ method: 'POST', bodyMode: 'json' });
    expect(result.collections[0].requests[1].url).toContain('q=two%20words');
  });

  it('keeps an explicit cURL max-time as a custom request timeout', () => {
    const result = importArtifact("curl --max-time 0 'https://api.example.com/events'", 'timeout.sh');
    expect(result.collections[0].requests[0].transport).toMatchObject({ timeoutMode: 'custom', timeoutMs: 0 });
  });

  it('keeps cURL insecure as an explicit certificate override', () => {
    const result = importArtifact("curl --insecure 'https://dev.example.com'", 'insecure.sh');
    expect(result.collections[0].requests[0].transport).toMatchObject({ validateCertificates: false, validateCertificatesMode: 'off' });
  });

  it('keeps an explicit cURL proxy as a custom request proxy', () => {
    const result = importArtifact("curl --proxy 'http://proxy.example:8080' 'https://api.example.com'", 'proxy.sh');
    expect(result.collections[0].requests[0].transport).toMatchObject({ proxyMode: 'custom', proxyUrl: 'http://proxy.example:8080' });
  });

  it('imports OpenAPI 3 and Swagger 2 documents', () => {
    const openapi = importArtifact(`openapi: 3.1.0
info: { title: Pets, version: 1.0.0 }
servers: [{ url: https://api.example.com }]
paths:
  /pets:
    get:
      operationId: listPets
      responses: { '200': { description: ok } }
`, 'pets.yaml');
    expect(openapi.format).toBe('openapi-3');
    expect(openapi.apiDesigns).toHaveLength(1);
    expect(openapi.collections[0].requests[0].url).toBe('https://api.example.com/pets');

    const swagger = importArtifact(JSON.stringify({ swagger: '2.0', info: { title: 'Legacy', version: '1' }, schemes: ['https'], host: 'legacy.example.com', basePath: '/v1', paths: { '/pets/{id}': { get: { operationId: 'getPet', responses: { 200: { description: 'ok' } }, parameters: [{ in: 'query', name: 'expand', type: 'boolean' }] } } } }), 'legacy.json');
    expect(swagger.format).toBe('swagger-2');
    expect(swagger.collections[0].requests[0]).toMatchObject({ method: 'GET', url: 'https://legacy.example.com/v1/pets/{{ id }}' });
  });

  it('imports WSDL services into SOAP request templates', () => {
    const result = importArtifact(`<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" targetNamespace="urn:calculator">
  <binding name="CalculatorBinding"><operation name="Add"><soap:operation soapAction="urn:add" /></operation></binding>
  <service name="Calculator"><port name="CalculatorPort" binding="tns:CalculatorBinding"><soap:address location="https://soap.example.com/calculator" /></port></service>
</definitions>`, 'calculator.wsdl');
    expect(result.format).toBe('wsdl');
    expect(result.collections[0].requests[0]).toMatchObject({ name: 'Add', method: 'POST', bodyMode: 'text' });
    expect(result.collections[0].requests[0].body).toContain('<tns:Add>');
  });

  it('imports Insomnia v4 resources and v5 nested collections', () => {
    const v4 = importArtifact(JSON.stringify({ __export_format: 4, __export_source: 'insomnia.desktop.app:v12', resources: [
      { _id: 'wrk_1', parentId: null, name: 'V4 Workspace', _type: 'workspace' },
      { _id: 'fld_1', parentId: 'wrk_1', name: 'Folder', _type: 'request_group' },
      { _id: 'req_1', parentId: 'fld_1', name: 'Get one', method: 'GET', url: 'https://api.example.com/one', headers: [], parameters: [], settingFollowRedirects: 'off', _type: 'request' },
      { _id: 'greq_1', parentId: 'wrk_1', name: 'Registry schema', url: 'grpcs://grpc.example.com', body: { text: '{"name":"Ada"}' }, metadata: [], protoMethodName: 'acme.Greeter/SayHello', reflectionApi: { enabled: true, url: 'https://buf.example.com', apiKey: '{{ vault.buf }}', module: 'buf.build/acme/greeter' }, disableUserAgentHeader: true, _type: 'grpc_request' },
      { _id: 'env_1', parentId: 'wrk_1', name: 'Base', data: { token: 'abc' }, _type: 'environment' },
      { _id: 'uts_1', parentId: 'wrk_1', name: 'Contract suite', metaSortKey: -2, _type: 'unit_test_suite' },
      { _id: 'ut_1', parentId: 'uts_1', requestId: 'req_1', name: 'Returns 200', code: 'const response = await insomnia.send();', metaSortKey: -1, _type: 'unit_test' },
    ] }), 'insomnia-v4.json');
    expect(v4.format).toBe('insomnia-v4');
    expect(v4.collections[0].requests[0].name).toBe('Get one');
    expect(v4.collections[0].requests[0].transport.followRedirectsMode).toBe('off');
    expect(v4.collections[0].folders?.[0]).toMatchObject({ name: 'Folder', parentId: '' });
    expect(v4.collections[0].requests[0].folderId).toBe(v4.collections[0].folders?.[0].id);
    expect(v4.collections[0].environment?.[0]).toMatchObject({ name: 'token', value: 'abc' });
    expect(v4.testSuites).toEqual([expect.objectContaining({ name: 'Contract suite', collectionId: v4.collections[0].id, tests: [expect.objectContaining({ name: 'Returns 200', requestId: v4.collections[0].requests[0].id })] })]);
    expect(v4.collections[0].requests.find((request) => request.protocol === 'grpc')).toMatchObject({
      disableUserAgentHeader: true,
      grpc: {
        descriptorSource: 'buf',
        reflectionApiUrl: 'https://buf.example.com',
        reflectionApiKey: '{{ vault.buf }}',
        reflectionApiModule: 'buf.build/acme/greeter',
      },
    });

    const v5 = importArtifact(`type: spec.insomnia.rest/5.0
schema_version: "5.1"
name: V5 Workspace
meta: { id: wrk_v5 }
cookieJar:
  name: Default Jar
  cookies:
    - { id: cookie_v5, key: sid, value: imported, domain: api.example.com, path: / }
spec: { contents: "openapi: 3.1.0" }
collection:
  - name: Folder
    meta: { id: fld_v5 }
    children:
      - name: Create
        meta: { id: req_v5 }
        method: POST
        url: https://api.example.com/items
        settings: { followRedirects: on }
        body: { mimeType: application/json, text: '{"ok":true}' }
      - name: Legacy gRPC
        meta: { id: greq_v5 }
        url: grpc://localhost:50051
        body: { text: '{}' }
        metadata: []
        protoFileId: pf_missing
        protoMethodName: acme.Greeter/SayHello
        reflectionApi: { enabled: false, url: '', apiKey: '', module: '' }
environments:
  name: Base
  data: { baseUrl: https://api.example.com }
testSuites:
  - name: V5 contract suite
    meta: { id: uts_v5, sortKey: -2 }
    tests:
      - name: Creates an item
        meta: { id: ut_v5, sortKey: -1 }
        requestId: req_v5
        code: const response = await insomnia.send();
`, 'insomnia-v5.yaml');
    expect(v5.format).toBe('insomnia-v5');
    expect(v5.collections[0].requests[0]).toMatchObject({ name: 'Create', bodyMode: 'json', transport: expect.objectContaining({ followRedirectsMode: 'on' }) });
    expect(v5.collections[0].folders?.[0]).toMatchObject({ name: 'Folder', parentId: '' });
    expect(v5.collections[0].requests[0].folderId).toBe(v5.collections[0].folders?.[0].id);
    expect(v5.collections[0].requests[1].grpc.descriptorSource).toBe('reflection');
    expect(v5.collections[0].requests[1].source?.unsupported).toMatchObject({ protoFileId: 'pf_missing' });
    expect(v5.warnings).toContainEqual(expect.objectContaining({ code: 'external-schema', resource: 'Legacy gRPC' }));
    expect(v5.collections[0].environment?.[0]).toMatchObject({ name: 'baseUrl', value: 'https://api.example.com' });
    expect(v5.testSuites).toEqual([expect.objectContaining({ name: 'V5 contract suite', collectionId: v5.collections[0].id, tests: [expect.objectContaining({ name: 'Creates an item', requestId: v5.collections[0].requests[0].id })] })]);
    const applied = applyArtifactImport(cloneSeedWorkspace(), v5);
    const appliedCollection = applied.collections.at(-1)!;
    expect(appliedCollection.requests[0].folderId).toBe(appliedCollection.folders?.[0].id);
    expect(appliedCollection.folders?.[0].id).not.toBe(v5.collections[0].folders?.[0].id);
    expect(applied.testSuites.at(-1)).toMatchObject({ collectionId: appliedCollection.id, tests: [expect.objectContaining({ requestId: appliedCollection.requests[0].id })] });
    expect(applied.fileState[applied.apiDesigns.at(-1)!.id].cookies).toEqual([expect.objectContaining({ name: 'sid', value: 'imported' })]);
    const appliedAgain = applyArtifactImport(applied, v5);
    expect(new Set(appliedAgain.testSuites.map((suite) => suite.id)).size).toBe(appliedAgain.testSuites.length);
    expect(new Set(appliedAgain.testSuites.flatMap((suite) => suite.tests.map((test) => test.id))).size).toBe(appliedAgain.testSuites.reduce((total, suite) => total + suite.tests.length, 0));
  });

  it.each([
    [1, {
      __export_format: 1,
      items: [{ name: 'Legacy group', environments: { base: { host: 'https://legacy.example' } }, requests: [{ name: 'Create item', method: 'POST', url: '{{ host }}/items', headers: [], body: '{"ok":true}', __insomnia: { format: 'json' } }] }],
    }],
    [2, {
      __export_format: 2,
      resources: [
        { _id: 'wrk_legacy', parentId: null, name: 'Legacy v2', _type: 'workspace' },
        { _id: 'req_legacy', parentId: 'wrk_legacy', name: 'Create item', method: 'POST', url: 'https://legacy.example/items', headers: [{ name: 'Content-Type', value: 'application/json' }], body: '{"ok":true}', _type: 'request' },
      ],
    }],
    [3, {
      __export_format: 3,
      resources: [
        { _id: 'wrk_legacy', parentId: null, name: 'Legacy v3', _type: 'workspace' },
        { _id: 'req_legacy', parentId: 'wrk_legacy', name: 'Create item', method: 'POST', url: 'https://legacy.example/items', headers: [], body: { mimeType: 'application/json', text: '{"ok":true}' }, _type: 'request' },
      ],
    }],
  ])('imports bounded Insomnia v%s exports through the v4 compatibility mapper', (version, document) => {
    const result = importArtifact(JSON.stringify(document), `insomnia-v${version}.json`);
    expect(result.format).toBe(`insomnia-v${version}`);
    expect(result.metadata.legacyVersion).toBe(String(version));
    expect(result.warnings[0]).toMatchObject({ code: 'legacy-format' });
    expect(result.collections[0].requests[0]).toMatchObject({ name: 'Create item', method: 'POST', bodyMode: 'json', body: '{"ok":true}' });
  });

  it('imports Socket.IO requests and promotes legacy nested MCP data to a disabled client', () => {
    const result = importArtifact(`type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: Realtime
meta: { id: wrk_realtime }
collection:
  - name: Rooms
    url: https://socket.example
    meta: { id: socketio-req-abc }
    settings: { path: /custom-path, cookies: { send: false, store: true } }
    eventListeners: [{ id: ev1, eventName: join, isOpen: true }]
    payload: { eventName: message, ack: true, args: [{ id: arg1, mode: json, value: '{"room":"orders"}' }] }
  - name: Tools
    url: https://mcp.example
    transportType: streamable-http
    meta: { id: mcp-req-abc }
    headers: [{ name: Authorization, value: Bearer plaintext }]
    env:
      - { id: mode, name: MODE, value: review, type: str, enabled: false }
      - { id: token, name: API_TOKEN, value: plaintext-token, type: str, enabled: true }
    roots: [{ uri: file:///workspace }]
    authentication: { type: bearer, token: plaintext-token }
`, 'realtime.yaml');

    expect(result.collections[0].requests[0]).toMatchObject({
      protocol: 'socketio',
      method: 'GET',
      transport: expect.objectContaining({ sendCookies: false, storeCookies: true }),
      socketIo: {
        path: '/custom-path', eventName: 'message', ack: true,
        args: [{ id: 'arg1', mode: 'json', value: '{"room":"orders"}' }],
        eventListeners: [{ id: 'ev1', eventName: 'join', description: '', enabled: true }],
      },
    });
    expect(result.collections[0].requests).toHaveLength(1);
    expect(result.mcpClients).toEqual([expect.objectContaining({
      name: 'Tools', enabled: false, transport: 'http', url: 'https://mcp.example', authType: 'bearer', token: '',
      headers: [expect.objectContaining({ name: 'Authorization', value: '' })],
      env: [expect.objectContaining({ id: 'mode', name: 'MODE', value: 'review', enabled: false }), expect.objectContaining({ id: 'token', name: 'API_TOKEN', value: '' })],
      roots: ['file:///workspace'],
    })]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'integrations-disabled', resource: 'Tools' }));
    expect(result.warnings.filter((warning) => warning.code === 'unsupported-protocol')).toHaveLength(0);
  });

  it('imports a first-class v5 MCP document without interpreting shell operators', () => {
    const result = importArtifact(`type: mcpClient.insomnia/5.0
schema_version: "5.1"
name: Unsafe local tools
meta: { id: mcp-workspace }
mcpRequest:
  name: Unsafe local tools
  url: node server.js && touch /tmp/should-not-run
  transportType: stdio
  meta: { id: mcp-req-unsafe }
`, 'mcp.insomnia.yaml');

    expect(result.collections).toEqual([]);
    expect(result.mcpClients).toEqual([expect.objectContaining({ transport: 'stdio', command: 'node server.js && touch /tmp/should-not-run', args: [], enabled: false })]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'mcp-command', resource: 'Unsafe local tools' }));
  });

  it('omits non-portable Insomnia Secret environment ciphertext with an explicit warning', () => {
    const result = importArtifact(`type: environment.insomnia.rest/5.0
schema_version: "5.1"
name: Private values
meta: { id: global-private }
environments:
  name: Base Environment
  meta: { id: global-base }
  data:
    region: us-west-2
    __insomnia_vault: { token: encrypted-account-ciphertext }
`, 'private.insomnia.yaml');
    expect(result.environments[0].variables).toEqual([expect.objectContaining({ name: 'region', value: 'us-west-2' })]);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'environment-secrets-omitted' }));
    expect(JSON.stringify(result)).not.toContain('encrypted-account-ciphertext');
  });

  it('imports Postman environments and applies resources with collision-safe IDs', () => {
    const result = importArtifact(JSON.stringify({ id: 'environment', name: 'Staging', _postman_variable_scope: 'environment', _postman_exported_at: '2026-01-01', values: [{ key: 'host', value: 'https://staging.example.com', enabled: true }] }), 'staging.postman_environment.json');
    expect(result.format).toBe('postman-environment');
    const first = applyArtifactImport(cloneSeedWorkspace(), result);
    const second = applyArtifactImport(first, result);
    expect(second.version).toBe(47);
    expect(new Set(second.environments.map((environment) => environment.id)).size).toBe(second.environments.length);
    expect(second.imports).toHaveLength(2);
  });
});
