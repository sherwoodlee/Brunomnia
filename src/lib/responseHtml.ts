const SAFE_POLICY = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";
const SCRIPT_POLICY = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

export const responseHtmlPreview = (body: string, allowScripts: boolean) => {
  const policy = allowScripts ? SCRIPT_POLICY : SAFE_POLICY;
  return {
    document: `<meta http-equiv="Content-Security-Policy" content="${policy}">${body}`,
    sandbox: allowScripts ? 'allow-scripts' : '',
  };
};
