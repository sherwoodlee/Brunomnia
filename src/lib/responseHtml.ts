const escapeAttribute = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

export const responseHtmlBaseUrl = (value: string | undefined) => {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
};

export const responseHtmlPreview = (body: string, allowScripts: boolean, requestUrl?: string) => {
  const baseUrl = responseHtmlBaseUrl(requestUrl);
  const basePolicy = baseUrl ? 'base-uri http: https:' : "base-uri 'none'";
  const policy = allowScripts
    ? `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; ${basePolicy}; form-action 'none'`
    : `default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; object-src 'none'; ${basePolicy}; form-action 'none'`;
  const base = baseUrl ? `<base href="${escapeAttribute(baseUrl)}">` : '';
  return {
    baseUrl,
    document: `<meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer">${base}${body}`,
    sandbox: allowScripts ? 'allow-scripts' : '',
  };
};
