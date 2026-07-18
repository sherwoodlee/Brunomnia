const utf8Decoder = new TextDecoder();

export const detectedResponseContentType = (originalContentType: string, bytes: Uint8Array) => {
  if (!bytes.byteLength) return originalContentType;
  try {
    JSON.parse(utf8Decoder.decode(bytes));
    return 'application/json';
  } catch { /* inspect the bounded HTML prefix next */ }

  try {
    const prefix = utf8Decoder.decode(bytes.subarray(0, 100)).trim();
    if (!originalContentType.toLowerCase().startsWith('text/html') && /^<!doctype html.*>/i.test(prefix)) return 'text/html';
  } catch { /* preserve the declared type */ }
  return originalContentType;
};
