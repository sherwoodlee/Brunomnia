import type { HttpResponse } from '../types';

export type ResponseBodyArtifact = { contents: string; fileName: string; mimeType: string };

const contentType = (response: HttpResponse) => Object.entries(response.headers)
  .find(([name]) => name.toLowerCase() === 'content-type')?.[1]
  .split(';')[0]
  .trim()
  .toLowerCase() || 'text/plain';

const extension = (mimeType: string) => mimeType.includes('json') ? 'json'
  : mimeType.includes('xml') ? 'xml'
    : mimeType.includes('html') ? 'html'
      : mimeType.includes('csv') ? 'csv'
        : /ya?ml/.test(mimeType) ? 'yaml'
          : 'txt';

const safeName = (value: string) => value.trim().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/gi, '_').replace(/_+/g, '_').slice(0, 120) || 'response';

export const createResponseBodyArtifact = (
  requestName: string,
  response: HttpResponse,
  prettify = false,
  timestamp = Date.now(),
): ResponseBodyArtifact => {
  const mimeType = contentType(response);
  let contents = response.body;
  if (prettify && mimeType.includes('json')) {
    try { contents = JSON.stringify(JSON.parse(contents), null, 2); } catch { /* retain raw invalid JSON */ }
  }
  return { contents, fileName: `${safeName(requestName)}-${timestamp}.${extension(mimeType)}`, mimeType };
};

export const downloadResponseBody = (requestName: string, response: HttpResponse, prettify = false) => {
  const artifact = createResponseBodyArtifact(requestName, response, prettify);
  const url = URL.createObjectURL(new Blob([artifact.contents], { type: artifact.mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = artifact.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};
