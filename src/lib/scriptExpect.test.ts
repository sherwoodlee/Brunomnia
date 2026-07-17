import { describe, expect, it } from 'vitest';
import { createScriptExpect } from './scriptExpect';

describe('shared script expect adapter', () => {
  const scriptExpect = () => createScriptExpect();

  it('resolves the current BDD chain, method, and alias inventory', () => {
    const check = scriptExpect();
    const chain = check({ id: 1 });
    const language = ['to', 'be', 'been', 'is', 'that', 'which', 'and', 'has', 'have', 'with', 'at', 'of', 'same', 'but', 'does', 'still', 'also'];
    const flags = ['not', 'deep', 'nested', 'own', 'ordered', 'any', 'all', 'itself'];
    const methods = [
      'a', 'an', 'include', 'includes', 'contain', 'contains', 'equal', 'equals', 'eq', 'eql', 'eqls',
      'above', 'gt', 'greaterThan', 'least', 'gte', 'below', 'lt', 'lessThan', 'most', 'lte', 'within',
      'instanceof', 'instanceOf', 'property', 'ownProperty', 'haveOwnProperty', 'ownPropertyDescriptor', 'haveOwnPropertyDescriptor', 'lengthOf', 'length',
      'match', 'matches', 'string', 'keys', 'key', 'throw', 'throws', 'Throw', 'respondTo', 'respondsTo',
      'satisfy', 'satisfies', 'closeTo', 'approximately', 'members', 'oneOf', 'change', 'changes', 'increase', 'increases',
      'decrease', 'decreases', 'by', 'toBe', 'toEqual', 'toContain', 'toBeTruthy', 'toBeLessThan', 'toBeGreaterThan',
    ];
    expect(language.every((name) => typeof chain[name] === 'object')).toBe(true);
    expect(flags.every((name) => typeof chain[name] === 'object')).toBe(true);
    expect(methods.every((name) => typeof chain[name] === 'function')).toBe(true);

    check(1).ok;
    check(true).true;
    check(false).false;
    check(null).null;
    check(undefined).undefined;
    check(NaN).NaN;
    check('value').exist;
    check('value').exists;
    check([]).empty;
    (function (..._values: unknown[]) { check(arguments).arguments.Arguments; })('value');
    check({}).extensible;
    check(Object.seal({})).sealed;
    check(Object.freeze({})).frozen;
    check(1).finite;
  });

  it('covers value, type, inclusion, property, and key chains', () => {
    const check = scriptExpect();
    check(true).to.be.true;
    check(null).to.be.null;
    check(undefined).to.be.undefined;
    check(NaN).to.be.NaN;
    check('ready').to.be.a('string').and.not.be.empty;
    check({ response: { body: [{ id: 42 }] } }).to.deep.nested.include({ 'response.body[0]': { id: 42 } });
    check({ response: { status: 201 } }).to.have.nested.property('response.status').that.equals(201);
    check(Object.assign(Object.create({ inherited: true }), { own: true })).to.have.ownProperty('own').and.not.haveOwnProperty('inherited');
    check({ id: 1, name: 'Ada', role: 'admin' }).to.include.all.keys('id', 'role');
    check({ id: 1, name: 'Ada' }).to.have.keys({ id: 0, name: 'ignored' });
    check({ id: 1 }).to.have.any.keys('id', 'missing');
    check(new Map([[{ id: 1 }, 'value']])).to.have.deep.keys([{ id: 1 }]);
  });

  it('covers numeric, length, matching, member, and predicate chains', () => {
    const check = scriptExpect();
    check(201).to.be.at.least(200).and.below(300).and.within(200, 299);
    check(9.99).to.be.closeTo(10, 0.02);
    check('ready').to.match(/^rea/).and.contain('ead');
    check('ready').to.have.lengthOf(5);
    check('ready').to.have.lengthOf.above(4);
    check([{ id: 1 }, { id: 2 }]).to.have.deep.members([{ id: 2 }, { id: 1 }]);
    check(['ready', 'sent', 'received']).to.include.ordered.members(['ready', 'sent']);
    check(201).to.be.oneOf([200, 201]).and.satisfy((status: number) => status >= 200);
  });

  it('covers throws, responses, object state, mutation chains, and aliases', () => {
    const check = scriptExpect();
    check(() => { throw new TypeError('boom'); }).to.throw(TypeError, /boom/).that.has.property('message', 'boom');
    check(Map).to.respondTo('get');
    check(Object.freeze({ ok: true })).to.be.frozen.and.sealed;
    check(2).to.be.finite;

    const counter = { value: 1 };
    check(() => { counter.value += 2; }).to.increase(counter, 'value').by(2);
    let getterValue = 3;
    check(() => { getterValue -= 1; }).to.decrease(() => getterValue).by(1);

    check({ id: 1 }).toEqual({ id: 1 });
    check(['one', 'two']).toContain('two');
    check(3).toBeGreaterThan(2);
    check(3).to.not.eq(2);
  });

  it('preserves custom errors and static failure behavior', () => {
    const check = scriptExpect();
    expect(() => check(500, 'status mismatch').to.equal(200)).toThrow('status mismatch');
    expect(() => check.fail('explicit failure')).toThrow('explicit failure');
  });
});
