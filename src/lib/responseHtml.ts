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

type ResponseHtmlPreviewOptions = {
  allowRemoteResources: boolean;
  allowScripts: boolean;
  requestUrl?: string;
};

export const responseHtmlPreview = (body: string, { allowRemoteResources, allowScripts, requestUrl }: ResponseHtmlPreviewOptions) => {
  const baseUrl = responseHtmlBaseUrl(requestUrl);
  const basePolicy = baseUrl ? 'base-uri http: https:' : "base-uri 'none'";
  const remoteSources = allowRemoteResources ? ' http: https:' : '';
  const activeNetwork = allowScripts && allowRemoteResources;
  const policy = [
    "default-src 'none'",
    ...(allowScripts ? [`script-src 'unsafe-inline'${remoteSources}`] : []),
    `style-src 'unsafe-inline'${remoteSources}`,
    `img-src data: blob:${remoteSources}`,
    `font-src data: blob:${remoteSources}`,
    allowRemoteResources ? 'media-src data: blob: http: https:' : "media-src 'none'",
    allowRemoteResources ? 'frame-src http: https:' : "frame-src 'none'",
    activeNetwork ? 'connect-src http: https: ws: wss:' : "connect-src 'none'",
    activeNetwork ? 'worker-src blob: http: https:' : "worker-src 'none'",
    "object-src 'none'",
    basePolicy,
    "form-action 'none'",
  ].join('; ');
  const base = baseUrl ? `<base href="${escapeAttribute(baseUrl)}">` : '';
  return {
    baseUrl,
    document: `<meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer">${base}${body}`,
    sandbox: allowScripts ? 'allow-scripts' : '',
  };
};
