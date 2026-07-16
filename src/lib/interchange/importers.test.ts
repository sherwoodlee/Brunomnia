import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cloneSeedWorkspace } from '../../data/seed';
import { applyArtifactImport, importArtifact } from './index';

describe('artifact import adapters', () => {
  it('warns and removes inherited authority from Brunomnia plugins', () => {
    const workspace = cloneSeedWorkspace();
    workspace.plugins = [{
      id: 'plugin-one', name: 'Imported', version: '1.0.0', description: '', source: 'module.exports = {};', sourceFormat: 'insomnia-commonjs', enabled: true,
      requestedPermissions: ['network'], grantedPermissions: ['network'], installedAt: new Date().toISOString(),
    }];
    const result = importArtifact(JSON.stringify(workspace), 'workspace.brunomnia.json');
    expect(result.warnings[0].message).toContain('capability grants were cleared');
    expect(result.replacement?.plugins[0]).toMatchObject({ enabled: false, grantedPermissions: [] });
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
        event: [{ listen: 'test', script: { exec: ["pm.test('created', () => pm.response.to.have.status(201));"] } }],
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
    expect(result.collections[0].requests[0].tests).toContain("insomnia.test('created'");
    expect(result.environments[0].variables[0]).toMatchObject({ name: 'baseUrl', value: 'https://shop.example.com' });
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
    expect(result.collections[0].requests).toHaveLength(2);
    expect(result.collections[0].requests[0]).toMatchObject({ method: 'POST', bodyMode: 'json' });
    expect(result.collections[0].requests[1].url).toContain('q=two%20words');
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
      { _id: 'req_1', parentId: 'fld_1', name: 'Get one', method: 'GET', url: 'https://api.example.com/one', headers: [], parameters: [], _type: 'request' },
      { _id: 'env_1', parentId: 'wrk_1', name: 'Base', data: { token: 'abc' }, _type: 'environment' },
    ] }), 'insomnia-v4.json');
    expect(v4.format).toBe('insomnia-v4');
    expect(v4.collections[0].requests[0].name).toBe('Folder / Get one');
    expect(v4.environments[0].variables[0]).toMatchObject({ name: 'token', value: 'abc' });

    const v5 = importArtifact(`type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: V5 Workspace
meta: { id: wrk_v5 }
collection:
  - name: Folder
    meta: { id: fld_v5 }
    children:
      - name: Create
        meta: { id: req_v5 }
        method: POST
        url: https://api.example.com/items
        body: { mimeType: application/json, text: '{"ok":true}' }
environments:
  name: Base
  data: { baseUrl: https://api.example.com }
`, 'insomnia-v5.yaml');
    expect(v5.format).toBe('insomnia-v5');
    expect(v5.collections[0].requests[0]).toMatchObject({ name: 'Folder / Create', bodyMode: 'json' });
  });

  it('preserves unsupported Insomnia real-time request details with explicit warnings', () => {
    const result = importArtifact(`type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: Realtime
meta: { id: wrk_realtime }
collection:
  - name: Rooms
    url: https://socket.example
    meta: { id: socketio-req-abc }
    eventListeners: [{ id: ev1, eventName: join, isOpen: true }]
  - name: Tools
    url: https://mcp.example
    transportType: streamable-http
    meta: { id: mcp-req-abc }
`, 'realtime.yaml');

    expect(result.collections[0].requests[0]).toMatchObject({ protocol: 'websocket', method: 'GET' });
    expect(result.collections[0].requests[0].source?.unsupported?.socketIo).toBeTruthy();
    expect(result.collections[0].requests[1]).toMatchObject({ protocol: 'http', method: 'POST' });
    expect(result.warnings.filter((warning) => warning.code === 'unsupported-protocol')).toHaveLength(2);
  });

  it('imports Postman environments and applies resources with collision-safe IDs', () => {
    const result = importArtifact(JSON.stringify({ id: 'environment', name: 'Staging', _postman_variable_scope: 'environment', _postman_exported_at: '2026-01-01', values: [{ key: 'host', value: 'https://staging.example.com', enabled: true }] }), 'staging.postman_environment.json');
    expect(result.format).toBe('postman-environment');
    const first = applyArtifactImport(cloneSeedWorkspace(), result);
    const second = applyArtifactImport(first, result);
    expect(second.version).toBe(7);
    expect(new Set(second.environments.map((environment) => environment.id)).size).toBe(second.environments.length);
    expect(second.imports).toHaveLength(2);
  });
});
