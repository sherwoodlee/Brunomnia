type TemplateValue = string | number | boolean | null | undefined | TemplateValue[] | { [key: string]: TemplateValue };

const maxTemplateLength = 8192;
const maxVariables = 100;
const maxOutputLength = 32768;
const operators = '+#./;?&';
const reserved = ":/?#[]@!$&'()*+,;=";

const encode = (value: string, allowReserved: boolean) => {
  let encoded = encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  if (allowReserved) {
    for (const character of reserved) {
      const code = `%${character.charCodeAt(0).toString(16).toUpperCase()}`;
      encoded = encoded.replace(new RegExp(code, 'gi'), character);
    }
  }
  return encoded;
};

const expressions = (template: string) => {
  if (!template || template.length > maxTemplateLength) throw new Error('MCP resource URI templates must contain 1–8,192 characters.');
  const values: Array<{ start: number; end: number; source: string }> = [];
  let cursor = 0;
  while (cursor < template.length) {
    const start = template.indexOf('{', cursor);
    const unexpectedClose = template.indexOf('}', cursor);
    if (unexpectedClose >= 0 && (start < 0 || unexpectedClose < start)) throw new Error('MCP resource URI template contains an unmatched closing brace.');
    if (start < 0) break;
    const end = template.indexOf('}', start + 1);
    if (end < 0) throw new Error('MCP resource URI template contains an unclosed expression.');
    const source = template.slice(start + 1, end);
    if (!source || source.includes('{')) throw new Error('MCP resource URI template contains a malformed expression.');
    values.push({ start, end: end + 1, source });
    if (values.length > maxVariables) throw new Error('MCP resource URI templates are limited to 100 expressions.');
    cursor = end + 1;
  }
  return values;
};

type VariableSpec = { name: string; explode: boolean; prefix: number };

const variableSpecs = (source: string): VariableSpec[] => {
  const body = operators.includes(source[0]) ? source.slice(1) : source;
  if (!body) throw new Error('MCP resource URI template expression has no variables.');
  return body.split(',').map((item) => {
    const explode = item.endsWith('*');
    const withoutExplode = explode ? item.slice(0, -1) : item;
    const prefixMatch = /^(.*):(\d+)$/.exec(withoutExplode);
    const name = prefixMatch?.[1] ?? withoutExplode;
    const prefix = prefixMatch ? Number(prefixMatch[2]) : 0;
    if (!/^(?:[A-Za-z0-9_]|%[0-9A-Fa-f]{2})(?:(?:[A-Za-z0-9_.]|%[0-9A-Fa-f]{2}))*$/.test(name)) {
      throw new Error(`MCP resource URI template contains an invalid variable name: ${name || '(empty)'}.`);
    }
    if (explode && prefix) throw new Error('MCP resource URI template variables cannot combine explode and prefix modifiers.');
    if (prefix > 10000) throw new Error('MCP resource URI template prefix modifiers are limited to 10,000 characters.');
    return { name: decodeURIComponent(name), explode, prefix };
  });
};

const scalar = (value: TemplateValue) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
const objectValue = (value: TemplateValue): value is { [key: string]: TemplateValue } => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const settings = (operator: string) => ({
  prefix: operator === '#' ? '#' : operator === '.' ? '.' : operator === '/' ? '/' : operator === ';' ? ';' : operator === '?' ? '?' : operator === '&' ? '&' : '',
  separator: operator === '.' ? '.' : operator === '/' ? '/' : operator === ';' ? ';' : operator === '?' || operator === '&' ? '&' : ',',
  named: operator === ';' || operator === '?' || operator === '&',
  allowReserved: operator === '+' || operator === '#',
  empty: operator === ';' ? '' : '=',
});

const expandVariable = (spec: VariableSpec, value: TemplateValue, operator: string) => {
  const config = settings(operator);
  const encodedName = encode(spec.name, false);
  if (value === undefined || value === null) return [];
  if (scalar(value)) {
    const source = String(value);
    const encoded = encode(spec.prefix ? [...source].slice(0, spec.prefix).join('') : source, config.allowReserved);
    if (!config.named) return [encoded];
    return [encoded ? `${encodedName}=${encoded}` : `${encodedName}${config.empty}`];
  }
  if (spec.prefix) throw new Error(`MCP resource URI template prefix modifier requires a scalar value for ${spec.name}.`);
  if (Array.isArray(value)) {
    const items = value.filter((item) => scalar(item)).map((item) => encode(String(item), config.allowReserved));
    if (!items.length) return [];
    if (spec.explode) return items.map((item) => config.named ? item ? `${encodedName}=${item}` : `${encodedName}${config.empty}` : item);
    const joined = items.join(',');
    return [config.named ? `${encodedName}=${joined}` : joined];
  }
  if (objectValue(value)) {
    const entries = Object.entries(value).filter(([, item]) => scalar(item)).map(([key, item]) => [encode(key, config.allowReserved), encode(String(item), config.allowReserved)] as const);
    if (!entries.length) return [];
    if (spec.explode) return entries.map(([key, item]) => item || operator !== ';' ? `${key}=${item}` : key);
    const joined = entries.flat().join(',');
    return [config.named ? `${encodedName}=${joined}` : joined];
  }
  return [];
};

const expandExpression = (source: string, values: Record<string, unknown>) => {
  const operator = operators.includes(source[0]) ? source[0] : '';
  const config = settings(operator);
  const parts = variableSpecs(source).flatMap((spec) => expandVariable(spec, values[spec.name] as TemplateValue, operator));
  return parts.length ? `${config.prefix}${parts.join(config.separator)}` : '';
};

export const mcpUriTemplateVariables = (template: string) => {
  const variables = expressions(template).flatMap(({ source }) => variableSpecs(source).map((spec) => spec.name));
  return [...new Set(variables)].slice(0, maxVariables);
};

export const expandMcpUriTemplate = (template: string, values: Record<string, unknown>) => {
  let output = '';
  let cursor = 0;
  for (const expression of expressions(template)) {
    output += template.slice(cursor, expression.start);
    output += expandExpression(expression.source, values);
    cursor = expression.end;
    if (output.length > maxOutputLength) throw new Error('Expanded MCP resource URI exceeds 32,768 characters.');
  }
  output += template.slice(cursor);
  if (output.length > maxOutputLength) throw new Error('Expanded MCP resource URI exceeds 32,768 characters.');
  return output;
};
