import { describe, expect, it } from 'vitest';
import { extractKonnectExpressionFields, parseKonnectExpression } from './konnectExpression';

describe('Konnect expression routes', () => {
  it('extracts deduplicated method, exact/prefix path, host, and normalized header predicates', () => {
    expect(extractKonnectExpressionFields(
      '(http.method == "GET" || http.method == "GET" || http.method == "POST") && ' +
      '(http.path == "/v1" || http.path ^= "/v2") && ' +
      'http.host == "api.example.com" && http.headers.X_Tenant_Id == "acme"',
    )).toEqual({
      methods: ['GET', 'POST'],
      paths: ['/v1', '/v2'],
      hosts: ['api.example.com'],
      headers: { 'x-tenant-id': ['acme'] },
    });
  });

  it('keeps extractable predicates while unsupported predicates remain an explicit over-approximation', () => {
    expect(parseKonnectExpression('http.method == "GET" && net.src.ip in 10.0.0.0/8')).toEqual({
      fields: { methods: ['GET'], paths: [], hosts: [], headers: {} },
    });
    expect(extractKonnectExpressionFields('http.method != "DELETE" && http.path ~ r#"^/users/\\d+$"#')).toEqual({ methods: [], paths: [], hosts: [], headers: {} });
  });

  it('rejects SNI, unextractable, and oversized expressions with exact reasons', () => {
    expect(parseKonnectExpression('tls.sni == "secure.example.com" && http.method == "GET"').reason).toContain('tls.sni');
    expect(parseKonnectExpression('net.dst.port == 5432').reason).toContain('no extractable');
    expect(parseKonnectExpression('x'.repeat(100_001)).reason).toContain('safety limit');
  });
});
