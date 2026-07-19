import { describe, expect, it } from 'vitest';
import { expandMcpUriTemplate, mcpUriTemplateVariables } from './mcpUriTemplate';

describe('MCP RFC 6570 URI templates', () => {
  const values = {
    var: 'value',
    hello: 'Hello World!',
    path: '/foo/bar',
    list: ['red', 'green', 'blue'],
    keys: { semi: ';', dot: '.', comma: ',' },
    x: '1024',
    y: '768',
    empty: '',
  };

  it('expands scalar, reserved, fragment, and prefix expressions', () => {
    expect(expandMcpUriTemplate('{var}', values)).toBe('value');
    expect(expandMcpUriTemplate('{hello}', values)).toBe('Hello%20World%21');
    expect(expandMcpUriTemplate('{+path}/here', values)).toBe('/foo/bar/here');
    expect(expandMcpUriTemplate('{#path}', values)).toBe('#/foo/bar');
    expect(expandMcpUriTemplate('{var:3}', values)).toBe('val');
  });

  it('expands list and object values across path and query operators', () => {
    expect(expandMcpUriTemplate('{/list*}', values)).toBe('/red/green/blue');
    expect(expandMcpUriTemplate('{?x,y,empty}', values)).toBe('?x=1024&y=768&empty=');
    expect(expandMcpUriTemplate('{&list*}', values)).toBe('&list=red&list=green&list=blue');
    expect(expandMcpUriTemplate('{;keys*}', values)).toBe(';semi=%3B;dot=.;comma=%2C');
    expect(expandMcpUriTemplate('{?keys*}', values)).toBe('?semi=%3B&dot=.&comma=%2C');
    expect(expandMcpUriTemplate('{;list*}', { list: ['', 'blue'] })).toBe(';list;list=blue');
    expect(expandMcpUriTemplate('{;keys*}', { keys: { empty: '', value: 'yes' } })).toBe(';empty;value=yes');
  });

  it('extracts stable unique variables and rejects malformed templates', () => {
    expect(mcpUriTemplateVariables('files://{/path}{?query,limit}{&query}')).toEqual(['path', 'query', 'limit']);
    expect(() => expandMcpUriTemplate('files://{query', {})).toThrow('unclosed');
    expect(() => expandMcpUriTemplate('files://{bad name}', {})).toThrow('invalid variable');
    expect(() => expandMcpUriTemplate('files://{items*:2}', {})).toThrow('invalid variable');
    expect(() => expandMcpUriTemplate('x'.repeat(8193), {})).toThrow('8,192');
    expect(() => expandMcpUriTemplate(Array.from({ length: 101 }, (_, index) => `{v${index}}`).join(''), {})).toThrow('100 expressions');
    expect(() => expandMcpUriTemplate('{value:10001}', { value: 'x' })).toThrow('10,000');
    expect(() => expandMcpUriTemplate('{value:2}', { value: ['one'] })).toThrow('scalar');
    expect(() => expandMcpUriTemplate('{value}', { value: 'x'.repeat(32769) })).toThrow('32,768');
  });
});
