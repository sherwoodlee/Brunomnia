import { describe, expect, it, vi } from 'vitest';
import { createScriptModules } from './scriptModules';

type AnyModule = Record<string, any>;

const modules = () => createScriptModules({
  atob,
  btoa,
  crypto,
  expect,
  structuredClone,
  TextDecoder,
  TextEncoder,
  URL,
  URLSearchParams,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
});

const documentedNames = [
  'ajv',
  'atob',
  'btoa',
  'chai',
  'cheerio',
  'crypto-js',
  'csv-parse',
  'lodash',
  'moment',
  'postman-collection',
  'tv4',
  'uuid',
  'xml2js',
  'assert',
  'buffer',
  'events',
  'path',
  'querystring',
  'punycode',
  'stream',
  'string-decoder',
  'timers',
  'url',
  'util',
] as const;

describe('script module adapters', () => {
  it('exposes every library and Node module documented by Insomnia', () => {
    const bundled = modules();
    expect(documentedNames.every((name) => Object.hasOwn(bundled, name))).toBe(true);
  });

  it('provides bounded schema, CSV, hash, markup, XML, date, and collection operations', async () => {
    const bundled = modules();
    const Ajv = bundled.ajv as new () => AnyModule;
    const ajv = new Ajv();
    expect(ajv.validate({ type: 'object', required: ['id'], properties: { id: { type: 'integer' } } }, { id: 1 })).toBe(true);
    expect((bundled.tv4 as AnyModule).validate({ id: 'wrong' }, { properties: { id: { type: 'integer' } } })).toBe(false);

    const csv = bundled['csv-parse'] as AnyModule;
    expect(csv.sync('name,role\nAda,admin', { columns: true })).toEqual([{ name: 'Ada', role: 'admin' }]);
    expect((bundled['crypto-js'] as AnyModule).SHA256('abc').toString()).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

    const $ = (bundled.cheerio as AnyModule).load('<main><p class="result">Ready</p></main>');
    expect($('.result').text()).toBe('Ready');
    expect(await (bundled.xml2js as AnyModule).parseStringPromise('<root><id>1</id></root>', { explicitArray: false })).toEqual({ root: { id: '1' } });
    expect((bundled.moment as any)('2026-07-17T03:04:05Z').utc().format('YYYY-MM-DD HH:mm:ss')).toBe('2026-07-17 03:04:05');

    const postman = bundled['postman-collection'] as AnyModule;
    const request = new postman.Request({ name: 'Create', method: 'POST', url: 'https://api.example.com/items', header: [{ key: 'Accept', value: 'application/json' }] });
    expect(request.toJSON()).toMatchObject({ name: 'Create', method: 'POST', url: 'https://api.example.com/items', header: [{ key: 'Accept', value: 'application/json', disabled: false }] });
  });

  it('provides common collection and Node compatibility helpers', async () => {
    const bundled = modules();
    const lodash = bundled.lodash as AnyModule;
    expect(lodash.get({ user: { names: ['Ada'] } }, 'user.names[0]')).toBe('Ada');
    expect(lodash.groupBy([{ role: 'admin' }, { role: 'reader' }, { role: 'admin' }], 'role')).toEqual({ admin: [{ role: 'admin' }, { role: 'admin' }], reader: [{ role: 'reader' }] });
    expect((bundled.querystring as AnyModule).parse('tag=one&tag=two')).toEqual({ tag: ['one', 'two'] });

    const Buffer = (bundled.buffer as AnyModule).Buffer;
    expect(Buffer.from('Brunomnia').toString('base64')).toBe('QnJ1bm9tbmlh');
    expect(Buffer.from('4272756e6f6d6e6961', 'hex').toString()).toBe('Brunomnia');
    expect((bundled.path as AnyModule).join('/collections', 'orders', '../items')).toBe('/collections/items');
    expect((bundled.url as AnyModule).resolve('https://api.example.com/v1/', '../status')).toBe('https://api.example.com/status');

    const EventEmitter = bundled.events as any;
    const emitter = new EventEmitter();
    const listener = vi.fn();
    emitter.once('ready', listener);
    emitter.emit('ready', 1);
    emitter.emit('ready', 2);
    expect(listener).toHaveBeenCalledOnce();

    const Readable = (bundled.stream as AnyModule).Readable;
    const Writable = (bundled.stream as AnyModule).Writable;
    const source = new Readable();
    const destination = new Writable();
    source.pipe(destination);
    source.push('chunk');
    source.push(null);
    expect(destination.chunks).toEqual(['chunk']);

    const StringDecoder = (bundled['string-decoder'] as AnyModule).StringDecoder;
    expect(new StringDecoder().end(Buffer.from('decoded'))).toBe('decoded');
    expect((bundled.util as AnyModule).format('%s:%d', 'status', 201)).toBe('status:201');
    expect((bundled.uuid as AnyModule).validate((bundled.uuid as AnyModule).v4())).toBe(true);
  });

  it('caps module input independently of script source limits', () => {
    const bundled = modules();
    expect(() => (bundled['crypto-js'] as AnyModule).SHA256('x'.repeat(5_000_001))).toThrow(/5 MB/);
  });
});
