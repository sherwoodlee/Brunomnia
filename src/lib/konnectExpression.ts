export type KonnectExpressionFields = {
  methods: string[];
  paths: string[];
  hosts: string[];
  headers: Record<string, string[]>;
};

export type KonnectExpressionResult =
  | { fields: KonnectExpressionFields; reason?: never }
  | { fields?: never; reason: string };

export const extractKonnectExpressionFields = (expression: string): KonnectExpressionFields => {
  const methods = [...new Set([...expression.matchAll(/http\.method\s*==\s*"([A-Z]+)"/g)].map((match) => match[1]))];
  const exactPaths = [...expression.matchAll(/http\.path\s*==\s*"([^"]+)"/g)].map((match) => match[1]);
  const prefixPaths = [...expression.matchAll(/http\.path\s*\^=\s*"([^"]+)"/g)].map((match) => match[1]);
  const hosts = [...new Set([...expression.matchAll(/http\.host\s*==\s*"([^"]+)"/g)].map((match) => match[1]))];
  const headers: Record<string, string[]> = {};
  for (const match of expression.matchAll(/http\.headers\.(\w+)\s*==\s*"([^"]+)"/g)) {
    const name = match[1].replace(/_/g, '-').toLowerCase();
    headers[name] = [...(headers[name] ?? []), match[2]];
  }
  return { methods, paths: [...new Set([...exactPaths, ...prefixPaths])], hosts, headers };
};

export const parseKonnectExpression = (expression: string): KonnectExpressionResult => {
  if (expression.length > 100_000) return { reason: 'Expression route exceeds the 100,000-character safety limit.' };
  if (/\btls\.sni\b/.test(expression)) return { reason: 'Expression route uses tls.sni matching, which request URLs cannot override.' };
  const fields = extractKonnectExpressionFields(expression);
  if (!fields.methods.length && !fields.paths.length && !fields.hosts.length && !Object.keys(fields.headers).length) {
    return { reason: 'Expression route has no extractable method, path, host, or header fields.' };
  }
  return { fields };
};
